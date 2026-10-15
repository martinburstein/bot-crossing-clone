/**
 * Bounded one-joint quintic trajectory and replan experiment (pure math only).
 *
 * Curve input:
 *   { start:{position,velocity,acceleration}, targetPosition, durationSeconds }
 * Limits for certifyQuintic:
 *   { position:[min,max], velocityAbs, accelerationAbs, jerkAbs }
 * Replan search adds:
 *   { duration:{minSeconds,maxSeconds,stepSeconds}, maxCandidates? }
 *
 * Example hand-check: start at rest at 0, target 1, T=1 gives normalized
 * coefficients [0,0,0,10,-15,6]. At u=.5, position=.5, velocity=1.875,
 * acceleration=0, jerk=-30. Given a current state (p,v,a), a newly fitted
 * curve starts with exactly that position, velocity, and acceleration, so a
 * replan is C2 continuous mathematically. Jerk continuity is not imposed.
 * This is not a plant model, firmware integration, or online safety guarantee.
 */

const MAX_MAGNITUDE = 1e9;
const MAX_DURATION = 600;
const MAX_CANDIDATES = 200;

function finiteBounded(value, name, min = -MAX_MAGNITUDE, max = MAX_MAGNITUDE) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be finite and within [${min}, ${max}]`);
  }
  return value;
}

function readStart(start) {
  if (!start || typeof start !== "object" || Array.isArray(start)) throw new TypeError("start must be {position, velocity, acceleration}");
  return {
    position: finiteBounded(start.position, "start.position"),
    velocity: finiteBounded(start.velocity, "start.velocity"),
    acceleration: finiteBounded(start.acceleration, "start.acceleration")
  };
}

function coefficientsFor(start, targetPosition, durationSeconds) {
  const T = durationSeconds;
  const c0 = start.position;
  const c1 = start.velocity * T;
  const c2 = 0.5 * start.acceleration * T * T;
  const A = targetPosition - c0 - c1 - c2;
  const B = -c1 - 2 * c2;
  const C = -2 * c2;
  const c3 = 10 * A - 4 * B + C / 2;
  const c4 = 7 * B - 15 * A - C;
  const c5 = 6 * A - 3 * B + C / 2;
  const coefficients = [c0, c1, c2, c3, c4, c5];
  coefficients.forEach((value, i) => finiteBounded(value, `coefficient[${i}]`));
  return coefficients;
}

export function fitQuintic({ start, targetPosition, durationSeconds } = {}) {
  const initial = readStart(start);
  const target = finiteBounded(targetPosition, "targetPosition");
  const T = finiteBounded(durationSeconds, "durationSeconds", Number.MIN_VALUE, MAX_DURATION);
  return {
    degree: 5,
    start: initial,
    targetPosition: target,
    durationSeconds: T,
    coefficients: coefficientsFor(initial, target, T)
  };
}

function validateCurve(curve) {
  if (!curve || typeof curve !== "object" || Array.isArray(curve) || curve.degree !== 5) throw new TypeError("curve must be a quintic returned by fitQuintic");
  const start = readStart(curve.start);
  const target = finiteBounded(curve.targetPosition, "curve.targetPosition");
  const T = finiteBounded(curve.durationSeconds, "curve.durationSeconds", Number.MIN_VALUE, MAX_DURATION);
  if (!Array.isArray(curve.coefficients) || curve.coefficients.length !== 6) throw new TypeError("curve.coefficients must contain six finite values");
  for (let i = 0; i < 6; i++) if (!(i in curve.coefficients)) throw new TypeError("curve.coefficients must be dense");
  const coefficients = curve.coefficients.map((value, i) => finiteBounded(value, `curve.coefficients[${i}]`));
  const expected = coefficientsFor(start, target, T);
  if (coefficients.some((value, i) => value !== expected[i])) {
    throw new RangeError("curve coefficients do not match the stated C2 start and rest target boundary conditions");
  }
  return { start, target, T, coefficients };
}

function derivativePower(coefficients, order, durationSeconds) {
  let current = coefficients.slice();
  for (let d = 0; d < order; d++) current = current.slice(1).map((value, i) => (i + 1) * value);
  const scale = durationSeconds ** order;
  return current.map(value => finiteBounded(value / scale, "time-scaled derivative coefficient"));
}

function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let value = 1;
  for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i;
  return value;
}

function powerToBernstein(power) {
  const n = power.length - 1;
  const bernstein = [];
  for (let k = 0; k <= n; k++) {
    let value = 0;
    for (let i = 0; i <= k; i++) value += power[i] * choose(k, i) / choose(n, i);
    bernstein.push(finiteBounded(value, "Bernstein coefficient"));
  }
  return bernstein;
}

function evaluatePower(coefficients, u) {
  let value = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) value = value * u + coefficients[i];
  return value;
}

export function evaluateQuintic(curve, timeSeconds) {
  const { T, coefficients } = validateCurve(curve);
  const t = finiteBounded(timeSeconds, "timeSeconds", 0, T);
  const u = t / T;
  const p = evaluatePower(coefficients, u);
  const v = evaluatePower(derivativePower(coefficients, 1, T), u);
  const a = evaluatePower(derivativePower(coefficients, 2, T), u);
  const j = evaluatePower(derivativePower(coefficients, 3, T), u);
  return {
    timeSeconds: t,
    position: finiteBounded(p, "evaluated position"),
    velocity: finiteBounded(v, "evaluated velocity"),
    acceleration: finiteBounded(a, "evaluated acceleration"),
    jerk: finiteBounded(j, "evaluated jerk")
  };
}

function validateLimits(limits) {
  if (!limits || typeof limits !== "object" || Array.isArray(limits)) throw new TypeError("limits must be an object");
  if (!Array.isArray(limits.position) || limits.position.length !== 2) throw new TypeError("limits.position must be [min,max]");
  const minPosition = finiteBounded(limits.position[0], "limits.position[0]");
  const maxPosition = finiteBounded(limits.position[1], "limits.position[1]");
  if (minPosition > maxPosition) throw new RangeError("position minimum must not exceed maximum");
  return {
    position: [minPosition, maxPosition],
    velocityAbs: finiteBounded(limits.velocityAbs, "limits.velocityAbs", 0, MAX_MAGNITUDE),
    accelerationAbs: finiteBounded(limits.accelerationAbs, "limits.accelerationAbs", 0, MAX_MAGNITUDE),
    jerkAbs: finiteBounded(limits.jerkAbs, "limits.jerkAbs", 0, MAX_MAGNITUDE)
  };
}

function validateInitialWithinLimits(start, limits) {
  if (start.position < limits.position[0] || start.position > limits.position[1] ||
      Math.abs(start.velocity) > limits.velocityAbs || Math.abs(start.acceleration) > limits.accelerationAbs) {
    throw new RangeError("initial position, velocity, and acceleration must already be within limits");
  }
}

function splitBernstein(coefficients) {
  let row = coefficients.slice();
  const left = [row[0]], right = [row.at(-1)];
  while (row.length > 1) {
    row = row.slice(0, -1).map((value, i) => (value + row[i + 1]) / 2);
    left.push(row[0]); right.unshift(row.at(-1));
  }
  return [left, right];
}

function boundFor(curve, order, subdivisionDepth) {
  const power = derivativePower(curve.coefficients, order, curve.durationSeconds);
  const bernstein = powerToBernstein(power);
  let pieces = [bernstein];
  for (let depth = 0; depth < subdivisionDepth; depth++) pieces = pieces.flatMap(splitBernstein);
  return {
    coefficients: bernstein,
    segments: pieces.length,
    min: Math.min(...pieces.map(piece => Math.min(...piece))),
    max: Math.max(...pieces.map(piece => Math.max(...piece)))
  };
}

/**
 * Certifies the full normalized interval via Bernstein convex-hull bounds.
 * In exact arithmetic, returned bounds are conservative; failure to certify
 * is not proof of a violation. This floating-point implementation is not
 * formally interval-verified. No dense time sampling is used as the proof.
 */
export function certifyQuintic(curve, limits, {subdivisionDepth = 0} = {}) {
  if (!Number.isInteger(subdivisionDepth) || subdivisionDepth < 0 || subdivisionDepth > 8) throw new RangeError('subdivisionDepth must be an integer from 0 to 8');
  const validated = validateCurve(curve);
  const L = validateLimits(limits);
  validateInitialWithinLimits(validated.start, L);
  const normalizedCurve = { ...validated, durationSeconds: validated.T, coefficients: validated.coefficients };
  const bounds = {
    position: boundFor(normalizedCurve, 0, subdivisionDepth),
    velocity: boundFor(normalizedCurve, 1, subdivisionDepth),
    acceleration: boundFor(normalizedCurve, 2, subdivisionDepth),
    jerk: boundFor(normalizedCurve, 3, subdivisionDepth)
  };
  const method = `power-to-Bernstein convex hull on u in [0,1], ${subdivisionDepth} midpoint subdivision levels`;
  const certified = bounds.position.min >= L.position[0] && bounds.position.max <= L.position[1] &&
    bounds.velocity.min >= -L.velocityAbs && bounds.velocity.max <= L.velocityAbs &&
    bounds.acceleration.min >= -L.accelerationAbs && bounds.acceleration.max <= L.accelerationAbs &&
    bounds.jerk.min >= -L.jerkAbs && bounds.jerk.max <= L.jerkAbs;
  return {
    certified,
    bounds,
    subdivisionDepth,
    method,
    numericalQualification: "Convex-hull bounds are conservative in exact arithmetic; floating-point operations are not formally interval-verified."
  };
}

/**
 * Exhaustively checks a finite duration grid; feasibility is not assumed
 * monotone in duration. Returns no-certified-candidate when the stated grid
 * contains no curve whose Bernstein bounds certify every supplied limit.
 */
export function findBoundedReplan({ start, targetPosition, duration, limits, maxCandidates = MAX_CANDIDATES, subdivisionDepth = 0 } = {}) {
  if (!Number.isInteger(subdivisionDepth) || subdivisionDepth < 0 || subdivisionDepth > 8) throw new RangeError('subdivisionDepth must be an integer from 0 to 8');
  const initial = readStart(start);
  const target = finiteBounded(targetPosition, "targetPosition");
  const L = validateLimits(limits);
  validateInitialWithinLimits(initial, L);
  if (!duration || typeof duration !== "object" || Array.isArray(duration)) throw new TypeError("duration must specify minSeconds, maxSeconds, and stepSeconds");
  const min = finiteBounded(duration.minSeconds, "duration.minSeconds", Number.MIN_VALUE, MAX_DURATION);
  const max = finiteBounded(duration.maxSeconds, "duration.maxSeconds", min, MAX_DURATION);
  const step = finiteBounded(duration.stepSeconds, "duration.stepSeconds", Number.MIN_VALUE, MAX_DURATION);
  const cap = finiteBounded(maxCandidates, "maxCandidates", 1, MAX_CANDIDATES);
  if (!Number.isInteger(cap)) throw new RangeError("maxCandidates must be an integer from 1 to 200");
  const regularCount = Math.floor((max - min) / step) + 1;
  if (!Number.isFinite(regularCount) || regularCount > cap) throw new RangeError("duration grid exceeds maxCandidates bound");
  const durations = Array.from({length:regularCount}, (_, i) => min + i * step).filter(T => T <= max);
  if (durations.at(-1) < max) durations.push(max);
  const count = durations.length;
  if (count > cap || count > MAX_CANDIDATES) throw new RangeError("duration grid exceeds maxCandidates bound");

  const rejected = [];
  for (let i = 0; i < count; i++) {
    const T = durations[i];
    try {
      const curve = fitQuintic({ start: initial, targetPosition: target, durationSeconds: T });
      const result = certifyQuintic(curve, L, {subdivisionDepth});
      if (result.certified) return { status: "certified-candidate", curve, certification: result, candidatesChecked: i + 1 };
      rejected.push({ durationSeconds: T, bounds: result.bounds });
    } catch (error) {
      // A numerically unbounded candidate cannot be certified; keep searching
      // the finite grid and report it as rejected rather than inventing fallback.
      if (!(error instanceof RangeError)) throw error;
      rejected.push({ durationSeconds: T, reason: "candidate could not be numerically bounded" });
    }
  }
  return {
    status: "no-certified-candidate",
    reason: "No duration on the fully checked finite grid was certified; no fallback curve is provided.",
    candidatesChecked: count,
    rejected
  };
}
