import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createMemorialGarden } from '../sowers/memorial-garden.js'

const all={dispenser:true,computer:true,campfire:true,agents:true}
const entry=(id,iteration,texture)=>({id,iteration,texture})

test('new tablets stay hidden behind every gate, resume after retraction, and rise without a final jump',()=>{
  const texture=new THREE.CanvasTexture({width:2,height:2,getContext:()=>null}),g=createMemorialGarden();g.userData.setMemorials([entry('a',1,texture)])
  const mark=g.userData.entries.get('a').group
  assert.equal(mark.visible,false);assert.equal(mark.position.y,-2)
  g.userData.setReadiness(all);assert.equal(mark.visible,true)
  g.userData.update(.05);const first=mark.position.y;assert.ok(first>-2&&first<0)
  g.userData.setReadiness({...all,campfire:false});assert.equal(mark.visible,false);const pausedY=mark.position.y
  g.userData.update(.05);assert.equal(mark.position.y,pausedY)
  g.userData.setReadiness(all);assert.equal(mark.visible,true)
  let previous=mark.position.y;for(let i=0;i<30;i++){g.userData.update(.05);assert.ok(mark.position.y>=previous);previous=mark.position.y}
  assert.equal(mark.userData.riseComplete,true);assert.equal(mark.position.y,0);assert.ok(mark.children.some(o=>o.isMesh&&o.geometry.type==='PlaneGeometry'))
  const image=mark.children.find(o=>o.geometry.type==='PlaneGeometry');assert.ok(image.position.z>.35)
  g.userData.setMemorials([entry('a',1),entry('b',2)]);assert.equal(g.userData.count,2);assert.equal(g.userData.entries.size,2)
  g.userData.dispose();g.userData.dispose();texture.dispose()
})

test('historical entries loaded initially or asynchronously never replay; gates hide and restore them settled',()=>{
  const g=createMemorialGarden({memorials:[entry('a',1)],readiness:all})
  const mark=g.userData.entries.get('a').group;assert.equal(mark.position.y,0);assert.equal(mark.userData.rising,false)
  g.userData.setReadiness({agents:false});assert.equal(mark.visible,false)
  g.userData.update(50);g.userData.setReadiness(all);assert.equal(mark.visible,true);assert.equal(mark.position.y,0)
  g.userData.setMemorials([entry('b',2)],{initial:true});const asyncMark=g.userData.entries.get('b').group
  assert.equal(asyncMark.position.y,0);assert.equal(asyncMark.userData.rising,false);g.userData.dispose()
})

test('placement is stable and overflow counts distinct rejected IDs across repeated polling',()=>{
  const a=createMemorialGarden({memorials:[entry('first',1)],capacity:1}),b=createMemorialGarden({memorials:[entry('first',1)],capacity:1})
  assert.deepEqual(a.userData.entries.get('first').group.position.toArray(),b.userData.entries.get('first').group.position.toArray())
  const polled=[entry('first',1),entry('overflow-a',2),entry('overflow-b',3)]
  a.userData.setMemorials(polled);assert.equal(a.userData.overflow,2)
  a.userData.setMemorials(polled);assert.equal(a.userData.overflow,2)
  assert.throws(()=>createMemorialGarden({capacity:0}),/capacity/);a.userData.dispose();b.userData.dispose()
})

test('caller-owned canvas texture is never disposed by garden teardown',()=>{
  const texture=new THREE.CanvasTexture({width:2,height:2,getContext:()=>null});let disposeCalls=0;texture.addEventListener('dispose',()=>disposeCalls++)
  const g=createMemorialGarden({memorials:[entry('a',1,texture)]});g.userData.dispose();assert.equal(disposeCalls,0);texture.dispose()
})

test('invalid and excessive animation deltas are safely bounded',()=>{
  const g=createMemorialGarden({readiness:all});g.userData.setMemorials([entry('a',1)]);const mark=g.userData.entries.get('a').group
  g.userData.update(Infinity);assert.equal(mark.position.y,-2);g.userData.update(-1);assert.equal(mark.position.y,-2)
  g.userData.update(10);assert.equal(mark.position.y,-2+2*.05/1.05);g.userData.dispose()
})
