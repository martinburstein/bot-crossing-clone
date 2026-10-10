import './worksite-board.css'
import {campfirePhilosophy} from './campfire-philosophy.js'
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e}
const goodText=(v,max=2000)=>typeof v==='string'&&v.trim().length>0&&v.length<=max
const roleId=v=>/^r(?:0[1-9]|1[0-5])$/.test(v||'')
function goodReceipt(r,slot,role,{submission=false,message=false}={}) {
  const evidence=r?.evidence||r?.note||r?.message
  return !!r&&r.slotId===slot&&r.workerId===slot&&r.roleId===role&&goodText(r.taskId,128)&&goodText(r.leaseId,128)&&
    Number.isFinite(r.at)&&goodText(evidence,4000)&&(!message||goodText(r.message,4000))&&
    (!submission||r.submissionId===undefined||goodText(r.submissionId,128))&&(r.digest===undefined||/^[a-f0-9]{64}$/i.test(r.digest))
}
function renderableCycle(c) {
  if(!c||typeof c!=='object'||!['selected','adopting','working','concluding','completed','blocked'].includes(c.phase)||!goodText(c.id,128)||
    !c.contract||!goodText(c.contract.id,128)||!goodText(c.contract.title,120)||!goodText(c.contract.objective)||!Array.isArray(c.contract.acceptance)||
    c.contract.acceptance.length<1||c.contract.acceptance.length>8||c.contract.acceptance.some(x=>!goodText(x,500))||
    !roleId(c.bRoleId)||!roleId(c.cRoleId)||c.pairId!==`${c.bRoleId}-${c.cRoleId}`||
    !c.taskIds||!goodText(c.taskIds.balthasar,128)||!goodText(c.taskIds.casper,128)||!Number.isSafeInteger(c.exchangeRound)||c.exchangeRound<0)return false
  if(c.adoptions!==undefined&&(!c.adoptions||typeof c.adoptions!=='object'||Array.isArray(c.adoptions))||c.contributions!==undefined&&(!c.contributions||typeof c.contributions!=='object'||Array.isArray(c.contributions)))return false
  for(const [slot,role]of [['balthasar',c.bRoleId],['casper',c.cRoleId]]){
    if(c.adoptions?.[slot]!==undefined&&!goodReceipt(c.adoptions[slot],slot,role))return false
    if(c.contributions?.[slot]!==undefined&&!goodReceipt(c.contributions[slot],slot,role,{submission:true}))return false
  }
  if(c.successorContract!==null&&c.successorContract!==undefined&&(!goodText(c.successorContract.id,128)||!goodText(c.successorContract.title,120)||
    !goodText(c.successorContract.objective)||!Array.isArray(c.successorContract.acceptance)||c.successorContract.acceptance.length<1||c.successorContract.acceptance.length>8||
    c.successorContract.acceptance.some(x=>!goodText(x,500))||!goodText(c.successorContract.evidence,2000)))return false
  if(c.phase==='completed'&&(!c.adoptions?.balthasar||!c.adoptions?.casper||!c.contributions?.balthasar?.submissionId||!c.contributions?.casper?.submissionId||
    !Number.isSafeInteger(c.roundLimit)||c.roundLimit<1||c.exchangeRound!==c.roundLimit||!Array.isArray(c.exchanges)||c.exchanges.length!==c.exchangeRound||
    !/^[a-f0-9]{64}$/i.test(c.contributions.balthasar.digest||'')||!/^[a-f0-9]{64}$/i.test(c.contributions.casper.digest||'')||
    !c.contributions.balthasar.artifactCount||!c.contributions.casper.artifactCount||!Number.isFinite(c.contributions.balthasar.submittedAt)||!Number.isFinite(c.contributions.casper.submittedAt)||
    !c.successorContract||!goodText(c.reviewEvidence,4000)))return false
  if(c.exchanges!==undefined&&(!Array.isArray(c.exchanges)||c.exchanges.length!==c.exchangeRound||c.exchanges.length>12||c.exchanges.some((x,i)=>
    !x||x.round!==i+1||!Number.isFinite(x.pairedAt)||!goodReceipt(x.balthasar,'balthasar',c.bRoleId,{message:true})||!goodReceipt(x.casper,'casper',c.cRoleId,{message:true}))))return false
  if(c.roundLimit!==undefined&&(!Number.isSafeInteger(c.roundLimit)||c.roundLimit<1||c.roundLimit>12||c.exchangeRound>c.roundLimit))return false
  if(c.reviewEvidence!==undefined&&!goodText(c.reviewEvidence,4000))return false
  if(c.phase==='blocked'&&!c.blocker)return false
  if(c.recoveryRequired!==undefined&&c.recoveryRequired!==true)return false
  if(c.recoverySlots!==undefined&&(!Array.isArray(c.recoverySlots)||c.recoverySlots.length<1||c.recoverySlots.length>2||new Set(c.recoverySlots).size!==c.recoverySlots.length||c.recoverySlots.some(id=>!['balthasar','casper'].includes(id))))return false
  return !(c.recoveryRequired===true&&!c.recoverySlots?.length)
}

/** Read-only display of accepted work, proposed contracts, and camp context. */
export class WorksiteBoard {
  constructor(root,focus,focusArm,simulate,focusCamp){
    this.el=node('details');this.el.className='worksite-board';this.summary=node('summary','RoArm · Bounty board')
    this.body=node('div');this.body.className='worksite-board-body'
    const button=node('button','Locate board');button.type='button';button.onclick=focus
    const armButton=node('button','View arm');armButton.type='button';armButton.onclick=focusArm
    const simulateButton=node('button','Simulate joints');simulateButton.type='button';simulateButton.onclick=simulate
    this.campButton=node('button','Visit camp');this.campButton.type='button';this.campButton.onclick=()=>{focusCamp?.();this.el.open=true;this.philosophyOpen=true;this.philosophy?.setAttribute('open','');this.philosophy?.scrollIntoView({block:'nearest'})};this.campButton.hidden=true
    this.status=node('p');this.list=node('div');this.cycle=node('section');this.cycle.className='symbiosis-cycle'
    this.cycleTitle=node('strong','Shared cycle');this.cycleBody=node('div');this.cycle.append(this.cycleTitle,this.cycleBody)
    this.pilot=node('p');this.sensor=node('p','Arm: waiting for measured angles');this.pair=node('p');this.roles=node('details');this.roleSummary=node('summary','15 shared roles · 225 ordered skills');this.roles.append(this.roleSummary);this.roleList=node('div');this.roles.append(this.roleList);this.roles.hidden=true
    this.body.append(this.campButton,this.pilot,this.sensor,this.pair,this.roles,this.cycle,armButton,simulateButton,button,this.status,this.list);this.el.append(this.summary,this.body);root.append(this.el);this.update({})
  }
  observation(data){
    if(data.state==='live')this.lastObservation=data
    const shown=data.pose?data:this.lastObservation||data,source=shown.source==='hardware'?'Measured hardware':shown.source==='simulator'?'Simulator':'No sensor feed'
    this.sensor.textContent=`${source} · ${data.state||'offline'}${shown.pose?' · '+Object.entries(shown.pose).map(([k,v])=>`${k} ${(v*180/Math.PI).toFixed(1)}°`).join(' / '):''}${data.state!=='live'&&shown.pose?' · holding last pose':''}`
  }
  update({bounties=[],serviceCredits=[],stale=false,pilot=null,contracts=[],earnedRewards=[],profile=null,executorSlots=[],roleCatalog=[],symbiosis=null,symbiosisCycle=null,campus=null}={}){
    this.campButton.hidden=profile!=='roarm-campus'
    if(pilot)this.lastPilot=pilot
    const duty=pilot||this.lastPilot
    this.pilot.textContent=duty?`Pilot ${duty.workerId.toUpperCase()} · ${stale?'assignment feed unavailable':duty.duty==='off'?'Rest authorized':duty.duty==='on'?'Stationed at controls':'key assigned'} · model activity shown separately`:'Pilot: awaiting assignment'
    this.roles.hidden=!['roarm-16','roarm-campus'].includes(profile);this.pair.textContent=''
    this.roleSummary.textContent=profile==='roarm-campus'?'15 executor skills · 225 starting tasks':'15 shared roles · 225 ordered skills'
    if(!this.roles.hidden)this.roleList.replaceChildren(...roleCatalog.map(role=>{const item=node('article');item.append(node('strong',`${role.id.toUpperCase()} · ${role.title}`),node('p',role.purpose||''));return item}))
    this.cycle.hidden=!['roarm-16','roarm-campus'].includes(profile)
    if(profile==='roarm-16'){
      const b=executorSlots.find(s=>s.slotId==='balthasar'),c=executorSlots.find(s=>s.slotId==='casper'),name=id=>roleCatalog.find(r=>r.id===id)?.title||id||'Role not selected',activity=s=>s?.status==='running'?'working':s?.status==='reserved'?'reserved':s?.status==='idle'?'idle':'unknown'
      this.pair.textContent=`16-3A = 15-2A + 1-A · Selected roles: Balthasar ${name(b?.roleId)} · Casper ${name(c?.roleId)} · ${symbiosis?.name||symbiosis?.id||''} · 225 ordered pairs. Model activity: Balthasar ${activity(b)}; Casper ${activity(c)}.`
      this.renderCycle(symbiosisCycle,executorSlots,roleCatalog,stale)
    }
    if(profile==='roarm-campus')this.renderCampus(campus,executorSlots,stale,roleCatalog)
    const open=bounties.filter(b=>b.status==='open')
    this.summary.textContent=`RoArm · ${stale?'Board offline':earnedRewards.length+' rewards · '+contracts.length+' contracts'}${open.length?' · '+open.length+' blockers':''}`
    this.status.textContent=stale?'Waiting for a fresh work record.':profile==='roarm-16'?'Shared contract → choose roles → work together → Astra review → camp → next contract':profile==='roarm-campus'?'Report + proposed hat → Astra acceptance → own pod → next executor receives instructions':'Complete contract → independent review → earn wearable → leave next contract'
    this.list.replaceChildren()
    for(const reward of earnedRewards){const item=node('article');item.append(node('strong',reward.design?.name||reward.rewardDesign?.name||reward.name||'Earned wearable'),node('p',`${reward.roleId||reward.workerId?.toUpperCase()||''} · reviewed RoArm work`));this.list.append(item)}
    for(const contract of contracts){const item=node('article');item.append(node('strong',contract.title||'Next contract'),node('p',contract.objective||''),node('small',`Proposed · ${contract.predecessorWorkerId||'previous worker'} → ${contract.successorWorkerId||'next worker'}`));this.list.append(item)}
    if(!bounties.length)this.list.append(node('p','No reported blockers.'))
    for(const bounty of bounties){const item=node('article');item.append(node('strong',bounty.description||bounty.text||bounty.title||bounty.id),node('p',`${bounty.status||bounty.state||'open'} · ${bounty.taskId||bounty.sourceTaskId||''}`));if(bounty.solvedByWorkerId)item.append(node('small',`${bounty.solvedByWorkerId.toUpperCase()} · verified service credit`));this.list.append(item)}
    this.list.append(node('p',`${serviceCredits.reduce((sum,c)=>sum+(Number.isFinite(c.amount)?c.amount:0),0)} verified service credits`))
  }
  renderCampus(c,slots,stale,roleCatalog=[]){
    if(this.philosophy)this.philosophyOpen=this.philosophy.open
    this.philosophy=null
    this.cycleBody.replaceChildren();this.cycleTitle.textContent='Work ahead & campfire'
    if(stale||!c){this.cycleBody.append(node('p','Waiting for a fresh campus record.'));return}
    this.pair.textContent=`15-1A + 2 specialists · Cycle ${c.cycleNumber} · ${c.mode==='sleeping'?'All fifteen tucked into pods':`${c.campRoleIds.length} at camp · ${c.activeRoleId} selected · ${c.chargingRoleId} charging`}`
    this.cycleBody.append(node('p',`${c.phase} · Model sessions: ${slots.map(s=>`${s.slotId}: ${s.status}`).join(' · ')}`))
    if(c.mode==='awake'){
      const session=campfirePhilosophy(c,roleCatalog),d=node('details');d.className='campfire-philosophy';d.open=!!this.philosophyOpen
      d.append(node('summary',session.title),node('p',session.opening),node('small',session.disclosure))
      for(const voice of session.voices){const line=node('article');line.append(node('strong',`${voice.id.toUpperCase()} · ${voice.title}${voice.remote?' · imagined from charging pod':''}`),node('p',voice.text));d.append(line)}
      d.append(node('strong','Ideas to carry forward'),node('p',session.synthesis));this.cycleBody.append(d);this.philosophy=d
    }
    if(c.currentContract)this.cycleBody.append(node('strong',c.currentContract.title),node('p',c.currentContract.objective))
    const memory=Array.isArray(c.campMemory)?c.campMemory.at(-1):c.campMemory?.content||c.campMemory
    if(memory?.synthesis||memory?.interpretation)this.cycleBody.append(node('strong','Accepted camp history'),node('p',memory.synthesis||memory.interpretation))
    if(memory?.dialogue?.length){const d=node('details');d.append(node('summary','Balthasar’s imagined camp conversation'));for(const line of memory.dialogue)d.append(node('p',`${line.roleId}: ${line.text}`));this.cycleBody.append(d)}
    if(memory?.facts?.length){const d=node('details');d.append(node('summary','Source-backed project facts'));for(const fact of memory.facts)d.append(node('p',fact.text),node('small',typeof fact.source==='string'?fact.source:JSON.stringify(fact.source||{artifactPath:fact.artifactPath,sha256:fact.sha256})));this.cycleBody.append(d)}
  }
  renderCycle(cycle,slots,roleCatalog,stale){
    this.cycleBody.replaceChildren()
    if(stale){this.cycleTitle.textContent='Shared cycle · source stale';this.cycleBody.append(node('p','Waiting for a fresh canonical projection. No cycle phase or completion is inferred.'));return}
    if(!cycle){this.cycleTitle.textContent='Shared cycle · none selected';this.cycleBody.append(node('p','No current shared contract is published.'));return}
    if(!renderableCycle(cycle)){this.cycleTitle.textContent='Shared cycle · details withheld';this.cycleBody.append(node('p','The projected cycle is incomplete or malformed; completion is not shown.'));return}
    const roleName=id=>roleCatalog.find(r=>r.id===id)?.title||id,status=id=>slots.find(s=>s.slotId===id)?.status||'unknown'
    this.cycleTitle.textContent=`Shared cycle · ${cycle.phase}`
    this.cycleBody.append(node('strong',cycle.contract.title),node('p',cycle.contract.objective),node('p',`Pair ${cycle.pairId} · Balthasar ${roleName(cycle.bRoleId)} (${status('balthasar')}) × Casper ${roleName(cycle.cRoleId)} (${status('casper')})`),node('p',`Protocol phase: ${cycle.phase}. Bound-slot activity reports confirmed lease state; it does not imply simultaneous model generation.`))
    for(const [id,label]of [['balthasar','Balthasar'],['casper','Casper']]){const a=cycle.adoptions?.[id],c=cycle.contributions?.[id];this.cycleBody.append(node('p',`${label} adoption: ${a?`recorded · ${a.evidence||'evidence supplied'}`:'pending'}`),node('p',`${label} contribution: ${c?`submitted · ${c.evidence||'evidence supplied'}`:'pending'}`))}
    this.cycleBody.append(node('p',`Coordinated work · exchange ${cycle.exchangeRound}${cycle.roundLimit?' / '+cycle.roundLimit:''}`))
    for(const x of cycle.exchanges||[])this.cycleBody.append(node('p',`Exchange ${x.round} · Balthasar: ${x.balthasar.message} · Casper: ${x.casper.message}`))
    if(cycle.phase==='blocked')this.cycleBody.append(node('p',`Blocked: ${typeof cycle.blocker==='string'?cycle.blocker:cycle.blocker?.reason||'evidence required'}`))
    if(cycle.recoveryRequired)this.cycleBody.append(node('p',`Recovery required · prior turn terminated for ${cycle.recoverySlots.map(id=>id==='casper'?'Casper':'Balthasar').join(', ')}`))
    if(cycle.phase==='completed'&&cycle.successorContract)this.cycleBody.append(node('article',`${cycle.reviewEvidence} · Shared successor contract: ${cycle.successorContract.title} — ${cycle.successorContract.objective}`))
  }
}
