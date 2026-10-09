import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {projectMagiState} from '../server/magi.mjs'
import {createRoArmCampus,campusPods} from '../src/world/roarm-campus.js'
import {MagiLife} from '../src/agents/magi-life.js'
import {confirmedVehicleWorker} from '../src/game/vehicle-jobs.js'
const now=1_000_000,roles=Array.from({length:15},(_,i)=>({id:`r${String(i+1).padStart(2,'0')}`,title:`Role ${i+1}`}))
function fixture(){return {schemaVersion:1,mode:'live',revision:1,projectId:'campus-fixture',observedAt:now,tasks:[],milestones:[],notes:[],
  workers:[{id:'w00',status:'idle',bound:false},{id:'balthasar',status:'idle',bound:false},{id:'casper',status:'idle',bound:false}],capacity:{limit:3,running:0,reserved:0,occupied:0},
  magi:{profile:'roarm-campus',roleCatalog:roles,executorSlots:[{slotId:'melchior',workerId:'w00',roleId:'pilot'},{slotId:'balthasar',workerId:'balthasar',roleId:'camper'},{slotId:'casper',workerId:'casper',roleId:'r13'}].map(s=>({...s,status:'idle',bound:false,occupied:false})),
    pilot:{workerId:'w00',duty:'off'},campus:{schemaVersion:1,cycleNumber:0,activeRoleId:'r13',chargingRoleId:'r01',campRoleIds:roles.map(r=>r.id).filter(id=>!['r13','r01'].includes(id)),mode:'awake',phase:'awaiting-instructions',pilot:{instructionGeneration:1,instructionState:'station'}}}}}
test('campus projects seventeen bodies onto exactly three slots and rejects forged occupancy',()=>{
  const state=fixture(),p=projectMagiState(state,now)
  assert.equal(p.threads.length,17);assert.equal(p.threads.filter(t=>t.slotId).length,3);assert.equal(p.threads.filter(t=>t.running).length,0)
  assert.equal(p.threads.filter(t=>t.campusPosition==='camp'&&t.roleId!=='camper').length,13)
  assert.equal(p.threads.find(t=>t.roleId==='r13').campusPosition,'awaiting-instructions')
  state.magi.campus.phase='charging';assert.equal(projectMagiState(state,now).threads.find(t=>t.roleId==='r13').campusPosition,'awaiting-acceptance')
  state.magi.campus.chargingRoleId='r13';assert.throws(()=>projectMagiState(state,now),/thirteen/)
  const forged=fixture();forged.magi.executorSlots[2].status='running';forged.magi.executorSlots[2].occupied=true;assert.throws(()=>projectMagiState(forged,now),/inconsistent/)
})
test('campus roles keep their hats after Casper rotates to a different skill',()=>{
  const state=fixture();state.magi.earnedRewards=[{id:'hat-old',roleId:'r02',workerId:'casper'},{id:'hat-new',roleId:'r13',workerId:'casper'},{id:'legacy',workerId:'casper'}]
  const p=projectMagiState(state,now)
  assert.deepEqual(p.threads.find(t=>t.roleId==='r02').earnedRewards.map(r=>r.id),['hat-old'])
  assert.deepEqual(p.threads.find(t=>t.roleId==='r13').earnedRewards.map(r=>r.id),['hat-new'])
  assert.equal(p.worksite.earnedRewards.length,3)
})
test('campus has fifteen unique pods, a larger pilot pod, a rooted camper, and thirteen social seats',()=>{
  const scene=new THREE.Scene(),site=createRoArmCampus(scene),state=fixture()
  site.update(projectMagiState(state,now).worksite)
  assert.equal(site.pods.length,15);assert.equal(new Set(site.pods.map(p=>p.userData.roleId)).size,15);assert.equal(site.seats.length,13);assert.equal(site.roots.length,7)
  assert.equal(site.camp.group.visible,false);assert.equal(site.camper.name,'campus-camper-root-body')
  const pilotBox=new THREE.Box3().setFromObject(site.pilotPod),normalBox=new THREE.Box3().setFromObject(site.pods[0]);assert.ok(pilotBox.getSize(new THREE.Vector3()).x>normalBox.getSize(new THREE.Vector3()).x)
  state.magi.campus.mode='sleeping';state.magi.campus.phase='sleeping';site.update(projectMagiState(state,now).worksite)
  for(const r of roles){const target=site.target({roleId:r.id}),pod=campusPods.find(p=>p.roleId===r.id);assert.equal(target.position.x,pod.x);assert.equal(target.position.z,pod.z)}
  assert.ok(site.pods.every(p=>p.userData.occupied))
  site.campusGroup.traverse(o=>{if(o.geometry){const a=o.geometry.getAttribute('position');for(let i=0;i<a.array.length;i++)assert.ok(Number.isFinite(a.array[i]))}})
  site.dispose();site.dispose();assert.equal(scene.children.length,0)
})
test('only a confirmed selected Casper may take a vehicle after visiting its own pod',()=>{
  const state=fixture();state.magi.campus.phase='working';state.magi.executorSlots[2]={...state.magi.executorSlots[2],status:'running',bound:true,occupied:true};state.workers[2]={...state.workers[2],status:'running',bound:true};state.capacity={limit:3,running:1,reserved:0,occupied:1}
  const p=projectMagiState(state,now),scene=new THREE.Scene(),site=createRoArmCampus(scene);site.update(p.worksite)
  const life=new MagiLife(scene,{transient:true,get:()=>false}),agent={thread:p.threads.find(t=>t.roleId==='r13'),status:'working',state:'at-site',pos:new THREE.Vector3()};const world={worksiteProjection:p.worksite,worksite:site}
  assert.equal(confirmedVehicleWorker(agent),true);assert.equal(life.campusDepartureReady(agent,world,0),false)
  agent.pos.copy(site.target(agent.thread).position);assert.equal(life.campusDepartureReady(agent,world,1),false);assert.equal(life.campusDepartureReady(agent,world,3),true)
  assert.equal(confirmedVehicleWorker({...agent,thread:p.threads[16]}),false)
  world.worksiteProjection.campus.mode='sleeping';assert.equal(life.campusDepartureReady(agent,world,4),false);life.dispose();site.dispose()
})
