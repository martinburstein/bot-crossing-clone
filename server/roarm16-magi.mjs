const SLOTS = ['melchior', 'balthasar', 'casper']
const SLOT_WORKERS = {melchior:'w00', balthasar:'balthasar', casper:'casper'}
const VISUAL_SLOT = {w00:'melchior', w06:'balthasar', w11:'casper'}
const ACTIVE = ['running','reviewing']
const ROLE_RE = /^r(?:0[1-9]|1[0-5])$/
const CYCLE_PHASES = new Set(['selected','adopting','working','concluding','completed','blocked'])
const boundedText = (value,max=2000) => typeof value==='string'&&value.trim().length>0&&value.length<=max

function cycleContract(value, successor=false, idRequired=true) {
  if(!value||typeof value!=='object'||Array.isArray(value)||(idRequired&&!boundedText(value.id,128))||!boundedText(value.title,120)||
    !boundedText(value.objective,2000)||!Array.isArray(value.acceptance)||value.acceptance.length<1||value.acceptance.length>8||
    value.acceptance.some(item=>!boundedText(item,500))||(successor&&!boundedText(value.evidence,2000)))return null
  if(successor&&value.proposedBy!==undefined&&(!Array.isArray(value.proposedBy)||value.proposedBy.length<1||value.proposedBy.length>2||
    new Set(value.proposedBy).size!==value.proposedBy.length||value.proposedBy.some(id=>!['balthasar','casper'].includes(id))))return null
  return {...(boundedText(value.id,128)?{id:value.id}:{}),title:value.title.trim(),objective:value.objective.trim(),acceptance:value.acceptance.map(x=>x.trim()),
    ...(successor?{evidence:value.evidence.trim(),...(value.proposedBy?{proposedBy:[...value.proposedBy]}:{})}:{})}
}

function cycleReceipt(value,slotId,roleId,{submission=false}={}) {
  if(value===undefined)return undefined
  if(!value||typeof value!=='object'||Array.isArray(value))return null
  const evidence=value.evidence??value.note??value.message
  if(value.slotId!==slotId||value.workerId!==slotId||!boundedText(value.leaseId,128)||!boundedText(value.taskId,128)||
    value.roleId!==roleId||!Number.isFinite(value.at)||!boundedText(evidence,4000)||
    (submission&&value.submissionId!==undefined&&!boundedText(value.submissionId,128))||
    (value.digest!==undefined&&!/^[a-f0-9]{64}$/i.test(value.digest))||
    (value.summary!==undefined&&!boundedText(value.summary,4000))||(value.submittedAt!==undefined&&!Number.isFinite(value.submittedAt)))return null
  const proposal=value.successorProposal===undefined?undefined:cycleContract(value.successorProposal,true,false)
  if(value.successorProposal!==undefined&&!proposal)return null
  if(value.artifacts!==undefined&&(!Array.isArray(value.artifacts)||value.artifacts.length>100||value.artifacts.some(a=>!a||typeof a.path!=='string'||a.path.length>500||!/^[a-f0-9]{64}$/i.test(a.sha256||'')||(a.size!==undefined&&(!Number.isSafeInteger(a.size)||a.size<0)))))return null
  return {slotId,workerId:slotId,roleId:value.roleId,taskId:value.taskId,leaseId:value.leaseId,at:value.at,
    ...(value.evidence?{evidence:value.evidence.trim()}:{}),...(value.note?{note:value.note.trim()}:{}),...(value.message?{message:value.message.trim()}:{}),
    ...(proposal?{successorProposal:proposal}:{}),...(value.submissionId?{submissionId:value.submissionId}:{}),...(value.digest?{digest:value.digest}:{}),
    ...(value.artifacts?{artifactCount:value.artifacts.length}:{}),...(value.summary?{summary:value.summary.trim()}:{}),...(value.submittedAt!==undefined?{submittedAt:value.submittedAt}:{})}
}

/** Return only the bounded public cycle fields; malformed lifecycle state is ignored. */
function projectSymbiosisCycle(value) {
  if(value===undefined||value===null)return null
  if(!value||typeof value!=='object'||Array.isArray(value)||!boundedText(value.id,128)||!CYCLE_PHASES.has(value.phase)||
    !ROLE_RE.test(value.bRoleId||'')||!ROLE_RE.test(value.cRoleId||'')||value.pairId!==`${value.bRoleId}-${value.cRoleId}`||
    !value.taskIds||typeof value.taskIds!=='object'||Array.isArray(value.taskIds)||
    !boundedText(value.taskIds.balthasar,128)||!boundedText(value.taskIds.casper,128)||
    !Number.isSafeInteger(value.exchangeRound)||value.exchangeRound<0)return null
  const contract=cycleContract(value.contract)
  if(!contract)return null
  const adoptionB=cycleReceipt(value.adoptions?.balthasar,'balthasar',value.bRoleId),adoptionC=cycleReceipt(value.adoptions?.casper,'casper',value.cRoleId)
  if(adoptionB===null||adoptionC===null)return null
  const contributionB=cycleReceipt(value.contributions?.balthasar,'balthasar',value.bRoleId,{submission:true}),contributionC=cycleReceipt(value.contributions?.casper,'casper',value.cRoleId,{submission:true})
  if(contributionB===null||contributionC===null)return null
  if(value.adoptions!==undefined&&(!value.adoptions||typeof value.adoptions!=='object'||Array.isArray(value.adoptions))||
    value.contributions!==undefined&&(!value.contributions||typeof value.contributions!=='object'||Array.isArray(value.contributions)))return null
  const successor=value.successorContract===null?null:cycleContract(value.successorContract,true,true)
  if(value.successorContract!==null&&!successor)return null
  if(value.reviewEvidence!==undefined&&!boundedText(value.reviewEvidence,4000))return null
  if(value.blocker!==undefined&&!(boundedText(value.blocker,4000)||value.blocker&&typeof value.blocker==='object'&&!Array.isArray(value.blocker)&&boundedText(value.blocker.reason,4000)&&boundedText(value.blocker.evidence,4000)))return null
  if(value.recoveryRequired!==undefined&&value.recoveryRequired!==true)return null
  if(value.recoverySlots!==undefined&&(!Array.isArray(value.recoverySlots)||value.recoverySlots.length<1||value.recoverySlots.length>2||
    new Set(value.recoverySlots).size!==value.recoverySlots.length||value.recoverySlots.some(id=>!['balthasar','casper'].includes(id))))return null
  if(value.recoveryRequired===true&&!value.recoverySlots?.length)return null
  if(value.roundLimit!==undefined&&(!Number.isSafeInteger(value.roundLimit)||value.roundLimit<0||value.roundLimit>12||value.exchangeRound>value.roundLimit))return null
  let exchanges=[]
  if(value.exchanges!==undefined) {
    if(!Array.isArray(value.exchanges)||value.exchanges.length!==value.exchangeRound||value.exchanges.length>12)return null
    exchanges=[]
    for(let index=0;index<value.exchanges.length;index++) {
      const exchange=value.exchanges[index]
      if(!exchange||typeof exchange!=='object'||exchange.round!==index+1||!Number.isFinite(exchange.pairedAt))return null
      const b=cycleReceipt({...exchange.balthasar,at:exchange.balthasar?.at??exchange.pairedAt,message:exchange.balthasar?.message},'balthasar',value.bRoleId)
      const c=cycleReceipt({...exchange.casper,at:exchange.casper?.at??exchange.pairedAt,message:exchange.casper?.message},'casper',value.cRoleId)
      if(!b||!c||!b.message||!c.message)return null
      exchanges.push({round:exchange.round,balthasar:b,casper:c,pairedAt:exchange.pairedAt})
    }
  }
  if(value.phase==='completed'&&(!Number.isSafeInteger(value.roundLimit)||value.roundLimit<1||value.exchangeRound!==value.roundLimit||!Array.isArray(value.exchanges)||
    !adoptionB||!adoptionC||!contributionB?.submissionId||!contributionC?.submissionId||
    !/^[a-f0-9]{64}$/i.test(contributionB.digest||'')||!/^[a-f0-9]{64}$/i.test(contributionC.digest||'')||
    !contributionB.artifactCount||!contributionC.artifactCount||!Number.isFinite(contributionB.submittedAt)||!Number.isFinite(contributionC.submittedAt)||
    !successor||!boundedText(value.reviewEvidence,4000)))return null
  if(value.phase==='blocked'&&value.blocker===undefined)return null
  return {id:value.id,phase:value.phase,contract,pairId:value.pairId,bRoleId:value.bRoleId,cRoleId:value.cRoleId,
    taskIds:{balthasar:value.taskIds.balthasar,casper:value.taskIds.casper},adoptions:{...(adoptionB?{balthasar:adoptionB}:{}),...(adoptionC?{casper:adoptionC}:{})},
    exchangeRound:value.exchangeRound,contributions:{...(contributionB?{balthasar:contributionB}:{}),...(contributionC?{casper:contributionC}:{})},
    successorContract:successor,...(boundedText(value.selectionRationale,4000)?{selectionRationale:value.selectionRationale.trim()}:{}),
    ...(value.roundLimit!==undefined?{roundLimit:value.roundLimit}:{}),...(value.exchanges!==undefined?{exchanges}:{}),
    ...(value.reviewEvidence?{reviewEvidence:value.reviewEvidence.trim()}:{}),...(value.blocker!==undefined?{blocker:typeof value.blocker==='string'?value.blocker.trim():{reason:value.blocker.reason.trim(),evidence:value.blocker.evidence.trim()}}:{}),
    ...(value.recoveryRequired?{recoveryRequired:true,recoverySlots:[...value.recoverySlots]}:{})}
}

function threadSymbiosis(cycle,slotId) {
  if(!cycle||!['balthasar','casper'].includes(slotId))return null
  const side=slotId,other=side==='balthasar'?'casper':'balthasar',roleId=cycle[side==='balthasar'?'bRoleId':'cRoleId']
  return {cycleId:cycle.id,phase:cycle.phase,pairId:cycle.pairId,roleId,partnerRoleId:cycle[other==='balthasar'?'bRoleId':'cRoleId'],
    partnerSlotId:other,taskId:cycle.taskIds[side],partnerTaskId:cycle.taskIds[other],exchangeRound:cycle.exchangeRound,
    adopted:Boolean(cycle.adoptions[side]),contribution:cycle.contributions[side]||null}
}

/** Execution slots and adopted roles are separate identities, even for the same role. */
export function assertRoArm16Projection(state, now=Date.now()) {
  if(state?.schemaVersion!==1 || !['live','standby'].includes(state.mode) || state.magi?.profile!=='roarm-16' ||
    !Number.isSafeInteger(state.revision) || typeof state.projectId!=='string' || !state.projectId ||
    !Number.isFinite(state.observedAt) || now-state.observedAt>20000 || state.observedAt>now+5000 ||
    !Array.isArray(state.tasks) || !Array.isArray(state.milestones) || !Array.isArray(state.notes))throw Error('RoArm16 state is invalid or stale')
  const slots=state.magi.executorSlots, roles=state.magi.roleCatalog
  if(!Array.isArray(slots)||slots.length!==3||new Set(slots.map(s=>s.slotId)).size!==3 ||
    !Array.isArray(roles)||roles.length!==15||new Set(roles.map(r=>r.id)).size!==15 ||
    roles.some((r,i)=>r.id!==`r${String(i+1).padStart(2,'0')}`||typeof r.title!=='string'))throw Error('RoArm16 must declare three slots and fifteen distinct roles')
  if(!Array.isArray(state.workers)||state.workers.length!==3||new Set(state.workers.map(w=>w.id)).size!==3)throw Error('RoArm16 must project three distinct executor workers')
  for(const id of SLOTS){
    const slot=slots.find(s=>s.slotId===id),worker=state.workers.find(w=>w.id===SLOT_WORKERS[id])
    if(!slot||!worker||slot.workerId!==worker.id||typeof slot.bound!=='boolean'||typeof slot.occupied!=='boolean'||
      !['idle','reserved','running'].includes(slot.status)||slot.occupied!==(slot.status!=='idle')||
      (id==='melchior'?slot.roleId!=='pilot':slot.roleId!==null&&!roles.some(r=>r.id===slot.roleId)))throw Error(`Invalid RoArm16 slot ${id}`)
    const active=ACTIVE.includes(worker.status),reserved=worker.status==='reserved'
    if(slot.status==='running'&&(!active||!slot.bound||!worker.bound)||slot.status==='reserved'&&!reserved||
      slot.status==='idle'&&(active||reserved))throw Error(`RoArm16 ${id} activity lacks a matching worker`)
  }
  const running=state.workers.filter(w=>ACTIVE.includes(w.status)).length,reserved=state.workers.filter(w=>w.status==='reserved').length
  if(state.capacity?.limit!==3||state.capacity.running!==running||state.capacity.reserved!==reserved||state.capacity.occupied!==running+reserved||running+reserved>3)throw Error('RoArm16 capacity is inconsistent')
  if(state.magi.pilot?.workerId!=='w00'||!['on','off'].includes(state.magi.pilot.duty))throw Error('RoArm16 must retain its dedicated pilot')
  return state
}

export function projectRoArm16(state, now=Date.now(),usage=new Map()) {
  assertRoArm16Projection(state,now)
  const {executorSlots:slots,roleCatalog:roles}=state.magi
  const symbiosisCycle=projectSymbiosisCycle(state.magi.symbiosisCycle)
  const active=SLOTS.map(id=>slots.find(s=>s.slotId===id).status==='running'),count=active.filter(Boolean).length
  const alignment={count,mode:['off','red','green','rainbow'][count],clusters:active}
  const threads=Array.from({length:16},(_,index)=>{
    const id=`w${String(index).padStart(2,'0')}`,slotId=VISUAL_SLOT[id],slot=slots.find(s=>s.slotId===slotId)
    const worker=slot&&state.workers.find(w=>w.id===slot.workerId)
    const catalogRole=roles[index-1],role=slotId==='melchior'?null:roles.find(r=>r.id===slot?.roleId)||catalogRole
    const title=slotId==='melchior'?'Captain · RoArm pilot':slot?`${slotId==='balthasar'?'Balthasar':'Casper'} · ${slot.roleId?role.title:'Role not selected'}`:role.title
    const status=worker?.status||'idle',running=slot?.status==='running'&&worker?.bound&&ACTIVE.includes(status)
    const task=state.tasks.find(t=>t.id===worker?.taskId)
    return {id:`magi:${id}`,shellId:id,isShell:true,shellName:title,title,projectLabel:title,project:`MAGI ${id}`,
      worldProfile:'roarm-16',clusterId:slotId||'roles',executorSlot:slotId||null,executorWorkerId:worker?.id||null,
      slotId:slotId||null,workerId:worker?.id||null,
      roleId:slot?slot.roleId:role.id,roleTitle:slotId==='melchior'?'RoArm pilot':slot&&!slot.roleId?'Role not selected':role.title,
      rolePurpose:role?.purpose||'Dedicated operator through the reviewed controller',catalogRoleId:catalogRole?.id||null,
      pilotIdentity:slotId==='melchior',shellColor:'#e9a45b',projectAccent:0xe9a45b,suitColor:slotId==='melchior'?0x274c70:0xf3f1ec,
      running:Boolean(running),hasError:status==='failed',archived:false,unread:false,canOpen:false,
      assignmentRole:running?(status==='reviewing'?'review':'work'):status==='reserved'?'reserved':'idle',assignmentState:status,
      shellStatus:running?(status==='reviewing'?'Reviewing':'Working'):status==='reserved'?'Reserved':slot?'Ready':'Role available',taskId:worker?.taskId||null,
      workerBackend:worker?.bound?(worker.backend||'unknown'):null,protocolExecution:status,taskTitle:worker?.taskTitle||task?.title||null,
      tokenUsage:slot?usage.get(worker.id)||null:null,vehicleId:worker?.vehicleId||null,alignment,
      earnedRewards:(state.magi.earnedRewards||[]).filter(r=>r.workerId===(worker?.id||id)),
      ...(slotId==='balthasar'||slotId==='casper'?{symbiosisPair:threadSymbiosis(symbiosisCycle,slotId)}:{}),
      milestones:state.milestones.filter(m=>m.workerId===(worker?.id||id)),dependencies:[],reviewer:null,
      createdAt:index+1,lastActivityAt:state.observedAt,sizeBytes:0,attemptCount:0,runId:state.projectId,
      constructionRunId:`magi:${state.projectId}`,projectPath:'',projectRoot:'',workflow:'RoArm 16 / 3',scrollUrl:null}
  })
  return {threads,alignment,worksite:{profile:'roarm-16',personaCount:16,executorSlots:slots,roleCatalog:roles,
    symbiosis:state.magi.symbiosis||{id:`${slots[1].roleId}-${slots[2].roleId}`,bRoleId:slots[1].roleId,cRoleId:slots[2].roleId},symbiosisCycle,
    pilot:state.magi.pilot,contracts:state.magi.contracts||[],earnedRewards:state.magi.earnedRewards||[],
    bounties:state.magi.bounties||[],serviceCredits:state.magi.serviceCredits||[],observedAt:state.observedAt,updatedAt:state.observedAt,revision:state.revision,stale:false}}
}
