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
export function normalizeMagiObservation(input,{observedAt=Date.now()}={}) {
  if(!record(input))throw Error('Invalid MAGI observation')
  const id=string(input.id,'id',120),number=input.number
  if(!Number.isSafeInteger(number)||number<1)throw Error('Invalid MAGI wave number')
  if(!Number.isSafeInteger(input.sequence)||input.sequence<1)throw Error('Invalid MAGI observation sequence')
  if(!['working','validating','campfire','complete'].includes(input.phase))throw Error('Invalid MAGI phase')
  if(!Array.isArray(input.agents)||input.agents.length!==3)throw Error('A MAGI observation requires three actual participants')
  const ids=new Set(),nativeIds=new Set()
  const agents=input.agents.map((a,index)=>{
    if(!record(a))throw Error('Invalid MAGI participant')
    const next={id:string(a.id,'participant id',160),name:string(a.name,'participant name',100),
      role:string(a.role,'participant role',300),model:string(a.model,'participant model',80),
      effort:string(a.effort,'participant effort',30),state:a.state,startedAt:time(a.startedAt,'start time'),
      endedAt:a.endedAt==null?null:time(a.endedAt,'end time'),accepted:a.accepted===true,slot:index}
    if(typeof a.accepted!=='boolean')throw Error('MAGI acceptance must be explicit')
    if(next.startedAt>observedAt||(next.endedAt!==null&&next.endedAt>observedAt))throw Error('MAGI participant timestamp is in the future')
    if(ids.has(next.id))throw Error('Duplicate MAGI participant');ids.add(next.id)
    if(!['working','complete','error'].includes(next.state))throw Error('Invalid MAGI participant state')
    if(next.endedAt!==null&&next.endedAt<next.startedAt)throw Error('MAGI participant ends before admission')
    if(next.state!=='working'&&next.endedAt===null)throw Error('Terminal MAGI observation needs its source end time')
    if(next.accepted&&next.state!=='complete')throw Error('Only observed completed work can be accepted')
    {
      if(typeof a.nativeId!=='string'||!a.nativeId.startsWith('codex:')||!uuid.test(a.nativeId.slice(6))||nativeIds.has(a.nativeId))throw Error('Invalid or duplicate MAGI native binding')
      next.nativeId=a.nativeId;nativeIds.add(a.nativeId)
    }
    if(a.memorialId!==undefined)next.memorialId=string(a.memorialId,'memorial identity',200)
    if(a.iteration!==undefined){if(!Number.isSafeInteger(a.iteration)||a.iteration<1)throw Error('Invalid Iteration number');next.iteration=a.iteration}
    return next
  })
  if(input.phase!=='working'&&agents.some(a=>a.state==='working'))throw Error('Campfire follows all three terminal task observations')
  if(input.phase==='complete'&&agents.some(a=>a.state!=='complete'||!a.accepted||!a.memorialId))throw Error('A complete wave needs three accepted successful artifacts')
  const c=input.coordinator
  if(!record(c)||!uuid.test(c.threadId))throw Error('MAGI coordinator needs its observed local thread id')
  const coordinator={model:string(c.model,'coordinator model',80),effort:string(c.effort,'coordinator effort',30),threadId:c.threadId}
  const readiness=Object.fromEntries(MAGI_READINESS.map(key=>[key,input.readiness?.[key]===true]))
  const admittedAt=time(input.admittedAt,'admission time')
  if(admittedAt>observedAt||agents.some(a=>a.startedAt>admittedAt))throw Error('MAGI admission time is invalid or in the future')
  return {id,number,sequence:input.sequence,phase:input.phase,admittedAt,coordinator,agents,readiness}
}
/** Ephemeral transport integrity cache, never an execution roster or scheduler. */
export function createMagiObservationGuard() {
  let last=null,fingerprint=''
  const rank={working:0,validating:1,campfire:2,complete:3}
  const identities=value=>JSON.stringify(value.agents.map(a=>[a.id,a.nativeId,a.model,a.effort,a.startedAt]))
  return {
    get last(){return last?structuredClone(last):null},
    accept(input,observedAt=Date.now()) {
      const next=normalizeMagiObservation(input,{observedAt}),signature=JSON.stringify(next)
      if(last) {
        if(next.number<last.number||next.admittedAt<last.admittedAt)throw Error('MAGI observation regressed to an older admission')
        if(next.number===last.number) {
          if(next.id!==last.id||next.admittedAt!==last.admittedAt||identities(next)!==identities(last))throw Error('MAGI admission identity changed')
          if(next.sequence<last.sequence||(next.sequence===last.sequence&&signature!==fingerprint))throw Error('MAGI observation sequence regressed or changed without a new frame')
          if(rank[next.phase]<rank[last.phase])throw Error('MAGI review phase regressed')
        } else if(next.id===last.id||next.agents.some(a=>last.agents.some(old=>old.nativeId===a.nativeId)))throw Error('A new wave needs three new native participants')
      }
      fingerprint=signature;last={...next,observedAt,stale:false}
      return structuredClone(last)
    },
  }
}
export const magiInfrastructureReady = observation => MAGI_READINESS.every(key=>observation?.readiness?.[key]===true)
export function magiObservedThreads(observation,native=[]) {
  if(!observation)return []
  const colors=[0xef844a,0x6ba99c,0xd3b157]
  return observation.agents.map((agent,index)=>{
    const source=native.find(t=>t.id===agent.nativeId&&t.agentPath===agent.id&&t.parentThreadId===`codex:${observation.coordinator.threadId}`)
    const nativeWorking=Boolean(source?.running&&observation.phase==='working'&&agent.state==='working')
    const historical=!source||Boolean(observation.stale&&!nativeWorking)
    return {id:agent.nativeId||`magi:${agent.id}`,agentPath:agent.id,shellName:agent.name,title:agent.role,
      preview:agent.role,project:`MAGI / WAVE ${observation.number}`,projectLabel:`Wave ${observation.number} · ${agent.model} / ${agent.effort}`,
      source:'broadcast',harnessName:'Recorded MAGI task observation',suitColor:colors[index],
      running:nativeWorking,hasError:agent.state==='error'||Boolean(observation.phase==='working'&&agent.state==='working'&&source?.hasError),
      assignmentState:observation.phase==='campfire'?'review':agent.state==='complete'?'complete':'',
      broadcastStale:historical,broadcastEvidenceStale:Boolean(observation.stale),broadcastObservedAt:observation.observedAt,nativeBindingVerified:Boolean(source),lifecycleSource:source?'native':'historical-observation',
      lastActivityAt:source?.lastActivityAt||agent.endedAt||agent.startedAt,activity:source?.activity||null,
      milestones:agent.accepted?[{id:`${observation.id}:${agent.id}:accepted`,title:'Deliverable verified',accepted:true,status:'accepted',level:'major'}]:[],
      ...(agent.accepted?{constructionProgress:1}:{}),magiSlot:index,magiAgent:agent,
    }
  })
}
