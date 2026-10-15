/** Pure, bounded logical-time velocity tracking experiment. Simulation only. */
import { createVelocityReference } from './velocity-reference.mjs';
import { dampedJointVelocity, SPATIAL_JOINTS } from './arm-differential.mjs';
import { GEOMETRY, LEGACY_MODEL_REVISION, forwardKinematics } from '../kinematics.mjs';

const JOINTS = [...SPATIAL_JOINTS];
const INITIAL = Object.freeze({ base: 0.2, shoulder: 0.3, elbow: 1.1 });
const GRIPPER = 0.5;
const DT = 10, DECISION = 50, LAST_DECISION = 9950, END = 10000;
const LAG = 0.15, STALE_MS = 200, MAX_AGE_MS = 100, MAX_PENDING = 256, MAX_TRACE = 3000;
const POS_LIMITS = Object.freeze({
  base: { min: -0.30, max: 0.70, velocity: 0.12, acceleration: 0.5, jerk: 4 },
  shoulder: { min: 0.05, max: 0.65, velocity: 0.12, acceleration: 0.5, jerk: 4 },
  elbow: { min: 0.65, max: 1.55, velocity: 0.12, acceleration: 0.5, jerk: 4 },
});
const REF_LIMITS = Object.freeze(Object.fromEntries(JOINTS.map(j => [j, {
  position: [POS_LIMITS[j].min, POS_LIMITS[j].max], velocityAbs: POS_LIMITS[j].velocity,
  accelerationAbs: POS_LIMITS[j].acceleration, jerkAbs: POS_LIMITS[j].jerk,
}])));
const clone = v => structuredClone(v);
const norm = v => Math.hypot(...v);
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const scale = (v, k) => v.map(x => x * k);
const vec3 = (value, name, min = -Infinity, max = Infinity) => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 3 || Reflect.ownKeys(value).length !== 4) throw new TypeError(`${name} must be a dense three-element array`);
  const ds = Object.getOwnPropertyDescriptors(value);
  const out = [0, 1, 2].map(i => {
    const d = ds[String(i)];
    if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) throw new TypeError(`${name}[${i}] must be an enumerable data element`);
    const x = d.value;
    if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max) throw new RangeError(`${name}[${i}] must be finite in [${min}, ${max}]`);
    return Object.is(x, -0) ? 0 : x;
  });
  return out;
};
const stateConfig = () => ({
  initialJointPositions: { ...INITIAL }, limits: clone(REF_LIMITS), dtMs: DT,
  maxRunDurationMs: END, minDurationMs: 500, maxDurationMs: 2000, durationStepMs: 50, maxCommands: 250,
});
const fk = p => { const v = forwardKinematics({ ...p, gripper: GRIPPER }, LEGACY_MODEL_REVISION); return [v.x, v.y, v.z]; };

export function createVelocityLiveLab(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be a plain data record');
  const optionsPrototype = Object.getPrototypeOf(options);
  if (optionsPrototype !== Object.prototype && optionsPrototype !== null) throw new TypeError('options must be a plain data record');
  const optionDescriptors = Object.getOwnPropertyDescriptors(options);
  const optionKeys = Reflect.ownKeys(optionDescriptors);
  if (optionKeys.length !== 0) throw new TypeError('createVelocityLiveLab has fixed configuration and accepts no option fields');
  const reference = createVelocityReference(stateConfig());
  const origin = fk(INITIAL);
  let timeMs = 0, stepCount = 0, terminal = null, disposed = false;
  let offset = [20, -15, 10], usedOffset = null, targetRevision = 0, committedRevision = 0, coalescedEdits = 0, targetEdits = 0;
  let latencyMs = 20, dropEvery = 0, faultEdits = 0, acquisitionCount = 0, droppedCount = 0, rejectedDeliveryCount = 0;
  let latest = { acquiredAtMs: 0, deliveredAtMs: 0, position: { ...INITIAL }, provenance: 'seeded-initial-q0', disposition: 'accepted' };
  let lastUsedAcquiredAtMs = null, pending = [], plant = { ...INITIAL }, lastDeliveryDisposition = 'seeded-initial-q0';
  let plantV = Object.fromEntries(JOINTS.map(j => [j, 0]));
  let plantA = Object.fromEntries(JOINTS.map(j => [j, 0]));
  let plantJ = Object.fromEntries(JOINTS.map(j => [j, 0]));
  const violations = { position: 0, velocity: 0, acceleration: 0, jerk: 0 };
  const counts = { accepted: 0, rejected: 0, staleInterrupts: 0, acceptedBrakes: 0, unresolvedBrakes: 0 };
  const history = [];
  function push(row) {
    if (history.length >= MAX_TRACE) { terminal = terminal ?? { reason: 'trace-cap-exceeded', atTimeMs: timeMs }; throw new RangeError('trace cap reached'); }
    history.push({ sequence: history.length, ...row });
  }
  const refSnap = () => reference.snapshot();
  const plantSnap = () => ({ position: { ...plant }, velocity: { ...plantV }, acceleration: { ...plantA }, jerk: { ...plantJ }, limitViolations: { ...violations } });
  function observationSnap() {
    return { ...clone(latest), ageMs: timeMs - latest.acquiredAtMs, pendingCount: pending.length,
      pending: pending.map(x => ({ acquiredAtMs: x.acquiredAtMs, scheduledDeliveryAtMs: x.scheduledDeliveryAtMs, provenance: x.provenance })),
      droppedCount, rejectedDeliveryCount, lastDeliveryDisposition };
  }
  function targetSnap(which = offset) { return { offsetMm: [...which], xyzMm: add(origin, which) }; }
  function recordInterrupt(reason, eventType = 'interrupt') {
    const before = refSnap();
    const result = reference.interrupt(reason);
    const after = refSnap();
    if (result.accepted && before.status !== 'holding' && before.status !== 'holding-interrupted') counts.acceptedBrakes += 1;
    if (!result.accepted) counts.unresolvedBrakes += 1;
    if (eventType === 'stale-observation') counts.staleInterrupts += 1;
    push({ kind: 'reference-interrupt', timeMs, eventType, reason, accepted: result.accepted, outcome: after.brakeResolution?.outcome ?? null,
      qvaPreserved: JOINTS.every(j => ['position','velocity','acceleration'].every(k => before.currentReference[j][k] === after.currentReference[j][k])),
      referenceBefore: before, referenceAfter: after });
    return result;
  }
  function decide(forcedReason = null) {
    const pre = refSnap(), obs = clone(latest), age = timeMs - obs.acquiredAtMs;
    const target = targetSnap(offset), tip = fk(obs.position), error = sub(target.xyzMm, tip), errorNorm = norm(error);
    let reasonCode = forcedReason;
    const reach = norm(target.xyzMm), maxReach = GEOMETRY.l2 + GEOMETRY.l3;
    const radius = { accepted: reach <= maxReach, targetRadiusMm: reach, necessaryMaximumReachMm: maxReach,
      reachabilityClassification: reach <= maxReach ? 'within necessary radius; reachability unknown' : 'outside necessary maximum-radius test' };
    if (!reasonCode && !radius.accepted) reasonCode = 'outside-necessary-max-reach-radius';
    else if (!reasonCode && age > MAX_AGE_MS) reasonCode = 'observation-age-over-100ms';
    else if (!reasonCode && lastUsedAcquiredAtMs !== null && obs.acquiredAtMs <= lastUsedAcquiredAtMs) reasonCode = 'observation-not-new';
    else if (!reasonCode && refSnap().intentLatched) reasonCode = 'tracking-intent-expired';
    let rawTask = null, cappedTask = null, diff = null, result = null, post = pre, splice = null;
    if (!reasonCode) {
      rawTask = scale(error, 0.5);
      const n = norm(rawTask); cappedTask = scale(rawTask, n > 15 ? 15 / n : 1);
      try {
        diff = dampedJointVelocity({ ...obs.position, gripper: GRIPPER }, cappedTask,
          { modelRevision: LEGACY_MODEL_REVISION, dampingMm: 15, maxJointVelocity: 0.08 });
        // The differential joint velocity is passed through directly; no position increment is synthesized.
        result = reference.retarget(diff.jointVelocityRadPerSecond);
        post = refSnap();
        if (result.accepted) {
          counts.accepted += 1;
          const segs = result.search.segments;
          const perJoint = Object.fromEntries(JOINTS.map(j => [j, {
            positionRad: Math.abs(segs[j].start.position - pre.currentReference[j].position),
            velocityRadPerSecond: Math.abs(segs[j].start.velocity - pre.currentReference[j].velocity),
            accelerationRadPerSecondSquared: Math.abs(segs[j].start.acceleration - pre.currentReference[j].acceleration),
          }]));
          splice = { perJoint, max: Object.fromEntries(['positionRad','velocityRadPerSecond','accelerationRadPerSecondSquared'].map(k => [k, Math.max(...JOINTS.map(j => perJoint[j][k]))])) };
        } else reasonCode = result.search?.status ?? 'retarget-rejected';
      } catch (e) { reasonCode = 'differential-or-reference-error'; diff = diff ?? null; }
    }
    if (reasonCode) counts.rejected += 1;
    lastUsedAcquiredAtMs = obs.acquiredAtMs;
    usedOffset = [...offset]; committedRevision = targetRevision;
    push({ kind: 'decision', timeMs, status: reasonCode ? 'rejected' : 'accepted', reasonCode,
      targetRevision, coalescedEdits, target: clone(target), observation: obs, observationAgeMs: age, observedTipMm: tip,
      cartesianErrorMm: error, cartesianErrorNormMm: errorNorm, necessaryRadiusGate: radius,
      taskVelocityRawMmPerSecond: rawTask, taskVelocityCappedMmPerSecond: cappedTask,
      differential: diff, proposedJointVelocityRadPerSecond: diff ? clone(diff.jointVelocityRadPerSecond) : null,
      referencePre: pre, referencePost: post, retarget: result ? { accepted: result.accepted, durationMs: result.durationMs ?? null, reason: result.reason ?? null } : null,
      acceptedSegments: result?.accepted && result.search ? clone(result.search.segments) : null, spliceResiduals: splice,
      plant: plantSnap() });
    coalescedEdits = 0;
  }
  push({ kind: 'initialization', timeMs: 0, simulationOnly: true, hypothetical: true, pose: { ...INITIAL, gripper: GRIPPER },
    originMm: [...origin], target: targetSnap(), observation: clone(latest), reference: refSnap(), plant: plantSnap(), physicalMovementVerified: false });
  decide();

  function ensureActive() { if (disposed) throw new Error('velocity live lab is disposed'); if (terminal) throw new Error(`velocity live lab is terminal: ${terminal.reason}`); }
  function setTargetOffsetMm(value) {
    ensureActive();
    const next = vec3(value, 'targetOffsetMm', -30, 30);
    if (timeMs >= 9500 || refSnap().intentLatched) throw new Error('target intent has expired; offset was not changed');
    if (targetEdits >= 1000) throw new RangeError('target edit cap of 1000 reached');
    targetEdits += 1; targetRevision += 1; if (targetRevision - committedRevision > 1) coalescedEdits += 1;
    offset = next;
    return snapshot();
  }
  function setFaults(patch) {
    ensureActive();
    if (timeMs >= 9500) throw new Error('finite intent has expired; fault settings were not changed');
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || ![Object.prototype, null].includes(Object.getPrototypeOf(patch))) throw new TypeError('fault patch must be a plain record');
    const ds = Object.getOwnPropertyDescriptors(patch), keys = Reflect.ownKeys(ds);
    if (keys.some(k => typeof k !== 'string' || !['latencyMs','dropEvery'].includes(k))) throw new TypeError('fault patch contains unknown fields');
    if (keys.length !== 2 || !keys.includes('latencyMs') || !keys.includes('dropEvery')) throw new TypeError('fault patch must provide both latencyMs and dropEvery');
    for (const k of keys) if (!('value' in ds[k]) || !ds[k].enumerable) throw new TypeError(`fault patch.${String(k)} must be enumerable data`);
    const nextLatency = Object.hasOwn(ds, 'latencyMs') ? ds.latencyMs.value : latencyMs;
    const nextDrop = Object.hasOwn(ds, 'dropEvery') ? ds.dropEvery.value : dropEvery;
    if (![20,100,180].includes(nextLatency) || ![0,2].includes(nextDrop)) throw new RangeError('latencyMs must be 20, 100, or 180 and dropEvery must be 0 or 2');
    if (faultEdits >= 100) throw new RangeError('fault patch cap of 100 reached');
    latencyMs = nextLatency; dropEvery = nextDrop; faultEdits += 1;
    return snapshot();
  }
  function interrupt(reason = 'user interrupted velocity tracking') {
    if (disposed) return snapshot();
    if (refSnap().intentLatched) return snapshot();
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 240) throw new TypeError('reason must be a nonempty string up to 240 characters');
    const result = recordInterrupt(reason, 'user-interrupt');
    return { ...snapshot(), interruptAccepted: result.accepted };
  }
  function deliverDue() {
    const due = pending.filter(x => x.scheduledDeliveryAtMs <= timeMs)
      .sort((a,b) => a.scheduledDeliveryAtMs-b.scheduledDeliveryAtMs || a.acquiredAtMs-b.acquiredAtMs || a.ordinal-b.ordinal);
    pending = pending.filter(x => x.scheduledDeliveryAtMs > timeMs);
    const delivered = [];
    for (const sample of due) {
      const age = timeMs - sample.acquiredAtMs;
      if (sample.acquiredAtMs <= latest.acquiredAtMs || age > STALE_MS) {
        rejectedDeliveryCount += 1; lastDeliveryDisposition = 'rejected-older-or-stale';
        delivered.push({ ...clone(sample), deliveredAtMs: timeMs, disposition: lastDeliveryDisposition });
      } else {
        latest = { ...sample, deliveredAtMs: timeMs, disposition: 'accepted' };
        lastDeliveryDisposition = 'accepted';
        delivered.push(clone(latest));
      }
    }
    return delivered;
  }
  function step() {
    ensureActive();
    if (stepCount >= 1000 || timeMs >= END) throw new RangeError('finite 1000-step experiment is complete');
    const nextTime = timeMs + DT;
    const beforeStale = refSnap(), moving = beforeStale.activeSegment !== null || JOINTS.some(j => beforeStale.currentReference[j].velocity !== 0 || beforeStale.currentReference[j].acceleration !== 0);
    if (!beforeStale.intentLatched && moving && nextTime - latest.acquiredAtMs > STALE_MS) recordInterrupt('observation-stale', 'stale-observation');
    const preRef = refSnap(), prePlant = plantSnap();
    try { reference.step(1); }
    catch (e) {
      terminal = { reason: 'reference-step-unresolved', atTimeMs: timeMs, detail: String(e?.message ?? e) };
      push({ kind: 'reference-step-error', timeMs, attemptedNextTimeMs: nextTime, referenceBefore: preRef, referenceAfter: refSnap(), plantNotAdvanced: true, reason: terminal.detail });
      return snapshot();
    }
    timeMs = nextTime; stepCount += 1;
    const rs = refSnap(), alpha = 1 - Math.exp(-(DT / 1000) / LAG), oldV = { ...plantV }, oldA = { ...plantA };
    for (const j of JOINTS) {
      const oldQ = plant[j]; plant[j] += (rs.currentReference[j].position - plant[j]) * alpha;
      plantV[j] = (plant[j] - oldQ) / (DT / 1000); plantA[j] = (plantV[j] - oldV[j]) / (DT / 1000); plantJ[j] = (plantA[j] - oldA[j]) / (DT / 1000);
      const l = POS_LIMITS[j];
      if (plant[j] < l.min - 1e-9 || plant[j] > l.max + 1e-9) violations.position++;
      if (Math.abs(plantV[j]) > l.velocity + 1e-9) violations.velocity++;
      if (Math.abs(plantA[j]) > l.acceleration + 1e-9) violations.acceleration++;
      if (Math.abs(plantJ[j]) > l.jerk + 1e-9) violations.jerk++;
    }
    let acquired = null, dropped = false;
    if (stepCount % 5 === 0) {
      acquisitionCount += 1;
      if (dropEvery === 2 && acquisitionCount % 2 === 0) { dropped = true; droppedCount++; lastDeliveryDisposition = 'dropped-by-configured-fault'; }
      else {
        if (pending.length >= MAX_PENDING) throw new RangeError('pending observation cap reached');
        acquired = { acquiredAtMs: timeMs, scheduledDeliveryAtMs: timeMs + latencyMs, position: { ...plant }, provenance: 'synthetic-plant-sample', hypothetical: true, ordinal: acquisitionCount };
        pending.push(acquired);
      }
    }
    const deliveries = deliverDue();
    push({ kind: 'simulation-step', timeMs, internalOrder: 'stale-gate,reference,plant,acquire,deliver,decision', referencePre: preRef, referencePost: rs,
      plantPre: prePlant, plantPost: plantSnap(), observation: observationSnap(), newlyAcquiredObservation: acquired ? clone(acquired) : null,
      newlyDeliveredObservations: deliveries, dropped, pendingObservationCount: pending.length });
    if (timeMs === 9500) {
      if (!refSnap().intentLatched) recordInterrupt('finite tracking intent expired', 'explicit-tracking-expiry');
      decide('tracking-intent-expired');
    } else if (timeMs <= LAST_DECISION && timeMs % DECISION === 0) decide();
    if (timeMs === END) terminal = { reason: refSnap().status === 'brake-unresolved' ? 'finite-cutoff-brake-unresolved' : 'finite-cutoff-at-10000ms', atTimeMs: timeMs };
    return snapshot();
  }
  function snapshot(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('snapshot options must be a record');
    const ds = Object.getOwnPropertyDescriptors(options), keys = Reflect.ownKeys(ds);
    if (keys.some(k => k !== 'includeHistory') || keys.some(k => !('value' in ds[k]) || !ds[k].enumerable)) throw new TypeError('snapshot accepts only includeHistory data option');
    const includeHistory = Object.hasOwn(ds, 'includeHistory') ? ds.includeHistory.value : false;
    if (typeof includeHistory !== 'boolean') throw new TypeError('includeHistory must be boolean');
    const r = refSnap(), obs = observationSnap(), obsTip = fk(obs.position), requested = targetSnap(offset), modeledError = sub(requested.xyzMm, fk(plant));
    return { timeMs, stepCount, status: terminal?.reason ?? (disposed ? 'disposed' : r.status), terminal: terminal ? clone(terminal) : null,
      reference: r, plant: plantSnap(), observation: obs, originMm: [...origin], target: requested,
      usedTarget: usedOffset ? targetSnap(usedOffset) : null, observationTipMm: obsTip,
      observationErrorMm: sub(requested.xyzMm, obsTip), modeledPlantErrorMm: modeledError,
      targetRevision, committedRevision, coalescedEdits, targetEditCount: targetEdits,
      faultSettings: { latencyMs, dropEvery, acceptedPatchCount: faultEdits, pendingCount: pending.length },
      decisionCount: counts.accepted + counts.rejected, acceptedRetargetCount: counts.accepted, rejectedRetargetCount: counts.rejected,
      staleInterruptCount: counts.staleInterrupts, acceptedBrakeCount: counts.acceptedBrakes, unresolvedBrakeCount: counts.unresolvedBrakes,
      positionLimits: clone(POS_LIMITS), plantLimitChecks: Object.fromEntries(JOINTS.map(j => [j, {
        positionWithin: plant[j] >= POS_LIMITS[j].min && plant[j] <= POS_LIMITS[j].max,
        velocityWithin: Math.abs(plantV[j]) <= POS_LIMITS[j].velocity,
        accelerationWithin: Math.abs(plantA[j]) <= POS_LIMITS[j].acceleration,
        jerkWithin: Math.abs(plantJ[j]) <= POS_LIMITS[j].jerk,
      }])), simulationOnly: true, hypothetical: true, physicalMovementVerified: false, physicalCertificate: false,
      ...(includeHistory ? { history: clone(history) } : {}),
    };
  }
  function dispose() {
    if (!disposed) { disposed = true; push({ kind: 'disposal', timeMs, reference: refSnap(), plant: plantSnap(), statePreserved: true }); }
    return snapshot();
  }
  return Object.freeze({ setTargetOffsetMm, setFaults, step, interrupt, snapshot, dispose });
}
