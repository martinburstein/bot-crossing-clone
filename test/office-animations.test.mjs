import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OFFICE_CLIPS,OFFICE_ANIMATIONS,applyOfficeAnimation} from '../src/agents/office-animations.js';
import {createOffice} from '../animations/office.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
const path=new URL('../public/',import.meta.url);
const bytes=readFileSync(new URL('assets/crew.glb',path)),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size));
delete json.images;delete json.textures;delete json.materials;
for(const mesh of json.meshes)for(const p of mesh.primitives)delete p.material;
const bin=bytes.subarray(28+size);json.buffers=[{byteLength:bin.length,uri:'data:application/octet-stream;base64,'+bin.toString('base64')}];
globalThis.ProgressEvent=class {constructor(type,data){Object.assign(this,data);}};
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
const mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(a=>a.name==='Idle_A')).play();mixer.setTime(0);gltf.scene.updateMatrixWorld(true);
const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
const skeleton=meshes[0].skeleton,bones=skeleton.bones,find=name=>bones.find(b=>b.name.replace(/[.\s_]/g,'').toLowerCase()===name);

function update(){gltf.scene.updateMatrixWorld(true);skeleton.update();}
function skin(mesh,index){const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index);mesh.applyBoneTransform(index,v);return v.applyMatrix4(mesh.matrixWorld);}
const original=bones.flatMap(b=>[...b.position,...b.quaternion]);
const pose=()=>bones.flatMap(b=>[...b.position,...b.quaternion]);
function near(actual,expected,message){assert.equal(actual.length,expected.length);assert.ok(actual.every((v,i)=>Math.abs(v-expected[i])<1e-6),message);}
test('eleven catalogue entries resolve to thirteen moving, finite, reversible clips',()=>{
 assert.equal(OFFICE_ANIMATIONS.length,11);assert.equal(Object.keys(OFFICE_CLIPS).length,13);
 for(const entry of OFFICE_ANIMATIONS)for(const key of entry.clips)assert.ok(OFFICE_CLIPS[key],key);
 for(const [key,spec]of Object.entries(OFFICE_CLIPS)){
  let first,last,changed=false;
  for(const time of [0,spec.duration/4,spec.duration/2,spec.duration]){
   const restore=applyOfficeAnimation(bones,spec.pose,time,spec.duration);update();const current=pose();
   assert.ok(current.every(Number.isFinite),key);if(!first)first=current;last=current;
   changed ||= current.some((v,i)=>Math.abs(v-original[i])>.01);
   restore();near(pose(),original,key+' must restore the source rig');
  }
  assert.ok(changed,key+' must move');if(spec.loop)near(last,first,key+' loop must close');
 }
});
test('seated transitions meet the typing loop without a palm or leg jump',()=>{
 const capture=(key,time)=>{const s=OFFICE_CLIPS[key],restore=applyOfficeAnimation(bones,s.pose,time,s.duration),state=pose();restore();return state;};
 near(capture('officeSitDown',1.2),capture('officeTyping',0),'sitting to typing');
 near(capture('officeTyping',4),capture('officeStandUp',0),'typing to standing');
 near(capture('officeStandUp',1.2),capture('officeSitDown',0),'standing endpoints');
});
test('387 sampled seated poses clear fitted furniture and keep feet above the rug',()=>{
 const office=createOffice(new THREE.Scene()),desk=office.desks[0],chair=office.chairs[0],dx=desk.position.x,dz=desk.position.z;
 const bodyMeshes=meshes.filter(m=>!m.name.includes('Head'));let samples=0;
 for(const key of ['officeSitDown','officeTyping','officeStandUp']){
  const spec=OFFICE_CLIPS[key];
  for(let sample=0;sample<=Math.round(spec.duration*60);sample++){
   const time=sample/60,t=Math.min(1,time/1.2),ease=t*t*(3-2*t),seated=key==='officeSitDown'?ease:key==='officeStandUp'?1-ease:1;
   const restore=applyOfficeAnimation(bones,spec.pose,time,spec.duration);update();office.setChair(0,seated);office.group.updateMatrixWorld(true);
   const root=new THREE.Matrix4().compose(new THREE.Vector3(dx,.8,dz+3.8-.90*seated),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI),new THREE.Vector3(1.65,1.65,1.65));
   const furniture=[...desk.children,...chair.children].filter(o=>o.isMesh&&['BoxGeometry','CylinderGeometry'].includes(o.geometry.type)).map(mesh=>({mesh,box:new THREE.Box3().setFromObject(mesh),inverse:mesh.matrixWorld.clone().invert()}));
   for(const mesh of bodyMeshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    const point=skin(mesh,i).applyMatrix4(root);
    if(mesh.name.includes('Leg'))assert.ok(point.y>=.78-.003,`${key} ${time}: foot through rug`);
    for(const {mesh:object,box,inverse}of furniture){
     const inside=point.x>box.min.x+.003&&point.x<box.max.x-.003&&point.y>box.min.y+.003&&point.y<box.max.y-.003&&point.z>box.min.z+.003&&point.z<box.max.z-.003;
     if(!inside)continue;
     if(object.geometry.type==='CylinderGeometry'){const p=point.clone().applyMatrix4(inverse),g=object.geometry.parameters;if(Math.hypot(p.x,p.z)>=g.radiusTop-.003||Math.abs(p.y)>=g.height/2-.003)continue;}
     assert.fail(`${key} ${time}: ${mesh.name} intersects ${object.name||object.geometry.type}`);
    }
   }
   restore();samples++;
  }
 }
 assert.equal(samples,387);
});
