import * as THREE from 'three';

export const IDLE_ACTIONS=['chat','coffee','stretch','note','think','wave','watch','tie','look','foot'];

// Bake short gestures into the existing character rig; every sample restores its inputs.
export function applyIdlePose(bones,action,time,duration=6){
 const saved=bones.map(b=>[b,b.position.clone(),b.quaternion.clone()]);
 const find=name=>bones.find(b=>b.name.replace(/[.\s_]/g,'').toLowerCase()===name);
 const root=bones[0],smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
 // Give the bulky forearm shells clearance from the jacket even at rest.
 root.updateWorldMatrix(true,true);
 for(const [side,suffix]of [[-1,'r'],[1,'l']]){
  const upper=find('upperarm'+suffix),world=upper.getWorldQuaternion(new THREE.Quaternion());
  world.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),side*.34));
  upper.quaternion.copy(upper.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));upper.updateWorldMatrix(true,true);
 }
 const neutral=bones.map(b=>[b,b.position.clone(),b.quaternion.clone()]);
 // A carried mug begins and ends in a stable holding pose, never swung past the elbow.
 const envelope=action==='coffee'?1:smooth(time/.65)*smooth((duration-time)/.65);
 const phase=time/duration*Math.PI*2,sway=Math.sin(phase),pulse=(1-Math.cos(phase))/2;
 function turn(name,x=0,y=0,z=0){find(name).quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)));}
 function aim(bone,child,target){
  const origin=bone.getWorldPosition(new THREE.Vector3()),from=child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
  const world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(from,to));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(true,true);
 }
 function hand(side,target,orientation=null,bendUp=-.5){
  root.updateWorldMatrix(true,true);
  const suffix=side<0?'r':'l',upper=find('upperarm'+suffix),lower=find('lowerarm'+suffix),palm=find('hand'+suffix);
  const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=lower.getWorldPosition(new THREE.Vector3()),wrist=palm.getWorldPosition(new THREE.Vector3());
  const l1=shoulder.distanceTo(elbow),l2=elbow.distanceTo(wrist),delta=target.clone().sub(shoulder),distance=Math.min(delta.length(),l1+l2-.001),direction=delta.normalize();
  const out=new THREE.Vector3(side,bendUp,0);out.addScaledVector(direction,-out.dot(direction)).normalize();
  const c=THREE.MathUtils.clamp((l1*l1+distance*distance-l2*l2)/(2*l1*distance),-1,1);
  const bend=shoulder.clone().addScaledVector(direction,l1*c).addScaledVector(out,l1*Math.sqrt(1-c*c));
  aim(upper,lower,bend);aim(lower,palm,shoulder.clone().addScaledVector(direction,distance));
  if(orientation){palm.quaternion.copy(palm.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));palm.updateWorldMatrix(true,true);}
 }
 const v=(x,y,z)=>new THREE.Vector3(x,y,z);
 const upright=new THREE.Quaternion(),forward=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0));
 switch(action){
  case 'chat': turn('head',.05*Math.sin(phase*3),.1*sway);turn('chest',0,.04*sway);hand(-1,v(-.48,.94+.06*Math.sin(phase*3),.43),forward);hand(1,v(.48,.87,.43),forward);break;
  case 'coffee': turn('head',-.04*pulse);hand(-1,v(-.30,1.0+.20*pulse,.57),new THREE.Quaternion().setFromEuler(new THREE.Euler(-.12*pulse,0,0)));break;
  case 'stretch': turn('chest',-.04,0,.025*sway);turn('head',-.05);hand(-1,v(-.69,1.36,.14),upright);hand(1,v(.69,1.36,.14),upright);break;
  case 'note': turn('head',.10,.03*sway);hand(-1,v(-.28,1.00,.52),upright);break;
  case 'think': turn('head',-.025,.06*sway,.025);hand(-1,v(-.28,1.20,.51),upright);break;
  case 'wave': turn('head',0,-.08);hand(-1,v(-.69+.025*Math.sin(phase*5),1.36,.18),upright);break;
  case 'watch': turn('head',.16,.18);hand(1,v(.38,.96,.49),forward);break;
  case 'tie': turn('head',.06);hand(-1,v(-.08,1.06+.025*Math.sin(phase*3),.39),forward,.65);break;
  case 'look': turn('head',-.035,.42*sway);turn('chest',0,.10*sway);break;
  case 'foot': turn('footr',-.18*(.5+.5*Math.sin(phase*6)));turn('head',0,.07*sway);break;
 }
 for(const [bone,position,rotation]of neutral){const target=bone.quaternion.clone();bone.position.lerpVectors(position,bone.position,envelope);bone.quaternion.slerpQuaternions(rotation,target,envelope);}
 return ()=>{for(const [bone,position,rotation]of saved){bone.position.copy(position);bone.quaternion.copy(rotation);}};
}
