import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {createCraneLab,CRANE_LAB,CRANE_REST} from '../src/world/crane-lab.js'
import {createRoArmPreview} from '../src/world/roarm-preview.js'

test('giant crane is visible offline and larger than the campus computers',()=>{
  const scene=new THREE.Scene(),lab=createCraneLab(scene)
  assert.equal(lab.simulation.group.visible,true)
  assert.equal(lab.measured.group.visible,false)
  const size=new THREE.Box3().setFromObject(lab.simulation.group).getSize(new THREE.Vector3())
  assert.ok(size.y>75)
  assert.equal(lab.group.position.z,CRANE_LAB.z)
  assert.equal(lab.snapshot().source,'offline-rehearsal')
  assert.equal(lab.snapshot().measurement.available,false)
  assert.equal(lab.snapshot().training,false)
  lab.dispose();assert.equal(scene.children.length,0)
})
test('offline rehearsal is finite and never mutates measured joints',()=>{
  const now=Date.now(),lab=createCraneLab(new THREE.Scene(),{now:()=>now})
  lab.updateObservation({state:'live',source:'hardware',observedAt:new Date(now).toISOString(),pose:CRANE_REST})
  const before=lab.measured.observation
  lab.wave()
  for(let i=0;i<20;i++)lab.update(.25,i*.25)
  const after=lab.snapshot()
  assert.equal(after.status,'complete');assert.equal(after.completedMoves,4)
  assert.deepEqual(after.pose,CRANE_REST);assert.deepEqual(lab.measured.observation,before)
  assert.throws(()=>lab.practice([{...CRANE_REST,base:Infinity}]),/finite/)
  assert.throws(()=>lab.practice(Array(11).fill(CRANE_REST)),/bounded/)
  lab.dispose()
})
test('hardware overlay expires and offline poses cannot seed measured preview',()=>{
  let now=Date.now();const lab=createCraneLab(new THREE.Scene(),{now:()=>now})
  assert.throws(()=>lab.seedFromMeasured(),/unavailable/)
  const observation={state:'live',source:'hardware',observedAt:new Date(now).toISOString(),pose:{...CRANE_REST}}
  lab.updateObservation(observation);assert.equal(lab.measured.group.visible,true)
  assert.equal(lab.snapshot().comparison.tipSeparationMm,0)
  observation.pose.elbow=2;assert.equal(lab.snapshot().comparison.tipSeparationMm,0)
  now+=5001;lab.update(0)
  assert.equal(lab.measured.group.visible,false);assert.equal(lab.snapshot().comparison,null)
  assert.throws(()=>lab.seedFromMeasured(),/unavailable/)
  assert.equal(lab.simulation.group.visible,true)
  lab.dispose()
})
test('comparison uses physical millimeters rather than magnified world units',()=>{
  const now=Date.now(),lab=createCraneLab(new THREE.Scene(),{now:()=>now})
  lab.updateObservation({state:'live',source:'simulator',observedAt:new Date(now).toISOString(),pose:CRANE_REST})
  lab.practice([{...CRANE_REST,elbow:CRANE_REST.elbow+.1}]);for(let i=0;i<4;i++)lab.update(.25)
  const comparison=lab.snapshot().comparison
  assert.ok(Math.abs(comparison.jointDeltaRad.elbow-.1)<1e-10)
  assert.ok(Math.abs(comparison.tipSeparationMm-2*Math.hypot(280.15,1.73)*Math.sin(.05))<1e-8)
  assert.equal(lab.snapshot().measurement.source,'simulator');lab.dispose()
})
test('adding offline rehearsal does not relax the existing measured preview gate',()=>{
  const preview=createRoArmPreview(new THREE.Scene())
  assert.throws(()=>preview.preview({startPose:{state:'offline',pose:CRANE_REST},moves:[CRANE_REST]}),/fresh live/)
  assert.throws(()=>preview.rehearse({startPose:CRANE_REST,moves:[{...CRANE_REST,shoulder:Math.PI}]}),/range/)
  assert.equal(preview.snapshot().status,'idle');assert.equal(preview.group.visible,false)
  preview.dispose()
})
