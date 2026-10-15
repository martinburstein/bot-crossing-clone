/**
 * Pure, bounded cubic-velocity reference candidate (offline math only).
 *
 * Public operations:
 *   fitVelocityTransition({start, targetVelocity, durationSeconds})
 *   evaluateVelocityTransition(segment, timeSeconds)
 *   screenVelocityTransition({segment, limits, subdivisionDepth?})
 *   findBoundedVelocityTransition({startByJoint, targetVelocityByJoint,
 *     limitsByJoint, durationSeconds, subdivisionDepth?})
 *
 * Screening uses normalized power-to-Bernstein convex-hull ranges with a
 * dimension-specific floating-point band. A `screened-bounded` result is a
 * conservative numerical screen, not a formal interval/physical certificate.
 * There are no imports, timers, I/O, global state, or automatic execution.
 */

const KIND = 'velocity-transition-v1';
const MAX_JOINTS = 8;
const MAX_CANDIDATES = 200;
const DEFAULT_SUBDIVISION_DEPTH = 4;
const MAX_SUBDIVISION_DEPTH = 6;
const ROUNDING_FACTOR = 512;
const EPS = Number.EPSILON;

const CAPS = Object.freeze({
  position: 1e3,
  velocity: 100,
  acceleration: 1e3,
  jerk: 1e5,
  durationSeconds: 10,
  coefficient: 1e9
});

function failType(name, detail) {
  throw new TypeError(`${name} ${detail}`);
}

function readRecord(value, name, requiredKeys, optionalKeys = []) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) failType(name, 'must be a plain data record');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) failType(name, 'must have an ordinary or null prototype');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some(key => typeof key !== 'string')) failType(name, 'must not contain symbol keys');
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of ownKeys) {
    if (!allowed.has(key)) failType(name, `contains unknown key ${String(key)}`);
  }
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(descriptors, key)) failType(name, `is missing ${key}`);
  }
  const result = Object.create(null);
  for (const key of ownKeys) {
    const descriptor = descriptors[key];
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) failType(name, `.${key} must be a data property; accessors are rejected`);
    if (!descriptor.enumerable) failType(name, `.${key} must be enumerable`);
    result[key] = descriptor.value;
  }
  return result;
}

function readJointMap(value, name, keys = null) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) failType(name, 'must be a plain joint data record');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) failType(name, 'must have an ordinary or null prototype');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some(key => typeof key !== 'string')) failType(name, 'must not contain symbol joint keys');
  if (ownKeys.length < 1 || ownKeys.length > MAX_JOINTS) failType(name, `must contain 1..${MAX_JOINTS} joints`);
  const joints = [];
  for (const key of ownKeys) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(key)) failType(name, `contains invalid joint key ${String(key)}`);
    if (keys && !keys.includes(key)) failType(name, `contains unexpected joint ${key}`);
    const descriptor = descriptors[key];
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) failType(name, `.${key} must be a data property; accessors are rejected`);
    if (!descriptor.enumerable) failType(name, `.${key} must be enumerable`);
    joints.push([key, descriptor.value]);
  }
  if (keys && (joints.length !== keys.length || keys.some(key => !joints.some(([candidate]) => candidate === key)))) {
    failType(name, 'must have exactly the same joint keys');
  }
  return joints;
}

function readDenseArray(value, name, minLength, maxLength) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) failType(name, 'must be an ordinary dense array');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = descriptors.length;
  if (!lengthDescriptor || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) failType(name, 'has invalid length');
  const length = lengthDescriptor.value;
  if (!Number.isInteger(length) || length < minLength || length > maxLength) {
    throw new RangeError(`${name}.length must be from ${minLength} to ${maxLength}`);
  }
  const expectedKeys = new Set(['length', ...Array.from({ length }, (_, i) => String(i))]);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some(key => typeof key !== 'string' || !expectedKeys.has(key)) || ownKeys.length !== expectedKeys.size) {
    failType(name, 'must be dense and have no extra properties');
  }
  const values = [];
  for (let i = 0; i < length; i++) {
    const descriptor = descriptors[String(i)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) failType(name, `[${i}] must be a data property; accessors are rejected`);
    if (!descriptor.enumerable) failType(name, `[${i}] must be enumerable`);
    values.push(descriptor.value);
  }
  return values;
}

function finite(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be finite in [${min}, ${max}]`);
  }
  return value === 0 ? 0 : value;
}

function readStart(value, name = 'start') {
  const record = readRecord(value, name, ['position', 'velocity', 'acceleration']);
  return {
    position: finite(record.position, `${name}.position`, -CAPS.position, CAPS.position),
    velocity: finite(record.velocity, `${name}.velocity`, -CAPS.velocity, CAPS.velocity),
    acceleration: finite(record.acceleration, `${name}.acceleration`, -CAPS.acceleration, CAPS.acceleration)
  };
}

function readLimits(value, name = 'limits') {
  const record = readRecord(value, name, ['position', 'velocityAbs', 'accelerationAbs', 'jerkAbs']);
  const position = readDenseArray(record.position, `${name}.position`, 2, 2)
    .map((v, i) => finite(v, `${name}.position[${i}]`, -CAPS.position, CAPS.position));
  if (position[0] > position[1]) throw new RangeError(`${name}.position minimum must not exceed maximum`);
  return {
    position,
    velocityAbs: finite(record.velocityAbs, `${name}.velocityAbs`, 0, CAPS.velocity),
    accelerationAbs: finite(record.accelerationAbs, `${name}.accelerationAbs`, 0, CAPS.acceleration),
    jerkAbs: finite(record.jerkAbs, `${name}.jerkAbs`, 0, CAPS.jerk)
  };
}

function horner(coefficients, s) {
  let value = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) value = value * s + coefficients[i];
  return value;
}

function makeSegment(start, targetVelocity, durationSeconds) {
  const T = durationSeconds;
  const d = targetVelocity - start.velocity;
  const qPower = [
    start.position,
    start.velocity * T,
    start.acceleration * T * T / 2,
    d * T - 2 * start.acceleration * T * T / 3,
    -d * T / 2 + start.acceleration * T * T / 4
  ].map((x, i) => finite(x, `position power coefficient ${i}`, -CAPS.coefficient, CAPS.coefficient));
  const vPower = [start.velocity, start.acceleration * T, 3 * d - 2 * start.acceleration * T,
    -2 * d + start.acceleration * T]
    .map((x, i) => finite(x, `velocity power coefficient ${i}`, -CAPS.coefficient, CAPS.coefficient));
  const aPower = [start.acceleration, 6 * d / T - 4 * start.acceleration,
    -6 * d / T + 3 * start.acceleration]
    .map((x, i) => finite(x, `acceleration power coefficient ${i}`, -CAPS.coefficient, CAPS.coefficient));
  const jPower = [6 * d / (T * T) - 4 * start.acceleration / T,
    -12 * d / (T * T) + 6 * start.acceleration / T]
    .map((x, i) => finite(x, `jerk power coefficient ${i}`, -CAPS.coefficient, CAPS.coefficient));
  const targetPosition = finite(start.position + 0.5 * (start.velocity + targetVelocity) * T + start.acceleration * T * T / 12,
    'derived target position', -CAPS.position, CAPS.position);
  return {
    kind: KIND,
    start,
    targetVelocity,
    durationSeconds: T,
    targetPosition,
    normalizedPower: { position: qPower, velocity: vPower, acceleration: aPower, jerk: jPower }
  };
}

function depthValue(value, name = 'subdivisionDepth') {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SUBDIVISION_DEPTH) {
    throw new RangeError(`${name} must be an integer from 0 to ${MAX_SUBDIVISION_DEPTH}`);
  }
  return value;
}

export function fitVelocityTransition(input) {
  const record = readRecord(input, 'input', ['start', 'targetVelocity', 'durationSeconds']);
  const start = readStart(record.start);
  const targetVelocity = finite(record.targetVelocity, 'targetVelocity', -CAPS.velocity, CAPS.velocity);
  const durationSeconds = finite(record.durationSeconds, 'durationSeconds', 0.01, CAPS.durationSeconds);
  return makeSegment(start, targetVelocity, durationSeconds);
}

function validateCanonicalSegment(value) {
  const record = readRecord(value, 'segment', ['kind', 'start', 'targetVelocity', 'durationSeconds', 'targetPosition', 'normalizedPower']);
  if (record.kind !== KIND) throw new TypeError(`segment.kind must be ${KIND}`);
  const canonical = fitVelocityTransition({
    start: record.start,
    targetVelocity: record.targetVelocity,
    durationSeconds: record.durationSeconds
  });
  if (record.targetPosition !== canonical.targetPosition) throw new RangeError('segment targetPosition does not match canonical boundary equations');
  const power = readRecord(record.normalizedPower, 'segment.normalizedPower', ['position', 'velocity', 'acceleration', 'jerk']);
  for (const key of ['position', 'velocity', 'acceleration', 'jerk']) {
    const actual = readDenseArray(power[key], `segment.normalizedPower.${key}`, canonical.normalizedPower[key].length, canonical.normalizedPower[key].length);
    for (let i = 0; i < actual.length; i++) {
      const x = finite(actual[i], `segment.normalizedPower.${key}[${i}]`, -CAPS.coefficient, CAPS.coefficient);
      if (x !== canonical.normalizedPower[key][i]) throw new RangeError(`segment ${key} coefficients are not canonical`);
    }
  }
  return canonical;
}

export function evaluateVelocityTransition(segment, timeSeconds) {
  const canonical = validateCanonicalSegment(segment);
  const t = finite(timeSeconds, 'timeSeconds', 0, canonical.durationSeconds);
  const s = t / canonical.durationSeconds;
  const p = canonical.normalizedPower;
  return {
    timeSeconds: t,
    position: finite(horner(p.position, s), 'evaluated position', -CAPS.coefficient, CAPS.coefficient),
    velocity: finite(horner(p.velocity, s), 'evaluated velocity', -CAPS.coefficient, CAPS.coefficient),
    acceleration: finite(horner(p.acceleration, s), 'evaluated acceleration', -CAPS.coefficient, CAPS.coefficient),
    jerk: finite(horner(p.jerk, s), 'evaluated jerk', -CAPS.coefficient, CAPS.coefficient)
  };
}

function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let value = 1;
  for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i;
  return value;
}

function powerToBernstein(power) {
  const n = power.length - 1;
  const control = [];
  for (let k = 0; k <= n; k++) {
    let value = 0;
    for (let i = 0; i <= k; i++) value += power[i] * choose(k, i) / choose(n, i);
    control.push(finite(value, 'Bernstein control point', -CAPS.coefficient, CAPS.coefficient));
  }
  return control;
}

function splitHalf(control) {
  let row = control.slice();
  const left = [row[0]], right = [row.at(-1)];
  while (row.length > 1) {
    row = row.slice(0, -1).map((value, i) => finite((value + row[i + 1]) / 2, 'subdivided Bernstein control point', -CAPS.coefficient, CAPS.coefficient));
    left.push(row[0]);
    right.unshift(row.at(-1));
  }
  return [left, right];
}

function subdividedControls(power, depth) {
  let pieces = [powerToBernstein(power)];
  for (let i = 0; i < depth; i++) pieces = pieces.flatMap(splitHalf);
  return pieces.flat();
}

function roundoffBand(values, limits, powerCoefficients) {
  let scale = 1;
  for (const value of [...values, ...limits, ...powerCoefficients]) scale = Math.max(scale, Math.abs(value));
  return ROUNDING_FACTOR * EPS * scale;
}

function screenInterval(controls, power, lower, upper, quantity) {
  const min = Math.min(...controls), max = Math.max(...controls);
  const band = roundoffBand(controls, [lower, upper], power);
  const identicallyZero = power.every(value => value === 0);
  if (lower === 0 && upper === 0) {
    const status = identicallyZero ? 'screened-bounded' :
      Math.max(Math.abs(min), Math.abs(max)) <= band ? 'indeterminate-at-bound' : 'screen-rejected';
    return {
      status,
      screenRange: [min, max],
      roundoffBand: band,
      exactZeroException: identicallyZero,
      ...(status === 'screen-rejected' ? { rejectionMeaning: 'Bernstein hull failed zero-bound containment; actual trajectory violation is not proven.' } : {})
    };
  }
  if (min < lower - band || max > upper + band) {
    return {
      status: 'screen-rejected',
      screenRange: [min, max],
      roundoffBand: band,
      rejectionMeaning: 'Bernstein hull failed allowed-interval containment; actual trajectory violation is not proven.'
    };
  }
  if (min <= lower + band || max >= upper - band) {
    return { status: 'indeterminate-at-bound', screenRange: [min, max], roundoffBand: band };
  }
  return { status: 'screened-bounded', screenRange: [min, max], roundoffBand: band };
}

function screenCanonical(canonical, limits, subdivisionDepth) {
  const power = canonical.normalizedPower;
  const qControls = subdividedControls(power.position, subdivisionDepth);
  const vControls = subdividedControls(power.velocity, subdivisionDepth);
  const aControls = subdividedControls(power.acceleration, subdivisionDepth);
  const jControls = subdividedControls(power.jerk, subdivisionDepth);
  const bounds = {
    position: screenInterval(qControls, power.position, limits.position[0], limits.position[1], 'position'),
    velocity: screenInterval(vControls, power.velocity, -limits.velocityAbs, limits.velocityAbs, 'velocity'),
    acceleration: screenInterval(aControls, power.acceleration, -limits.accelerationAbs, limits.accelerationAbs, 'acceleration'),
    jerk: screenInterval(jControls, power.jerk, -limits.jerkAbs, limits.jerkAbs, 'jerk')
  };
  const statuses = Object.values(bounds).map(item => item.status);
  const status = statuses.includes('screen-rejected') ? 'screen-rejected' :
    statuses.includes('indeterminate-at-bound') ? 'indeterminate-at-bound' : 'screened-bounded';
  return {
    status,
    physicalCertificate: false,
    fullPathViolationProven: false,
    durationSeconds: canonical.durationSeconds,
    targetPosition: canonical.targetPosition,
    subdivisionDepth,
    bounds,
    numericalQualification: 'Bernstein convex-hull floating-point screen with dimension-specific heuristic roundoff bands scaled by controls, limits, and normalized power coefficients; this is not rigorous outward rounding or a formal interval or physical certificate. A hull outside the allowed interval rejects containment only and does not prove an actual trajectory violation.'
  };
}

export function screenVelocityTransition(input) {
  const record = readRecord(input, 'input', ['segment', 'limits'], ['subdivisionDepth']);
  const canonical = validateCanonicalSegment(record.segment);
  const limits = readLimits(record.limits);
  const subdivisionDepth = depthValue(record.subdivisionDepth === undefined ? DEFAULT_SUBDIVISION_DEPTH : record.subdivisionDepth);
  if (canonical.start.position < limits.position[0] || canonical.start.position > limits.position[1]) {
    throw new RangeError('start position is outside limits.position');
  }
  if (Math.abs(canonical.start.velocity) > limits.velocityAbs || Math.abs(canonical.start.acceleration) > limits.accelerationAbs) {
    throw new RangeError('start velocity or acceleration is outside its limit');
  }
  if (Math.abs(canonical.targetVelocity) > limits.velocityAbs) throw new RangeError('targetVelocity is outside limits.velocityAbs');
  return screenCanonical(canonical, limits, subdivisionDepth);
}

function readDurationGrid(value) {
  const raw = readDenseArray(value, 'durationSeconds', 1, MAX_CANDIDATES);
  const grid = raw.map((duration, i) => finite(duration, `durationSeconds[${i}]`, 0.01, CAPS.durationSeconds));
  for (let i = 1; i < grid.length; i++) {
    if (!(grid[i] > grid[i - 1])) throw new RangeError('durationSeconds must be strictly ascending with no duplicates');
  }
  return grid;
}

export function findBoundedVelocityTransition(input) {
  const record = readRecord(input, 'input', ['startByJoint', 'targetVelocityByJoint', 'limitsByJoint', 'durationSeconds'], ['subdivisionDepth']);
  const startEntries = readJointMap(record.startByJoint, 'startByJoint');
  const joints = startEntries.map(([joint]) => joint);
  const targets = readJointMap(record.targetVelocityByJoint, 'targetVelocityByJoint', joints);
  const limitEntries = readJointMap(record.limitsByJoint, 'limitsByJoint', joints);
  if (targets.length !== joints.length || limitEntries.length !== joints.length) throw new TypeError('joint maps must have exactly the same joint keys');
  const targetMap = new Map(targets);
  const limitMap = new Map(limitEntries.map(([joint, value]) => [joint, readLimits(value, `limitsByJoint.${joint}`)]));
  const starts = new Map(startEntries.map(([joint, value]) => [joint, readStart(value, `startByJoint.${joint}`)]));
  const depth = depthValue(record.subdivisionDepth === undefined ? DEFAULT_SUBDIVISION_DEPTH : record.subdivisionDepth);
  const grid = readDurationGrid(record.durationSeconds);

  for (const joint of joints) {
    const start = starts.get(joint), target = finite(targetMap.get(joint), `targetVelocityByJoint.${joint}`, -CAPS.velocity, CAPS.velocity);
    const limit = limitMap.get(joint);
    if (start.position < limit.position[0] || start.position > limit.position[1]) throw new RangeError(`${joint} start position is outside limits`);
    if (Math.abs(start.velocity) > limit.velocityAbs) throw new RangeError(`${joint} start velocity is outside limits`);
    if (Math.abs(start.acceleration) > limit.accelerationAbs) throw new RangeError(`${joint} start acceleration is outside limits`);
    if (Math.abs(target) > limit.velocityAbs) throw new RangeError(`${joint} target velocity is outside limits`);
  }

  const candidateReports = [];
  for (const durationSeconds of grid) {
    const segments = Object.create(null), jointScreens = Object.create(null);
    let failedToFit = false;
    for (const joint of joints) {
      try {
        const segment = makeSegment(starts.get(joint), targetMap.get(joint), durationSeconds);
        const screen = screenCanonical(segment, limitMap.get(joint), depth);
        segments[joint] = segment;
        jointScreens[joint] = screen;
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        failedToFit = true;
        jointScreens[joint] = { status: 'screen-rejected', reason: 'candidate exceeded supported finite output cap' };
        break;
      }
    }
    if (failedToFit) {
      candidateReports.push({ durationSeconds, status: 'screen-rejected', jointScreens });
      continue;
    }
    const statuses = Object.values(jointScreens).map(screen => screen.status);
    const status = statuses.includes('screen-rejected') ? 'screen-rejected' :
      statuses.includes('indeterminate-at-bound') ? 'indeterminate-at-bound' : 'screened-bounded';
    const report = { durationSeconds, status, jointScreens };
    if (status === 'screened-bounded') {
      return {
        status,
        physicalCertificate: false,
        fullPathViolationProven: false,
        durationSeconds,
        segments,
        jointScreens,
        candidatesChecked: candidateReports.length + 1,
        rejectedCandidates: candidateReports,
        numericalQualification: 'Bernstein convex-hull floating-point screen with dimension-specific heuristic roundoff bands scaled by controls, limits, and normalized power coefficients; this is not rigorous outward rounding or a formal interval or physical certificate. A hull outside the allowed interval rejects containment only and does not prove an actual trajectory violation.'
      };
    }
    candidateReports.push(report);
  }
  const status = candidateReports.some(candidate => candidate.status === 'indeterminate-at-bound')
    ? 'indeterminate-at-bound' : 'screen-rejected';
  return {
    status,
    physicalCertificate: false,
    fullPathViolationProven: false,
    candidatesChecked: candidateReports.length,
    rejectedCandidates: candidateReports,
    reason: status === 'indeterminate-at-bound'
      ? 'No duration on the supplied finite grid was screened-bounded; at least one candidate overlaps a numerical bound margin, and the finite search does not establish global infeasibility.'
      : 'No duration on the supplied finite grid was screened-bounded; this finite search does not establish global infeasibility.',
    numericalQualification: 'Bernstein convex-hull floating-point screen with dimension-specific heuristic roundoff bands scaled by controls, limits, and normalized power coefficients; this is not rigorous outward rounding or a formal interval or physical certificate. A hull outside the allowed interval rejects containment only and does not prove an actual trajectory violation.'
  };
}
