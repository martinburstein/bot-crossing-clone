import {ROARM_PREVIEW_LIMITS_RAD,ROARM_PREVIEW_MAX_MOVES} from '../world/roarm-preview.js'

const JOINT_ORDER=['base','shoulder','elbow','gripper']
const TITLES={base:'Base yaw',shoulder:'Shoulder',elbow:'Elbow',gripper:'Gripper'}
const round1=value=>Math.round(value*10)/10
const degrees=rad=>rad*180/Math.PI
const radians=deg=>deg*Math.PI/180

function liveAndFresh(observation,now=Date.now()) {
  if(!observation||observation.state!=='live'||!['hardware','simulator'].includes(observation.source)||typeof observation.observedAt!=='string')return false
  const time=Date.parse(observation.observedAt)
  return Number.isFinite(time)&&time<=now&&now-time<=5000
}

/** Create a control-free local preview panel. It only calls preview/clear. */
export function RoArmPreviewPanel(root,preview,getMeasuredPose) {
  if(!root?.append||!preview?.preview||!preview?.clear||typeof getMeasuredPose!=='function')
    throw new TypeError('RoArmPreviewPanel requires a root, preview API, and measured-pose getter')
  const element=document.createElement('section');element.className='roarm-preview-panel'
  const heading=document.createElement('h2');heading.textContent='RoArm joint preview'
  const alert=document.createElement('p');alert.className='roarm-preview-warning';alert.textContent='Simulation only · collision clearance unverified'
  const jawNote=document.createElement('p');jawNote.className='roarm-preview-jaw-note';jawNote.textContent='Jaw opening scale is illustrative; the open reference is uncalibrated.'
  const labels=document.createElement('p');labels.className='roarm-preview-source'
  const fieldset=document.createElement('fieldset');fieldset.className='roarm-preview-controls'
  const legend=document.createElement('legend');legend.textContent='Hypothetical joint targets (raw degrees)';fieldset.append(legend)
  const inputs={}
  for(const joint of JOINT_ORDER) {
    const row=document.createElement('label');row.className='roarm-preview-joint'
    const name=document.createElement('span');name.textContent=TITLES[joint]
    const range=document.createElement('input');range.type='range';range.step='0.1';range.setAttribute('aria-label',`${TITLES[joint]} raw degrees`)
    const [min,max]=ROARM_PREVIEW_LIMITS_RAD[joint];range.min=String(Math.ceil(degrees(min)));range.max=String(Math.floor(degrees(max)))
    const value=document.createElement('output');value.textContent='0°'
    range.oninput=()=>{value.textContent=`${range.value}°`;if(!loading)edited=true}
    row.append(name,range,value);fieldset.append(row);inputs[joint]=range
  }
  const start=document.createElement('button');start.type='button';start.className='roarm-preview-start';start.textContent='Preview pose'
  const reset=document.createElement('button');reset.type='button';reset.className='roarm-preview-reset';reset.textContent='Reset preview'
  const status=document.createElement('p');status.className='roarm-preview-status';status.setAttribute('role','status');status.textContent='Waiting for a fresh measured pose.'
  element.append(heading,alert,jawNote,labels,fieldset,start,reset,status);root.append(element)
  let edited=false,loading=false,loadedMeasuredPose=false

  function refresh() {
    const observation=getMeasuredPose()
    const live=liveAndFresh(observation)
    labels.textContent=`Measured source: ${observation?.source??'unknown'} · ${live?'fresh measured pose available':`state ${observation?.state??'unavailable'}; preview start disabled`}`
    start.disabled=!live
    if(live&&!loadedMeasuredPose&&!edited) {loadPose(observation.pose);loadedMeasuredPose=true}
    if(!live)status.textContent='Preview requires a fresh live measured pose; stale and offline poses cannot start a preview.'
    return live
  }
  function readTarget() { return Object.fromEntries(JOINT_ORDER.map(joint=>[joint,radians(Number(inputs[joint].value))])) }
  function loadPose(pose) {
    if(!pose||!JOINT_ORDER.every(joint=>Number.isFinite(pose[joint])))return
    loading=true
    for(const joint of JOINT_ORDER) {
      const value=round1(degrees(pose[joint]));inputs[joint].value=String(Math.max(Number(inputs[joint].min),Math.min(Number(inputs[joint].max),value)))
      inputs[joint].dispatchEvent(new Event('input',{bubbles:true}))
    }
    loading=false
  }
  start.onclick=()=>{
    const observation=getMeasuredPose()
    if(!liveAndFresh(observation)) {refresh();return}
    try {
      const result=preview.preview({startPose:observation,moves:[readTarget()]})
      status.textContent=`Kinematic preview · collision clearance unverified · ${result.status}`
      refresh()
    } catch(error) {status.textContent=error instanceof Error?error.message:'Preview could not start.';refresh()}
  }
  reset.onclick=()=>{
    preview.clear();edited=false
    const observation=getMeasuredPose();loadedMeasuredPose=liveAndFresh(observation)
    if(loadedMeasuredPose)loadPose(observation.pose)
    refresh();status.textContent='Simulation preview cleared. No robot command was sent.'
  }
  loadPose(getMeasuredPose()?.pose)
  refresh()
  return {
    element,
    refresh,
    reset:()=>reset.onclick?.(),
    dispose(){start.onclick=null;reset.onclick=null;for(const input of Object.values(inputs))input.oninput=null;element.remove()},
    getValues:readTarget,
  }
}
