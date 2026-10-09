import * as THREE from 'three'
import {createRoArmModel} from './roarm-model.js'

const JOINTS=Object.freeze(['base','shoulder','elbow','gripper'])
const BOUNDS=Object.freeze({
  // Illustrative visualization ranges only; these are not controller limits.
  base:Object.freeze([-Math.PI,Math.PI]),
  shoulder:Object.freeze([-Math.PI/2,Math.PI/2]),
  elbow:Object.freeze([-Math.PI/4,Math.PI]),
  gripper:Object.freeze([1.08,3.144660615]),
})
const MAX_MOVES=10
const MAX_OBSERVATION_AGE_MS=5000
const SEGMENT_SECONDS=.55
const MAX_FRAME_DELTA_SECONDS=.25
const DEFAULT_COLOR=0x52e2ef

export const ROARM_PREVIEW_LIMITS_RAD=BOUNDS
export const ROARM_PREVIEW_MAX_MOVES=MAX_MOVES

function finitePose(pose,label='pose') {
  if(!pose||typeof pose!=='object'||Array.isArray(pose))throw new TypeError(`${label} must be a joint pose object in raw radians`)
  const copy={}
  for(const joint of JOINTS) {
    const angle=pose[joint]
    if(typeof angle!=='number'||!Number.isFinite(angle))throw new TypeError(`${label}.${joint} must be finite radians`)
    const [min,max]=BOUNDS[joint]
    if(angle<min||angle>max)throw new RangeError(`${label}.${joint} is outside the illustrative simulation range`)
    copy[joint]=angle
  }
  return copy
}

function currentMeasuredPose(observation,now) {
  if(!observation||observation.state!=='live')throw new Error('A fresh live observation is required to start a simulation preview')
  if(!['hardware','simulator'].includes(observation.source))throw new Error('The measured starting pose source must be hardware or simulator')
  if(typeof observation.observedAt!=='string'||!Number.isFinite(now))throw new Error('The measured starting pose needs a valid observation timestamp')
  const timestamp=Date.parse(observation.observedAt)
  if(!Number.isFinite(timestamp)||timestamp>now||now-timestamp>MAX_OBSERVATION_AGE_MS)
    throw new Error('The measured starting pose is stale or has an invalid timestamp')
  return finitePose(observation.pose,'startPose.pose')
}

function mix(a,b,t) { return a+(b-a)*t }
function interpolate(a,b,t) { return Object.fromEntries(JOINTS.map(joint=>[joint,mix(a[joint],b[joint],t)])) }

/**
 * Add an explicitly hypothetical, translucent joint model to a Three.js scene.
 * This object owns no observation reader, robot client, serial port, or network
 * path. The only start point it accepts is a recent live observation supplied
 * by the caller; moves are complete absolute raw-radian joint targets.
 */
export function createRoArmPreview(scene,{now=Date.now}={}) {
  if(!scene?.add)throw new TypeError('createRoArmPreview requires a Three.js scene')
  if(typeof now!=='function')throw new TypeError('preview clock must be a function')
  const model=createRoArmModel(),group=model.group
  group.name='roarm-simulation-ghost';group.userData.simulationOnly=true;group.userData.source='simulation-preview'
  const ownedMaterials=new Set()
  group.traverse(object=>{
    if(!object.isMesh||!object.material)return
    const source=Array.isArray(object.material)?object.material:[object.material]
    const ghost=source.map(material=>{
      const copy=material.clone();copy.color.set(DEFAULT_COLOR);copy.emissive?.set(DEFAULT_COLOR)
      copy.emissiveIntensity=.18;copy.transparent=true;copy.opacity=.34;copy.depthWrite=false
      ownedMaterials.add(copy);return copy
    })
    object.material=Array.isArray(object.material)?ghost:ghost[0]
  })
  scene.add(group)

  let disposed=false,status='idle',source=null,observedAt=null,sequence=[],segment=0,elapsed=0,currentPose=null
  function assertActive() { if(disposed)throw new Error('RoArm preview is disposed') }
  function poseObservation(pose) {
    currentPose={...pose}
    model.updateObservation({source:'simulation-preview',state:'measured',pose:currentPose,observedAt})
  }
  function snapshot() {
    return {simulationOnly:true,status,source,observedAt,completedMoves:Math.min(segment,Math.max(0,sequence.length-1)),totalMoves:Math.max(0,sequence.length-1),
      pose:currentPose?{...currentPose}:null,limitsRad:BOUNDS,clearance:'unverified'}
  }
  function preview({startPose,moves}={}) {
    assertActive()
    if(!Array.isArray(moves)||moves.length<1||moves.length>MAX_MOVES)throw new RangeError(`Preview needs 1 to ${MAX_MOVES} bounded moves`)
    const start=currentMeasuredPose(startPose,now())
    const targets=moves.map((pose,index)=>finitePose(pose,`moves[${index}]`))
    source=startPose.source??null;observedAt=startPose.observedAt
    sequence=[start,...targets];segment=0;elapsed=0;status='previewing'
    poseObservation(start)
    return snapshot()
  }
  function update(dt) {
    assertActive()
    if(typeof dt!=='number'||!Number.isFinite(dt)||dt<0)throw new TypeError('preview delta time must be finite and nonnegative')
    if(status!=='previewing')return snapshot()
    elapsed+=Math.min(dt,MAX_FRAME_DELTA_SECONDS)
    while(elapsed>=SEGMENT_SECONDS&&segment<sequence.length-1) {elapsed-=SEGMENT_SECONDS;segment++}
    const from=sequence[segment],to=sequence[Math.min(segment+1,sequence.length-1)]
    const t=segment>=sequence.length-1?1:Math.min(elapsed/SEGMENT_SECONDS,1)
    poseObservation(interpolate(from,to,t))
    if(segment===sequence.length-1)status='complete'
    return snapshot()
  }
  function clear() {
    assertActive();status='idle';source=null;observedAt=null;sequence=[];segment=0;elapsed=0;currentPose=null;group.visible=false
    return snapshot()
  }
  function dispose() {
    if(disposed)return
    disposed=true;scene.remove(group);model.dispose()
    for(const material of ownedMaterials)material.dispose()
    ownedMaterials.clear();sequence=[];currentPose=null;status='disposed'
  }
  return {group,preview,clear,update,snapshot,dispose,get limitsRad(){return BOUNDS}}
}
