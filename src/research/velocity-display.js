import {ROARM_MODEL_SOURCE} from '../world/roarm-model.js'
import {KINEMATIC_MODELS,LEGACY_MODEL_REVISION} from '../kinematics.mjs'

// Display conversion only: research pins the earlier zero-distal-offset model.
// The shared world model and all measured overlays keep their original equations.
export function velocityDisplayPose(pose){
  const g=ROARM_MODEL_SOURCE.geometryMm
  const sourceOffset=KINEMATIC_MODELS[LEGACY_MODEL_REVISION].distalOffsetRad
  return {...pose,elbow:pose.elbow+sourceOffset-Math.atan2(g.l3B,g.l3A),gripper:.5}
}
export function velocityTargetLocal(xyzMm){
  const s=ROARM_MODEL_SOURCE.scale
  return [xyzMm[1]*s,(xyzMm[2]+ROARM_MODEL_SOURCE.geometryMm.l1)*s,xyzMm[0]*s]
}
