import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {createCraneRealtime} from '../src/research/crane-realtime.js'
import {createCraneLab,CRANE_REST} from '../src/world/crane-lab.js'

test('fixed-step reference is frame-partition invariant and remains distinct from plant',()=>{
  const a=createCraneRealtime(CRANE_REST),b=createCraneRealtime(CRANE_REST),target={...CRANE_REST,elbow:1.2}
  a.start([target]);b.start([target]);for(let i=0;i<50;i++)a.update(.02);for(let i=0;i<100;i++)b.update(.01)
  assert.deepEqual(a.snapshot().engine,b.snapshot().engine)
  assert.notEqual(a.snapshot().engine.reference.position.elbow,a.snapshot().pose.elbow)
  for(let i=0;i<600&&a.snapshot().status==='running';i++)a.update(.01)
  assert.equal(a.snapshot().status,'complete');assert.ok(Math.abs(a.snapshot().pose.elbow-1.2)<.001)
  a.dispose();b.dispose()
})
test('browser stall interrupts without advancing hidden elapsed time',()=>{
  const d=createCraneRealtime(CRANE_REST);d.start([{...CRANE_REST,elbow:1.2}]);d.update(.1)
  const before=d.snapshot().engine.simTimeMs;d.update(2)
  assert.equal(d.snapshot().status,'interrupted');assert.equal(d.snapshot().engine.simTimeMs,before);assert.equal(d.snapshot().stallCount,1)
  assert.equal(d.snapshot().engine.referenceComplete,false);assert.match(d.snapshot().reason,/frame gap/);d.dispose()
})
test('drop fault latches and cannot masquerade as script completion; reset clears it',()=>{
  const d=createCraneRealtime(CRANE_REST);d.start([{...CRANE_REST,elbow:1.2}]);d.setFaults({dropEvery:1})
  for(let i=0;i<60;i++)d.update(.01)
  assert.equal(d.snapshot().status,'interrupted');assert.ok(d.snapshot().engine.observationAgeMs>300)
  assert.equal(d.snapshot().completedMoves,0);assert.ok(d.snapshot().engine.metrics.droppedSamples>0)
  d.reset();assert.equal(d.snapshot().engine.faults.dropEvery,0);assert.equal(d.snapshot().engine.simTimeMs,0);d.dispose()
})
test('malformed sequence and live supersession reject atomically; snapshots cannot mutate state',()=>{
  const d=createCraneRealtime(CRANE_REST),before=d.snapshot()
  assert.throws(()=>d.start([{...CRANE_REST,elbow:NaN}]),/finite/);assert.deepEqual(d.snapshot(),before)
  d.start([{...CRANE_REST,elbow:1.2}]);assert.throws(()=>d.start([CRANE_REST]),/running/)
  const s=d.snapshot();s.engine.plant.position.elbow=999;assert.notEqual(d.snapshot().engine.plant.position.elbow,999)
  d.dispose();assert.throws(()=>d.update(.01),/disposed/)
})
test('visible Crane uses the driver plant and preserves measured overlay source',()=>{
  const now=Date.now(),d=createCraneLab(new THREE.Scene(),{now:()=>now})
  d.updateObservation({state:'live',source:'hardware',observedAt:new Date(now).toISOString(),pose:CRANE_REST})
  const before=d.measured.observation;d.scan();for(let i=0;i<100;i++)d.update(.01)
  assert.equal(d.snapshot().mode,'realtime');assert.deepEqual(d.snapshot().pose,d.snapshot().realtime.engine.plant.position)
  assert.deepEqual(d.measured.observation,before);assert.equal(d.simulation.group.visible,false)
  d.interrupt();assert.equal(d.snapshot().status,'interrupted');d.reset();assert.equal(d.snapshot().mode,'legacy');assert.equal(d.simulation.group.visible,true);d.dispose()
})
test('interrupted plant cannot be restarted with invented zero velocity and invalid reset preserves state',()=>{
  const d=createCraneRealtime(CRANE_REST);d.start([{...CRANE_REST,elbow:1.2}]);d.update(.2);d.update(.2);d.interrupt()
  const before=d.snapshot();assert.equal(before.engine.plantSettled,false)
  assert.throws(()=>d.start([CRANE_REST]),/still settling/);assert.deepEqual(d.snapshot(),before)
  assert.throws(()=>d.reset({...CRANE_REST,elbow:Infinity}),/finite/);assert.deepEqual(d.snapshot(),before)
  d.update(.02);assert.ok(d.snapshot().engine.simTimeMs>before.engine.simTimeMs)
  d.reset();assert.equal(d.snapshot().status,'ready');d.dispose()
})

test('moving target update preserves plant state, reference C2 and elapsed simulation clock',()=>{
  const d=createCraneRealtime(CRANE_REST);d.start([{...CRANE_REST,elbow:1.2}]);for(let i=0;i<70;i++)d.update(.01)
  const before=d.snapshot();d.retarget({...CRANE_REST,elbow:.4});const after=d.snapshot()
  assert.equal(after.engine.simTimeMs,before.engine.simTimeMs);assert.deepEqual(after.engine.reference,before.engine.reference);assert.deepEqual(after.engine.plant,before.engine.plant)
  assert.equal(after.retargetCount,1);assert.ok(after.lastPlanningMs>=0);assert.equal(after.engine.referenceMode,'online-c2')
  d.interrupt();assert.equal(d.snapshot().engine.braking,true)
  for(let i=0;i<1000&&(d.snapshot().engine.activeMotion||!d.snapshot().engine.plantSettled);i++)d.update(.01)
  assert.equal(d.snapshot().engine.activeMotion,null);assert.equal(d.snapshot().engine.plantSettled,true);assert.equal(d.snapshot().engine.metrics.referenceAbruptions,0)
  assert.throws(()=>d.retarget(CRANE_REST),/Start a simulation/);d.dispose()
})

test('finite timed intents replan on simulation clock and count only final settlement',()=>{
  const a=createCraneRealtime(CRANE_REST),b=createCraneRealtime(CRANE_REST)
  const moves=[{...CRANE_REST,elbow:1.2},{...CRANE_REST,elbow:.3},{...CRANE_REST,elbow:.8}]
  a.start(moves,{intervalMs:500});b.start(moves,{intervalMs:500})
  for(let i=0;i<50;i++)a.update(.02)
  for(let i=0;i<100;i++)b.update(.01)
  assert.deepEqual(a.snapshot().engine,b.snapshot().engine)
  assert.equal(a.snapshot().intentsDispatched,3);assert.equal(a.snapshot().completedMoves,0);assert.equal(a.snapshot().retargetCount,2)
  for(let i=0;i<1000&&a.snapshot().status==='running';i++)a.update(.01)
  const s=a.snapshot();assert.equal(s.status,'complete');assert.equal(s.completedMoves,1);assert.equal(s.totalMoves,1);assert.ok(Math.abs(s.pose.elbow-.8)<.001)
  assert.match(s.completionMeaning,/earlier intents may be superseded/);a.dispose();b.dispose()
})

test('timed intent validation is atomic, and manual retarget cancels future scripted updates',()=>{
  const d=createCraneRealtime(CRANE_REST),before=d.snapshot()
  for(const intervalMs of [99,501,5001,NaN])assert.throws(()=>d.start([CRANE_REST],{intervalMs}),/Intent interval/)
  assert.throws(()=>d.start(new Array(2)),/complete four-joint/);assert.deepEqual(d.snapshot(),before)
  d.start([{...CRANE_REST,elbow:1.2},{...CRANE_REST,elbow:.3}],{intervalMs:500});d.update(.2);d.retarget({...CRANE_REST,elbow:.9})
  for(let i=0;i<1000&&d.snapshot().status==='running';i++)d.update(.01)
  assert.equal(d.snapshot().scheduledIntents,0);assert.equal(d.snapshot().retargetCount,1);assert.ok(Math.abs(d.snapshot().pose.elbow-.9)<.001);d.dispose()
})

test('interrupt is idempotent and cannot retroactively invalidate ready or complete state',()=>{
  const d=createCraneRealtime(CRANE_REST),ready=d.snapshot();assert.deepEqual(d.interrupt(),ready)
  d.start([{...CRANE_REST,elbow:.7}]);d.update(.2);d.interrupt('first reason');const interrupted=d.snapshot();assert.deepEqual(d.interrupt('later reason'),interrupted)
  d.reset();d.start([{...CRANE_REST,elbow:.7}]);for(let i=0;i<1000&&d.snapshot().status==='running';i++)d.update(.01)
  const complete=d.snapshot();assert.equal(complete.status,'complete');assert.deepEqual(d.interrupt(),complete);d.dispose()
})

test('browser startup excludes preflight time but a true post-start gap still interrupts',()=>{
  let clock=1000;const d=createCraneRealtime(CRANE_REST,{nowMs:()=>clock});d.start([{...CRANE_REST,elbow:1.2}]);clock+=20;d.update(.4)
  assert.equal(d.snapshot().engine.simTimeMs,20);assert.equal(d.snapshot().status,'running');assert.equal(d.snapshot().stallCount,0)
  clock+=400;d.update(.4);assert.equal(d.snapshot().status,'interrupted');assert.equal(d.snapshot().stallCount,1)
  d.reset();d.start([{...CRANE_REST,elbow:1.2}]);clock+=400;d.update(.4);assert.equal(d.snapshot().status,'interrupted');assert.equal(d.snapshot().engine.simTimeMs,0);d.dispose()
})

test('disposed snapshot publishes the terminal nested engine state',()=>{
  const d=createCraneRealtime(CRANE_REST);d.start([{...CRANE_REST,elbow:1.2}]);d.update(.1);d.dispose()
  const s=d.snapshot();assert.equal(s.status,'disposed');assert.equal(s.engine.status,'disposed');assert.equal(s.engine.activeMotion,null);assert.equal(s.engine.interrupted,true)
})
