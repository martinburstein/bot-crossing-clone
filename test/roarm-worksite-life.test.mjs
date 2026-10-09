import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {MagiLife} from '../src/agents/magi-life.js'
import {standbyMagiThreads,MAGI_HOME_CELLS,MAGI_CLUSTERS} from '../src/game/magi-world.js'
import {createRoArmWorksite,ROARM_WORKSITE,ROARM_SERVICE_POINTS} from '../src/world/roarm-worksite.js'

test('all idle personas inhabit one shared camp beside the central arm worksite',()=>{
  const scene=new THREE.Scene(),worksite=createRoArmWorksite(scene)
  const life=new MagiLife(scene,{transient:true,get:()=>false})
  const agents=standbyMagiThreads().map(thread=>({id:thread.id,thread,status:'idle',state:'at-site',pos:new THREE.Vector3()}))
  const world={worksite,groundAt:()=>0}
  life.sync(agents,world);life.update(agents,world,1)
  assert.deepEqual(worksite.layout.arm,ROARM_WORKSITE.arm)
  assert.deepEqual(worksite.layout.camp,ROARM_WORKSITE.camp)
  assert.equal(MAGI_HOME_CELLS.length,15)
  assert.equal(new Set([...life.camps.values()]).size,1)
  assert.equal(life.camps.size,3)
  assert.equal(life.camps.get('melchior'),worksite.camp)
  assert.equal(life.camps.get('balthasar'),worksite.camp)
  assert.equal(life.camps.get('casper'),worksite.camp)
  assert.equal(worksite.camp.group.parent,worksite.group)
  assert.equal(worksite.camp.group.position.x,0)
  assert.equal(worksite.camp.group.position.z,-38)
  const assertCampGoals=idleAgents=>{
    const goals=idleAgents.map(agent=>agent.magiGoal)
    assert.equal(new Set(idleAgents.map(agent=>agent.thread.shellId)).size,idleAgents.length)
    for(let i=0;i<goals.length;i++){
      assert.ok(goals[i].distanceTo(worksite.camp.group.position)<11,'every idle goal stays inside the canopy bounds')
      for(let j=0;j<i;j++)assert.ok(goals[i].distanceTo(goals[j])>=2,'idle goals are separated')
      for(const obstacle of worksite.camp.obstacles())assert.ok(Math.hypot(goals[i].x-obstacle.x,goals[i].z-obstacle.z)>=obstacle.r+1,'idle goal clears each camp obstacle')
    }
  }
  assert.equal(worksite.camp.idleGoals.length,15)
  assertCampGoals(agents)
  for(const i of [0,5,10]){agents[i].status='working';agents[i].thread.running=true;agents[i].thread.assignmentState='running'}
  life.update(agents,world,2)
  assert.equal(life.fleet.size,3,'one confirmed pilot per cluster receives a vehicle')
  const offshift=agents.filter(agent=>!agent.mounted)
  assert.equal(offshift.length,12);assertCampGoals(offshift)
  for(const i of [0,5,10]){agents[i].status='idle';agents[i].thread.running=false;agents[i].thread.assignmentState='idle'}
  life.update(agents,world,3)
  assertCampGoals(agents)
  assert.deepEqual(MAGI_CLUSTERS.map(c=>c.id),ROARM_SERVICE_POINTS.map(p=>p.clusterId))
  const oldCampCount=scene.children.filter(child=>child.name.startsWith('camp-')).length
  assert.equal(oldCampCount,0,'MagiLife must not create three duplicate camps')
  life.dispose();worksite.dispose()
  assert.equal(scene.children.length,0)
})

test('worksite exposes shared safety geometry once for colony integration',()=>{
  const scene=new THREE.Scene(),worksite=createRoArmWorksite(scene)
  assert.ok(worksite.obstacles().length>0)
  assert.ok(worksite.clearings().some(c=>c.service==='central-arm'))
  assert.ok(worksite.clearings().some(c=>c.service==='shared-camp'&&c.x===0&&c.z===-38))
  assert.ok(worksite.clearings().some(c=>c.service==='bounty-board'&&c.x===-22&&c.z===22))
  assert.deepEqual(worksite.servicePoints,ROARM_SERVICE_POINTS)
  worksite.dispose()
  assert.equal(scene.children.length,0)
})

test('one enabled pilot occupies the arm seat while the remaining fourteen retain camp destinations',()=>{
  const scene=new THREE.Scene(),worksite=createRoArmWorksite(scene),life=new MagiLife(scene,{transient:true,get:()=>false})
  const seat={position:new THREE.Vector3(2,1,3),yaw:.2};worksite.pilotSeat=()=>seat
  const agents=standbyMagiThreads().map(thread=>({id:thread.id,thread,status:'idle',state:'at-site',pos:new THREE.Vector3()}))
  const world={worksite,groundAt:()=>0,worksiteProjection:{pilot:{workerId:'w01',previousWorkerId:null,generation:1}}}
  life.sync(agents,world);life.update(agents,world,1)
  assert.equal(agents.filter(a=>a.mounted).length,1)
  assert.equal(agents[0].magiActivity,'pilot');assert.equal(agents[0].thread.running,false)
  assert.equal(life.fleet.size,0)
  for(const agent of agents.slice(1))assert.ok(agent.magiGoal.distanceTo(worksite.camp.group.position)<11)
  life.dispose();worksite.dispose()
})
