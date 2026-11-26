// A rendering contract for recorded collaboration observations. No scheduling,
// dispatch, task mutation or independent execution state lives here.
const record = v => v && typeof v === 'object' && !Array.isArray(v)
const string = (v, label, max=200) => {
  if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`Invalid MAGI ${label}`)
  return v.trim()
}
const time = (v,label) => {
  if(!Number.isSafeInteger(v)||v<=0)throw Error(`Invalid MAGI ${label}`)
  return v
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAGI_READINESS = Object.freeze(['agents','dispenser','computer','campfire'])
export function normalizeMagiObservation(input) {
  if(!record(input))throw Error('Invalid MAGI observation')
  const id=string(input.id,'id',120),number=input.number
  if(!Number.isSafeInteger(number)||number<1)throw Error('Invalid MAGI wave number')
  if(!['working','validating','campfire','complete'].includes(input.phase))throw Error('Invalid MAGI phase')
  if(!Array.isArray(input.agents)||input.agents.length!==3)throw Error('A MAGI observation requires three actual participants')
  const ids=new Set(),nativeIds=new Set()
  const agents=input.agents.map((a,index)=>{
    if(!record(a))throw Error('Invalid MAGI participant')
    const next={id:string(a.id,'participant id',160),name:string(a.name,'participant name',100),
      role:string(a.role,'participant role',300),model:string(a.model,'participant model',80),
      effort:string(a.effort,'participant effort',30),state:a.state,startedAt:time(a.startedAt,'start time'),
      endedAt:a.endedAt==null?null:time(a.endedAt,'end time'),accepted:a.accepted===true,slot:index}
    if(ids.has(next.id))throw Error('Duplicate MAGI participant');ids.add(next.id)
    if(!['working','complete','error'].includes(next.state))throw Error('Invalid MAGI participant state')
    if(next.endedAt!==null&&next.endedAt<next.startedAt)throw Error('MAGI participant ends before admission')
    if(next.state!=='working'&&next.endedAt===null)throw Error('Terminal MAGI observation needs its source end time')
    if(next.accepted&&next.state!=='complete')throw Error('Only observed completed work can be accepted')
    if(a.nativeId!==undefined){
      if(typeof a.nativeId!=='string'||!a.nativeId.startsWith('codex:')||!uuid.test(a.nativeId.slice(6))||nativeIds.has(a.nativeId))throw Error('Invalid or duplicate MAGI native binding')
      next.nativeId=a.nativeId;nativeIds.add(a.nativeId)
    }
    return next
  })
  if(input.phase!=='working'&&agents.some(a=>a.state==='working'))throw Error('Campfire follows all three terminal task observations')
  const c=input.coordinator
  if(!record(c)||!uuid.test(c.threadId))throw Error('MAGI coordinator needs its observed local thread id')
  const coordinator={model:string(c.model,'coordinator model',80),effort:string(c.effort,'coordinator effort',30),threadId:c.threadId}
  const readiness=Object.fromEntries(MAGI_READINESS.map(key=>[key,input.readiness?.[key]===true]))
  return {id,number,phase:input.phase,admittedAt:time(input.admittedAt,'admission time'),coordinator,agents,readiness}
}
export const magiInfrastructureReady = observation => MAGI_READINESS.every(key=>observation?.readiness?.[key]===true)
export function magiObservedThreads(observation,native=[]) {
  if(!observation)return []
  const colors=[0xef844a,0x6ba99c,0xd3b157]
  return observation.agents.map((agent,index)=>{
    const source=native.find(t=>t.id===agent.nativeId&&t.agentPath===agent.id)
    return {id:agent.nativeId||`magi:${agent.id}`,agentPath:agent.id,shellName:agent.name,title:agent.role,
      preview:agent.role,project:`MAGI / WAVE ${observation.number}`,projectLabel:`Wave ${observation.number} · ${agent.model} / ${agent.effort}`,
      source:'broadcast',harnessName:'Recorded MAGI task observation',suitColor:colors[index],
      running:!observation.stale&&observation.phase==='working'&&agent.state==='working',hasError:agent.state==='error',
      assignmentState:observation.phase==='campfire'?'review':agent.state==='complete'?'complete':'',
      broadcastStale:Boolean(observation.stale),broadcastObservedAt:observation.observedAt,
      lastActivityAt:source?.lastActivityAt||agent.endedAt||agent.startedAt,activity:source?.activity||null,
      milestones:agent.accepted?[{id:`${observation.id}:${agent.id}:accepted`,title:'Deliverable verified',accepted:true,status:'accepted',level:'major'}]:[],
      ...(agent.accepted?{constructionProgress:1}:{}),magiSlot:index,magiAgent:agent,
    }
  })
}
