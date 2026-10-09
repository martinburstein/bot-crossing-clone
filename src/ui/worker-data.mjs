import {magiOnShift,tokenConstruction,MAGI_CLUSTERS} from '../game/magi-world.js'
import {selectEarnedWearables} from '../world/roarm-rewards.js'

const workingWords={cargo:'Delivering supplies',posts:'Drilling post holes',samples:'Collecting samples',intercept:'Intercepting meteor',handling:'Moving materials',excavate:'Digging trench',reports:'Delivering reports',survey:'Scanning terrain','remote-survey':'Surveying remote camp','air-scout':'Scouting ahead',perimeter:'Checking perimeter'}
const travelWords={cargo:'Hauling supplies',posts:'Heading to drill',samples:'Seeking samples',intercept:'Approaching meteor',handling:'Hauling materials',excavate:'Heading to dig',reports:'Carrying reports',survey:'Surveying camp','remote-survey':'Surveying remote camp','air-scout':'Scouting ahead',perimeter:'Patrolling perimeter'}
const idleWords={talk:'Chatting',tinker:'Tinkering',board:'Reading board',snack:'Snack break',pilot:'At controls'}
const number=n=>n.toLocaleString('en-US')
const xyz=p=>[p.x,p.y,p.z].map(n=>Number.isFinite(n)?n.toFixed(1):'—').join(' / ')

export function workerSpeech(agent,fleet) {
  if(agent.thread.worldProfile==='roarm-campus') {if(agent.thread.campusPosition==='charging'||agent.thread.campusPosition==='sleeping')return 'Resting in my pod';if(agent.thread.campusPosition==='downloading')return 'Receiving instructions';if(agent.thread.roleId==='camper')return 'Keeping the camp history'}
  if(agent.magiActivity==='pilot-rest')return 'Captain · taking a break'
  if(agent.magiActivity==='pilot')return 'At controls'
  if(!magiOnShift(agent.thread)||!agent.mounted||!fleet) return idleWords[agent.magiActivity]||'Between shifts'
  if(fleet.phase==='outbound') return 'Starting shift'
  if(fleet.routeBlocked) return 'Checking route'
  return (fleet.operating?workingWords:travelWords)[fleet.job.id]||'On patrol'
}

// Current renderer observations and measured receipts only; never infer task progress.
export function workerInspection(agent,fleet,{speed=null,perf={},viewport={},groundY=0,stale=false,standby=false}={}) {
  const thread=agent.thread,onShift=magiOnShift(thread),plan=tokenConstruction(thread)
  const p=fleet?.model.position||agent.pos,target=fleet?.stops[fleet.stopIndex]
  const rows=[
    [onShift?'Task':'Last task',thread.taskTitle||'No assignment'],
    ['Activity',workerSpeech(agent,fleet)],
    ['Vehicle',fleet?.model.userData.spec.name||'Off duty · at camp'],
  ]
  const rewards=selectEarnedWearables(thread.earnedRewards,thread.rewardWorkerId||thread.executorWorkerId||thread.shellId)
  if(['roarm-16','roarm-campus'].includes(thread.worldProfile))rows.push(['Executor',thread.executorSlot||'Role library · no session'],['Adopted role',thread.roleTitle||thread.roleId])
  if(rewards.inventory.length)rows.push(['Earned wearables',rewards.inventory.map(reward=>reward.design.name).join(', ')])
  if(rewards.wearing)rows.push(['Wearing',rewards.wearing.design.name])
  if(agent.magiActivity==='pilot')rows.push(['Pilot duty',agent.magiPilotStatus==='unknown'?`Assigned · ${thread.shellId} · feed unknown`:`Assigned · ${thread.shellId}`])
  if(agent.magiActivity==='pilot-rest'&&thread.worldProfile!=='roarm-campus')rows.push(['Pilot duty','Explicitly released to rest · key retained'])
  if(agent.magiActivity==='pilot'&&agent.magiPilotHandoff)rows.push(['Key handoff',agent.magiPilotHandoff.label])
  if(fleet) {
    rows.push(['Mission',fleet.job.label],['Travel',`${speed===null?'—':speed.toFixed(1)} u/s · ${Math.max(0,p.y-groundY).toFixed(1)} u altitude`])
    if(target) rows.push(['Destination',fleet.operating?'Working at stop':`Stop ${fleet.stopIndex+1}/${fleet.stops.length} · ${Math.hypot(target.x-p.x,target.z-p.z).toFixed(1)} u away`])
  }
  rows.push(['XYZ',xyz(p)],['Tokens',plan.measured?`${number(plan.tokens)}${thread.tokenUsage.cached?' · cached':''}`:'Not measured'])
  if(plan.measured)rows.push(['Next growth',`${number(plan.nextSmall)} tokens to addition · ${number(plan.nextHex)} to hex`])
  const detail=[
    ['Feed',stale||thread.assignmentState==='unknown'?'Unavailable · crew off shift':standby?'Standby':'Connected'],
    ['Task record',thread.assignmentState||'idle'],
    ['Runtime',thread.workerBackend||'No worker bound'],
    ['Render',`${Math.round(perf.fps||0)} FPS · ${(perf.frameMs||0).toFixed(1)} ms`],
    ['Scene',`${perf.drawCalls||0} draws · ${number(perf.triangles||0)} triangles`],
    ['Buffer',`${viewport.bw||0} × ${viewport.bh||0}`],
  ]
  if(fleet)detail.unshift(['Route',`${fleet.pathAt||0}/${fleet.path?.length||0} waypoints · ${fleet.visitedStops.length} recent stops`])
  if(plan.measured)detail.unshift(['Receipts',`${thread.tokenUsage.completedTurns??0} completed · ${thread.tokenUsage.pendingTurns??0} pending`])
  return {speech:workerSpeech(agent,fleet),crew:MAGI_CLUSTERS.find(c=>c.id===thread.clusterId)?.name||thread.clusterId,rows,detail}
}
