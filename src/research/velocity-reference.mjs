/**
 * Bounded logical-time owner for velocity-transition reference segments.
 * This is reference-only state; it has no plant, wall clock, I/O, or hardware.
 * The caller must invoke interrupt() when its command-acquisition-age policy
 * expires (for example, >200 ms since acquisition) or when user intent expires.
 */
import {
  evaluateVelocityTransition,
  findBoundedVelocityTransition
} from './velocity-transition.mjs';

const MAX_JOINTS = 8;
const MAX_GRID_CANDIDATES = 200;
const MAX_RUN_STEPS = 10_000;
const MAX_RUN_MS = 600_000;
const MAX_COMMANDS = 250;
const EPS = Number.EPSILON;
const ENDPOINT_ROUNDING_FACTOR = 512;

function typeError(name, detail) {
  throw new TypeError(`${name} ${detail}`);
}

function ownRecord(value, name, required, optional = []) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) typeError(name, 'must be a plain data record');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) typeError(name, 'must have an ordinary or null prototype');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string')) typeError(name, 'must not contain symbol keys');
  const allowed = new Set([...required, ...optional]);
  for (const key of keys) if (!allowed.has(key)) typeError(name, `contains unknown key ${String(key)}`);
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(descriptors, key)) typeError(name, `is missing ${key}`);
  const result = Object.create(null);
  for (const key of keys) {
    const d = descriptors[key];
    if (!Object.prototype.hasOwnProperty.call(d, 'value')) typeError(name, `.${key} must be a data property; accessors are rejected`);
    if (!d.enumerable) typeError(name, `.${key} must be enumerable`);
    result[key] = d.value;
  }
  return result;
}

function jointEntries(value, name, expectedKeys = null) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) typeError(name, 'must be a plain joint data record');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) typeError(name, 'must have an ordinary or null prototype');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string')) typeError(name, 'must not contain symbol joint keys');
  if (keys.length < 1 || keys.length > MAX_JOINTS) throw new RangeError(`${name} must contain 1..${MAX_JOINTS} joints`);
  const entries = [];
  for (const key of keys) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(key)) typeError(name, `contains invalid joint key ${String(key)}`);
    if (expectedKeys && !expectedKeys.includes(key)) typeError(name, `contains unexpected joint ${key}`);
    const d = descriptors[key];
    if (!Object.prototype.hasOwnProperty.call(d, 'value')) typeError(name, `.${key} must be a data property; accessors are rejected`);
    if (!d.enumerable) typeError(name, `.${key} must be enumerable`);
    entries.push([key, d.value]);
  }
  if (expectedKeys && (keys.length !== expectedKeys.length || expectedKeys.some(key => !keys.includes(key)))) {
    typeError(name, 'must have exactly the same joint keys');
  }
  return entries;
}

function finiteNumber(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be finite in [${min}, ${max}]`);
  }
  return value === 0 ? 0 : value;
}

function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`${name} must be an integer in [${min}, ${max}]`);
  return value;
}

function cloneState(state, joints) {
  const result = Object.create(null);
  for (const joint of joints) result[joint] = { ...state[joint] };
  return result;
}

function startStates(state, joints) {
  const result = Object.create(null);
  for (const joint of joints) {
    result[joint] = {
      position: state[joint].position,
      velocity: state[joint].velocity,
      acceleration: state[joint].acceleration
    };
  }
  return result;
}

function allZeroRate(state, joints) {
  return joints.every(joint => state[joint].velocity === 0 && state[joint].acceleration === 0);
}

function makeConfig(raw) {
  const record = ownRecord(raw, 'config', ['initialJointPositions', 'limits'], [
    'dtMs', 'maxRunDurationMs', 'minDurationMs', 'maxDurationMs', 'durationStepMs', 'maxCommands'
  ]);
  const positionEntries = jointEntries(record.initialJointPositions, 'initialJointPositions');
  const joints = positionEntries.map(([joint]) => joint);
  const positions = new Map(positionEntries.map(([joint, value]) => [joint,
    finiteNumber(value, `initialJointPositions.${joint}`, -1e3, 1e3)]));
  const limitsEntries = jointEntries(record.limits, 'limits', joints);
  const limits = Object.create(null);
  for (const [joint, value] of limitsEntries) {
    const lim = ownRecord(value, `limits.${joint}`, ['position', 'velocityAbs', 'accelerationAbs', 'jerkAbs']);
    if (!Array.isArray(lim.position) || Object.getPrototypeOf(lim.position) !== Array.prototype) typeError(`limits.${joint}.position`, 'must be a dense two-element array');
    const ds = Object.getOwnPropertyDescriptors(lim.position);
    const keys = Reflect.ownKeys(ds);
    if (keys.length !== 3 || !Object.prototype.hasOwnProperty.call(ds, '0') || !Object.prototype.hasOwnProperty.call(ds, '1') || !Object.prototype.hasOwnProperty.call(ds, 'length') || !Object.prototype.hasOwnProperty.call(ds.length, 'value') || ds.length.value !== 2) typeError(`limits.${joint}.position`, 'must be a dense two-element array of length exactly two');
    for (const k of ['0', '1']) if (!Object.prototype.hasOwnProperty.call(ds[k], 'value') || !ds[k].enumerable) typeError(`limits.${joint}.position[${k}]`, 'must be an enumerable data property');
    const position = [finiteNumber(ds[0].value, `limits.${joint}.position[0]`, -1e3, 1e3), finiteNumber(ds[1].value, `limits.${joint}.position[1]`, -1e3, 1e3)];
    if (position[0] > position[1]) throw new RangeError(`limits.${joint}.position minimum must not exceed maximum`);
    limits[joint] = {
      position,
      velocityAbs: finiteNumber(lim.velocityAbs, `limits.${joint}.velocityAbs`, 0, 100),
      accelerationAbs: finiteNumber(lim.accelerationAbs, `limits.${joint}.accelerationAbs`, 0, 1e3),
      jerkAbs: finiteNumber(lim.jerkAbs, `limits.${joint}.jerkAbs`, 0, 1e5)
    };
    if (positions.get(joint) < position[0] || positions.get(joint) > position[1]) throw new RangeError(`initialJointPositions.${joint} is outside its position limits`);
  }
  const dtMs = integer(record.dtMs ?? 10, 'dtMs', 1, 1000);
  const maxRunDurationMs = integer(record.maxRunDurationMs ?? 10_000, 'maxRunDurationMs', dtMs, MAX_RUN_MS);
  if (maxRunDurationMs % dtMs !== 0 || maxRunDurationMs / dtMs > MAX_RUN_STEPS) throw new RangeError('maxRunDurationMs must be a dtMs multiple with no more than 10000 steps');
  const minDurationMs = integer(record.minDurationMs ?? 500, 'minDurationMs', Math.max(dtMs, 10), Math.min(maxRunDurationMs, 10_000));
  const maxDurationMs = integer(record.maxDurationMs ?? 2000, 'maxDurationMs', minDurationMs, Math.min(maxRunDurationMs, 10_000));
  const durationStepMs = integer(record.durationStepMs ?? 50, 'durationStepMs', 1, Math.min(maxRunDurationMs, 10_000));
  if ([minDurationMs, maxDurationMs, durationStepMs].some(value => value % dtMs !== 0)) throw new RangeError('duration bounds and step must be multiples of dtMs');
  const gridSize = Math.floor((maxDurationMs - minDurationMs) / durationStepMs) + 1;
  if (gridSize > MAX_GRID_CANDIDATES) throw new RangeError(`duration grid exceeds ${MAX_GRID_CANDIDATES} candidates`);
  const maxCommands = integer(record.maxCommands ?? MAX_COMMANDS, 'maxCommands', 1, MAX_COMMANDS);
  return { joints, positions, limits, dtMs, maxRunDurationMs, minDurationMs, maxDurationMs, durationStepMs, maxCommands };
}

function endpointFromSegments(segments, joints) {
  const state = Object.create(null), residuals = Object.create(null);
  for (const joint of joints) {
    const segment = segments[joint];
    const t = segment.durationSeconds;
    const actual = evaluateVelocityTransition(segment, t);
    const qCoefficients = segment.normalizedPower.position;
    const vCoefficients = segment.normalizedPower.velocity;
    const aCoefficients = segment.normalizedPower.acceleration;
    const expected = { position: segment.targetPosition, velocity: segment.targetVelocity, acceleration: 0 };
    const values = { position: actual.position, velocity: actual.velocity, acceleration: actual.acceleration };
    const residual = Object.create(null);
    for (const key of ['position', 'velocity', 'acceleration']) {
      residual[key] = values[key] - expected[key];
      const coefficients = key === 'position' ? qCoefficients : key === 'velocity' ? vCoefficients : aCoefficients;
      const scale = Math.max(1, Math.abs(values[key]), Math.abs(expected[key]), ...coefficients.map(Math.abs));
      const tolerance = ENDPOINT_ROUNDING_FACTOR * EPS * scale;
      if (!Number.isFinite(residual[key]) || Math.abs(residual[key]) > tolerance) {
        throw new RangeError(`${joint} endpoint ${key} residual exceeds dimension-specific floating-point tolerance`);
      }
    }
    residuals[joint] = residual;
    state[joint] = { ...expected, jerk: actual.jerk };
  }
  return { state, residuals };
}

export function createVelocityReference(configInput) {
  const config = makeConfig(configInput);
  const { joints, limits, dtMs, maxRunDurationMs, minDurationMs, maxDurationMs, durationStepMs, maxCommands } = config;
  let timeMs = 0;
  let state = Object.create(null);
  for (const joint of joints) state[joint] = { position: config.positions.get(joint), velocity: 0, acceleration: 0, jerk: 0 };
  let status = 'holding';
  let active = null;
  let intentLatched = false;
  let disposed = false;
  let acceptedRetargets = 0;
  let commandsUsed = 0;
  let nextSegmentId = 1;
  let lastEndpointResiduals = null;
  let brakeResolution = null;

  function ensureAlive() {
    if (disposed) throw new Error('velocity reference is disposed');
  }

  function currentStatusAtBudget() {
    return timeMs >= maxRunDurationMs && (active !== null || !allZeroRate(state, joints));
  }

  function snapshot() {
    return {
      status,
      referenceOnly: true,
      physicalCertificate: false,
      plantTrackingClaim: false,
      timeMs,
      dtMs,
      maxRunDurationMs,
      traceStatus: currentStatusAtBudget() ? 'finite-trace-cutoff' : null,
      continuity: 'Accepted replacements preserve position, velocity, and acceleration; jerk may jump at a splice.',
      intentLatched,
      disposed,
      acceptedRetargets,
      commandsUsed,
      commandLimit: maxCommands,
      currentReference: cloneState(state, joints),
      activeSegment: active ? {
        id: active.id,
        startedAtMs: active.startedAtMs,
        endTimeMs: active.endTimeMs,
        durationMs: active.durationMs,
        targetVelocityByJoint: { ...active.targetVelocityByJoint },
        purpose: active.purpose
      } : null,
      lastEndpointResiduals: lastEndpointResiduals ? JSON.parse(JSON.stringify(lastEndpointResiduals)) : null,
      brakeResolution: brakeResolution ? structuredCloneSafe(brakeResolution) : null,
      scope: 'Logical mathematical reference only; it is not a plant state, hardware stop, or tracking claim.',
      clockPolicy: 'No internal clock or command lease exists. Caller supplies logical steps and must invoke interrupt() when acquisition age exceeds its policy (for example 200 ms) or user intent expires.'
    };
  }

  function structuredCloneSafe(value) {
    if (Array.isArray(value)) return value.map(structuredCloneSafe);
    if (value && typeof value === 'object') {
      const copy = Object.create(null);
      for (const key of Object.keys(value)) copy[key] = structuredCloneSafe(value[key]);
      return copy;
    }
    return value;
  }

  function makeDurationGrid(remainingMs, requestedMs) {
    let minimumMs = minDurationMs;
    if (requestedMs !== undefined) {
      minimumMs = integer(requestedMs, 'durationMs', minDurationMs, maxDurationMs);
      if (minimumMs % dtMs !== 0 || (minimumMs - minDurationMs) % durationStepMs !== 0) {
        throw new RangeError('durationMs must lie on the configured duration grid');
      }
    }
    const grid = [];
    for (let durationMs = minimumMs; durationMs <= maxDurationMs && durationMs <= remainingMs; durationMs += durationStepMs) {
      grid.push(durationMs);
    }
    return grid;
  }

  function durationMilliseconds(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) throw new RangeError('selected duration must be finite and positive');
    const ms = seconds * 1000;
    const rounded = Math.round(ms);
    const tolerance = 16 * EPS * Math.max(1, Math.abs(ms));
    if (!Number.isSafeInteger(rounded) || Math.abs(ms - rounded) > tolerance) {
      throw new RangeError('selected duration does not round-trip to an integer millisecond grid value');
    }
    return rounded;
  }

  function startAcceptedSegment(segments, targetMap, durationMs, purpose) {
    const end = timeMs + durationMs;
    if (end > maxRunDurationMs) throw new RangeError('candidate segment exceeds remaining run budget');
    const segment = {
      id: nextSegmentId++,
      startedAtMs: timeMs,
      endTimeMs: end,
      durationMs,
      segments,
      targetVelocityByJoint: Object.fromEntries(joints.map(joint => [joint, targetMap.get(joint)])),
      purpose
    };
    segment.segments = structuredCloneSafe(segments);
    active = segment;
    for (const joint of joints) {
      const start = evaluateVelocityTransition(active.segments[joint], 0);
      state[joint] = { ...state[joint], jerk: start.jerk };
    }
    status = purpose === 'brake' ? 'braking' : 'moving';
    lastEndpointResiduals = null;
    return segment;
  }

  function boundedSearch(targetMap, durationGrid) {
    if (durationGrid.length === 0) return { status: 'screen-rejected', candidatesChecked: 0, reason: 'No duration fits within the remaining run budget.' };
    const result = findBoundedVelocityTransition({
      startByJoint: startStates(state, joints),
      targetVelocityByJoint: Object.fromEntries(joints.map(joint => [joint, targetMap.get(joint)])),
      limitsByJoint: limits,
      durationSeconds: durationGrid.map(ms => ms / 1000)
    });
    return result;
  }

  function retarget(targetVelocityByJoint, options = undefined) {
    ensureAlive();
    const optionRecord = options === undefined ? Object.create(null) : ownRecord(options, 'retarget options', [], ['durationMs']);
    const targetEntries = jointEntries(targetVelocityByJoint, 'targetVelocityByJoint', joints);
    const targetMap = new Map();
    for (const [joint, value] of targetEntries) targetMap.set(joint, finiteNumber(value, `targetVelocityByJoint.${joint}`, -100, 100));
    if (commandsUsed >= maxCommands) return { accepted: false, reason: 'retarget command limit reached', snapshot: snapshot() };
    commandsUsed += 1;
    if (intentLatched) return { accepted: false, reason: 'interrupted intent is latched; no new target is accepted', snapshot: snapshot() };
    if (timeMs >= maxRunDurationMs) return { accepted: false, reason: 'finite run budget is exhausted', snapshot: snapshot() };
    const remainingMs = maxRunDurationMs - timeMs;
    const grid = makeDurationGrid(remainingMs, optionRecord.durationMs);
    let search;
    try {
      search = boundedSearch(targetMap, grid);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return { accepted: false, reason: error.message, snapshot: snapshot() };
    }
    if (search.status !== 'screened-bounded') {
      return { accepted: false, reason: search.reason ?? 'No duration was screened-bounded on the finite grid.', search, snapshot: snapshot() };
    }
    const selectedDurationMs = durationMilliseconds(search.durationSeconds);
    if (!grid.includes(selectedDurationMs)) throw new RangeError('selected duration does not map back to the configured integer-millisecond grid');
    startAcceptedSegment(search.segments, targetMap, selectedDurationMs, 'retarget');
    acceptedRetargets += 1;
    return { accepted: true, durationMs: active.durationMs, status: 'moving', search, snapshot: snapshot() };
  }

  function endpointTransition(normalized, segment, endpointTimeMs) {
    const purpose = segment.purpose;
    let nextStatus = status;
    let nextBrakeResolution = brakeResolution;
    if (purpose === 'brake') {
      nextStatus = 'holding-interrupted';
      nextBrakeResolution = { accepted: true, outcome: 'brake-complete-reference-only', completedAtMs: endpointTimeMs, endpointResiduals: normalized.residuals };
    } else if (intentLatched && status === 'brake-unresolved') {
      // Preserve unresolved disposition. The old curve reaching an endpoint does not convert a failed brake into a stop claim.
    } else if (allZeroRate(normalized.state, joints)) {
      nextStatus = 'holding';
    } else {
      nextStatus = 'needs-new-segment';
    }
    return { normalized, nextStatus, nextBrakeResolution };
  }

  function commitEndpointTransition(transition) {
    state = transition.normalized.state;
    lastEndpointResiduals = transition.normalized.residuals;
    status = transition.nextStatus;
    brakeResolution = transition.nextBrakeResolution;
    active = null;
  }

  function step(count = 1) {
    ensureAlive();
    const n = integer(count, 'count', 1, MAX_RUN_STEPS);
    if (timeMs >= maxRunDurationMs) throw new RangeError('finite run budget is exhausted');
    if (status === 'needs-new-segment') throw new Error('nonzero endpoint requires an accepted replacement before further stepping');
    if (status === 'brake-unresolved' && active === null) throw new Error('brake is unresolved and no accepted curve remains to evaluate');
    const targetTime = timeMs + n * dtMs;
    if (targetTime > maxRunDurationMs) throw new RangeError('step would exceed finite run budget');
    if (active && targetTime > active.endTimeMs && (status === 'brake-unresolved' || active.targetVelocityByJoint && joints.some(j => active.targetVelocityByJoint[j] !== 0))) {
      throw new Error('step would pass an endpoint that requires a new accepted segment');
    }
    if (active && targetTime <= active.endTimeMs) {
      const elapsedMs = targetTime - active.startedAtMs;
      const newState = Object.create(null);
      for (const joint of joints) {
        const sampleTime = targetTime === active.endTimeMs ? active.segments[joint].durationSeconds : elapsedMs / 1000;
        const sample = evaluateVelocityTransition(active.segments[joint], sampleTime);
        newState[joint] = { position: sample.position, velocity: sample.velocity, acceleration: sample.acceleration, jerk: sample.jerk };
      }
      const endingSegment = active;
      const endpoint = targetTime === endingSegment.endTimeMs ? endpointFromSegments(endingSegment.segments, joints) : null;
      const transition = endpoint ? endpointTransition(endpoint, endingSegment, targetTime) : null;
      if (transition) {
        timeMs = targetTime;
        commitEndpointTransition(transition);
      } else {
        state = newState;
        timeMs = targetTime;
      }
    } else if (active && targetTime > active.endTimeMs) {
      // Crossing a zero-rate endpoint is allowed: evaluate/normalize exactly at
      // the declared end, then advance only the stationary reference clock.
      const endingSegment = active;
      const endpoint = endpointFromSegments(endingSegment.segments, joints);
      const transition = endpointTransition(endpoint, endingSegment, endingSegment.endTimeMs);
      commitEndpointTransition(transition);
      timeMs = targetTime;
      if (status === 'holding' || status === 'holding-interrupted') {
        for (const joint of joints) state[joint].jerk = 0;
      }
    } else {
      timeMs = targetTime;
      // Holding can advance logical time while preserving the already normalized reference state.
      for (const joint of joints) state[joint].jerk = 0;
    }
    return snapshot();
  }

  function interrupt(reason) {
    ensureAlive();
    if (typeof reason !== 'string' || reason.trim().length < 1 || reason.length > 240) typeError('reason', 'must be a nonempty string of at most 240 characters');
    if (intentLatched) return { accepted: false, status, reason: 'interrupt is already latched', snapshot: snapshot() };
    intentLatched = true;
    if (allZeroRate(state, joints) && active === null) {
      status = 'holding-interrupted';
      brakeResolution = { accepted: true, outcome: 'already-at-reference-rest', requestedReason: reason, completedAtMs: timeMs };
      return { accepted: true, status, reason: 'reference was already stationary', snapshot: snapshot() };
    }
    const remainingMs = maxRunDurationMs - timeMs;
    const grid = makeDurationGrid(remainingMs, undefined);
    const zeros = new Map(joints.map(joint => [joint, 0]));
    let search;
    try {
      search = boundedSearch(zeros, grid);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      status = 'brake-unresolved';
      brakeResolution = {
        accepted: false,
        outcome: 'brake-unresolved',
        requestedReason: reason,
        atTimeMs: timeMs,
        currentReference: cloneState(state, joints),
        existingSegmentEndTimeMs: active?.endTimeMs ?? null,
        searchError: error.message
      };
      return { accepted: false, status, reason: error.message, snapshot: snapshot() };
    }
    if (search.status === 'screened-bounded') {
      const selectedDurationMs = durationMilliseconds(search.durationSeconds);
      if (!grid.includes(selectedDurationMs)) {
        status = 'brake-unresolved';
        brakeResolution = { accepted: false, outcome: 'brake-unresolved', requestedReason: reason, atTimeMs: timeMs, searchError: 'selected duration does not map back to the configured integer-millisecond grid', existingSegmentEndTimeMs: active?.endTimeMs ?? null };
        return { accepted: false, status, reason: brakeResolution.searchError, snapshot: snapshot() };
      }
      startAcceptedSegment(search.segments, zeros, selectedDurationMs, 'brake');
      brakeResolution = { accepted: true, outcome: 'braking-reference', requestedReason: reason, search, segmentEndTimeMs: active.endTimeMs };
      return { accepted: true, status, search, snapshot: snapshot() };
    }
    status = 'brake-unresolved';
    brakeResolution = {
      accepted: false,
      outcome: 'brake-unresolved',
      requestedReason: reason,
      atTimeMs: timeMs,
      currentReference: cloneState(state, joints),
      existingSegmentEndTimeMs: active?.endTimeMs ?? null,
      search
    };
    return { accepted: false, status, search, snapshot: snapshot() };
  }

  function dispose() {
    if (disposed) return snapshot();
    disposed = true;
    return snapshot();
  }

  return Object.freeze({ retarget, step, interrupt, snapshot, dispose });
}

export function runVelocityReferenceSelfChecks() {
  const checks = [];
  const create = createVelocityReference;
  const broad = { j: { position: [-2, 2], velocityAbs: 2, accelerationAbs: 10, jerkAbs: 1000 } };
  const config = (overrides = {}) => ({
    initialJointPositions: { j: 0 }, limits: broad,
    dtMs: 10, maxRunDurationMs: 1000, minDurationMs: 100, maxDurationMs: 200,
    durationStepMs: 50, ...overrides
  });
  const record = (name, passed) => checks.push({ name, passed: Boolean(passed) });
  const sameReferenceState = (left, right) => JSON.stringify({
    status: left.status, timeMs: left.timeMs, intentLatched: left.intentLatched,
    currentReference: left.currentReference, activeSegment: left.activeSegment,
    lastEndpointResiduals: left.lastEndpointResiduals, brakeResolution: left.brakeResolution
  }) === JSON.stringify({
    status: right.status, timeMs: right.timeMs, intentLatched: right.intentLatched,
    currentReference: right.currentReference, activeSegment: right.activeSegment,
    lastEndpointResiduals: right.lastEndpointResiduals, brakeResolution: right.brakeResolution
  });

  const endpoint = create(config());
  const acceptedEndpoint = endpoint.retarget({ j: 0.1 }, { durationMs: 100 });
  const endpointState = acceptedEndpoint.accepted ? endpoint.step(10) : null;
  record('nonzero endpoint requires replacement and exposes segment jerk', endpointState?.status === 'needs-new-segment' && endpointState.currentReference.j.velocity === 0.1 && Number.isFinite(endpointState.currentReference.j.jerk) && endpointState.currentReference.j.jerk !== 0);
  const beforeBlockedStep = endpoint.snapshot();
  let blocked = false;
  try { endpoint.step(); } catch { blocked = true; }
  record('nonzero endpoint further step is atomic rejection', blocked && sameReferenceState(beforeBlockedStep, endpoint.snapshot()));

  const zeroCross = create(config());
  const zeroAccepted = zeroCross.retarget({ j: 0 }, { durationMs: 100 }).accepted;
  const zeroAfter = zeroAccepted ? zeroCross.step(20) : null;
  record('zero endpoint may enter reference holding with resting jerk', zeroAfter?.status === 'holding' && zeroAfter.timeMs === 200 && zeroAfter.currentReference.j.velocity === 0 && zeroAfter.currentReference.j.acceleration === 0 && zeroAfter.currentReference.j.jerk === 0);

  const brake = create(config());
  const moved = brake.retarget({ j: 0.2 }, { durationMs: 200 }).accepted;
  if (moved) brake.step(2);
  const braking = moved ? brake.interrupt('self-check logical expiry') : null;
  const brakeDuration = braking?.snapshot.activeSegment?.durationMs ?? 0;
  const completedBrake = braking?.accepted ? brake.step(brakeDuration / 10) : null;
  record('successful interrupt brakes reference before holding', completedBrake?.status === 'holding-interrupted' && completedBrake.currentReference.j.velocity === 0 && completedBrake.currentReference.j.acceleration === 0 && completedBrake.lastEndpointResiduals !== null);

  const unresolved = create(config({ maxRunDurationMs: 250, minDurationMs: 200, maxDurationMs: 200, durationStepMs: 10 }));
  const unresolvedStarted = unresolved.retarget({ j: 0.2 }, { durationMs: 200 }).accepted;
  if (unresolvedStarted) unresolved.step(10);
  const unresolvedResult = unresolvedStarted ? unresolved.interrupt('self-check with insufficient remaining time') : null;
  const atOldEnd = unresolvedResult?.accepted === false ? unresolved.step(10) : null;
  let noPostEndStep = false;
  try { unresolved.step(); } catch { noPostEndStep = true; }
  record('failed brake preserves old curve then remains unresolved', unresolvedResult?.status === 'brake-unresolved' && atOldEnd?.status === 'brake-unresolved' && noPostEndStep);

  const narrow = create({ ...config(), limits: { j: { position: [-0.001, 0.001], velocityAbs: 2, accelerationAbs: 10, jerkAbs: 1000 } } });
  const beforeReject = narrow.snapshot();
  const rejected = narrow.retarget({ j: 1 }, { durationMs: 100 });
  record('screen-rejected retarget leaves reference state unchanged', rejected.accepted === false && sameReferenceState(beforeReject, narrow.snapshot()));

  const durationGrid = create(config({
    maxRunDurationMs: 1000, minDurationMs: 500, maxDurationMs: 600, durationStepMs: 10,
    limits: { j: { position: [-2, 2], velocityAbs: 1, accelerationAbs: 10, jerkAbs: 1.8 } }
  }));
  const minimumResult = durationGrid.retarget({ j: 0.1 }, { durationMs: 570 });
  record('durationMs is a minimum and search advances on the configured grid', minimumResult.accepted && minimumResult.durationMs === 580 && minimumResult.search.rejectedCandidates[0].durationSeconds * 1000 >= 570);
  const beforeBadGrid = durationGrid.snapshot();
  let badGridRejected = false;
  try { durationGrid.retarget({ j: 0.1 }, { durationMs: 575 }); } catch { badGridRejected = true; }
  record('duration minimum outside configured grid is rejected atomically', badGridRejected && sameReferenceState(beforeBadGrid, durationGrid.snapshot()));

  const cutoff = create(config({ maxRunDurationMs: 100, minDurationMs: 100, maxDurationMs: 100 }));
  const cutoffAccepted = cutoff.retarget({ j: 0.1 }, { durationMs: 100 }).accepted;
  const cutoffSnapshot = cutoffAccepted ? cutoff.step(10) : null;
  record('run cap reports finite active trace cutoff', cutoffSnapshot?.traceStatus === 'finite-trace-cutoff' && cutoffSnapshot.currentReference.j.velocity !== 0);

  const dispose = create(config());
  const disposedStart = dispose.retarget({ j: 0.1 }, { durationMs: 100 }).accepted;
  const beforeDispose = disposedStart ? dispose.step(1) : dispose.snapshot();
  const afterDispose = dispose.dispose();
  let invalidated = false;
  try { dispose.step(); } catch { invalidated = true; }
  record('dispose retains state and invalidates further actions', invalidated && JSON.stringify(beforeDispose.currentReference) === JSON.stringify(afterDispose.currentReference) && beforeDispose.status === afterDispose.status);

  let getterReads = 0;
  const targetWithGetter = { j: 0.1 };
  Object.defineProperty(targetWithGetter, 'x', { enumerable: true, get() { getterReads += 1; return 0; } });
  let getterRejected = false;
  try { create(config()).retarget(targetWithGetter); } catch { getterRejected = true; }
  record('accessor input is rejected without evaluation', getterRejected && getterReads === 0);

  return { passed: checks.filter(check => check.passed).length, total: checks.length, checks };
}
