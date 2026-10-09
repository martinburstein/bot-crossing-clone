import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {standbyMagiThreads,clusterWorkFront,MAGI_CLUSTERS} from '../src/game/magi-world.js'
import {MagiLife} from '../src/agents/magi-life.js'
import {vehicleJob,VEHICLE_JOBS,ROARM_SERVICE_DESTINATIONS} from '../src/game/vehicle-jobs.js'
import {createRoArmWorksite,ROARM_SERVICE_POINTS} from '../src/world/roarm-worksite.js'

function fixture() {
  const scene=new THREE.Scene(),settings={transient:true,reduced:false,get(){return this.reduced}}
  const worksite=createRoArmWorksite(scene),life=new MagiLife(scene,settings),world={groundAt:()=>.45,worksite}
  const agents=standbyMagiThreads().map(thread=>({id:thread.id,thread,status:'idle',state:'at-site',pos:new THREE.Vector3(40,0,0)}))
  life.sync(agents,world);let time=0
  return {scene,life,settings,agents,world,tick(n=1){for(let i=0;i<n;i++)life.update(agents,world,time+=.1)},
    active(index,title=''){const a=agents[index];a.status='working';Object.assign(a.thread,{running:true,assignmentState:'running',taskTitle:title});return a},dispose(){life.dispose();worksite.dispose()}}
}

test('jobs match vehicle functions and a defence preference cannot invent an incoming meteor',()=>{
  const thread=standbyMagiThreads()[0]
  assert.equal(Object.keys(VEHICLE_JOBS).length,11)
  for(const [title,vehicle] of [['Dig foundation post holes','mining-truck'],['Excavate the trench','drill-unit'],['Collect mineral samples','cargo-rover'],['Report from camp to camp','drill-pod'],['Deliver supplies','dropship'],['Salvage construction materials','claw-tank']])
    assert.equal(vehicleJob({...thread,taskTitle:title}).vehicle,vehicle)
  assert.notEqual(vehicleJob(thread,'defender').vehicle,'defender')
  assert.notEqual(vehicleJob({...thread,taskTitle:'Study meteor geology'},'defender').vehicle,'defender')
  assert.equal(vehicleJob({...thread,taskTitle:'Report from camp to camp'},'mining-truck').vehicle,'drill-pod','a preference cannot replace a report mission with post drilling')
  assert.equal(vehicleJob({...thread,taskTitle:'Intercept an incoming large meteor'},'defender').meteorAlert,true)
  assert.equal(vehicleJob({...thread,assignmentRole:'review',taskTitle:'Review incoming meteor defences'},'defender').vehicle,'drill-pod')
  for(const vehicle of Object.keys(VEHICLE_JOBS).filter(id=>id!=='defender')){
    const job=vehicleJob({...thread,taskTitle:''},vehicle)
    assert.match(job.label,/arm|cable|gripper|fastener|service/i)
    assert.doesNotMatch(job.label,/camp|mineral|post hole|between camps|remote work site/i)
  }
})

test('each logical cluster routes to one fixed RoArm service approach',()=>{
  assert.equal(ROARM_SERVICE_POINTS.length,3)
  for(const cluster of MAGI_CLUSTERS){
    const site=clusterWorkFront(cluster.id)[0]
    assert.deepEqual(site,ROARM_SERVICE_POINTS.find(p=>p.clusterId===cluster.id))
    assert.ok(Math.hypot(site.x,site.z)>=8&&Math.hypot(site.x,site.z)<=10)
    assert.ok(Math.abs(Math.hypot(site.normal.x,site.normal.z)-1)<.002)
    assert.ok(ROARM_SERVICE_DESTINATIONS[cluster.id].includes('arm'))
  }
  const f=fixture(),a=f.active(0,'Dig post holes');f.tick()
  const item=f.life.fleet.get(a.id),site=clusterWorkFront('melchior')[0]
  assert.equal(item.stops.length,1);assert.equal(item.stops[0].x,site.x);assert.equal(item.stops[0].z,site.z)
  f.dispose()
})

test('exactly three confirmed cluster pilots deploy immediately, do different jobs and stop on disconnect',()=>{
  const f=fixture(),active=[f.active(0,'Deliver supplies'),f.active(5,'Dig post holes'),f.active(10,'Report from camp to camp')]
  f.active(1,'Duplicate cluster persona');f.tick()
  assert.equal(f.life.fleet.size,3);assert.ok(active.every(a=>a.mounted));assert.equal(f.agents[1].mounted,false)
  assert.deepEqual([...f.life.fleet.values()].map(v=>v.job.id),['cargo','posts','reports'])
  assert.deepEqual([...f.life.fleet.values()].map(v=>v.job.destination),['Melchior arm service point','Balthasar arm service point','Casper arm service point'])
  const positions=[...f.life.fleet.values()].map(v=>v.model.position.clone());f.tick(250)
  assert.ok([...f.life.fleet.values()].every(v=>v.rolling>1&&!v.routeBlocked))
  for(const a of f.agents){a.status='idle';a.thread.running=false;a.thread.assignmentState='unknown'}f.tick()
  assert.equal(f.life.fleet.size,0);assert.ok(f.agents.every(a=>!a.mounted))
  assert.ok(f.scene.children.every(c=>!c.name.startsWith('mission-')))
  const campRefs=[...f.life.camps.values()];assert.equal(campRefs.length,3);assert.ok(campRefs.every(c=>c===campRefs[0]),'three identities share one camp')
  assert.equal(f.world.worksite.camp.group.name,'shared-recharge-camp')
  const parked=f.life.hangar.bays.map(b=>b.model.position.clone());f.tick(100)
  assert.ok(f.life.hangar.bays.every((b,i)=>b.model.position.equals(parked[i])))
  f.dispose();assert.equal(f.scene.children.length,0)
})

test('an assigned arm pilot never double-books a fleet vehicle while the other clusters work',()=>{
  const f=fixture(),pilot=f.active(0,'Deliver supplies')
  f.world.worksite.pilotSeat=()=>({position:new THREE.Vector3(1,1,2),yaw:0})
  f.world.worksiteProjection={pilot:{workerId:'w01',previousWorkerId:null,generation:1}}
  const others=[f.active(1,'Dig post holes'),f.active(5,'Report from camp to camp'),f.active(10,'Deliver supplies')]
  f.tick()
  assert.equal(pilot.mounted,true);assert.equal(f.life.pilotDuty.workerId,'w01')
  assert.equal(f.life.fleet.has(pilot.id),false)
  assert.equal(others.every(a=>f.life.fleet.has(a.id)),true)
  assert.equal(f.life.fleet.size,3)
  assert.equal(f.agents.filter(a=>a.mounted).length,4,'one arm seat plus three independent cluster vehicle seats')
  f.dispose()
})

test('post drilling operates tools at work stops without spinning stationary wheels',()=>{
  const f=fixture(),a=f.active(5,'Dig post holes');f.tick()
  const item=f.life.fleet.get(a.id)
  for(let i=0;i<600&&!item.operating;i++)f.tick()
  assert.equal(item.operating,true)
  const position=item.model.position.clone(),wheel=item.model.userData.wheels[0].rotation.x
  f.tick(10)
  assert.ok(item.model.position.equals(position));assert.equal(item.model.userData.wheels[0].rotation.x,wheel)
  assert.ok(item.model.userData.rotors.some(r=>r.rotation.z!==0));assert.ok(item.mission.operating)
  f.dispose()
})

test('defense effect fires only at an incoming large meteor while its confirmed pilot operates',()=>{
  const f=fixture(),a=f.active(0,'Intercept an incoming large meteor');f.tick()
  const item=f.life.fleet.get(a.id),meteor=item.mission.group.getObjectByName('incoming-large-meteor'),beam=item.mission.group.getObjectByName('meteor-intercept-beam')
  assert.equal(meteor.visible,false);assert.equal(beam.visible,false)
  for(let i=0;i<300&&!(item.operating&&item.mission.threat);i++)f.tick()
  assert.equal(meteor.visible,true)
  for(let i=0;i<100&&!beam.visible;i++)f.tick()
  assert.equal(beam.visible,true)
  a.status='idle';a.thread.running=false;f.tick()
  assert.equal(f.life.fleet.size,0);assert.ok(!f.scene.children.includes(item.mission.group))
  f.dispose()
})

test('vehicle-width routing avoids an obstruction and reduced motion freezes the mission without changing live status',()=>{
  const f=fixture(),a=f.active(5,'Dig post holes')
  f.life.setNavigationObstacles([{x:-6,z:25,r:2}],80);f.tick(50)
  const item=f.life.fleet.get(a.id)
  for(let i=0;i<200;i++){f.tick();assert.ok(Math.hypot(item.model.position.x+6,item.model.position.z-25)>=3.7,'vehicle must not cross the inflated obstruction')}
  const before=item.model.position.clone();f.settings.reduced=true;f.tick(20)
  assert.ok(item.model.position.equals(before));assert.equal(item.active,true);assert.equal(a.thread.running,true)
  f.dispose()
})
