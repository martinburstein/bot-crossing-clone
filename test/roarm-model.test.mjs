import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {createRoArmModel,roarmForwardKinematics,ROARM_MODEL_SOURCE} from '../src/world/roarm-model.js'

const poses=[
  {base:.001533981,shoulder:.015339808,elbow:1.595340019,gripper:3.13545673},
  {base:.4,shoulder:.32,elbow:.82,gripper:2.1},
  {base:-.7,shoulder:-.3,elbow:1.2,gripper:1.5},
]
const close=(a,b,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`)

test('forward kinematics uses measured joint angles and sourced link offsets',()=>{
  const {geometryMm}=ROARM_MODEL_SOURCE
  assert.equal(geometryMm.l1,126.06)
  for(const pose of poses) {
    const shoulder=pose.shoulder+Math.atan2(30,236.82)
    const distal=pose.shoulder+pose.elbow+Math.atan2(1.73,280.15)
    const l2=Math.hypot(236.82,30),l3=Math.hypot(280.15,1.73)
    const radial=l2*Math.sin(shoulder)+l3*Math.sin(distal)
    const robotZ=l2*Math.cos(shoulder)+l3*Math.cos(distal)
    const fk=roarmForwardKinematics(pose)
    close(fk.robotX,radial*Math.cos(pose.base))
    close(fk.robotY,radial*Math.sin(pose.base))
    close(fk.robotZ,robotZ)
    close(fk.x,radial*Math.sin(pose.base)*.035)
    close(fk.y,(robotZ+126.06)*.035+.7)
    close(fk.z,radial*Math.cos(pose.base)*.035)
  }
  assert.throws(()=>roarmForwardKinematics({base:0,shoulder:0,elbow:0}),/gripper/)
})

test('model is hidden without measurements, follows measured joints, and freezes stale pose',()=>{
  const model=createRoArmModel()
  assert.equal(model.group.visible,false)
  assert.equal(model.pilotSeat(),null)
  assert.equal(model.pilotYaw(),null)
  assert.ok(model.group.children.length<10)
  const first={source:'controller',state:'measured',observedAt:'t1',pose:poses[0]}
  model.updateObservation(first)
  assert.equal(model.group.visible,true)
  const measured=model.observation.pose
  const shoulder=model.group.getObjectByName('roarm-shoulder-joint')
  const forearm=model.group.getObjectByName('roarm-distal-joint')
  close(shoulder.rotation.x,poses[0].shoulder+Math.atan2(30,236.82))
  close(forearm.rotation.x,poses[0].elbow+Math.atan2(1.73,280.15)-Math.atan2(30,236.82))
  const expectedEnd=roarmForwardKinematics(poses[0]),actualEnd=model.group.getObjectByName('roarm-wrist-tool').getWorldPosition(new THREE.Vector3())
  close(actualEnd.x,expectedEnd.x);close(actualEnd.y,expectedEnd.y);close(actualEnd.z,expectedEnd.z)
  const cab=model.group.getObjectByName('roarm-pilot-cab'),cabUpright=model.group.getObjectByName('roarm-pilot-cab-upright')
  const base=model.group.getObjectByName('roarm-base-assembly')
  assert.equal(cab.parent,base,'pilot station is attached to the rotating base, not the claw')
  close(cabUpright.rotation.x,0);close(cabUpright.rotation.y,0);close(cabUpright.rotation.z,0)
  const seat1=model.pilotSeat()
  assert.ok(seat1.position instanceof THREE.Vector3)
  assert.equal(model.pilotYaw(),poses[0].base)
  model.updateObservation({source:'controller',state:'offline',observedAt:'t2',pose:poses[1]})
  assert.deepEqual(model.observation.pose,measured)
  close(shoulder.rotation.x,poses[0].shoulder+Math.atan2(30,236.82))
  assert.equal(model.observation.frozen,true)
  model.updateObservation({source:'controller',state:'measured',observedAt:'t3',pose:poses[1]})
  close(shoulder.rotation.x,poses[1].shoulder+Math.atan2(30,236.82))
  for(const pose of poses.slice(1)) {
    model.updateObservation({source:'controller',state:'live',pose})
    const expected=roarmForwardKinematics(pose),actual=model.group.getObjectByName('roarm-wrist-tool').getWorldPosition(new THREE.Vector3())
    close(actual.x,expected.x);close(actual.y,expected.y);close(actual.z,expected.z)
  }
  const unchangedBase={...poses[2],base:poses[0].base}
  model.updateObservation({source:'controller',state:'measured',pose:unchangedBase})
  const seatAfterArmMove=model.pilotSeat()
  assert.ok(seatAfterArmMove.position.distanceTo(seat1.position)<1e-9,'shoulder, elbow, and gripper motion leave the station fixed')
  close(seatAfterArmMove.yaw,seat1.yaw)
  model.updateObservation({source:'controller',state:'measured',pose:poses[1]})
  assert.notDeepEqual(model.pilotSeat().position.toArray(),seat1.position.toArray(),'measured base yaw rotates the base-mounted station')
  close(model.pilotSeat().yaw,poses[1].base)
  model.dispose();model.dispose()
  assert.equal(model.group.parent,null)
})

test('all major physical shapes are named and gripper opening disclosure is explicit',()=>{
  const model=createRoArmModel()
  for(const name of ['roarm-base','roarm-turntable','roarm-shoulder-yoke','roarm-upper-link-left','roarm-upper-link-right','roarm-elbow','roarm-forearm-left','roarm-forearm-right','roarm-gripper-left','roarm-gripper-right','roarm-pilot-cab','roarm-pilot-seat','roarm-pilot-screen','roarm-pilot-lever-1','roarm-pilot-lever-2'])
    assert.ok(model.group.getObjectByName(name),`missing ${name}`)
  assert.match(ROARM_MODEL_SOURCE.gripper.opening,/not calibrated/)
  assert.equal(ROARM_MODEL_SOURCE.gripper.closedTicks,2050)
  assert.equal(ROARM_MODEL_SOURCE.gripper.openCandidateTicks,705)
  model.dispose()
})
