import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {createMessageBoard,boardPositions} from '../src/world/message-boards.js'
import {constructionFor,allocateSwarmCells} from '../src/game/swarm-construction.js'

const policy={version:2,itemSlots:6,legacyThrough:100}
const minors=(n,start=101)=>Array.from({length:n},(_,i)=>({id:'minor-'+i,at:start+i,level:'minor',title:'Verified '+i}))
test('filling a hexagon earns space once, with six separate items per cell',()=>{
  for(const n of [0,1,5,6,7,12,18,61]){
    const p=constructionFor({growthPolicy:policy,milestones:minors(n)})
    assert.equal(p.cells,1+Math.floor(n/6));assert.equal(p.capacityExpansions,Math.floor(n/6));assert.equal(p.major,0)
    assert.equal(p.structures.length,n);assert.ok(p.structures.every(s=>s.level===1))
    assert.deepEqual(constructionFor({growthPolicy:policy,milestones:minors(n)}),p)
  }
})
test('migration preserves old structures/upgrades and major receipts; retractions release only unearned growth',()=>{
  const old=minors(8,1),before=constructionFor({milestones:old})
  const after=constructionFor({growthPolicy:policy,milestones:old})
  assert.deepEqual(after.structures,before.structures);assert.equal(after.cells,2)
  const next=constructionFor({growthPolicy:policy,milestones:[...old,...minors(1,200)]})
  assert.equal(next.structures.at(-1).slot,8)
  const major={id:'phase',at:90,level:'major',title:'Reviewed phase'}
  assert.deepEqual(constructionFor({growthPolicy:policy,milestones:[...old,major]}).structures,constructionFor({milestones:[...old,major]}).structures)
  const retracted=minors(6).map((m,i)=>i===5?{...m,retractedAt:999}:m)
  assert.equal(constructionFor({growthPolicy:policy,milestones:retracted}).cells,1)
})
test('preserved homes and earned cells do not move when a full earlier shell expands',()=>{
  const base=Array.from({length:7},(_,i)=>({id:'s0'+(i+1),shellId:'s0'+(i+1),cells:i===0?1:3}))
  const old=allocateSwarmCells(base),next=allocateSwarmCells(base.map((p,i)=>({...p,cells:i===0?2:p.cells})),old)
  for(const p of base)assert.deepEqual(next.get(p.id).slice(0,p.cells),old.get(p.id))
})
test('board meshes are finite, pickable and distinct from the hexagon furniture',()=>{
  const board=createMessageBoard(0xe53935)
  assert.equal(board.children.length,5)
  board.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();assert.ok(Number.isFinite(o.geometry.boundingBox.max.y));assert.ok(o.castShadow)}})
  board.updateMatrixWorld(true)
  const ray=new THREE.Raycaster(new THREE.Vector3(0,2.4,5),new THREE.Vector3(0,0,-1))
  assert.ok(ray.intersectObject(board,true).length)
  const pos=boardPositions([{shellId:'s01',project:'Red',suitColor:0xe53935}],[{name:'Red',center:{x:26,z:0},localCenters:[{x:0,z:0}]}])
  assert.equal(pos.length,2);assert.equal(pos[1].id,'global')
  assert.ok(Math.hypot(pos[0].x-26,pos[0].z)>9)
  board.userData.dispose()
})
