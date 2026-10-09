import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {DOCKLIGHT_MERIDIAN_CROWN,validateRewardDesign,rewardGeometryKey,createRewardWearable,selectEarnedWearables,syncRewardWearable,applyRewardBoneTransform} from '../src/world/roarm-rewards.js'

const backAccessory={name:'Back Relay Badge',story:'A compact blue marker for the rear pack.',kind:'accessory',anchor:'back',parts:[
  {shape:'box',color:'#5AAFC0',position:[0,.05,-.62],rotation:[0,0,0],scale:[.28,.22,.08]},
]}
const record=(workerId,sequence,design=DOCKLIGHT_MERIDIAN_CROWN,{awardedAt=100+sequence,fingerprint=String(sequence.toString(16)).padStart(64,'0'),...overrides}={})=>({
  taskId:`task-${sequence}`,submissionId:`submission-${sequence}`,leaseId:`lease-${sequence}`,workerId,awardedAt,sequence,fingerprint,rewardDesign:design,...overrides,
})

test('authored crown is a bounded, visor-clear primitive recipe with a distinct geometry key',()=>{
  const design=validateRewardDesign(DOCKLIGHT_MERIDIAN_CROWN)
  assert.equal(design.name,'Docklight Meridian Crown');assert.equal(design.kind,'hat');assert.equal(design.anchor,'head')
  assert.equal(design.parts.length,4);assert.ok(design.parts.every(part=>['box','sphere','cylinder','cone','torus'].includes(part.shape)))
  assert.equal(rewardGeometryKey(design),rewardGeometryKey({...design,name:'Renamed crown',story:'Same geometry'}))
  const reordered={...design,parts:[...design.parts].reverse().map(part=>({...part,color:part.color.toLowerCase()}))}
  assert.equal(rewardGeometryKey(design),rewardGeometryKey(reordered))
  assert.throws(()=>validateRewardDesign({...design,script:'alert(1)'}),/invalid shape/)
  assert.throws(()=>validateRewardDesign({...design,parts:Array(25).fill(design.parts[0])}),/part count/)
  assert.throws(()=>validateRewardDesign({...design,parts:[{...design.parts[0],color:'red'}]}),/#[RRGGBB]/)
  assert.throws(()=>validateRewardDesign({...design,parts:[{...design.parts[0],scale:[.2,0,.2]}]}),/outside the allowed bounds/)
  assert.throws(()=>validateRewardDesign({...design,parts:[{...design.parts[0],position:[0,.4,.4]}]}),/floats below|obscures the visor/)
})

test('primitive renderer creates owned low-polygon parts and disposes geometry/material once',()=>{
  const wearable=createRewardWearable(DOCKLIGHT_MERIDIAN_CROWN),geometries=new Set(),materials=new Set()
  wearable.group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material)})
  assert.equal(wearable.group.children.length,4)
  assert.ok(wearable.group.children.every(object=>object.isMesh))
  let geometryDisposals=0,materialDisposals=0
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>geometryDisposals++)
  for(const material of materials)material.addEventListener('dispose',()=>materialDisposals++)
  wearable.dispose();wearable.dispose()
  assert.equal(wearable.group.parent,null);assert.equal(geometryDisposals,geometries.size);assert.equal(materialDisposals,materials.size)
})

test('only unique, valid accepted-projection records for their owner enter inventory or get worn',()=>{
  const invalid=record('w06',4,DOCKLIGHT_MERIDIAN_CROWN,{fingerprint:'bad'})
  const wrongOwner=record('w07',5,backAccessory)
  const duplicate=record('w06',3,backAccessory,{fingerprint:record('w06',2,backAccessory).fingerprint})
  const sameGeometryDifferentFingerprint=record('w06',6,{...backAccessory,name:'Renamed badge',story:'Same geometry.'},{fingerprint:'f'.repeat(64)})
  const records=[record('w06',2,backAccessory,{awardedAt:201}),record('w06',1,DOCKLIGHT_MERIDIAN_CROWN,{awardedAt:200}),duplicate,sameGeometryDifferentFingerprint,invalid,wrongOwner]
  const selected=selectEarnedWearables(records,'w06')
  assert.equal(selected.inventory.length,2)
  assert.equal(selected.inventory[0].sequence,1)
  assert.equal(selected.inventory[1].sequence,2)
  assert.equal(selected.wearing.design.name,backAccessory.name)
  assert.deepEqual(selectEarnedWearables([record('w07',1)],'w06'),{inventory:[],wearing:null})
})

test('accepted head and back wearables follow their animated bone, astronaut scale, and seated root',()=>{
  const scene=new THREE.Scene(),parent=new THREE.Group();scene.add(parent)
  const a={thread:{shellId:'w01'}},b={thread:{shellId:'w02'}}
  syncRewardWearable(a,[record('w01',1,DOCKLIGHT_MERIDIAN_CROWN)],'w01',parent,true)
  syncRewardWearable(b,[record('w02',2,backAccessory)],'w02',parent,true)
  assert.equal(parent.children.length,2)
  assert.equal(a.rewardWearable.anchor,'head');assert.equal(b.rewardWearable.anchor,'back')
  const rootFor=(position,yaw,scale=.56)=>new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,0)),new THREE.Vector3(scale,scale,scale))
  // Representative rig head rest frame: raised from the neck and slightly pitched,
  // as the existing helmet slot sees it before animated clip deltas.
  const head0=new THREE.Matrix4().compose(new THREE.Vector3(0,.46,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(-.08,0,.03)),new THREE.Vector3(1,1,1))
  const back0=new THREE.Matrix4().compose(new THREE.Vector3(0,.2,-.1),new THREE.Quaternion(),new THREE.Vector3(1,1,1))
  const root=rootFor([4,2,-3],.7)
  applyRewardBoneTransform(a.rewardWearable,root,head0)
  applyRewardBoneTransform(b.rewardWearable,root,back0)
  const expectedHead=root.clone().multiply(head0),expectedBack=root.clone().multiply(back0)
  for(let i=0;i<16;i++){assert.ok(Math.abs(a.rewardWearable.group.matrix.elements[i]-expectedHead.elements[i])<1e-9);assert.ok(Math.abs(b.rewardWearable.group.matrix.elements[i]-expectedBack.elements[i])<1e-9)}
  const head1=new THREE.Matrix4().compose(new THREE.Vector3(.2,.62,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,.25,0)),new THREE.Vector3(1,1,1))
  applyRewardBoneTransform(a.rewardWearable,rootFor([4,2,-3],.7),head1)
  assert.ok(!a.rewardWearable.group.matrix.equals(expectedHead),'the head anchor follows the changed clip frame')
  const old=a.rewardWearable,oldGeo=old.group.children[0].geometry
  let disposed=0;oldGeo.addEventListener('dispose',()=>disposed++)
  syncRewardWearable(a,[],'w01',parent,true)
  assert.equal(a.rewardWearable,null);assert.equal(a.wornReward,null);assert.equal(disposed,1)
  assert.equal(parent.children.includes(old.group),false)
  const seatedRoot=rootFor([9,1,8],-1.2,.56)
  applyRewardBoneTransform(b.rewardWearable,seatedRoot,back0)
  assert.ok(b.rewardWearable.group.matrix.elements.every(Number.isFinite))
  old.dispose();b.rewardWearable.dispose();scene.remove(parent)
})
