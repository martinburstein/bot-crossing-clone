import * as THREE from 'three';
import {IDLE_ACTIONS,applyIdlePose} from './idle-poses.js';

// Shared visual motions. These definitions never dispatch work or alter task state.
export const OFFICE_ANIMATION_VERSION='1.0.0';
export const OFFICE_ANIMATIONS=Object.freeze([
 {id:'sitting',label:'Sitting & typing',description:'Sit down, roll in, type, and stand up again.',clips:['officeSitDown','officeTyping','officeStandUp']},
 {id:'chat',label:'Chatting',description:'A little conversation with a colleague.'},
 {id:'coffee',label:'Sipping coffee',description:'Lift a mug, take a sip, and lower it again.'},
 {id:'stretch',label:'Stretching',description:'Raise both arms and loosen up the shoulders.'},
 {id:'note',label:'Reading a note',description:'Hold a small note and glance over it.'},
 {id:'think',label:'Thinking',description:'Hand to chin, with a thoughtful head tilt.'},
 {id:'wave',label:'Waving',description:'A friendly wave across the office.'},
 {id:'watch',label:'Checking the time',description:'Raise the wrist and glance down.'},
 {id:'tie',label:'Adjusting a tie',description:'Straighten the tie with a small tug.'},
 {id:'look',label:'Looking around',description:'A quiet glance from side to side.'},
 {id:'foot',label:'Tapping a foot',description:'An absent-minded little foot tap.'},
].map(item=>Object.freeze({...item,clips:Object.freeze(item.clips||['idle-'+item.id])})));
export const OFFICE_CLIPS=Object.freeze({
 ...Object.fromEntries(IDLE_ACTIONS.map(action=>['idle-'+action,Object.freeze({name:'Idle_A',loop:true,pose:'idle-'+action,duration:6})])),
 officeSitDown:Object.freeze({name:'Idle_A',loop:false,pose:'office-down',duration:1.2}),
 officeTyping:Object.freeze({name:'Idle_A',loop:true,pose:'office-type',duration:4}),
 officeStandUp:Object.freeze({name:'Idle_A',loop:false,pose:'office-up',duration:1.2}),
});
export function isOfficePose(pose){return typeof pose==='string'&&(pose.startsWith('idle-')||pose.startsWith('office-'));}
export function applyOfficeAnimation(bones,pose,time,duration){
 return pose?.startsWith('idle-')?applyIdlePose(bones,pose.slice(5),time,duration):applyOfficePose(bones,pose,time);
}

export function applyOfficePose(bones,pose,time){
  const saved=bones.map(b=>[b,b.position.clone(),b.quaternion.clone()]);
  const find=name=>bones.find(b=>b.name.replace(/[.\s_]/g,'').toLowerCase()===name);
  const smooth=v=>{v=THREE.MathUtils.clamp(v,0,1);return v*v*(3-2*v);};
  const seated=pose==='office-down'?smooth(time/1.2):pose==='office-up'?1-smooth(time/1.2):1;
  const root=bones[0];root.updateWorldMatrix(true,true);
  for(const [side,suffix]of [[-1,'r'],[1,'l']]){const upper=find('upperarm'+suffix),world=upper.getWorldQuaternion(new THREE.Quaternion());world.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),side*.34));upper.quaternion.copy(upper.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));upper.updateWorldMatrix(true,true);}
  const originals=Object.fromEntries(['footl','footr','handl','handr'].map(n=>[n,{position:find(n).getWorldPosition(new THREE.Vector3()),rotation:find(n).getWorldQuaternion(new THREE.Quaternion())}]));
  find('hips').position.y-=.17*seated;
  find('chest').quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.045*seated,0,0)));
  root.updateWorldMatrix(true,true);
  function aim(bone,child,target){
    const origin=bone.getWorldPosition(new THREE.Vector3()),from=child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
    const world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(from,to));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(true,true);
  }
  function solve(upper,lower,end,target,out,rotation){
    const origin=upper.getWorldPosition(new THREE.Vector3()),joint=lower.getWorldPosition(new THREE.Vector3()),tip=end.getWorldPosition(new THREE.Vector3());
    const a=origin.distanceTo(joint),b=joint.distanceTo(tip),delta=target.clone().sub(origin),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(a-b)+.0001,a+b-.0001),direction=delta.normalize();
    out.addScaledVector(direction,-out.dot(direction)).normalize();
    const c=THREE.MathUtils.clamp((a*a+distance*distance-b*b)/(2*a*distance),-1,1);
    const bend=origin.clone().addScaledVector(direction,a*c).addScaledVector(out,a*Math.sqrt(1-c*c));
    aim(upper,lower,bend);aim(lower,end,origin.clone().addScaledVector(direction,distance));
    end.quaternion.copy(end.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));end.updateWorldMatrix(true,true);
  }
  for(const [side,suffix]of [[-1,'r'],[1,'l']]){
    const foot=originals['foot'+suffix],target=foot.position.clone();target.z=THREE.MathUtils.lerp(target.z,.25,seated);
    solve(find('upperleg'+suffix),find('lowerleg'+suffix),find('foot'+suffix),target,new THREE.Vector3(0,0,1),foot.rotation);
    const hand=originals['hand'+suffix],lift=smooth(seated/.42),reach=smooth((seated-.30)/.70);
    const tap=pose==='office-type'?.010*(1+Math.sin(time*Math.PI*6+side*Math.PI/2))*smooth(time/.25)*smooth((4-time)/.25):0;
    const palm=new THREE.Vector3(THREE.MathUtils.lerp(hand.position.x,side*.30,reach),THREE.MathUtils.lerp(hand.position.y,1.00+tap,lift)+.05*Math.sin(Math.PI*reach),THREE.MathUtils.lerp(hand.position.z,.52,lift));
    const rotation=hand.rotation.clone().slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0)),lift);
    solve(find('upperarm'+suffix),find('lowerarm'+suffix),find('hand'+suffix),palm,new THREE.Vector3(side,-.15,0),rotation);
  }
  find('head').quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.025*seated,pose==='office-type'?.025*Math.sin(time*Math.PI/2):0,0)));
  return ()=>{for(const [bone,position,rotation]of saved){bone.position.copy(position);bone.quaternion.copy(rotation);}};
}
