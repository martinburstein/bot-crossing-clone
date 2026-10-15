/**
 * Disconnected, deterministic soft-real-time robot-arm experiment candidate.
 *
 * API: createLab(options) -> { send(target, { durationMs? }), step(count?),
 *   interrupt(reason?), reset(), setFaults(patch), snapshot({includeHistory}), dispose() }.
 * Joint names and units are caller-defined (the example convention is radians).
 * Options: initial, limits, dtMs, lagSeconds, observationEverySteps, latencyMs,
 * jitterMs, noise, seed, staleAfterMs, maxDurationMs, maxQueuedSamples,
 * maxStoredSamples, maxStoredEvents, maxCommands, maxRunDurationMs. Durations are rounded upward
 * to a whole fixed step; the exact analytical minimum is returned separately.
 * At most 32 joints are accepted; configured limits apply as measured simulation
 * limits, and violations are counted rather than hidden by clipping the plant.
 * `step`/default snapshots omit trace arrays; request `snapshot({includeHistory:true})`
 * for bounded stored samples/events. `reset` restores the original seed, pose,
 * fault settings, clock, counters and buffers; it resets the simulation only.
 * Options require `initial` and per-joint `limits` entries {min,max,velocity,
 * acceleration,jerk}; see DEFAULTS below. `send` accepts one target only while
 * idle. There is no pending queue: a target while a trajectory is active is
 * rejected. Calls are synchronous and deterministic; the host must call step.
 *
 * This is an uncalibrated first-order setpoint-lag model, not identified robot
 * physics. Observation times are simulated milliseconds, never wall-clock or
 * hardware timestamps. Quintic jerk is bounded but jumps at rest boundaries.
 * Interrupt freezes the generated reference at its current value; the lagging
 * plant can continue settling toward that value. It is not a physical stop.
 */

import {createOnlineReference} from './online-reference.mjs';

const DEFAULTS = Object.freeze({
  referenceMode: 'rest-to-rest',
  dtMs: 10,
  lagSeconds: 0.15,
  observationEverySteps: 5,
  latencyMs: 20,
  jitterMs: 0,
  noise: 0,
  seed: 1,
  staleAfterMs: 500,
  maxDurationMs: 120_000,
  maxRunDurationMs: 300_000,
  maxQueuedSamples: 128,
  maxStoredSamples: 2_000,
  maxStoredEvents: 500,
  maxCommands: 1_000
});

const CONFIG_KEYS = Object.freeze(['referenceMode', 'dtMs', 'lagSeconds', 'observationEverySteps', 'latencyMs', 'jitterMs', 'noise', 'seed',
  'staleAfterMs', 'maxDurationMs', 'maxRunDurationMs', 'maxQueuedSamples', 'maxStoredSamples', 'maxStoredEvents', 'maxCommands']);

const own = (x, k) => Object.prototype.hasOwnProperty.call(x, k);
const finite = (x, name) => {
  if (!Number.isFinite(x)) throw new TypeError(`${name} must be finite`);
  return x;
};
const positive = (x, name) => {
  finite(x, name);
  if (x <= 0) throw new RangeError(`${name} must be positive`);
  return x;
};
const nonnegative = (x, name) => {
  finite(x, name);
  if (x < 0) throw new RangeError(`${name} must be nonnegative`);
  return x;
};
const copy = x => structuredClone(x);

/** Quintic rest-to-rest position fraction and analytic derivatives in u. */
export function quinticProgress(u) {
  finite(u, 'u');
  if(u<0||u>1)throw new RangeError('u must be within normalized trajectory time 0..1');
  const u2 = u * u, u3 = u2 * u, u4 = u3 * u, u5 = u4 * u;
  return {
    position: 10 * u3 - 15 * u4 + 6 * u5,
    d1: 30 * u2 - 60 * u3 + 30 * u4,
    d2: 60 * u - 180 * u2 + 120 * u3,
    d3: 60 - 360 * u + 360 * u2
  };
}

/** Per-joint exact conservative duration lower bound for the required profile. */
export function minimumDurationMs(start, target, limits) {
  const names = Object.keys(start ?? {});
  if (!names.length || names.length !== Object.keys(target ?? {}).length || names.length !== Object.keys(limits ?? {}).length)
    throw new TypeError('start, target and limits must have the same nonempty joint keys');
  let seconds = 0;
  for (const j of names) {
    const delta = Math.abs(finite(target[j], `${j}.target`) - finite(start[j], `${j}.start`));
    const lim = limits[j];
    if (!lim) throw new TypeError(`missing limits for ${j}`);
    seconds = Math.max(seconds,
      1.875 * delta / positive(lim.velocity, `${j}.velocity`),
      Math.sqrt((10 / Math.sqrt(3)) * delta / positive(lim.acceleration, `${j}.acceleration`)),
      Math.cbrt(60 * delta / positive(lim.jerk, `${j}.jerk`)));
  }
  if(!Number.isFinite(seconds*1000))throw new RangeError('Trajectory duration exceeds finite numeric range');
  return seconds * 1000;
}

/** Create a deterministic fixed-step simulation. Imports pure math only; no timers or I/O.
 * referenceMode='online-c2' permits midflight reference replans and attempts a
 * smooth reference brake on interruption. The default preserves the original
 * rest-to-rest/abrupt-freeze baseline. No option changes physical control.
 */
export function createLab(options = {}) {
  if (!options || typeof options !== 'object') throw new TypeError('options must be an object');
  for (const k of Object.keys(options)) if (!['initial', 'limits', ...CONFIG_KEYS].includes(k)) throw new TypeError(`unknown option: ${k}`);
  const cfg = { ...DEFAULTS };
  for (const k of CONFIG_KEYS) if (own(options, k)) cfg[k] = options[k];
  if (!['rest-to-rest','online-c2'].includes(cfg.referenceMode)) throw new RangeError('unknown referenceMode');
  const initial = options.initial && copy(options.initial);
  const limits = options.limits && copy(options.limits);
  if (!initial || !limits || typeof initial !== 'object' || typeof limits !== 'object')
    throw new TypeError('initial and per-joint limits are required');
  const joints = Object.keys(initial);
  if (!joints.length || joints.length > 32 || joints.length !== Object.keys(limits).length || joints.some(j => !own(limits, j)))
    throw new TypeError('initial and limits must have the same nonempty joint keys');
  for (const [name, value] of Object.entries({
    dtMs: positive(cfg.dtMs, 'dtMs'), lagSeconds: positive(cfg.lagSeconds, 'lagSeconds'),
    observationEverySteps: positive(cfg.observationEverySteps, 'observationEverySteps'),
    staleAfterMs: positive(cfg.staleAfterMs, 'staleAfterMs'), maxDurationMs: positive(cfg.maxDurationMs, 'maxDurationMs'),
    maxRunDurationMs: positive(cfg.maxRunDurationMs, 'maxRunDurationMs'),
    maxQueuedSamples: positive(cfg.maxQueuedSamples, 'maxQueuedSamples'), maxStoredSamples: positive(cfg.maxStoredSamples, 'maxStoredSamples'),
    maxStoredEvents: positive(cfg.maxStoredEvents, 'maxStoredEvents'), maxCommands: positive(cfg.maxCommands, 'maxCommands')
  })) if (Number.isInteger(value) === false && name !== 'lagSeconds' && name !== 'staleAfterMs' && name !== 'maxDurationMs' && name !== 'maxRunDurationMs')
    throw new TypeError(`${name} must be an integer`);
  if (cfg.dtMs < 1 || cfg.dtMs > 100) throw new RangeError('dtMs must be from 1 to 100');
  if (cfg.lagSeconds > 60 || cfg.staleAfterMs > 60_000 || cfg.maxDurationMs > 120_000 || cfg.maxRunDurationMs > 600_000)
    throw new RangeError('lag, freshness and duration settings exceed finite experiment caps');
  if (cfg.observationEverySteps > 10_000 || cfg.maxQueuedSamples > 256 || cfg.maxStoredSamples > 5_000 || cfg.maxStoredEvents > 2_000 || cfg.maxCommands > 10_000)
    throw new RangeError('step, queue, history or command setting exceeds finite experiment caps');
  nonnegative(cfg.latencyMs, 'latencyMs'); nonnegative(cfg.jitterMs, 'jitterMs'); nonnegative(cfg.noise, 'noise');
  if (cfg.latencyMs > 60_000 || cfg.jitterMs > 60_000 || cfg.noise > 10) throw new RangeError('latency or noise exceeds finite experiment caps');
  if (cfg.maxRunDurationMs < cfg.dtMs) throw new RangeError('maxRunDurationMs must allow at least one step');
  finite(cfg.seed, 'seed');
  if (!Number.isInteger(cfg.seed) || cfg.seed < 0 || cfg.seed > 0xffff_ffff) throw new RangeError('seed must be an unsigned 32-bit integer');
  if (cfg.jitterMs > cfg.latencyMs) throw new RangeError('jitterMs cannot exceed latencyMs');

  const q = Object.fromEntries(joints.map(j => [j, finite(initial[j], `${j}.initial`)]));
  if (joints.some(j => Math.abs(q[j]) > 1_000_000)) throw new RangeError('initial values exceed numeric experiment caps');
  const plant = { ...q };
  const ref = { position: { ...q }, velocity: Object.fromEntries(joints.map(j => [j, 0])),
    acceleration: Object.fromEntries(joints.map(j => [j, 0])), jerk: Object.fromEntries(joints.map(j => [j, 0])) };
  for (const j of joints) {
    const l = limits[j];
    if (!l || !Number.isFinite(l.min) || !Number.isFinite(l.max) || Math.abs(l.min) > 1_000_000 || Math.abs(l.max) > 1_000_000 || l.min > l.max || q[j] < l.min || q[j] > l.max)
      throw new RangeError(`${j} needs valid position limits containing the initial state`);
    for (const k of ['velocity', 'acceleration', 'jerk']) positive(l[k], `${j}.${k}`);
    if (l.velocity > 1_000_000 || l.acceleration > 1_000_000 || l.jerk > 1_000_000_000) throw new RangeError(`${j} dynamic limits exceed numeric experiment caps`);
  }
  const originalInitial = { ...q }, originalCfg = { ...cfg };
  const makePlanner = () => {
    if(cfg.referenceMode!=='online-c2')return null;
    const maxDurationMs=Math.floor(cfg.maxDurationMs/cfg.dtMs)*cfg.dtMs;
    const minDurationMs=Math.min(maxDurationMs,Math.ceil(100/cfg.dtMs)*cfg.dtMs);
    return createOnlineReference({initial:originalInitial,limits,dtMs:cfg.dtMs,maxRunDurationMs:Math.floor(cfg.maxRunDurationMs),
      minDurationMs,maxDurationMs,durationStepMs:Math.max(cfg.dtMs,Math.ceil((maxDurationMs-minDurationMs)/(199*cfg.dtMs))*cfg.dtMs),maxCommands:cfg.maxCommands});
  };
  let planner=makePlanner();
  let simTimeMs = 0, stepNumber = 0, commandNumber = 0, disposed = false, interrupted = false, referenceAbruptions = 0;
  let active = null, rngState = (Math.trunc(cfg.seed) >>> 0) || 0x6d2b79f5;
  const queue = [], samples = [], events = [];
  let lastObservation = { acquiredAtMs: 0, deliveredAtMs: 0, position: { ...plant }, source: 'simulation', hypothetical: true };
  const fault = { dropEvery: 0, freezeEvery: 0, reorderEvery: 0 };
  const newMetrics = () => ({ commands: 0, rejectedCommands: 0, droppedSamples: 0, staleSamples: 0, queueOverflow: 0,
    positionLimitViolations: 0, velocityLimitViolations: 0, accelerationLimitViolations: 0, jerkLimitViolations: 0, referenceAbruptions: 0,
    maxReferenceVelocity: Object.fromEntries(joints.map(j => [j, 0])), maxReferenceAcceleration: Object.fromEntries(joints.map(j => [j, 0])),
    maxReferenceJerk: Object.fromEntries(joints.map(j => [j, 0])),smoothBrakePlans:0,failedBrakePlans:0,replans:0 });
  let metrics = newMetrics();
  let plantVelocity = Object.fromEntries(joints.map(j => [j, 0]));
  let plantAcceleration = Object.fromEntries(joints.map(j => [j, 0]));
  let plantJerk = Object.fromEntries(joints.map(j => [j, 0]));

  const assertOpen = () => { if (disposed) throw new Error('lab is disposed'); };
  const plantSettled = () => joints.every(j => Math.abs(plant[j] - ref.position[j]) <= 1e-3 && Math.abs(plantVelocity[j]) <= 1e-3);
  const rand = () => {
    // xorshift32; deterministic for an identical call sequence and seed.
    let x = rngState; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; rngState = x >>> 0;
    return rngState / 0x1_0000_0000;
  };
  const record = (type, detail = {}) => {
    events.push({ atMs: simTimeMs, type, ...detail });
    if (events.length > cfg.maxStoredEvents) events.shift();
  };
  const observe = () => {
    const n = stepNumber / cfg.observationEverySteps;
    if (fault.dropEvery && Number.isInteger(n / fault.dropEvery)) { metrics.droppedSamples++; return; }
    const acquiredAtMs = simTimeMs;
    let position = Object.fromEntries(joints.map(j => [j, plant[j] + (rand() * 2 - 1) * cfg.noise]));
    if (fault.freezeEvery && Number.isInteger(n / fault.freezeEvery)) {
      position = { ...lastObservation.position };
      record('sample-frozen', { acquiredAtMs });
      // Repeated acquisition time is intentionally recognizable as frozen.
    }
    let latency = cfg.latencyMs + (rand() * 2 - 1) * cfg.jitterMs;
    if (fault.reorderEvery && Number.isInteger(n / fault.reorderEvery)) latency += cfg.dtMs * cfg.observationEverySteps * 2;
    const sample = { acquiredAtMs: fault.freezeEvery && Number.isInteger(n / fault.freezeEvery) ? lastObservation.acquiredAtMs : acquiredAtMs,
      scheduledDeliveryAtMs: simTimeMs + latency, deliveredAtMs: null, position, source: 'simulation', hypothetical: true };
    if (queue.length >= cfg.maxQueuedSamples) { metrics.queueOverflow++; metrics.droppedSamples++; return; }
    queue.push(sample);
  };
  const evaluateReference = () => {
    if (!active) return;
    const u = Math.min(1, active.elapsedMs / active.durationMs), p = quinticProgress(u);
    for (const j of joints) {
      const d = active.delta[j], T = active.durationMs / 1000;
      ref.position[j] = active.start[j] + d * p.position;
      ref.velocity[j] = d * p.d1 / T;
      ref.acceleration[j] = d * p.d2 / (T * T);
      ref.jerk[j] = d * p.d3 / (T * T * T);
      metrics.maxReferenceVelocity[j] = Math.max(metrics.maxReferenceVelocity[j], Math.abs(ref.velocity[j]));
      metrics.maxReferenceAcceleration[j] = Math.max(metrics.maxReferenceAcceleration[j], Math.abs(ref.acceleration[j]));
      metrics.maxReferenceJerk[j] = Math.max(metrics.maxReferenceJerk[j], Math.abs(ref.jerk[j]));
    }
    if (u >= 1) {
      for (const j of joints) { ref.position[j] = active.target[j]; ref.velocity[j] = 0; ref.acceleration[j] = 0; ref.jerk[j] = 0; }
      record('reference-complete', { commandId: active.id }); active = null;
    }
  };
  const advanceOnlineReference = () => {
    const before=active, s=planner.step();
    for(const j of joints){
      for(const key of ['position','velocity','acceleration','jerk'])ref[key][j]=s.state[j][key];
      metrics.maxReferenceVelocity[j]=Math.max(metrics.maxReferenceVelocity[j],Math.abs(ref.velocity[j]));
      metrics.maxReferenceAcceleration[j]=Math.max(metrics.maxReferenceAcceleration[j],Math.abs(ref.acceleration[j]));
      metrics.maxReferenceJerk[j]=Math.max(metrics.maxReferenceJerk[j],Math.abs(ref.jerk[j]));
    }
    active=s.activeMotion;
    if(before&&!active)record('reference-complete',{commandId:before.id,kind:before.kind});
  };
  const deliver = () => {
    const ready = [], waiting = [];
    for (const s of queue) (s.scheduledDeliveryAtMs <= simTimeMs ? ready : waiting).push(s);
    queue.length = 0; queue.push(...waiting);
    ready.sort((a, b) => a.scheduledDeliveryAtMs - b.scheduledDeliveryAtMs);
    for (const s of ready) {
      s.deliveredAtMs = simTimeMs;
      if (s.acquiredAtMs <= lastObservation.acquiredAtMs || simTimeMs - s.acquiredAtMs > cfg.staleAfterMs) {
        metrics.staleSamples++; record('sample-rejected-stale', { acquiredAtMs: s.acquiredAtMs, deliveredAtMs: s.deliveredAtMs }); continue;
      }
      lastObservation = s; samples.push(copy(s));
      if (samples.length > cfg.maxStoredSamples) samples.shift();
    }
  };

  function send(target, { durationMs } = {}) {
    assertOpen();
    const reject = message => { metrics.rejectedCommands++; record('command-rejected', { message }); throw new Error(message); };
    if (interrupted) return reject('lab is interrupted; call reset before another command');
    if (!planner && active) return reject('one motion is already active; pending targets are not supported');
    if (!planner && !plantSettled()) return reject('reference is complete but the modeled plant has not settled');
    if (metrics.commands >= cfg.maxCommands) return reject('maximum command count reached');
    if (simTimeMs - lastObservation.acquiredAtMs > cfg.staleAfterMs) return reject('latest observation is stale; no new reference was created');
    if (!target || typeof target !== 'object' || joints.some(j => !own(target, j)) || Object.keys(target).some(j => !own(q, j)))
      return reject('target must contain exactly the configured joint keys');
    const next = Object.fromEntries(joints.map(j => [j, finite(target[j], `${j}.target`)]));
    for (const j of joints) if (next[j] < limits[j].min || next[j] > limits[j].max) return reject(`${j} target exceeds simulation position limits`);
    if(planner){
      const wasActive=!!active;
      const result=planner.retarget(next,{durationMs});
      if(!result.accepted)return reject(result.reason);
      active=planner.snapshot().activeMotion;commandNumber++;metrics.commands++;if(wasActive)metrics.replans++;
      record('command-accepted',{commandId:result.id,durationMs:result.durationMs,referenceMode:cfg.referenceMode,replanned:wasActive});
      return {...result,referenceMode:cfg.referenceMode};
    }
    const minimumMs = minimumDurationMs(ref.position, next, limits);
    const requestedMs = durationMs === undefined ? minimumMs : positive(durationMs, 'durationMs');
    const selectedMs = Math.max(cfg.dtMs, Math.ceil(Math.max(minimumMs, requestedMs) / cfg.dtMs) * cfg.dtMs);
    if (selectedMs + 1e-9 < minimumMs) return reject(`durationMs ${selectedMs} is below exact limit-derived minimum ${minimumMs}`);
    if (selectedMs > cfg.maxDurationMs) return reject('duration exceeds configured finite maximum');
    if (simTimeMs + selectedMs > cfg.maxRunDurationMs + 1e-9) return reject('trajectory would exceed the remaining simulation time budget');
    const id = ++commandNumber;
    active = { id, start: { ...ref.position }, target: next, delta: Object.fromEntries(joints.map(j => [j, next[j] - ref.position[j]])),
      durationMs: selectedMs, elapsedMs: 0, minimumDurationMs: minimumMs };
    metrics.commands++; record('command-accepted', { commandId: id, durationMs: selectedMs, minimumDurationMs: minimumMs });
    return { id, accepted: true, simulated: true, durationMs: selectedMs, requestedDurationMs: requestedMs, minimumDurationMs: minimumMs };
  }

  function step(count = 1, snapshotOptions = {}) {
    assertOpen();
    if (!Number.isInteger(count) || count < 1 || count > 100_000) throw new RangeError('step count must be an integer from 1 to 100000');
    if (simTimeMs + count * cfg.dtMs > cfg.maxRunDurationMs + 1e-9) throw new RangeError('step would exceed the finite total simulation duration');
    for (let i = 0; i < count; i++) {
      simTimeMs += cfg.dtMs; stepNumber++;
      if (active && !interrupted && simTimeMs - lastObservation.acquiredAtMs > cfg.staleAfterMs) latchInterrupt('observation-stale');
      if(planner)advanceOnlineReference();
      else if (active && !interrupted) { active.elapsedMs = Math.min(active.durationMs, active.elapsedMs + cfg.dtMs); evaluateReference(); }
      const oldV = { ...plantVelocity }, oldA = { ...plantAcceleration };
      const alpha = 1 - Math.exp(-(cfg.dtMs / 1000) / cfg.lagSeconds);
      for (const j of joints) {
        const old = plant[j]; plant[j] += (ref.position[j] - plant[j]) * alpha;
        plantVelocity[j] = (plant[j] - old) / (cfg.dtMs / 1000);
        plantAcceleration[j] = (plantVelocity[j] - oldV[j]) / (cfg.dtMs / 1000);
        plantJerk[j] = (plantAcceleration[j] - oldA[j]) / (cfg.dtMs / 1000);
        const l = limits[j];
        if (plant[j] < l.min - 1e-9 || plant[j] > l.max + 1e-9) metrics.positionLimitViolations++;
        if (Math.abs(plantVelocity[j]) > l.velocity + 1e-9) metrics.velocityLimitViolations++;
        if (Math.abs(plantAcceleration[j]) > l.acceleration + 1e-9) metrics.accelerationLimitViolations++;
        if (Math.abs(plantJerk[j]) > l.jerk + 1e-9) metrics.jerkLimitViolations++;
      }
      if (stepNumber % cfg.observationEverySteps === 0) observe();
      deliver();
    }
    return snapshot(snapshotOptions);
  }

  function latchInterrupt(reason) {
    if (interrupted) return;
    if(planner&&active){
      const brake=planner.brake();
      if(brake.accepted){
        active=planner.snapshot().activeMotion;metrics.smoothBrakePlans++;interrupted=true;
        record('smooth-reference-brake',{reason:String(reason).slice(0,256),...brake});return;
      }
      metrics.failedBrakePlans++;record('smooth-brake-unavailable',{reason:String(reason).slice(0,256),detail:brake.reason});
    }
    if (active) {
      const discontinuity = Object.fromEntries(joints.map(j => [j, { velocityBeforeFreeze: ref.velocity[j], accelerationBeforeFreeze: ref.acceleration[j], jerkBeforeFreeze: ref.jerk[j] }]));
      referenceAbruptions++; metrics.referenceAbruptions++;
      record('reference-frozen-abruptly', { commandId: active.id, reason: String(reason).slice(0, 256), discontinuity,
        guarantee: 'smooth-profile guarantee ends at this interruption' });
      for (const j of joints) { ref.velocity[j] = 0; ref.acceleration[j] = 0; ref.jerk[j] = 0; }
      active = null;
    }
    if(planner)planner.freeze();
    interrupted = true;
  }

  function interrupt(reason = 'interrupted') {
    assertOpen();
    latchInterrupt(reason);
    return snapshot();
  }

  function reset() {
    assertOpen();
    Object.assign(cfg, originalCfg); Object.assign(metrics, newMetrics());
    for (const j of joints) { plant[j] = originalInitial[j]; ref.position[j] = originalInitial[j]; ref.velocity[j] = 0; ref.acceleration[j] = 0; ref.jerk[j] = 0; }
    for (const j of joints) { plantVelocity[j] = 0; plantAcceleration[j] = 0; plantJerk[j] = 0; }
    simTimeMs = 0; stepNumber = 0; commandNumber = 0; interrupted = false; active = null; referenceAbruptions = 0;
    planner=makePlanner();
    rngState = (Math.trunc(originalCfg.seed) >>> 0) || 0x6d2b79f5;
    queue.length = 0; samples.length = 0; events.length = 0;
    for (const k of Object.keys(fault)) fault[k] = 0;
    lastObservation = { acquiredAtMs: 0, deliveredAtMs: 0, position: { ...plant }, source: 'simulation', hypothetical: true };
    record('initialized', { simulationOnly: true });
    return snapshot();
  }

  function setFaults(patch = {}) {
    assertOpen();
    if (!patch || typeof patch !== 'object') throw new TypeError('fault patch must be an object');
    const allowed = ['dropEvery', 'freezeEvery', 'reorderEvery', 'latencyMs', 'jitterMs', 'noise'];
    for (const k of Object.keys(patch)) if (!allowed.includes(k)) throw new TypeError(`unknown fault: ${k}`);
    const nextFault = { ...fault };
    for (const k of ['dropEvery', 'freezeEvery', 'reorderEvery']) if (own(patch, k)) {
      if (!Number.isInteger(patch[k]) || patch[k] < 0 || patch[k] > 10_000) throw new RangeError(`${k} must be an integer from 0 to 10000; zero disables it`);
      nextFault[k] = patch[k];
    }
    const next = { latencyMs: own(patch, 'latencyMs') ? nonnegative(patch.latencyMs, 'latencyMs') : cfg.latencyMs,
      jitterMs: own(patch, 'jitterMs') ? nonnegative(patch.jitterMs, 'jitterMs') : cfg.jitterMs,
      noise: own(patch, 'noise') ? nonnegative(patch.noise, 'noise') : cfg.noise };
    if (next.latencyMs > 60_000 || next.jitterMs > 60_000 || next.noise > 10) throw new RangeError('latency or noise exceeds finite experiment caps');
    if (next.jitterMs > next.latencyMs) throw new RangeError('jitterMs cannot exceed latencyMs');
    Object.assign(fault, nextFault);
    Object.assign(cfg, next);
    record('faults-updated', { faults: { ...fault }, latencyMs: cfg.latencyMs, jitterMs: cfg.jitterMs, noise: cfg.noise });
    return snapshot();
  }

  function snapshot({ includeHistory = false } = {}) {
    const result = { simulated: true, hypothetical: true, model: 'uncalibrated first-order setpoint lag; no contact/load/friction/backlash model',
      simTimeMs, dtMs: cfg.dtMs, status: disposed ? 'disposed' : interrupted ? 'interrupted' : active ? 'moving' : 'idle',
      interrupted, referenceMode:cfg.referenceMode, braking:!!(interrupted&&active?.kind==='braking'),reference: ref, plant: { position: plant, velocity: plantVelocity, acceleration: plantAcceleration, jerk: plantJerk },
      observation: lastObservation, observationAgeMs: simTimeMs - lastObservation.acquiredAtMs,
      activeMotion: active, pendingTargets: 0, queuedSamples: queue.length, faults: { ...fault },
      referenceContinuity: referenceAbruptions ? 'abrupt-freeze-interruption; smooth guarantee ended' : planner ? 'C2 reference replanning; bounded jerk may jump at splice boundaries' : 'quintic per segment; jerk discontinuous at rest boundaries',
      referenceComplete: active === null && !interrupted && commandNumber > 0,
      referenceStatus: interrupted ? active?.kind==='braking'?'braking-after-interruption':'interrupted-before-verification' : active ? 'advancing' : commandNumber > 0 ? 'target-reached' : 'no-command',
      plantSettled: plantSettled(),
      simulationLimitsSatisfied: metrics.positionLimitViolations + metrics.velocityLimitViolations + metrics.accelerationLimitViolations + metrics.jerkLimitViolations === 0,
      metrics };
    if (includeHistory) { result.samples = samples; result.events = events; }
    return copy(result);
  }

  function dispose() {
    if (disposed) return { disposed: true };
    latchInterrupt('disposed'); queue.length = 0; disposed = true;
    if(planner&&active){
      planner.freeze();active=null;referenceAbruptions++;metrics.referenceAbruptions++;
      for(const j of joints){ref.velocity[j]=0;ref.acceleration[j]=0;ref.jerk[j]=0;}
      record('pending-brake-terminated-on-disposal',{simulationOnly:true});
    }
    record('disposed');
    return { disposed: true };
  }

  // The initial observation is a synthetic experiment seed, not telemetry.
  record('initialized', { simulationOnly: true });
  return { send, step, interrupt, reset, setFaults, snapshot, dispose };
}
