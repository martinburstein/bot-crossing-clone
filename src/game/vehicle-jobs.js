// Visual assignments only: never issue work, complete a task or award territory.
import {magiOnShift} from './magi-world.js'
export const VEHICLE_JOBS = Object.freeze({
  eagle: {id:'survey',label:'Mapping the camp approach',operation:'scan',speed:8},
  defender: {id:'intercept',label:'Intercepting an incoming meteor',operation:'intercept',speed:5},
  dropship: {id:'cargo',label:'Delivering supplies to camp',operation:'cargo',speed:8},
  'cargo-rover': {id:'samples',label:'Collecting mineral samples',operation:'drill',speed:4},
  'mining-truck': {id:'posts',label:'Drilling foundation post holes',operation:'drill',speed:4},
  trike: {id:'perimeter',label:'Checking the camp perimeter',operation:'scan',speed:6},
  'astro-fighter': {id:'air-scout',label:'Scouting the route ahead',operation:'scan',speed:9},
  'claw-tank': {id:'handling',label:'Moving construction materials',operation:'claw',speed:3.5},
  'drill-unit': {id:'excavate',label:'Excavating a foundation trench',operation:'drill',speed:3},
  'drill-flyer': {id:'remote-survey',label:'Surveying a remote work site',operation:'scan',speed:8},
  'drill-pod': {id:'reports',label:'Carrying reports between camps',operation:'report',speed:6},
})

export function confirmedVehicleWorker(agent) {
  return agent?.thread.worldProfile==='15-3A' && agent.status==='working' && magiOnShift(agent.thread) &&
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
  return {...VEHICLE_JOBS[vehicle],vehicle,contextual,meteorAlert:vehicle==='defender'&&alert}
}
