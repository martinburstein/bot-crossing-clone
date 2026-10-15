import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {createRoArmCampus,freeCampusSeats} from '../src/world/roarm-campus.js'
import {unitConversationFrame} from '../src/ui/unit-conversation.js'
import {assertFreeCampusProjection,projectFreeCampusState} from '../server/free-campus-magi.mjs'
import {FREE_CAMPUS,FREE_CAMPUS_SEATS,FREE_CAMPUS_HOMES,STARTER_ROSETTE,FREE_CAMPUS_PODS,freeCampusUpload} from '../src/world/free-campus-layout.js'
import {allocateMagiCells} from '../src/game/magi-world.js'
import {isCampusPilot,createCampusPilotGear} from '../src/world/campus-pilot-gear.js'
import {isCampusCamper,createCampusCamperGear} from '../src/world/campus-camper-gear.js'
const slots=['melchior','balthasar','casper']
function fixture(){
 const campus={dispatchMode:'free-15-3A',mode:'awake',free:{schemaVersion:1,assignments:{melchior:null,balthasar:null,casper:null},chargingRoleIds:[],conversation:[]}}
 const executorSlots=slots.map((slotId,i)=>({slotId,workerId:i?'balthasar casper'.split(' ')[i-1]:'w00',roleId:null,status:'idle',occupied:false,bound:true}))
 return {schemaVersion:1,mode:'live',revision:1,observedAt:1000,projectId:'test',tasks:[],milestones:[],notes:[],capacity:{total:3,limit:3,running:0,reserved:0,occupied:0},magi:{profile:'roarm-campus',campus,executorSlots,roleCatalog:freeCampusSeats.map((_,i)=>({id:`r${String(i+1).padStart(2,'0')}`,title:'Role'}))},workers:executorSlots.map(s=>({id:s.workerId,roleId:null,bound:true,status:'idle'}))}
}
test('all 17 bodies remain present; any unit can activate either permanent role',()=>{
 const state=fixture();assert.equal(projectFreeCampusState(state,1000).threads.length,17)
 for(const [i,slot]of slots.entries())for(const role of ['pilot','camper']){
  state.magi.campus.free.assignments[slot]=role;state.magi.executorSlots[i].roleId=role;state.workers[i].roleId=role
  const projected=projectFreeCampusState(state,1000);assert.equal(projected.threads.length,17);assert.equal(projected.threads.find(t=>t.roleId===role).slotId,slot)
  state.magi.campus.free.assignments[slot]=null;state.magi.executorSlots[i].roleId=null;state.workers[i].roleId=null
 }
 assert.throws(()=>assertFreeCampusProjection(state,22000),/stale/)
 state.magi.executorSlots[0].status='running';assert.throws(()=>assertFreeCampusProjection(state,1000),/evidence/)
})
test('free scenery keeps 17 seats, wireless memory pods and no old wire geometry when stale',()=>{
 const s=fixture(),world=createRoArmCampus(new THREE.Scene()),c=s.magi.campus
 world.update({campus:c,executorSlots:s.magi.executorSlots,stale:false})
 assert.equal(world.charger.visible,true);assert.equal(world.camper.visible,true);assert.equal(world.pilotPod.visible,true)
 assert.equal(world.campusGroup.visible,false);assert.equal(world.freeScene.group.visible,true)
 for(const p of FREE_CAMPUS_SEATS)assert.equal(world.surfaceHeight(p.x,p.z),1.42)
 assert.notDeepEqual(world.target({roleId:'r01'},0).position,world.target({roleId:'r01'},60).position)
 c.free.assignments.melchior='r01';s.magi.executorSlots[0]={...s.magi.executorSlots[0],roleId:'r01',occupied:true,status:'running'}
 const data={campus:c,executorSlots:s.magi.executorSlots,stale:false},agents=[{thread:{roleId:'r01'},state:'idle',pos:new THREE.Vector3()}]
 world.update(data);world.animate(1,agents);assert.deepEqual(world.signals,{})
 world.update({stale:true});world.animate(2,agents);assert.equal(world.freeScene.group.visible,true);assert.equal(world.campusGroup.visible,false)
 assert.equal(world.cores.melchior.userData.caption,'FEED UNAVAILABLE')
 assert.equal(world.board.position.x,FREE_CAMPUS.board.x);assert.equal(world.board.position.z,FREE_CAMPUS.board.z)
 assert.equal(world.board.getObjectByName('bounty-board-deck-surface').visible,false)
 assert.equal(world.surfaceHeight(0,0),.523)
 world.dispose()
})
test('starter homes and two civic cells form one complete sixfold symmetric rosette',()=>{
 const projects=Object.entries(FREE_CAMPUS_HOMES).map(([shellId])=>({id:shellId,shellId,worldProfile:'roarm-campus',dispatchMode:'free-15-3A',cells:1}))
 const cells=[...allocateMagiCells(projects).values()].flat().concat([{q:0,r:0},{q:0,r:-2}]),keys=new Set(cells.map(c=>`${c.q},${c.r}`))
 assert.equal(cells.length,19);assert.equal(keys.size,19);assert.equal(STARTER_ROSETTE.length,19)
 for(const c of cells){assert.ok(keys.has(`${-c.r},${c.q+c.r}`));assert.ok(keys.has(`${-c.q},${c.r+c.q}`))}
 assert.equal(FREE_CAMPUS_PODS.length,15)
 assert.equal(FREE_CAMPUS.computerSize,FREE_CAMPUS.camp.radius*2)
 assert.ok(FREE_CAMPUS.casper.x<0&&FREE_CAMPUS.melchior.x>0&&FREE_CAMPUS.balthasar.z<FREE_CAMPUS.camp.z)
})
test('retirement and assignment upload cues are bounded and both larger resident fits are unit-independent',()=>{
 const c={free:{history:[{kind:'replace',roleId:'r01',at:1000,definition:{generation:2}}]}}
 assert.equal(freeCampusUpload(c,'r01',6000).progress,.5);assert.equal(freeCampusUpload(c,'r01',12000),null)
 assert.equal(freeCampusUpload(c,'r01',900),null)
 for(const slotId of [null,...slots]){assert.equal(isCampusPilot({worldProfile:'roarm-campus',dispatchMode:'free-15-3A',roleId:'pilot',slotId}),true);assert.equal(isCampusCamper({worldProfile:'roarm-campus',dispatchMode:'free-15-3A',roleId:'camper',slotId}),true)}
 for(const g of [createCampusPilotGear({aura:true}),createCampusCamperGear()]){assert.equal(g.userData.characterScale,1.65);g.update(new THREE.Matrix4(),new THREE.Matrix4(),new THREE.Matrix4());g.dispose()}
})
test('idle conversation only replays accepted attributed contributions from idle authors',()=>{
 const s=fixture(),c=s.magi.campus,line={slotId:'casper',text:'A useful question.',kind:'question',source:'accepted-luna-turn',submissionId:'s1',submissionDigest:'a'.repeat(64),acceptedAt:1000}
 c.free.conversation=[line];assert.equal(unitConversationFrame(c,s.magi.executorSlots,0),line)
 const newer={...line,submissionId:'s2',acceptedAt:2000,text:'The current accepted contribution.'}
 c.free.conversation.push(newer);assert.equal(unitConversationFrame(c,s.magi.executorSlots,0),newer)
 assert.equal(c.free.conversation.length,2);c.free.conversation=[line]
 s.magi.executorSlots[2].status='running';assert.equal(unitConversationFrame(c,s.magi.executorSlots,0),null)
 s.magi.executorSlots[2].status='idle';line.source='imagined';assert.equal(unitConversationFrame(c,s.magi.executorSlots,0),null)
 line.source='accepted-luna-turn';c.mode='sleeping';assert.equal(unitConversationFrame(c,s.magi.executorSlots,0),null)
})
