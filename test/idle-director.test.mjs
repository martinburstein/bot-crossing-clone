import test from 'node:test'
import assert from 'node:assert/strict'
import { IdleDirector, mountIdleDirector } from '../src/core/idle-director.js'

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z, copy(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this } })
function fixture() {
  let reducedMotion = false
  const rig = { target: vec(), desiredTarget: vec(), azimuth: 0, desiredAzimuth: 0,
    polar: .92, desiredPolar: .92, distance: 180, desiredDistance: 180,
    maxDistance: 420, enabled: true, interacting: false, orbiting: false, intentVersion: 0,
    settings: { get: () => reducedMotion }, _clampTarget() {} }
  const subjects = [{ id: 'a', pos: vec(10, 0, 20) }, { id: 'b', pos: vec(-10, 0, -20) }]
  const director = new IdleDirector(rig, { subjects: () => subjects, office: true, random: () => .5 })
  const advance = seconds => { for (let i = 0; i < seconds * 60; i++) director.update(1 / 60) }
  return { rig, subjects, director, advance, reduced: () => { reducedMotion = true } }
}
test('waits for inactivity then alternates scenic, follow, scenic, portrait without invalid targets', () => {
  const f = fixture(); f.advance(29); assert.equal(f.director.active, false)
  f.advance(2); assert.equal(f.director.snapshot().shot, 'scenic')
  f.advance(28); assert.equal(f.director.snapshot().shot, 'follow')
  f.director.shot.agent.pos.x = 80; f.advance(10)
  assert.ok(f.rig.desiredTarget.x > 70, 'tracking shot must follow the moving resident')
  for (const value of [f.rig.desiredTarget.x, f.rig.desiredAzimuth, f.rig.desiredDistance]) assert.ok(Number.isFinite(value))
  f.advance(19); assert.equal(f.director.snapshot().shot, 'scenic')
  f.advance(28); assert.equal(f.director.snapshot().shot, 'portrait')
})
test('input releases immediately and clears remaining glide', () => {
  const f = fixture(); f.advance(40); f.director.interrupt()
  assert.equal(f.director.active, false); assert.equal(f.rig.cinematic, false)
  assert.deepEqual(['x','y','z'].map(k => f.rig.desiredTarget[k]), ['x','y','z'].map(k => f.rig.target[k]))
  assert.equal(f.rig.desiredDistance, f.rig.distance)
  f.advance(29); assert.equal(f.director.active, false)
})
test('reduced motion, explicit orbit, interaction and disabled camera suppress idle shots', () => {
  for (const change of [f => f.reduced(), f => { f.rig.orbiting = true }, f => { f.rig.interacting = true }, f => { f.rig.enabled = false }, f => f.director.setEnabled(false)]) {
    const f = fixture(); change(f); f.advance(45); assert.equal(f.director.active, false)
  }
})
test('programmatic focus remains intact and starts a fresh idle delay', () => {
  const f = fixture(); f.advance(40); f.rig.intentVersion++; f.rig.desiredTarget.x = 77
  f.director.update(.016); assert.equal(f.director.active, false); assert.equal(f.rig.desiredTarget.x, 77)
})
test('removed residents and an empty colony fall back safely', () => {
  const f = fixture(); f.advance(60); f.subjects.length = 0; f.advance(90)
  assert.ok(Number.isFinite(f.rig.desiredTarget.x)); assert.equal(f.director.shot.agent, null)
})
test('I toggles cinematic mode without stealing C or keys typed in a form; listeners dispose', () => {
  const f=fixture(),events=new Map(),removed=[]
  const win={addEventListener:(n,fn)=>events.set(n,fn),removeEventListener:n=>removed.push(n),localStorage:{setItem(){}}}
  const doc={addEventListener(){},removeEventListener(){}}
  const dispose=mountIdleDirector(f.director,{window:win,document:doc})
  const key=events.get('keydown')
  key({code:'KeyC'});assert.equal(f.director.enabled,true)
  key({code:'KeyI',target:{closest:()=>true}});assert.equal(f.director.enabled,true)
  key({code:'KeyI'});assert.equal(f.director.enabled,false)
  dispose();assert.deepEqual(removed,['pointerdown','pointermove','wheel','keydown'])
})
