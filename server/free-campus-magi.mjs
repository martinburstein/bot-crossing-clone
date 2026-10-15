const ROLES=Array.from({length:15},(_,i)=>`r${String(i+1).padStart(2,'0')}`)
const WORKERS={melchior:'w00',balthasar:'balthasar',casper:'casper'}
const NAMES={melchior:'Melchior',balthasar:'Balthasar',casper:'Casper'}
export function assertFreeCampusProjection(state,now=Date.now()){
  const m=state?.magi,c=m?.campus,f=c?.free,slots=m?.executorSlots,assignments=f?.assignments
  if(state?.schemaVersion!==1||m?.profile!=='roarm-campus'||c?.dispatchMode!=='free-15-3A'||!['live','standby'].includes(state.mode)||
    !Number.isSafeInteger(state.revision)||!Number.isFinite(state.observedAt)||now-state.observedAt>20000||state.observedAt>now+5000||
    typeof state.projectId!=='string'||!state.projectId||!Array.isArray(state.tasks)||!Array.isArray(state.milestones)||!Array.isArray(state.notes)||
    !['awake','sleeping'].includes(c.mode)||f?.schemaVersion!==1||!assignments||Object.keys(assignments).sort().join(',')!=='balthasar,casper,melchior'||
    Object.values(assignments).some(r=>r!==null&&!['pilot','camper',...ROLES].includes(r))||new Set(Object.values(assignments).filter(Boolean)).size!==Object.values(assignments).filter(Boolean).length||
    !Array.isArray(f.chargingRoleIds)||new Set(f.chargingRoleIds).size!==f.chargingRoleIds.length||f.chargingRoleIds.some(r=>!ROLES.includes(r)||Object.values(assignments).includes(r))||
    !Array.isArray(f.conversation)||f.conversation.length>60||!Array.isArray(m.roleCatalog)||m.roleCatalog.length!==15||m.roleCatalog.some((r,i)=>r.id!==ROLES[i]||typeof r.title!=='string')||
    !Array.isArray(slots)||slots.length!==3||!Array.isArray(state.workers)||state.workers.length!==3)throw Error('Free 15-3A projection is invalid or stale')
  for(const [slotId,workerId]of Object.entries(WORKERS)){
    const s=slots.find(s=>s.slotId===slotId),w=state.workers.find(w=>w.id===workerId)
    if(!s||!w||s.workerId!==workerId||s.roleId!==assignments[slotId]||w.roleId!==s.roleId||typeof s.bound!=='boolean'||typeof w.bound!=='boolean'||
      !['idle','reserved','running'].includes(s.status)||s.occupied!==(s.status!=='idle')||s.status!=='idle'&&!s.roleId||
      s.status==='running'&&(!s.bound||!w.bound||!['running','reviewing'].includes(w.status))||s.status==='reserved'&&w.status!=='reserved'||
      s.status==='idle'&&['running','reviewing','reserved'].includes(w.status))throw Error(`Free 15-3A unit ${slotId} has inconsistent execution evidence`)
  }
  const running=slots.filter(s=>s.status==='running').length,reserved=slots.filter(s=>s.status==='reserved').length
  if(state.capacity?.total!==3||state.capacity.limit!==3||state.capacity.running!==running||state.capacity.reserved!==reserved||state.capacity.occupied!==running+reserved||
    c.mode==='sleeping'&&running+reserved>0)throw Error('Free 15-3A capacity is inconsistent')
  return state
}
export function projectFreeCampusState(state,now=Date.now(),usage=new Map()){
  assertFreeCampusProjection(state,now)
  const m=state.magi,c=m.campus,f=c.free,slots=m.executorSlots
  const flags=Object.keys(WORKERS).map(id=>slots.find(s=>s.slotId===id).status==='running'),count=flags.filter(Boolean).length
  const alignment={count,mode:['off','red','green','rainbow'][count],clusters:flags}
  const visibleRoles=['pilot',...ROLES,'camper']
  const threads=visibleRoles.map((roleId,index)=>{
    const shellId=roleId==='pilot'?'w00':roleId==='camper'?'w16':`w${roleId.slice(1)}`
    const slotId=Object.keys(WORKERS).find(id=>f.assignments[id]===roleId)??null,slot=slots.find(s=>s.slotId===slotId),worker=state.workers.find(w=>w.id===slot?.workerId)
    const role=m.roleCatalog.find(r=>r.id===roleId),title=role?.title??(roleId==='pilot'?'Pilot':'Camper')
    const running=slot?.status==='running',reserved=slot?.status==='reserved',position=c.mode==='sleeping'?'sleeping':f.chargingRoleIds.includes(roleId)?'charging':running?'working':reserved?'receiving':slot?'assigned':'camp'
    const rewards=(m.earnedRewards??[]).filter(r=>r.roleId===roleId||!r.roleId&&r.workerId===shellId)
    return {id:`magi:${shellId}`,shellId,isShell:true,shellName:title,title,projectLabel:title,project:`MAGI ${shellId}`,worldProfile:'roarm-campus',dispatchMode:'free-15-3A',
      clusterId:slotId??'roles',slotId,executorSlot:slotId,campusSlotPurpose:roleId==='pilot'?'pilot':roleId==='camper'?'camper':slotId?'executor':null,
      workerId:worker?.id??null,executorWorkerId:worker?.id??null,roleId,roleTitle:title,rolePurpose:role?.purpose??`Permanent ${title} agent file`,roleGeneration:role?.generation??1,roleActivated:Boolean(slot),
      catalogRoleId:roleId,campusPosition:position,rewardWorkerId:rewards.at(-1)?.workerId??shellId,shellColor:roleId==='pilot'?'#30bcff':roleId==='camper'?'#80f59b':'#e7f8ff',suitColor:roleId==='pilot'?0x274c70:roleId==='camper'?0x9daa86:0xf3f1ec,projectAccent:0xd4b37f,
      running:Boolean(running),hasError:false,archived:false,unread:false,canOpen:false,assignmentRole:running?'work':reserved?'reserved':'idle',assignmentState:slot?.status??'idle',shellStatus:running?'Working':position,
      taskId:worker?.taskId??null,taskTitle:worker?.taskTitle??null,workerBackend:worker?.bound?worker.backend:null,protocolExecution:slot?.status??'idle',tokenUsage:worker?usage.get(worker.id)??null:null,vehicleId:worker?.vehicleId??null,
      unitName:slotId?NAMES[slotId]:null,alignment,earnedRewards:rewards,milestones:[],dependencies:[],reviewer:null,createdAt:index+1,lastActivityAt:state.observedAt,sizeBytes:0,attemptCount:0,runId:state.projectId,constructionRunId:`magi:${state.projectId}`,projectPath:'',projectRoot:'',workflow:'15-3A · interchangeable roles',scrollUrl:null}
  })
  return {threads,alignment,worksite:{profile:'roarm-campus',dispatchMode:'free-15-3A',personaCount:17,executorSlots:slots,roleCatalog:m.roleCatalog,campus:c,pilot:m.pilot,
    contracts:m.contracts??[],earnedRewards:m.earnedRewards??[],bounties:m.bounties??[],serviceCredits:m.serviceCredits??[],observedAt:state.observedAt,updatedAt:state.observedAt,revision:state.revision,stale:false}}
}
