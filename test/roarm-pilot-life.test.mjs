import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname,resolve} from 'node:path'
import * as THREE from 'three'
import {MagiLife} from '../src/agents/magi-life.js'
import {standbyMagiThreads} from '../src/game/magi-world.js'
import {createRoArmWorksite} from '../src/world/roarm-worksite.js'
import {createRoArmPilotGear} from '../src/world/roarm-pilot-gear.js'
import {workerInspection,workerSpeech} from '../src/ui/worker-data.mjs'

function fixture(initialPilot='w06') {
  const scene=new THREE.Scene(),worksite=createRoArmWorksite(scene),life=new MagiLife(scene,{transient:true,get:()=>false})
  const seat={position:new THREE.Vector3(1,2,3),yaw:.4}
  worksite.pilotSeat=()=>({position:seat.position.clone(),yaw:seat.yaw})
  const world={worksite,groundAt:()=>0,worksiteProjection:{pilot:{workerId:initialPilot,previousWorkerId:null,generation:1,changedAt:'first'}}}
  const agents=standbyMagiThreads().map(thread=>({id:thread.id,thread,status:'idle',state:'at-site',pos:new THREE.Vector3()}))
  life.sync(agents,world);life.update(agents,world,1)
  return {scene,worksite,life,world,agents,seat,dispose(){life.dispose();worksite.dispose()}}
}

function roarm16Fixture({seatAvailable=true}={}) {
  const scene=new THREE.Scene(),worksite=createRoArmWorksite(scene),life=new MagiLife(scene,{transient:true,get:()=>false})
  const seat={position:new THREE.Vector3(0,1.6,-2.72),yaw:0}
  worksite.pilotSeat=()=>seatAvailable?{position:seat.position.clone(),yaw:seat.yaw}:null
  const pilot={workerId:'w00',slotId:'melchior',roleId:'pilot',duty:'on',generation:1,changedAt:1,evidence:'Dedicated RoArm-16 pilot assigned',history:[
    {operationId:'pilot-enable-1',kind:'enable',toWorkerId:'w00',toDuty:'on',generation:1,evidence:'Dedicated RoArm-16 pilot assigned',at:1},
  ]}
  const world={worksite,groundAt:()=>0,worksiteProjection:{profile:'roarm-16',pilot}}
  const agents=Array.from({length:16},(_,index)=>{
    const pilot=index===0,slotId=pilot?'melchior':index<8?'balthasar':'casper',workerId=pilot?'w00':slotId
    const shellId=pilot?'w00':`w${String(index<8?index+6:index+3).padStart(2,'0')}`
    const thread={id:`magi:${shellId}`,workerId,shellId,slotId,roleId:pilot?'pilot':`role-${index}`,clusterId:slotId,worldProfile:'roarm-16',running:!pilot&&index===2}
    return {id:thread.id,thread,status:pilot?'working':'idle',state:'at-site',pos:new THREE.Vector3()}
  })
  life.sync(agents,world);life.update(agents,world,1)
  return {scene,worksite,life,world,agents,seat,pilot:agents[0],dispose(){life.dispose();worksite.dispose()}}
}

function createAnimationMethod() {
  const source=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../src/agents/astronauts.js'),'utf8')
  const start=source.indexOf('  _animate(agent, dt, anim) {')
  const end=source.indexOf('\n  // ── writing the instance buffers',start)
  assert.ok(start>=0&&end>start,'Astronauts animation method remains available for the regression')
  const method=source.slice(start,end).trim()
  return new Function('THREE','WALK_SPEED','frameFor',`return ({${method}})._animate`)(THREE,2.1,()=>0)
}

test('one durable pilot stays seated while idle and the other fourteen keep camp goals',()=>{
  const f=fixture(),pilot=f.agents[5]
  assert.equal(f.life.pilotDuty.workerId,'w06')
  assert.equal(f.life.fleet.size,0)
  assert.equal(f.agents.filter(a=>a.mounted).length,1)
  assert.equal(pilot.mounted,true);assert.equal(pilot.thread.running,false)
  assert.ok(pilot.magiSeat.distanceTo(f.seat.position)<1e-9)
  assert.equal(pilot.magiActivity,'pilot');assert.equal(f.life.pilotKey.visible,true)
  assert.equal(workerSpeech(pilot,null),'At controls')
  const info=workerInspection(pilot,null)
  assert.ok(info.rows.some(([k,v])=>k==='Pilot duty'&&v==='Assigned · w06'))
  const others=f.agents.filter(a=>a!==pilot)
  assert.equal(others.length,14);assert.ok(others.every(a=>a.magiGoal.distanceTo(f.worksite.camp.group.position)<11))
  assert.equal(f.life.fleet.has(pilot.id),false)
  f.dispose()
})

test('roarm-16 Melchior pilot returns to the base cab only after explicit duty-on',()=>{
  const f=roarm16Fixture(),pilot=f.pilot
  assert.deepEqual(f.life.pilotDuty,{profile:'roarm-16',workerId:'w00',slotId:'melchior',roleId:'pilot',duty:'on',generation:1})
  assert.equal(pilot.mounted,true);assert.equal(pilot.magiActivity,'pilot');assert.equal(pilot.magiPilotStatus,'confirmed')
  assert.ok(pilot.magiSeat.distanceTo(f.seat.position)<1e-9);assert.equal(f.life.pilotKey.visible,true)
  assert.equal(f.agents.filter(agent=>agent.mounted).length,1)
  f.world.worksiteProjection.pilot={...f.world.worksiteProjection.pilot,duty:'off',generation:2,changedAt:2,evidence:'Coordinator explicitly released pilot for rest',history:[
    ...f.world.worksiteProjection.pilot.history,
    {operationId:'pilot-off-2',kind:'duty-change',fromDuty:'on',toDuty:'off',generation:2,evidence:'Coordinator explicitly released pilot for rest',at:2},
  ]}
  f.life.update(f.agents,f.world,2)
  assert.equal(pilot.mounted,false);assert.equal(pilot.magiSeat,null);assert.equal(pilot.magiActivity,'pilot-rest');assert.equal(pilot.magiPilotStatus,'off-duty')
  const restSpot=f.worksite.camp.restSpot.clone().add(f.worksite.camp.group.position)
  assert.ok(pilot.magiGoal.distanceTo(restSpot)<1e-9,'the off-duty captain uses the reserved shared-camp rest spot')
  assert.ok(pilot.magiGoal.distanceTo(f.seat.position)>15,'the captain leaves the base cab')
  assert.equal(f.life.pilotKey.visible,false);assert.equal(f.agents.filter(agent=>agent.mounted).length,0)
  const confirmedOffProjection=f.world.worksiteProjection.pilot
  const confirmedOffHistory=confirmedOffProjection.history
  f.world.worksiteProjection={profile:'roarm-16',stale:true,pilot:confirmedOffProjection}
  f.life.update(f.agents,f.world,3)
  assert.equal(pilot.magiActivity,'pilot-rest','a stale feed preserves the last explicit rest goal')
  assert.ok(pilot.magiGoal.distanceTo(restSpot)<1e-9)
  assert.equal(pilot.magiPilotStatus,'unknown');assert.equal(f.life.pilotDuty.duty,'off');assert.equal(f.life.pilotDuty.generation,2)
  f.world.worksiteProjection.pilot={...confirmedOffProjection,duty:'on',generation:3,changedAt:3,evidence:'Coordinator restored pilot duty',history:[
    ...confirmedOffHistory,
    {operationId:'pilot-on-3',kind:'duty-change',fromDuty:'off',toDuty:'on',generation:3,evidence:'Coordinator restored pilot duty',at:3},
  ]}
  f.world.worksiteProjection.stale=false
  f.life.update(f.agents,f.world,4)
  assert.equal(pilot.mounted,true);assert.equal(pilot.magiActivity,'pilot');assert.equal(pilot.magiPilotStatus,'confirmed')
  assert.ok(pilot.magiSeat.distanceTo(f.seat.position)<1e-9);assert.equal(f.agents.filter(agent=>agent.mounted).length,1)
  assert.equal(f.life.pilotKey.visible,true)
  f.dispose()
})

test('off-duty captain walks to camp then sits when settled even if its task status is working',()=>{
  const f=roarm16Fixture(),captain=f.pilot
  f.world.worksiteProjection.pilot={...f.world.worksiteProjection.pilot,duty:'off',generation:2,changedAt:2,evidence:'Coordinator explicitly released pilot for rest',history:[
    ...f.world.worksiteProjection.pilot.history,
    {operationId:'pilot-off-2',kind:'duty-change',fromDuty:'on',toDuty:'off',generation:2,evidence:'Coordinator explicitly released pilot for rest',at:2},
  ]}
  f.life.update(f.agents,f.world,2)
  const animate=createAnimationMethod(),animator={rig:{clips:{
    walk:{start:10,frames:8,loop:true,duration:1},
    sit:{start:20,frames:8,loop:true,duration:1},
    idle:{start:0,frames:8,loop:true,duration:1},
    work:{start:30,frames:8,loop:true,duration:1},
  }}}
  captain.state='at-site';captain.status='working';captain.magiActivity='pilot-rest';captain.magiSettled=false;captain.groundSpeed=1
  animate.call(animator,captain,0.1,1)
  assert.equal(captain.clipKey,'walk','the unmounted captain uses locomotion while traveling to camp')
  captain.groundSpeed=0;captain.magiSettled=true
  animate.call(animator,captain,0.1,1)
  assert.equal(captain.clipKey,'sit','explicit settled rest takes precedence over the stale working task status')
  f.dispose()
})

test('dedicated pilot waits beside the base without fabricating a seat before telemetry',()=>{
  const f=roarm16Fixture({seatAvailable:false}),pilot=f.pilot
  assert.equal(pilot.mounted,false);assert.equal(pilot.magiSeat,null)
  assert.equal(pilot.magiPilotStatus,'awaiting-telemetry');assert.equal(f.life.pilotKey.visible,false)
  assert.ok(Math.hypot(pilot.magiGoal.x,pilot.magiGoal.z)<7)
  f.dispose()
})

test('captain helmet and suit gear follows the real astronaut root and bones, then disposes',()=>{
  const scene=new THREE.Scene(),parent=new THREE.Group();scene.add(parent)
  const gear=createRoArmPilotGear(parent),root=new THREE.Matrix4().makeTranslation(3,2,-4)
  const head=new THREE.Matrix4().compose(new THREE.Vector3(0,.46,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(-.08,.1,0)),new THREE.Vector3(1,1,1))
  const chest=new THREE.Matrix4().compose(new THREE.Vector3(0,.12,0),new THREE.Quaternion(),new THREE.Vector3(1,1,1))
  gear.update(root,head,chest)
  assert.ok(gear.helmetFrame.matrix.equals(root.clone().multiply(head)))
  assert.ok(gear.suitFrame.matrix.equals(root.clone().multiply(chest)))
  assert.ok(gear.helmetFrame.getObjectByName('captain-helmet-halo'))
  assert.ok(gear.suitFrame.getObjectByName('captain-chest-rank'))
  let disposed=0,geometryCount=0
  for(const frame of [gear.helmetFrame,gear.suitFrame])frame.traverse(item=>{if(item.geometry){geometryCount++;item.geometry.addEventListener('dispose',()=>disposed++)}})
  gear.dispose();gear.dispose()
  assert.equal(parent.children.length,0);assert.equal(disposed,geometryCount)
})

test('only a newer core handoff generation swaps seats and the control key',()=>{
  const f=fixture(),old=f.agents[5],next=f.agents[11]
  next.status='working';next.thread.running=true;next.thread.assignmentState='running'
  f.world.worksiteProjection.pilot={workerId:'w12',previousWorkerId:'w06',generation:2,changedAt:'handoff-2'}
  f.life.update(f.agents,f.world,2)
  assert.equal(old.mounted,false);assert.notEqual(old.magiActivity,'pilot')
  assert.equal(next.mounted,true);assert.equal(next.thread.running,true)
  assert.equal(f.agents.filter(a=>a.mounted).length,1)
  assert.equal(f.life.fleet.has(next.id),false)
  assert.equal(f.life.pilotDuty.workerId,'w12')
  assert.deepEqual(f.life.pilotHandoff,{from:'w06',to:'w12',generation:2,changedAt:'handoff-2',transfers:[{from:'w06',to:'w12',generation:2,changedAt:'handoff-2'}],label:'Control key handed from w06 to w12'})
  assert.equal(old.magiPilotStatus,undefined);assert.equal(old.magiPilotGeneration,undefined);assert.equal(old.magiPilotHandoff,undefined)
  assert.equal(f.life.pilotKey.visible,true)
  // A feed outage preserves the last assigned pilot and pose, marked unknown.
  f.world.worksiteProjection.pilot=null
  f.life.update(f.agents,f.world,3)
  assert.equal(f.life.pilotDuty.workerId,'w12');assert.equal(next.mounted,true)
  assert.equal(next.magiPilotStatus,'unknown')
  assert.match(workerInspection(next,null).rows.find(([k])=>k==='Pilot duty')[1],/feed unknown/)
  f.dispose()
})

test('canonical history catches up across two missed handoffs and seats only the latest owner',()=>{
  const f=fixture('w01'),initial=f.agents[0],middle=f.agents[5],latest=f.agents[11]
  f.world.worksiteProjection.pilot={workerId:'w12',previousWorkerId:'w06',generation:3,changedAt:3,history:[
    {operationId:'enable-1',kind:'enable',fromWorkerId:null,toWorkerId:'w01',generation:1,evidence:'assigned',at:1},
    {operationId:'handoff-2',kind:'handoff',fromWorkerId:'w01',toWorkerId:'w06',generation:2,evidence:'first key transfer',at:2},
    {operationId:'handoff-3',kind:'handoff',fromWorkerId:'w06',toWorkerId:'w12',generation:3,evidence:'second key transfer',at:3},
  ]}
  f.life.update(f.agents,f.world,2)
  assert.equal(f.life.pilotDuty.workerId,'w12');assert.equal(f.life.pilotDuty.generation,3)
  assert.equal(initial.mounted,false);assert.equal(middle.mounted,false);assert.equal(latest.mounted,true)
  assert.equal(f.agents.filter(a=>a.mounted).length,1)
  assert.deepEqual(f.life.pilotHandoff.transfers,[
    {from:'w01',to:'w06',generation:2,changedAt:2},
    {from:'w06',to:'w12',generation:3,changedAt:3},
  ])
  assert.equal(f.life.pilotHandoff.label,'Control key history: w01 → w06 → w12')
  assert.equal(initial.magiPilotStatus,undefined);assert.equal(middle.magiPilotStatus,undefined)
  assert.ok([initial,middle].every(a=>a.magiGoal.distanceTo(f.worksite.camp.group.position)<11))
  f.dispose()
})

test('invalid IDs, stale generations, and nonmatching previous owners cannot move the key',()=>{
  const f=fixture()
  for(const projection of [
    {workerId:'w16',previousWorkerId:'w06',generation:2},
    {workerId:'w07',previousWorkerId:'w06',generation:1},
    {workerId:'w07',previousWorkerId:'w05',generation:2},
  ]) {
    f.world.worksiteProjection.pilot=projection;f.life.update(f.agents,f.world,4)
    assert.equal(f.life.pilotDuty.workerId,'w06');assert.equal(f.agents.filter(a=>a.mounted).length,1)
  }
  f.dispose()
})

test('gapped, malformed, or wrong-owner multi-generation history fails closed',()=>{
  const badHistories=[
    [
      {operationId:'enable-1',kind:'enable',fromWorkerId:null,toWorkerId:'w01',generation:1,evidence:'assigned',at:1},
      {operationId:'handoff-3',kind:'handoff',fromWorkerId:'w06',toWorkerId:'w12',generation:3,evidence:'gap',at:3},
    ],
    [
      {operationId:'enable-1',kind:'enable',fromWorkerId:null,toWorkerId:'w01',generation:1,evidence:'assigned',at:1},
      {operationId:'handoff-2',kind:'handoff',fromWorkerId:'w02',toWorkerId:'w06',generation:2,evidence:'wrong owner',at:2},
      {operationId:'handoff-3',kind:'handoff',fromWorkerId:'w06',toWorkerId:'w12',generation:3,evidence:'transfer',at:3},
    ],
    [
      {operationId:'enable-1',kind:'enable',fromWorkerId:null,toWorkerId:'w01',generation:1,evidence:'assigned',at:1},
      {operationId:'handoff-2',kind:'handoff',fromWorkerId:'w01',toWorkerId:'w06',generation:2,evidence:'transfer',at:2},
      {operationId:'handoff-3',kind:'handoff',fromWorkerId:'w06',toWorkerId:'w99',generation:3,evidence:'bad worker',at:3},
    ],
  ]
  for(const history of badHistories) {
    const f=fixture('w01')
    f.world.worksiteProjection.pilot={workerId:'w12',previousWorkerId:'w06',generation:3,changedAt:3,history}
    f.life.update(f.agents,f.world,2)
    assert.equal(f.life.pilotDuty.workerId,'w01');assert.equal(f.life.pilotFeed,'unknown')
    assert.equal(f.agents[0].mounted,true);assert.equal(f.agents.filter(a=>a.mounted).length,1)
    assert.equal(f.life.pilotHandoff,null)
    f.dispose()
  }
})
