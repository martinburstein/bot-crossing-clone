import test from 'node:test'
import assert from 'node:assert/strict'
import { createHopController } from '../sowers/locomotion.mjs'

test('hop navigation is deterministic, bounded, and lands softly at explicit waypoints', () => {
  const route=[{x:2,z:0},{x:2,z:2,yaw:1.2}]
  const a=createHopController({waypoints:route}), b=createHopController({waypoints:route})
  let airborne=false, maxY=0, last
  for(let i=0;i<500;i++) { const p=a.update(1/60),q=b.update(1/60); assert.deepEqual(p,q); assert.ok([p.x,p.y,p.z,p.yaw,p.lean,p.progress].every(Number.isFinite));assert.ok(Math.abs(p.x)<=2&&Math.abs(p.z)<=2);assert.ok(Math.abs(p.lean)<=.120001);airborne ||= p.airborne;maxY=Math.max(maxY,p.y);last=p }
  assert.ok(airborne);assert.ok(maxY>.1);assert.deepEqual(last,{x:2,y:0,z:2,yaw:1.2,lean:0,airborne:false,progress:0})
})

test('pause, reduced motion, bounded dt, and retargeting never teleport', () => {
  const c=createHopController({waypoints:[{x:3,z:0}]})
  const p=c.update(.05);assert.deepEqual(c.update(.05,{paused:true}),p);assert.deepEqual(c.update(.05,{reducedMotion:true}),p)
  const before=c.sample();const after=c.update(999);assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<.2)
  c.setWaypoints([{x:-3,z:0}]);const next=c.update(.05);assert.ok(Math.hypot(next.x-after.x,next.z-after.z)<.2)
  assert.deepEqual(c.update(NaN),c.sample())
})

test('mid-hop retargeting defers both replacement and empty routes until landing', () => {
  const c=createHopController({waypoints:[{x:2,z:0}]})
  const start=c.update(.05), mid=c.update(.05);assert.ok(mid.x>start.x)
  c.setWaypoints([{x:-2,z:0}]);const retargeted=c.update(.05);assert.ok(retargeted.x>=mid.x)
  for(let i=0;i<100;i++)c.update(.05)
  assert.ok(c.sample().x<0)
  c.reset({x:0,z:0});c.setWaypoints([{x:2,z:0}]);c.update(.05);c.update(.05);const during=c.sample()
  c.setWaypoints([]);assert.ok(c.update(.05).x>during.x)
  for(let i=0;i<100;i++)c.update(.05)
  assert.ok(Math.abs(c.sample().x-1.35)<1e-5)
  assert.equal(c.waypointsRemaining,0)
})

test('large duplicate and malformed routes are bounded and do not recurse', () => {
  const duplicates=Array.from({length:10000},()=>({x:0,z:0}))
  const c=createHopController({waypoints:duplicates})
  assert.doesNotThrow(()=>c.update(.05));assert.equal(c.waypointsRemaining,0)
  c.setWaypoints([null,{}, {x:NaN,z:Infinity}, {x:2,z:0}])
  for(let i=0;i<100;i++)assert.ok([c.update(.05).x,c.sample().z].every(Number.isFinite))
})
