import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {createRoArmWorksite,ROARM_LAYOUT,ROARM_SERVICE_POINTS,ROARM_IDLE_GOAL_COUNT} from '../src/world/roarm-worksite.js'

test('RoArm worksite builds a bounded arm, one shared twelve-seat camp and connected landmarks',()=>{
  const scene=new THREE.Scene(),worksite=createRoArmWorksite(scene)
  assert.equal(scene.children.includes(worksite.group),true)
  assert.equal(worksite.group.name,'roarm-worksite')
  assert.equal(worksite.camp.group.name,'shared-recharge-camp')
  assert.equal(worksite.group.getObjectByName('roarm-hex-foundation')!==undefined,true)
  for(const part of ['roarm-base','roarm-upright','roarm-upper-link-left','roarm-upper-link-right','roarm-elbow','roarm-forearm-left','roarm-forearm-right','roarm-gripper-left','roarm-gripper-right'])
    assert.ok(worksite.group.getObjectByName(part),`missing arm part ${part}`)
  assert.equal(worksite.group.children.filter(o=>o.name==='connected-worksite-walkway').length,11)
  assert.equal(worksite.camp.group.children.filter(o=>o.name.startsWith('camp-recharge-seat-')).length,12)
  assert.equal(worksite.camp.group.children.filter(o=>o.name.startsWith('camp-recharge-pad-')).length,12)
  assert.equal(worksite.armModel.group.visible,false)
  assert.equal(worksite.pilotSeat(),null)
  worksite.updateObservation({source:'fixture',state:'measured',observedAt:'2026-10-09T00:00:00Z',pose:{base:.001533981,shoulder:.015339808,elbow:1.595340019,gripper:3.13545673}})
  assert.equal(worksite.armModel.group.visible,true)
  assert.ok(worksite.pilotSeat()?.position instanceof THREE.Vector3)
  assert.ok(Math.abs(worksite.pilotSeat().yaw-.001533981)<1e-9)
  worksite.group.position.set(3,2,-4);worksite.group.rotation.y=.3;worksite.group.updateMatrixWorld(true)
  const worldSeat=worksite.pilotSeat(),modelWorldSeat=worksite.armModel.pilotSeat()
  assert.ok(worldSeat.position.distanceTo(modelWorldSeat.position)<1e-9)
  assert.ok(Math.abs(worldSeat.yaw-(.3+.001533981))<1e-9)
  worksite.group.position.set(0,0,0);worksite.group.rotation.y=0;worksite.group.updateMatrixWorld(true)
  assert.equal(worksite.group.getObjectByName('shared-camp-open-canopy').geometry.parameters.openEnded,true)
  for(const activity of ['talk','tinker','board','snack']) {
    assert.ok(Array.isArray(worksite.camp.targets[activity])&&worksite.camp.targets[activity].length>0)
    assert.ok(worksite.camp.looks[activity] instanceof THREE.Vector3)
  }
  assert.deepEqual(ROARM_LAYOUT.sharedCamp,{x:0,z:-38})
  assert.deepEqual(ROARM_SERVICE_POINTS.map(p=>p.clusterId),['melchior','balthasar','casper'])
  for(const point of worksite.servicePoints)assert.ok(Math.hypot(point.x,point.z)>6)
  assert.equal(worksite.camp.idleGoals.length,ROARM_IDLE_GOAL_COUNT)
  assert.equal(worksite.camp.targets.console.length,1)
  assert.ok(worksite.camp.looks.console instanceof THREE.Vector3)
  const campObstacles=worksite.camp.obstacles()
  assert.ok(campObstacles.some(item=>item.worksite==='camp-console'))
  for(const goal of worksite.camp.idleGoals) {
    assert.ok(goal instanceof THREE.Vector3&&Math.hypot(goal.x,goal.z-.6)<=5.51)
    for(const obstacle of campObstacles) {
      const worldX=goal.x+worksite.camp.group.position.x,worldZ=goal.z+worksite.camp.group.position.z
      assert.ok(Math.hypot(worldX-obstacle.x,worldZ-obstacle.z)>=obstacle.r+1,`idle goal overlaps ${obstacle.worksite??obstacle.campSeat}`)
    }
  }
  for(let i=0;i<worksite.camp.idleGoals.length;i++)for(let j=i+1;j<worksite.camp.idleGoals.length;j++)
    assert.ok(worksite.camp.idleGoals[i].distanceTo(worksite.camp.idleGoals[j])>=2,`idle goals ${i} and ${j} overlap`)
  assert.equal(worksite.clearings().length,5)
  assert.ok(worksite.obstacles().length>=16)

  worksite.group.updateMatrixWorld(true)
  const bounds=new THREE.Box3().setFromObject(worksite.group)
  assert.ok(bounds.min.x<=-31&&bounds.max.x>=20)
  assert.ok(bounds.min.z<=-50&&bounds.max.z>=29)
  assert.ok(bounds.max.y>=14&&bounds.max.y<=15)
  assert.equal(worksite.surfaceHeight(0,0),.7)
  assert.equal(worksite.surfaceHeight(0,-38),.74)
  assert.equal(worksite.surfaceHeight(-22,22),.6)
  assert.equal(worksite.surfaceHeight(25,-15),.38)
  assert.equal(worksite.surfaceHeight(200,200),null)
  worksite.dispose()
  assert.equal(scene.children.includes(worksite.group),false)
})

test('bounty board accepts actual projection data without inventing activity',()=>{
  const scene=new THREE.Scene(),worksite=createRoArmWorksite(scene)
  assert.equal(worksite.board.userData.projection.bounties.length,0)
  assert.equal(worksite.board.userData.projection.serviceCredits.length,0)
  const bounties=[
    {id:'b-1',description:'Repair the signal relay',status:'open'},
    {id:'b-0',description:'Already accepted blocker',status:'solved'},
  ],serviceCredits=[
    {id:'r-1',workerId:'w02',amount:2},
    {id:'r-2',workerId:'w11',amount:1},
  ]
  worksite.update({bounties,serviceCredits,stale:false,updatedAt:'2026-10-09T00:00:00.000Z'})
  assert.deepEqual(worksite.board.userData.projection,{bounties:[bounties[0]],serviceCredits,serviceCreditTotal:3,latestCreditWorkerId:'w11',stale:false,updatedAt:'2026-10-09T00:00:00.000Z'})
  bounties.push({id:'local-mutation'})
  assert.equal(worksite.board.userData.projection.bounties.length,1)
  assert.throws(()=>worksite.update(null),/must be an object/)
  worksite.dispose()
})

test('dispose releases owned geometries and materials once',()=>{
  const scene=new THREE.Scene(),worksite=createRoArmWorksite(scene),geometries=new Set(),materials=new Set()
  worksite.group.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry)
    for(const material of (Array.isArray(object.material)?object.material:[object.material]))if(material)materials.add(material)
  })
  let geometryDisposals=0,materialDisposals=0
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>geometryDisposals++)
  for(const material of materials)material.addEventListener('dispose',()=>materialDisposals++)
  worksite.dispose();worksite.dispose()
  assert.equal(geometryDisposals,geometries.size)
  assert.equal(materialDisposals,materials.size)
})
