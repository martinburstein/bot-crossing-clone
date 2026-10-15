import * as THREE from 'three'
import {createRoArmPreview} from './roarm-preview.js'
import {createRoArmModel,roarmForwardKinematics} from './roarm-model.js'
import {createCraneRealtime} from '../research/crane-realtime.js'
import {createVelocityFrameDriver} from '../research/velocity-frame-driver.mjs'
import {velocityDisplayPose,velocityTargetLocal} from '../research/velocity-display.js'

export const CRANE_LAB=Object.freeze({x:-56,z:-124,scale:4.2})
export const CRANE_REST=Object.freeze({base:-.8,shoulder:.08,elbow:.58,gripper:3.1})
const joints=['base','shoulder','elbow','gripper']
const fresh=(o,now)=>o?.state==='live'&&o.stale!==true&&['hardware','simulator'].includes(o.source)&&Number.isFinite(Date.parse(o.observedAt))&&now>=Date.parse(o.observedAt)&&now-Date.parse(o.observedAt)<=5000&&joints.every(j=>Number.isFinite(o.pose?.[j]))

/** A magnified kinematic rehearsal landmark. No robot client or write endpoint. */
export function createCraneLab(scene,{now=Date.now}={}){
  const group=new THREE.Group();group.name='mist-crane-laboratory';group.position.set(CRANE_LAB.x,0,CRANE_LAB.z);scene.add(group)
  const simulation=createRoArmPreview(group,{now,appearance:'solid'}),measured=createRoArmModel()
  simulation.group.scale.setScalar(CRANE_LAB.scale);simulation.group.position.y=1.5
  measured.group.scale.setScalar(CRANE_LAB.scale);measured.group.position.y=1.5;group.add(measured.group)
  const resources=[],geometry=[],overlayMaterials=[]
  measured.group.traverse(o=>{if(!o.isMesh)return;const m=o.material.clone();m.color.set(0x76f2f3);m.emissive?.set(0x37c2d5);m.emissiveIntensity=.8;m.transparent=true;m.opacity=.6;m.wireframe=true;m.depthWrite=false;o.material=m;overlayMaterials.push(m)})
  const material=(color,options={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.75,...options});resources.push(m);return m}
  const dark=material(0x34494e),edge=material(0xd8b56d),cargo=material(0x748884),light=material(0x9ed7d2,{emissive:0x82bdbb,emissiveIntensity:.5})
  function mesh(g,m,x,y,z){geometry.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);group.add(o);return o}
  const box=(x,y,z,w,h,d,m)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z)
  mesh(new THREE.CylinderGeometry(17,18,1.5,12),dark,0,.5,0).name='crane-lab-foundation'
  const ring=mesh(new THREE.TorusGeometry(16.6,.17,6,80),edge,0,1.3,0);ring.rotation.x=Math.PI/2
  // Cargo gives the distant arm a familiar scale; a narrow service bridge meets its footing.
  for(const [i,x]of [-22,22].entries()){
    box(x,2.0,-4,7.5,3.6,13,cargo).name=`crane-scale-container-${i}`
    for(let z=-9;z<=1;z+=1)box(x,2.0,z,7.6,3.65,.1,dark)
    box(x,3.9,-4,7.6,.13,13.1,edge)
  }
  box(0,.45,24,5,.6,19,dark)
  for(const x of [-2.8,2.8])for(let z=17;z<=31;z+=7){box(x,1.5,z,.16,2,.16,edge);box(x,2.65,z,.38,.2,.38,light)}
  // Thin low layers leave the landmark silhouette readable through the haze.
  const mistMat=material(0xc3d3ce,{transparent:true,opacity:.075,depthWrite:false})
  const mist=[]
  for(let i=0;i<5;i++){const o=mesh(new THREE.SphereGeometry(1,16,8),mistMat,(i-2)*10,3+i*1.7,(i%2?9:-7));o.scale.set(24,1.7,12);o.name='crane-ground-mist';mist.push(o)}
  if(typeof document!=='undefined'){
    const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#193238';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#d8b56d';ctx.lineWidth=8;ctx.strokeRect(10,10,1004,236);ctx.fillStyle='#ede0bf';ctx.textAlign='center';ctx.font='600 70px sans-serif';ctx.fillText('CRANE / SIMULATION',512,105);ctx.fillStyle='#a6d8d2';ctx.font='30px sans-serif';ctx.fillText('KINEMATIC REHEARSAL     /     4.2x WORLD SCALE',512,184)
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;resources.push(texture)
    const m=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});resources.push(m)
    const sign=mesh(new THREE.PlaneGeometry(24,6),m,0,3,14.8);sign.rotation.x=-Math.PI/4
  }
  const modeled=createRoArmModel(),reference=createRoArmModel()
  for(const model of [modeled,reference]){model.group.scale.setScalar(CRANE_LAB.scale);model.group.position.y=1.5;group.add(model.group)}
  reference.group.traverse(o=>{if(!o.isMesh)return;const m=o.material.clone();m.color.set(0xc49cfa);m.transparent=true;m.opacity=.26;m.wireframe=true;m.depthWrite=false;o.material=m;overlayMaterials.push(m)})
  const realtime=createCraneRealtime(CRANE_REST,{nowMs:typeof document==='undefined'?null:()=>performance.now(),onPose:(plant,planned)=>{modeled.updateObservation({state:'measured',source:'simulation-preview',pose:plant});reference.updateObservation({state:'measured',source:'simulation-preview',pose:planned})}})
  const markerGeometry=new THREE.SphereGeometry(.10,14,10);geometry.push(markerGeometry)
  const targetMarker=new THREE.Mesh(markerGeometry,material(0xf477aa,{emissive:0xf477aa,emissiveIntensity:.8,depthTest:false}));targetMarker.name='velocity-target-marker';targetMarker.renderOrder=10;modeled.group.add(targetMarker)
  const haloGeometry=new THREE.TorusGeometry(.27,.025,6,24);geometry.push(haloGeometry)
  const haloMaterial=material(0xffa3cb,{emissive:0xffa3cb,emissiveIntensity:1,depthTest:false})
  for(const angle of [0,Math.PI/2]){const halo=new THREE.Mesh(haloGeometry,haloMaterial);halo.rotation.y=angle;halo.renderOrder=10;targetMarker.add(halo)}
  const originMarker=new THREE.Mesh(markerGeometry,material(0x8bc4a2,{wireframe:true}));originMarker.name='velocity-origin-marker';modeled.group.add(originMarker)
  const newVelocityDriver=()=>createVelocityFrameDriver({nowMs:typeof document==='undefined'?null:()=>performance.now(),onState:e=>{
    modeled.updateObservation({state:'measured',source:'simulation-preview',pose:velocityDisplayPose(e.plant.position)})
    reference.updateObservation({state:'measured',source:'simulation-preview',pose:velocityDisplayPose(Object.fromEntries(Object.entries(e.reference.currentReference).map(([j,s])=>[j,s.position])))})
    targetMarker.position.fromArray(velocityTargetLocal(e.target.xyzMm));originMarker.position.fromArray(velocityTargetLocal(e.originMm))
  }})
  let velocity=newVelocityDriver()
  let observation=null,disposed=false,mode='legacy'
  function showMode(){simulation.group.visible=mode==='legacy';modeled.group.visible=mode!=='legacy';reference.group.visible=mode!=='legacy';targetMarker.visible=mode==='velocity';originMarker.visible=mode==='velocity'}
  function reset(){velocity.dispose();realtime.reset(CRANE_REST);mode='legacy';simulation.rehearse({startPose:CRANE_REST,moves:[CRANE_REST]});simulation.update(.25);simulation.update(.25);simulation.update(.25);showMode();return snapshot()}
  function practice(moves){const start=mode==='velocity'?CRANE_REST:snapshot().pose??CRANE_REST;const r=simulation.rehearse({startPose:start,moves});velocity.dispose();realtime.reset(start);mode='legacy';showMode();return r}
  function smooth(moves,options={}){const start=mode==='velocity'?CRANE_REST:snapshot().pose??CRANE_REST;if(mode==='velocity')realtime.reset(start);const r=realtime.start(moves,{...options,startPose:start});velocity.dispose();mode='realtime';showMode();return r}
  function startVelocity(){velocity.dispose();velocity=newVelocityDriver();mode='velocity';velocity.start();showMode();return snapshot()}
  function setTargetOffsetMm(value){if(mode!=='velocity')throw Error('Start velocity tracking first');velocity.setTargetOffsetMm(value);return snapshot()}
  function setVelocityFaults(value){if(mode!=='velocity')throw Error('Start velocity tracking first');velocity.setFaults(value);return snapshot()}
  function retarget(target){if(mode!=='realtime')throw Error('Start a smooth simulation before retargeting');return realtime.retarget(target)}
  function scan(){const p=snapshot().pose??CRANE_REST;return smooth([{base:-.4,shoulder:.25,elbow:.35,gripper:2.7},{base:.35,shoulder:.42,elbow:.7,gripper:2.2},{base:.05,shoulder:.12,elbow:1.1,gripper:2.9},{...p}])}
  function flow(){const p=snapshot().pose??CRANE_REST;return smooth([{base:-.4,shoulder:.25,elbow:.35,gripper:2.7},{base:.35,shoulder:.42,elbow:.7,gripper:2.2},{base:.05,shoulder:.12,elbow:1.1,gripper:2.9},{...p}],{intervalMs:900})}
  function wave(){const p=snapshot().pose??CRANE_REST;return practice([{...p,elbow:.25},{...p,elbow:.9},{...p,elbow:.25},{...p,elbow:p.elbow}])}
  function seedFromMeasured(){if(!fresh(observation,now()))throw Error('Fresh measured pose unavailable');simulation.preview({startPose:observation,moves:[observation.pose]});velocity.dispose();realtime.reset(observation.pose);mode='legacy';showMode();return snapshot()}
  function updateObservation(value){
    observation=value?{...value,pose:value.pose?{...value.pose}:null}:null
    if(fresh(observation,now()))measured.updateObservation(observation)
    else measured.updateObservation({state:'offline'})
    measured.group.visible=fresh(observation,now())
    return snapshot()
  }
  function snapshot(){
    const rt=realtime.snapshot(),vt=velocity.snapshot(),simulated=mode==='velocity'?{source:'offline-rehearsal',status:vt.status,simulationOnly:true,pose:{...vt.engine.plant.position,gripper:.5}}:mode==='realtime'?{...rt,source:'offline-rehearsal',status:rt.status==='running'?'previewing':rt.status}:simulation.snapshot(),live=fresh(observation,now())
    let comparison=null
    if(live&&simulated.pose){const displayPose=mode==='velocity'?velocityDisplayPose(simulated.pose):simulated.pose,a=roarmForwardKinematics(displayPose),b=roarmForwardKinematics(observation.pose);comparison={jointDeltaRad:Object.fromEntries(joints.map(j=>[j,displayPose[j]-observation.pose[j]])),jointComparisonFrame:mode==='velocity'?'world-model display angles':'world-model angles',tipSeparationMm:Math.hypot(a.robotX-b.robotX,a.robotY-b.robotY,a.robotZ-b.robotZ)}}
    return {...simulated,mode,realtime:rt,velocity:vt,worldScale:CRANE_LAB.scale,measurement:{available:live,source:observation?.source??null,observedAt:observation?.observedAt??null},comparison,physics:mode!=='legacy'?'uncalibrated first-order lag; no contact, load or collision model':'kinematics only; no contact, load or collision model',training:false}
  }
  function update(dt,elapsed=0){if(mode==='velocity')velocity.update(dt);else if(mode==='realtime')realtime.update(dt);else simulation.update(dt);measured.group.visible=fresh(observation,now());for(const [i,o]of mist.entries())o.position.x=(i-2)*10+Math.sin(elapsed*.09+i)*3}
  reset()
  return {group,simulation,measured,practice,wave,smooth,retarget,scan,flow,startVelocity,setTargetOffsetMm,setVelocityFaults,interrupt:()=>mode==='velocity'?velocity.interrupt():realtime.interrupt(),setFaults:p=>realtime.setFaults(p),reset,seedFromMeasured,updateObservation,snapshot,update,limitsRad:simulation.limitsRad,
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();velocity.dispose();realtime.dispose();modeled.dispose();reference.dispose();simulation.dispose();measured.dispose();overlayMaterials.forEach(m=>m.dispose());geometry.forEach(g=>g.dispose());resources.forEach(r=>r.dispose())}}
}
