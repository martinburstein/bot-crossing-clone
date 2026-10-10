const IDS=Array.from({length:15},(_,i)=>`r${String(i+1).padStart(2,'0')}`)
const WORKERS={melchior:'w00',balthasar:'balthasar',casper:'casper'}
const SLOT_NAMES={melchior:'Melchior',balthasar:'Balthasar',casper:'Casper'}
const ACTIVE=['running','reviewing']
const DUTIES=['pilot','executor','camper']
const LEGACY_ASSIGNMENTS={pilot:'melchior',executor:'casper',camper:'balthasar'}
function assignments(c){
  const a=c.slotAssignments===undefined?LEGACY_ASSIGNMENTS:c.slotAssignments
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length!==3||DUTIES.some(d=>!Object.hasOwn(WORKERS,a[d]))||new Set(DUTIES.map(d=>a[d])).size!==3||a.pilot!=='melchior')throw Error('Campus slot assignments must keep Melchior as pilot and map the other duties to unique real slots')
  return a
}
export function assertCampusProjection(state,now=Date.now()){
  const m=state?.magi,c=m?.campus
  if(state?.schemaVersion!==1||m?.profile!=='roarm-campus'||!['live','standby'].includes(state.mode)||!Number.isSafeInteger(state.revision)||
    typeof state.projectId!=='string'||!state.projectId||!Number.isFinite(state.observedAt)||now-state.observedAt>20000||state.observedAt>now+5000||
    !Array.isArray(state.tasks)||!Array.isArray(state.milestones)||!Array.isArray(state.notes))throw Error('Campus projection is invalid or stale')
  if(c?.schemaVersion!==1||!Number.isSafeInteger(c.cycleNumber)||c.cycleNumber<0||!IDS.includes(c.activeRoleId)||!IDS.includes(c.chargingRoleId)||
    !Array.isArray(c.campRoleIds)||c.campRoleIds.length!==13||c.campRoleIds.some(id=>!IDS.includes(id))||new Set([c.activeRoleId,c.chargingRoleId,...c.campRoleIds]).size!==15||
    !['awake','sleeping'].includes(c.mode)||!['awaiting-instructions','working','charging','downloading','sleeping'].includes(c.phase)||
    (c.mode==='sleeping')!==(c.phase==='sleeping')||!Number.isSafeInteger(c.pilot?.instructionGeneration)||c.pilot.instructionGeneration<1||
    !['station','download','sleep'].includes(c.pilot?.instructionState))throw Error('Campus must preserve thirteen camp roles, one active role and one charging role')
  if(!Array.isArray(m.roleCatalog)||m.roleCatalog.length!==15||m.roleCatalog.some((r,i)=>r.id!==IDS[i]||typeof r.title!=='string')||
    !Array.isArray(m.executorSlots)||m.executorSlots.length!==3||new Set(m.executorSlots.map(s=>s.slotId)).size!==3||
    !Array.isArray(state.workers)||state.workers.length!==3||new Set(state.workers.map(w=>w.id)).size!==3)throw Error('Campus requires three real slots and fifteen roles')
  const assigned=assignments(c),roleBySlot=Object.fromEntries([[assigned.pilot,'pilot'],[assigned.camper,'camper'],[assigned.executor,c.activeRoleId]])
  for(const [id,workerId]of Object.entries(WORKERS)){
    const s=m.executorSlots.find(s=>s.slotId===id),w=state.workers.find(w=>w.id===workerId),role=roleBySlot[id]
    if(!s||!w||s.workerId!==workerId||s.roleId!==role||typeof s.bound!=='boolean'||typeof w.bound!=='boolean'||typeof s.occupied!=='boolean'||
      !['idle','reserved','running'].includes(s.status)||s.occupied!==(s.status!=='idle')||
      (s.status==='running'&&(!s.bound||!w.bound||!ACTIVE.includes(w.status)))||(s.status==='reserved'&&w.status!=='reserved')||
      (s.status==='idle'&&(ACTIVE.includes(w.status)||w.status==='reserved')))throw Error(`Campus slot ${id} is inconsistent`)
  }
  const running=state.workers.filter(w=>ACTIVE.includes(w.status)).length,reserved=state.workers.filter(w=>w.status==='reserved').length
  if(state.capacity?.limit!==3||state.capacity.running!==running||state.capacity.reserved!==reserved||state.capacity.occupied!==running+reserved||running+reserved>3||
    (c.mode==='sleeping'&&running+reserved!==0)||m.pilot?.workerId!=='w00'||!['on','off'].includes(m.pilot.duty))throw Error('Campus capacity or pilot state is inconsistent')
  return state
}

export function projectCampusState(state,now=Date.now(),usage=new Map()){
  assertCampusProjection(state,now)
  const m=state.magi,c=m.campus,slots=m.executorSlots
  const assigned=assignments(c)
  const purposeForRole=roleId=>roleId==='pilot'?'pilot':roleId==='camper'?'camper':roleId===c.activeRoleId?'executor':null
  const flags=Object.keys(WORKERS).map(id=>slots.find(s=>s.slotId===id).status==='running'),count=flags.filter(Boolean).length
  const alignment={count,mode:['off','red','green','rainbow'][count],clusters:flags}
  const threads=Array.from({length:17},(_,i)=>{
    const id=`w${String(i).padStart(2,'0')}`,roleId=i===0?'pilot':i===16?'camper':IDS[i-1],role=m.roleCatalog.find(r=>r.id===roleId)
    const duty=purposeForRole(roleId),slotId=duty?assigned[duty]:null,slot=slots.find(s=>s.slotId===slotId),worker=state.workers.find(w=>w.id===slot?.workerId)
    const position=c.mode==='sleeping'?'sleeping':i===0?c.pilot.instructionState:i===16?'camp':roleId===c.chargingRoleId?'charging':roleId===c.activeRoleId?(c.phase==='charging'?'awaiting-acceptance':c.phase):'camp'
    const running=slot?.status==='running'&&worker?.bound&&ACTIVE.includes(worker.status),title=i===0?`${SLOT_NAMES[assigned.pilot]} · Pilot`:i===16?`${SLOT_NAMES[assigned.camper]} · Camper`:role.title,status=worker?.status||'idle'
    // Role receipts stay with the stable NPC; legacy wNN awards retain their original body and identity.
    const earnedRewards=(m.earnedRewards||[]).filter(r=>roleId==='pilot'?r.workerId===WORKERS[assigned.pilot]:roleId==='camper'?r.workerId===WORKERS[assigned.camper]:r.roleId===roleId||(!r.roleId&&r.workerId===id))
    return {id:`magi:${id}`,shellId:id,isShell:true,shellName:title,title,projectLabel:title,project:`MAGI ${id}`,worldProfile:'roarm-campus',
      clusterId:slotId||'casper',slotId,executorSlot:slotId,campusSlotPurpose:duty||null,workerId:worker?.id||null,executorWorkerId:worker?.id||null,
      roleId,rewardWorkerId:earnedRewards.at(-1)?.workerId||(i===0?WORKERS[assigned.pilot]:i===16?WORKERS[assigned.camper]:WORKERS[assigned.executor]),roleTitle:title,rolePurpose:role?.purpose||'Permanent campus specialist',catalogRoleId:role?.id||null,campusPosition:position,
      shellColor:duty==='pilot'?'#30bcff':duty==='camper'?'#80f59b':'#e7f8ff',projectAccent:0xe9a45b,suitColor:duty==='pilot'?0x274c70:0xf3f1ec,
      running:Boolean(running),hasError:status==='failed',archived:false,unread:false,canOpen:false,assignmentRole:running?(status==='reviewing'?'review':'work'):status==='reserved'?'reserved':'idle',assignmentState:status,
      shellStatus:running?'Working':position,taskId:worker?.taskId||null,workerBackend:worker?.bound?(worker.backend||'unknown'):null,protocolExecution:status,taskTitle:worker?.taskTitle||null,
      tokenUsage:slot?usage.get(worker.id)||null:null,vehicleId:worker?.vehicleId||null,alignment,earnedRewards,
      milestones:[],dependencies:[],reviewer:null,createdAt:i+1,lastActivityAt:state.observedAt,sizeBytes:0,attemptCount:0,runId:state.projectId,
      constructionRunId:`magi:${state.projectId}`,projectPath:'',projectRoot:'',workflow:'15-1A + 2 specialists',scrollUrl:null}
  })
  return {threads,alignment,worksite:{profile:'roarm-campus',personaCount:17,executorSlots:slots,roleCatalog:m.roleCatalog,campus:{...c,slotAssignments:assigned},pilot:m.pilot,
    contracts:m.contracts||[],earnedRewards:m.earnedRewards||[],bounties:m.bounties||[],serviceCredits:m.serviceCredits||[],
    observedAt:state.observedAt,updatedAt:state.observedAt,revision:state.revision,stale:false}}
}
