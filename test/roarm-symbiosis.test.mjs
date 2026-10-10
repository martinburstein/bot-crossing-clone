import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {dirname,resolve} from 'node:path'
import os from 'node:os'
import path from 'node:path'
import * as THREE from 'three'
import {projectMagiState} from '../server/magi.mjs'
import {MagiLife} from '../src/agents/magi-life.js'
import {createRoArmWorksite} from '../src/world/roarm-worksite.js'
import {projectSymbiosisCycle as projectCoreSymbiosisCycle} from '../../swarm-protocol/core/symbiosis.mjs'

function createAnimationMethod() {
  const source=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../src/agents/astronauts.js'),'utf8')
  const start=source.indexOf('  _animate(agent, dt, anim) {'),end=source.indexOf('\n  // ── writing the instance buffers',start)
  assert.ok(start>=0&&end>start,'Astronauts animation method remains available for the regression')
  return new Function('THREE','WALK_SPEED','frameFor',`return ({${source.slice(start,end).trim()}})._animate`)(THREE,2.1,()=>0)
}

const now=100000
const receipt=(side,roleId,submission=false)=>({slotId:side,workerId:side,leaseId:`${side}-lease`,taskId:`${side}-task`,...(submission?{submissionId:`${side}-submission`,digest:'a'.repeat(64),artifacts:[{path:`out/${side}.json`,sha256:'b'.repeat(64),size:12}],summary:`${side} submitted a read-only artifact`,submittedAt:now,note:`${side} bounded contribution evidence`,successorProposal:{title:'Trace the next fixture',objective:'Check a read-only trace.',acceptance:['Source is recorded'],evidence:'Contribution proposal'}}:{}),roleId,at:now,...(submission?{}:{evidence:`${side} explicitly adopted the contract`})})
function cycle({phase='completed',successor=true}={}) {
  return {id:'cycle-r05-r05-1',phase,contract:{id:'shared-contract-1',title:'Inspect simulated pose provenance',objective:'Compare deterministic telemetry fixtures and preserve blocked or failed readings.',acceptance:['Source and freshness are visible','No command is sent']},
    pairId:'r05-r05',bRoleId:'r05',cRoleId:'r05',taskIds:{balthasar:'b-task',casper:'c-task'},adoptions:{balthasar:receipt('balthasar','r05'),casper:receipt('casper','r05')},exchangeRound:2,
    contributions:{balthasar:receipt('balthasar','r05',true),casper:receipt('casper','r05',true)},successorContract:successor?{id:'successor-1',title:'Reconcile readiness without motion',objective:'Review read-only restart fixtures; do not issue movement.',acceptance:['Failed history retained'],evidence:'Both role contributions were recorded.',proposedBy:['balthasar','casper']}:null,
    selectionRationale:'The operator display is the highest priority pair for this mission.',roundLimit:2,exchanges:[1,2].map(round=>({round,balthasar:{slotId:'balthasar',workerId:'balthasar',roleId:'r05',taskId:'b-task',leaseId:`b-exchange-${round}`,message:`B checkpoint ${round}`,at:now},casper:{slotId:'casper',workerId:'casper',roleId:'r05',taskId:'c-task',leaseId:`c-exchange-${round}`,message:`C checkpoint ${round}`,at:now},pairedAt:now+round})),
    reviewEvidence:'Astra checked both contributions and accepted the joint result.'}
}
function canonicalCycle() {
  const internal=cycle()
  for(const side of ['balthasar','casper']) {
    internal.adoptions[side].turnTokenDigest='c'.repeat(64);internal.adoptions[side].sessionBindingDigest='d'.repeat(64)
    internal.contributions[side].turnTokenDigest='e'.repeat(64);internal.contributions[side].sessionBindingDigest='f'.repeat(64)
  }
  return projectCoreSymbiosisCycle(internal)
}
function fixture({cycleData=canonicalCycle(),casperRunning=false}={}) {
  const ids=['w00','balthasar','casper'],slots=['melchior','balthasar','casper']
  const state={schemaVersion:1,mode:'live',revision:4,projectId:'symbiosis-fixture',observedAt:now,tasks:[],notes:[],milestones:[],capacity:{total:3,limit:3,running:casperRunning?2:1,reserved:0,occupied:casperRunning?2:1},
    workers:ids.map((id,i)=>({id,name:slots[i],bound:i>0,status:i===1||casperRunning?'running':'idle',backend:i>0?'fixture':null})),
    magi:{mode:'magi',profile:'roarm-16',personaCount:16,executorSlots:ids.map((workerId,i)=>({workerId,slotId:slots[i],roleId:i?'r05':'pilot',bound:i>0,status:i===1||casperRunning?'running':'idle',occupied:i===1||casperRunning})),
      roleCatalog:Array.from({length:15},(_,i)=>({id:`r${String(i+1).padStart(2,'0')}`,title:`Role ${i+1}`,purpose:`Purpose ${i+1}`})),pilot:{workerId:'w00',slotId:'melchior',roleId:'pilot',duty:'on',generation:1,changedAt:1,evidence:'Pilot assigned',history:[{operationId:'pilot-enable',kind:'enable',toWorkerId:'w00',toDuty:'on',generation:1,evidence:'Pilot assigned',at:1}]},earnedRewards:[],contracts:[],symbiosisCycle:cycleData}}
  return state
}

test('canonical completed projection publishes one shared cycle and per-slot metadata without inflating actual execution',()=>{
  const projected=projectMagiState(fixture(),now)
  assert.equal(projected.worksite.symbiosisCycle.id,'cycle-r05-r05-1')
  assert.equal(projected.worksite.symbiosisCycle.selectionRationale,cycle().selectionRationale)
  assert.equal(projected.worksite.symbiosisCycle.exchanges.length,2)
  assert.equal(projected.worksite.symbiosisCycle.exchanges.at(-1).casper.message,'C checkpoint 2')
  assert.equal(projected.alignment.count,1)
  assert.equal(projected.threads.find(t=>t.slotId==='balthasar').running,true)
  assert.equal(projected.threads.find(t=>t.slotId==='casper').running,false)
  const b=projected.threads.find(t=>t.slotId==='balthasar').symbiosisPair,c=projected.threads.find(t=>t.slotId==='casper').symbiosisPair
  assert.deepEqual([b.cycleId,b.phase,b.roleId,b.partnerRoleId,b.taskId,b.partnerTaskId],['cycle-r05-r05-1','completed','r05','r05','b-task','c-task'])
  assert.equal(b.contribution.submissionId,'balthasar-submission');assert.equal(c.contribution.submissionId,'casper-submission')
  assert.equal(b.contribution.artifactCount,1)
  assert.equal(JSON.stringify(projected).includes('turnToken'),false)
  assert.equal(JSON.stringify(projected).includes('sessionBindingDigest'),false)
})

test('malformed completed cycles are ignored instead of projecting a successful handoff',()=>{
  const projected=projectMagiState(fixture({cycleData:cycle({successor:false})}),now)
  assert.equal(projected.worksite.symbiosisCycle,null)
  assert.equal(projected.threads.find(t=>t.slotId==='balthasar').symbiosisPair,null)
  assert.equal(projected.threads.find(t=>t.slotId==='casper').symbiosisPair,null)
  const blocked=cycle({phase:'blocked'});delete blocked.blocker
  assert.equal(projectMagiState(fixture({cycleData:blocked}),now).worksite.symbiosisCycle,null)
})

test('blocked recovery projection preserves terminated slot identities for operator visibility',()=>{
  const recovering=cycle({phase:'blocked'});recovering.blocker='Casper turn terminated after uncertain dispatch';recovering.recoveryRequired=true;recovering.recoverySlots=['casper']
  const projected=projectMagiState(fixture({cycleData:recovering}),now)
  assert.equal(projected.worksite.symbiosisCycle.recoveryRequired,true)
  assert.deepEqual(projected.worksite.symbiosisCycle.recoverySlots,['casper'])
  const malformed=cycle({phase:'blocked'});malformed.blocker='Recovery status';malformed.recoveryRequired=true;malformed.recoverySlots=['melchior']
  assert.equal(projectMagiState(fixture({cycleData:malformed}),now).worksite.symbiosisCycle,null)
})

test('canonical completion sends both stable role bodies to the shared camp without changing worker activity',()=>{
  const projected=projectMagiState(fixture(),now),scene=new THREE.Scene(),worksite=createRoArmWorksite(scene)
  const life=new MagiLife(scene,{transient:true,get:()=>false})
  const world={worksite,groundAt:()=>0,worksiteProjection:projected.worksite}
  const agents=projected.threads.map(thread=>({id:thread.id,thread,status:thread.running?'working':'idle',state:'at-site',pos:new THREE.Vector3()}))
  try {
    life.sync(agents,world);life.update(agents,world,1)
    const b=agents.find(a=>a.thread.slotId==='balthasar'),c=agents.find(a=>a.thread.slotId==='casper')
    assert.equal(life.fleet.size,0,'completed pair is no longer shown at a vehicle worksite')
    assert.equal(b.magiActivity,'symbiosis-handoff');assert.equal(c.magiActivity,'symbiosis-handoff')
    assert.ok(b.magiGoal.distanceTo(worksite.camp.group.position)<10);assert.ok(c.magiGoal.distanceTo(worksite.camp.group.position)<10)
    assert.notEqual(b.magiGoal.distanceToSquared(c.magiGoal),0,'the two bodies have separate camp places')
    assert.equal(b.thread.running,true,'camp placement does not rewrite bound execution state')
    assert.equal(c.thread.running,false)
  } finally {life.dispose();worksite.dispose()}
})

test('a newer task for the same role is not held at the prior completed cycle camp',()=>{
  const projected=projectMagiState(fixture(),now),scene=new THREE.Scene(),worksite=createRoArmWorksite(scene)
  const life=new MagiLife(scene,{transient:true,get:()=>false}),world={worksite,groundAt:()=>0,worksiteProjection:projected.worksite}
  const agents=projected.threads.map(thread=>({id:thread.id,thread,status:thread.running?'working':'idle',state:'at-site',pos:new THREE.Vector3()}))
  try {
    const b=agents.find(a=>a.thread.slotId==='balthasar')
    b.thread.taskId='new-task-after-cycle'
    life.sync(agents,world);life.update(agents,world,1)
    assert.notEqual(b.magiActivity,'symbiosis-handoff')
    assert.equal(b.thread.taskId,'new-task-after-cycle')
  } finally {life.dispose();worksite.dispose()}
})

test('completed pair walks to camp then rests there even when the last task status is working',()=>{
  const animate=createAnimationMethod(),animator={rig:{clips:{walk:{start:1,frames:8,loop:true,duration:1},sit:{start:11,frames:8,loop:true,duration:1},idle:{start:21,frames:8,loop:true,duration:1},work:{start:31,frames:8,loop:true,duration:1}}}}
  const agent={magiActivity:'symbiosis-handoff',status:'working',state:'at-site',groundSpeed:1,magiSettled:false,clipKey:'idle'}
  animate.call(animator,agent,.1,1)
  assert.equal(agent.clipKey,'walk','real translation to camp retains locomotion')
  agent.groundSpeed=0;agent.magiSettled=true
  animate.call(animator,agent,.1,1)
  assert.equal(agent.clipKey,'sit','the completed handoff rests despite a stale work label')
})

test('board renders one shared contract and distinguishes protocol cycle from bound slot activity',async()=>{
  const source=readFileSync(new URL('../src/ui/worksite-board.js',import.meta.url),'utf8')
    .replace("import './worksite-board.css'",'')
    .replace("import {campfirePhilosophy} from './campfire-philosophy.js'",'const campfirePhilosophy=()=>({})')
    .replace("import {campusSlotAssignments,campusSlotName} from '../campus-slot-assignments.js'",'const campusSlotAssignments=()=>null,campusSlotName=id=>id')
  const file=path.join(await fs.mkdtemp(path.join(os.tmpdir(),'symbiosis-board-')),'board.mjs')
  try {
    await fs.writeFile(file,source)
    const original=globalThis.document
    class Element {constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.hidden=false;this.className=''}append(...items){this.children.push(...items)}replaceChildren(...items){this.children=items}}
    globalThis.document={createElement:tag=>new Element(tag)}
    try {
      const {WorksiteBoard}=await import(`${pathToFileURL(file).href}?fixture=1`)
      const root=new Element('root'),board=new WorksiteBoard(root,()=>{},()=>{},()=>{})
      const shared=projectMagiState(fixture(),now).worksite.symbiosisCycle
      board.update({profile:'roarm-16',symbiosisCycle:shared,executorSlots:[{slotId:'balthasar',roleId:'r05',status:'running'},{slotId:'casper',roleId:'r05',status:'idle'}],roleCatalog:[{id:'r05',title:'Motion verification'}]})
      const allText=element=>`${element.textContent} ${(element.children||[]).map(allText).join(' ')}`
      const text=allText(board.cycle)
      assert.match(text,/Inspect simulated pose provenance/)
      assert.match(text,/Balthasar Working|Balthasar Motion verification/)
      assert.match(text,/Coordinated work · exchange 2/)
      assert.match(board.pair.textContent,/Model activity: Balthasar working; Casper idle/)
      assert.match(text,/Shared successor contract/)
      assert.match(board.pair.textContent,/16-3A = 15-2A \+ 1-A/)
      assert.match(board.status.textContent,/Shared contract → choose roles → work together → Astra review → camp → next contract/)
      const recovering=cycle({phase:'blocked'});recovering.blocker='Casper turn ended uncertainly';recovering.recoveryRequired=true;recovering.recoverySlots=['casper']
      board.update({profile:'roarm-16',symbiosisCycle:projectMagiState(fixture({cycleData:recovering}),now).worksite.symbiosisCycle,executorSlots:[],roleCatalog:[]})
      assert.match(allText(board.cycle),/Recovery required · prior turn terminated for Casper/)
      const malformed={...shared,successorContract:null}
      board.update({profile:'roarm-16',symbiosisCycle:malformed,executorSlots:[],roleCatalog:[]})
      assert.match(board.cycleTitle.textContent,/details withheld/)
      assert.match(board.cycle.children[1].children[0].textContent,/completion is not shown/)
    } finally {globalThis.document=original}
  } finally {await fs.rm(path.dirname(file),{recursive:true,force:true})}
})
