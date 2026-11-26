import test from 'node:test'
import assert from 'node:assert/strict'
import { createSowerOutpost } from '../sowers/outpost.js'

test('outpost exposes fixed hop stations, bounds and explicit readiness/phase controls',()=>{
  const o=createSowerOutpost({seed:'test'}),d=o.userData
  assert.equal(d.socketPositions.length,3);assert.equal(d.releasePositions.length,3);assert.equal(d.meetingPositions.length,3);assert.equal(d.sourceStations.length,3)
  assert.ok(d.releasePositions.every(p=>p.y>4.8&&p.y<5.1));
  const numberedSockets=o.children.filter(x=>x.isMesh&&x.geometry.type==='CylinderGeometry'&&Math.abs(x.position.z-1.09)<.001)
  assert.equal(numberedSockets.length,3)
  const segments=o.children.filter(x=>x.isMesh&&x.position.z>1.14&&x.position.z<1.17&&x.position.y>5.6&&x.position.y<6.2)
  assert.ok(segments.length>=12)
  assert.ok(d.bounds.min.x < -9 && d.bounds.max.z > 9&&d.bounds.max.y>6)
  assert.deepEqual(d.readiness,{dispenser:false,computer:false,campfire:false,agents:false})
  d.setReadiness({dispenser:true,computer:true,campfire:true,agents:true}); assert.ok(Object.values(d.readiness).every(Boolean))
  d.setPhase('review'); assert.equal(d.phase,'review');assert.equal(o.children.find(x=>x.isMesh&&x.geometry.type==='ConeGeometry').material.emissiveIntensity,1.2)
  d.setPhase('rest');assert.equal(d.phase,'rest');assert.throws(()=>d.setPhase('done'))
  d.dispose();d.dispose()
})

test('presentation animation respects pause and reduced motion',()=>{
  const o=createSowerOutpost(), flame=o.children.find(x=>x.isMesh&&x.geometry.type==='ConeGeometry'), before=flame.scale.y
  o.userData.animate(1,{paused:true}); assert.equal(flame.scale.y,before)
  o.userData.animate(1,{reducedMotion:true}); assert.equal(flame.scale.y,before)
  o.userData.animate(1); assert.notEqual(flame.scale.y,before); o.userData.dispose()
})
