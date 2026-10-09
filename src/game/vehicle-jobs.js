// Visual assignments only: never issue work, complete a task or award territory.
import {magiOnShift} from './magi-world.js'
export const VEHICLE_JOBS = Object.freeze({
  eagle: {id:'survey',label:'Inspecting arm-base fasteners',operation:'scan',speed:8},
  defender: {id:'intercept',label:'Intercepting an incoming meteor',operation:'intercept',speed:5},
  dropship: {id:'cargo',label:'Delivering arm service tools',operation:'cargo',speed:8},
  'cargo-rover': {id:'samples',label:'Delivering cable clips and fasteners',operation:'drill',speed:4},
  'mining-truck': {id:'posts',label:'Checking arm-base anchor bolts',operation:'drill',speed:4},
  trike: {id:'perimeter',label:'Inspecting arm joint guards',operation:'scan',speed:6},
  'astro-fighter': {id:'air-scout',label:'Inspecting overhead cable clearance',operation:'scan',speed:9},
  'claw-tank': {id:'handling',label:'Moving spare gripper parts',operation:'claw',speed:3.5},
  'drill-unit': {id:'excavate',label:'Checking base mounts and footing',operation:'drill',speed:3},
  'drill-flyer': {id:'remote-survey',label:'Inspecting upper-link clearances',operation:'scan',speed:8},
  'drill-pod': {id:'reports',label:'Carrying visual service diagnostics',operation:'report',speed:6},
})
export const ROARM_SERVICE_DESTINATIONS = Object.freeze({
  melchior:'Melchior arm service point',balthasar:'Balthasar arm service point',casper:'Casper arm service point',
})

export function confirmedVehicleWorker(agent) {
  if(agent?.thread.worldProfile==='roarm-campus'&&(agent.thread.slotId!=='casper'||agent.thread.campusPosition!=='working'))return false
  return ['15-3A','roarm-16','roarm-campus'].includes(agent?.thread.worldProfile) && agent.status==='working' && magiOnShift(agent.thread) &&
    !['leaving','gone'].includes(agent.state)
}

export function vehicleJob(thread, preferred) {
  const title=String(thread.taskTitle||'').toLowerCase()
  const alert=/(?:incoming|approaching|falling|intercept|imminent).{0,35}(?:meteor|asteroid)|(?:meteor|asteroid).{0,35}(?:incoming|approaching|falling|impact|intercept)/.test(title)
  let vehicle,contextual=true
  if(thread.assignmentRole==='review') vehicle='drill-pod'
  else if(alert) vehicle='defender'
  else if(/post|anchor|footing/.test(title)) vehicle='mining-truck'
  else if(/excavat|trench|foundation/.test(title)) vehicle='drill-unit'
  else if(/mineral|sample|\bore\b/.test(title)) vehicle='cargo-rover'
  else if(/deliver|cargo|supply|supplies|transport/.test(title)) vehicle='dropship'
  else if(/salvage|material|assembl|repair/.test(title)) vehicle='claw-tank'
  else if(/report|communicat|camp.to.camp/.test(title)) vehicle='drill-pod'
  else if(/remote|aerial/.test(title)) vehicle='drill-flyer'
  else if(/scout|recon/.test(title)) vehicle='astro-fighter'
  else if(/perimeter|inspect/.test(title)) vehicle='trike'
  else if(/survey|map|scan/.test(title)) vehicle='eagle'
  else {vehicle={melchior:'dropship',balthasar:'mining-truck',casper:'drill-pod'}[thread.clusterId]||'drill-pod';contextual=false}
  // A preference chooses the visual job; it cannot manufacture a meteor alert.
  if(VEHICLE_JOBS[preferred] && (!contextual||preferred===vehicle) && (preferred!=='defender'||alert) && thread.assignmentRole!=='review') vehicle=preferred
  if(thread.assignmentRole==='review') vehicle='drill-pod'
  const destination=ROARM_SERVICE_DESTINATIONS[thread.clusterId]||'RoArm service point'
  const job=VEHICLE_JOBS[vehicle]
  return {...job,label:`${job.label} · ${destination}`,vehicle,contextual,meteorAlert:vehicle==='defender'&&alert,destination}
}
