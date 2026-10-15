// Approximate EoAT geometry for firmware EEMode 0 (gripper), from the pinned
// RoArm-M2-S configuration. This module is pure math and never sends commands.
export const GEOMETRY = Object.freeze({
  l1: 126.06,
  l2A: 236.82,
  l2B: 30.00,
  l3A: 280.15,
  l3B: 1.73,
  l2: Math.hypot(236.82, 30.00),
  l3: Math.hypot(280.15, 1.73),
  t2rad: Math.atan2(30.00, 236.82),
  t3rad: Math.atan2(1.73, 280.15),
  firmwareRevision: 'c6ccc5bda2eb92df2f0850d3e63cc42b81557f4f',
  mode: 'EEMode 0'
});

// These identify source equations, never an installed firmware attestation.
export const LEGACY_MODEL_REVISION = GEOMETRY.firmwareRevision;
export const OFFSET_MODEL_REVISION = 'roarm-m2-260630-eemode0-sha256:d07556deb490cfcb1a439d7b6af023a696c7e95eb7950c7971ea0c85a3cabb90';
export const KINEMATIC_MODELS = Object.freeze({
  [LEGACY_MODEL_REVISION]: Object.freeze({distalOffsetRad:0, label:'Pinned GitHub EEMode 0', mode:GEOMETRY.mode}),
  [OFFSET_MODEL_REVISION]: Object.freeze({distalOffsetRad:GEOMETRY.t3rad, label:'Waveshare June 30, 2026 EEMode 0', mode:GEOMETRY.mode})
});
function modelFor(revision){
  if(typeof revision!=='string'||!Object.hasOwn(KINEMATIC_MODELS,revision))throw Error('Unknown kinematic model revision');
  return KINEMATIC_MODELS[revision];
}

const EPSILON = 1e-9;
const finite = (n, name) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`${name} must be finite`);
  return n;
};

function requireJoints(joints) {
  if (!joints || typeof joints !== 'object' || Array.isArray(joints)) throw new Error('joints must be an object');
  for (const key of ['base', 'shoulder', 'elbow', 'gripper']) finite(joints[key], key);
}

/** FK matching the pinned firmware's EEMode==0 polar-linkage approximation. */
export function forwardKinematics(joints, modelRevision = LEGACY_MODEL_REVISION) {
  requireJoints(joints);
  const {distalOffsetRad} = modelFor(modelRevision);
  const { l2, l3, t2rad } = GEOMETRY;
  const radial = l2 * Math.sin(joints.shoulder + t2rad) + l3 * Math.sin(joints.elbow + joints.shoulder + distalOffsetRad);
  const z = l2 * Math.cos(joints.shoulder + t2rad) + l3 * Math.cos(joints.elbow + joints.shoulder + distalOffsetRad);
  return { x: radial * Math.cos(joints.base), y: radial * Math.sin(joints.base), z, t: joints.gripper };
}

/**
 * Analytic inverse for the same two-link planar approximation. Returns one
 * deterministic, nonsingular branch and rejects branches outside conservative
 * source-derived commissioning envelopes; it does not clip or calibrate.
 */
export function inverseKinematics(point, modelRevision = LEGACY_MODEL_REVISION) {
  const {distalOffsetRad} = modelFor(modelRevision);
  if (!point || typeof point !== 'object' || Array.isArray(point)) throw new Error('point must be an object');
  for (const key of ['x', 'y', 'z', 't']) finite(point[key], key);
  const radial = Math.hypot(point.x, point.y);
  if (radial < EPSILON) throw new Error('Cartesian base-axis singularity is unsupported');
  const { l2, l3, t2rad } = GEOMETRY;
  const distance2 = radial * radial + point.z * point.z;
  const cosQ = (distance2 - l2 * l2 - l3 * l3) / (2 * l2 * l3);
  if (cosQ < -1 - EPSILON || cosQ > 1 + EPSILON) throw new Error('Cartesian target is unreachable');
  const qMagnitude = Math.acos(Math.max(-1, Math.min(1, cosQ)));
  if (Math.abs(Math.sin(qMagnitude)) < 1e-7) throw new Error('Cartesian target is at a linkage singularity');

  const base = Math.atan2(point.y, point.x);
  const candidates = [qMagnitude, -qMagnitude].map(q => {
    const direction = Math.atan2(point.z, radial);
    const a = direction - Math.atan2(l3 * Math.sin(q), l2 + l3 * Math.cos(q));
    const shoulder = Math.PI / 2 - a - t2rad;
    const elbow = t2rad - q - distalOffsetRad;
    return { base, shoulder, elbow, gripper: point.t };
  }).filter(c => c.shoulder >= -Math.PI / 2 && c.shoulder <= Math.PI / 2 && c.elbow >= -Math.PI / 4 && c.elbow <= Math.PI);

  if (!candidates.length) throw new Error('No inverse branch lies inside the conservative shoulder/elbow envelope');
  // Prefer the positive q branch when both branches are available.
  const result = candidates[0];
  if (!Object.values(result).every(Number.isFinite)) throw new Error('Inverse kinematics produced a nonfinite solution');
  return result;
}
