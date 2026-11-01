import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {createRenewal,restoreRenewal,nextTrio,beginPreviewWave,finishPreviewWave,finishPlanting} from '../src/suit-lab/renewal.js'
import {flowerRecipe,flowerFingerprint,flowerPosition,createFlower} from '../src/suit-lab/flowers.js'
import {createFloatingIsland} from '../src/suit-lab/island.js'

function complete(s,note=''){s=beginPreviewWave(s);if(s.pending.length)s=finishPlanting(s,s.pending.map(f=>f.id));return finishPreviewWave(s,note)}

test('fifteen bodies form five trios; wave five has 3 working, 9 idle and 3 planting',()=>{
 let s=createRenewal();const seen=new Set()
 for(let i=1;i<=4;i++){s=beginPreviewWave(s);assert.equal(s.active.length,3);assert.equal(s.pending.length,0);s.active.forEach(id=>{assert.ok(!seen.has(id));seen.add(id)});s=finishPreviewWave(s,i===1?'Remember the seam fixture.':'')}
 s=beginPreviewWave(s)
 assert.deepEqual(s.active,['r13','r14','r15']);assert.deepEqual(s.pending.map(f=>f.bodyId),['r01','r02','r03'])
 assert.equal(15-s.active.length-s.pending.length,9)
 assert.ok(s.pending.every(f=>f.generation===1&&f.plantedDuringWave===5&&f.beforeWave===6&&f.notes[0].text==='Remember the seam fixture.'))
 assert.throws(()=>finishPreviewWave(s),'Cannot skip planting')
 const during=finishPlanting(s,s.pending.map(f=>f.id))
 assert.equal(during.flowers.length,3);assert.deepEqual(during.active,s.active)
 assert.equal(during.bodies.r01.generation,2);assert.deepEqual(during.bodies.r01.notes,[])
 const next=beginPreviewWave(finishPreviewWave(during))
 assert.deepEqual(next.active,['r01','r02','r03']);assert.deepEqual(next.pending.map(f=>f.bodyId),['r04','r05','r06'])
})

test('a full rotation preserves bodies, archives notes, and rejects duplicate or incomplete transitions',()=>{
 let s=createRenewal();for(let i=0;i<10;i++)s=complete(s,`Preview handoff ${i+1}`)
 assert.equal(s.waves.length,10);assert.equal(s.flowers.length,18)
 assert.equal(Object.keys(s.bodies).length,15);assert.equal(new Set(s.flowers.map(f=>f.id)).size,18)
 assert.deepEqual(nextTrio(s),['r01','r02','r03'])
 s=beginPreviewWave(s);assert.throws(()=>beginPreviewWave(s));assert.throws(()=>finishPlanting(s,s.pending.slice(0,2).map(f=>f.id)))
 const planted=finishPlanting(s,s.pending.map(f=>f.id));assert.throws(()=>finishPlanting(planted,s.pending.map(f=>f.id)))
})

test('saved preview state replays during work, planting and after planting; tampered history fails',()=>{
 let s=createRenewal();for(let i=0;i<4;i++)s=complete(s,`Note ${i}`)
 for(const phase of [s,beginPreviewWave(s)])assert.deepEqual(restoreRenewal(JSON.parse(JSON.stringify(phase))),phase)
 s=beginPreviewWave(s);s=finishPlanting(s,s.pending.map(f=>f.id));assert.deepEqual(restoreRenewal(JSON.parse(JSON.stringify(s))),s)
 const changed=JSON.parse(JSON.stringify(s));changed.bodies.r01.generation=99;assert.throws(()=>restoreRenewal(changed))
})

test('procedural signatures are repeatable, distinct across 2000 identities and remain on land',()=>{
 const fingerprints=new Set()
 for(let i=0;i<2000;i++){const p=flowerRecipe(`agent:${i}`);assert.deepEqual(p,flowerRecipe(`agent:${i}`));fingerprints.add(flowerFingerprint(p));const pos=flowerPosition(i);assert.ok(((pos.x+7)/103)**2+((pos.z+1)/89)**2<.97)}
 assert.equal(fingerprints.size,2000)
 const f=createFlower({id:'test',recipe:flowerRecipe('test')},0)
 f.root.traverse(o=>{for(const v of o.geometry?.attributes.position.array??[])assert.ok(Number.isFinite(v))});f.dispose()
})

test('the island has finite upward-facing turf, a visible floating underside and no wall',()=>{
 const scene=new THREE.Scene(),island=createFloatingIsland(scene),turf=island.group.getObjectByName('island-meadow')
 assert.ok(island.group.getObjectByName('floating-earth'))
 const normal=turf.geometry.attributes.normal
 for(let i=0;i<normal.count;i++)assert.ok(normal.getY(i)>=0)
 assert.ok(!island.group.getObjectByName('memorial-surface'))
})
