// Offline differential-kinematics study. Pure math; no controller or transport.
import {GEOMETRY,KINEMATIC_MODELS,LEGACY_MODEL_REVISION,forwardKinematics} from '../kinematics.mjs';

export const SPATIAL_JOINTS=Object.freeze(['base','shoulder','elbow']);
const finite=(x,name)=>{if(!Number.isFinite(x))throw Error(`${name} must be finite`);return x;};
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);

/** Rows xyz in mm, columns base/shoulder/elbow in raw radians. */
export function armJacobian(pose,modelRevision=LEGACY_MODEL_REVISION){
  const tip=forwardKinematics(pose,modelRevision),model=KINEMATIC_MODELS[modelRevision];
  const {l2,l3,t2rad}=GEOMETRY,b=pose.base,s=pose.shoulder,e=pose.elbow;
  const r=l2*Math.sin(s+t2rad)+l3*Math.sin(s+e+model.distalOffsetRad);
  const re=l3*Math.cos(s+e+model.distalOffsetRad),ze=-l3*Math.sin(s+e+model.distalOffsetRad);
  return [
    [-r*Math.sin(b),tip.z*Math.cos(b),re*Math.cos(b)],
    [ r*Math.cos(b),tip.z*Math.sin(b),re*Math.sin(b)],
    [0,-r,ze],
  ];
}

function solve3(matrix,rhs){
  const a=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let col=0;col<3;col++){
    let pivot=col;for(let r=col+1;r<3;r++)if(Math.abs(a[r][col])>Math.abs(a[pivot][col]))pivot=r;
    if(Math.abs(a[pivot][col])<1e-14)throw Error('Numerically singular damped system');
    [a[col],a[pivot]]=[a[pivot],a[col]];
    const scale=a[col][col];for(let c=col;c<4;c++)a[col][c]/=scale;
    for(let r=0;r<3;r++)if(r!==col){const factor=a[r][col];for(let c=col;c<4;c++)a[r][c]-=factor*a[col][c];}
  }
  return a.map(row=>row[3]);
}

/**
 * Damped least-squares joint velocity candidate, globally scaled to velocity
 * bounds. This is not collision-aware, torque control or physical permission.
 * Damping has the same length scale as the mm/radian Jacobian. It introduces
 * task-space error, which is returned explicitly rather than hidden.
 */
export function dampedJointVelocity(pose,velocityMmPerSecond,{modelRevision=LEGACY_MODEL_REVISION,dampingMm=15,maxJointVelocity=0.3}={}){
  if(!Array.isArray(velocityMmPerSecond)||velocityMmPerSecond.length!==3)throw Error('Cartesian velocity must have exactly xyz');
  for(let i=0;i<3;i++)if(Math.abs(finite(velocityMmPerSecond[i],`velocity[${i}]`))>1e6)throw Error('Cartesian velocity exceeds numeric experiment cap 1000000 mm/s');
  if(finite(dampingMm,'dampingMm')<0.001||dampingMm>1e6)throw Error('dampingMm must be 0.001..1000000');
  const bounds=typeof maxJointVelocity==='number'?SPATIAL_JOINTS.map(()=>maxJointVelocity):SPATIAL_JOINTS.map(j=>maxJointVelocity?.[j]);
  bounds.forEach(v=>{if(finite(v,'joint velocity bound')<=0)throw Error('Joint velocity bounds must be positive');});
  const J=armJacobian(pose,modelRevision),A=J.map((row,r)=>J.map((other,c)=>dot(row,other)+(r===c?dampingMm*dampingMm:0)));
  const y=solve3(A,velocityMmPerSecond),unscaled=SPATIAL_JOINTS.map((_,c)=>J.reduce((sum,row,r)=>sum+row[c]*y[r],0));
  const scale=Math.min(1,...unscaled.map((v,i)=>v===0?1:bounds[i]/Math.abs(v)));
  const velocity=unscaled.map(v=>v*scale),achievedMmPerSecond=J.map(row=>dot(row,velocity));
  const residualMmPerSecond=velocityMmPerSecond.map((v,i)=>v-achievedMmPerSecond[i]);
  const residualNormMmPerSecond=Math.hypot(...residualMmPerSecond);
  [scale,...velocity,...achievedMmPerSecond,...residualMmPerSecond,residualNormMmPerSecond].forEach(v=>finite(v,'computed differential result'));
  return {simulationOnly:true,jointVelocityRadPerSecond:Object.fromEntries(SPATIAL_JOINTS.map((j,i)=>[j,velocity[i]])),scale,achievedMmPerSecond,residualMmPerSecond,residualNormMmPerSecond,dampingMm,modelRevision};
}
