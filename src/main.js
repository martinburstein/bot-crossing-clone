import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createOffice} from './office.js';
import {PROFILES} from './profiles.js';
import {loadCrew,decorateSkinned,attachMatrixAt,frameFor} from './crew.js';
import {tailorOfficeMaterial} from './suit.js';
import {createOriginalHeads} from './original-heads.js';
import {makeRoute} from './idle-routes.js';
import {createMotion,routePose} from './live-motion.js';
import {createIdleProps} from './idle-props.js';

const host=document.querySelector('#scene');
const loading=document.querySelector('#loading');
try { await start(); } catch(error) { loading.hidden=false;loading.textContent='The office could not load. Open it using Start Office Demo.cmd.';console.error(error); }

async function start(){
const scene=new THREE.Scene();scene.background=new THREE.Color(0xdedfd4);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(38,1,.1,400);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;
controls.minDistance=20;controls.maxDistance=150;controls.maxPolarAngle=Math.PI*.46;controls.target.set(0,0,2);
function reset(){camera.position.set(62,70,88);controls.target.set(0,0,2);controls.update();}
reset();
scene.add(new THREE.HemisphereLight(0xfffae9,0x7c958b,2.7));
const sun=new THREE.DirectionalLight(0xfff1d4,3.3);sun.position.set(-32,62,24);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:150});sun.shadow.bias=-.0003;sun.shadow.normalBias=.04;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(1500,1500),new THREE.MeshStandardMaterial({color:0xdedfd4,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=true;scene.add(ground);
const office=createOffice(scene);
const rig=await loadCrew();
const geometry=rig.geometry.clone();
const frames=new THREE.InstancedBufferAttribute(new Float32Array(8),1);geometry.setAttribute('aFrame',frames);
const styles=new THREE.InstancedBufferAttribute(new Float32Array(8*4),4);geometry.setAttribute('aOfficeStyle',styles);
const uniforms={uBones:{value:rig.boneTexture},uFrameMax:{value:rig.frameCount-1}};
const material=tailorOfficeMaterial(decorateSkinned(new THREE.MeshStandardMaterial({roughness:.78}),uniforms));
const body=new THREE.InstancedMesh(geometry,material,8);body.frustumCulled=false;body.castShadow=true;
body.customDepthMaterial=decorateSkinned(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),uniforms,{normals:false});scene.add(body);
const heads=createOriginalHeads(scene,8);
const props=createIdleProps(scene,8);
const agents=PROFILES.map(p=>{
 body.setColorAt(p.index,new THREE.Color(p.color));const c=new THREE.Color(p.accent);styles.setXYZW(p.index,c.r,c.g,c.b,p.index+1);
 const route=makeRoute(p);return {...p,route,motion:createMotion(route,Math.floor(p.index/2)*45),yaw:Math.PI,position:new THREE.Vector3(),mode:'idle'};
});
const root=new THREE.Matrix4(),bone=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(1.65,1.65,1.65),axis=new THREE.Vector3(0,1,0);
let elapsed=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,last=performance.now();
let live=true,feed={available:false,seats:[],receivedAt:0},feedState='Connecting to Codex…';
const status=document.querySelector('#activity'),modeButton=document.querySelector('#mode');
function labelActivity(){
 const fresh=Date.now()-feed.receivedAt<8000;
 status.textContent=!live?'Animated demo':!fresh||!feed.available?feedState:`Live · ${feed.active} working${feed.overflow?` · ${feed.overflow} beyond eight desks`:''}`;
 modeButton.textContent=live?'Show demo':'Show live';modeButton.setAttribute('aria-pressed',String(!live));
}
modeButton.onclick=()=>{live=!live;for(const a of agents)a.motion=createMotion(a.route,Math.floor(a.index/2)*45);labelActivity();};
async function poll(){
 try{const response=await fetch('./api/activity',{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error();
  const data=await response.json();if(!Array.isArray(data.seats)||data.seats.length!==8)throw Error();
  feed={...data,receivedAt:Date.now()};feedState=data.available?'Live feed disconnected':'Codex not found · idle office';
 }catch{feed={available:false,seats:[],receivedAt:0};feedState='Live feed disconnected · idle office';}
 labelActivity();setTimeout(poll,2000);
}
poll();
function update(delta){
 for(const a of agents){
  const working=live&&feed.available&&Date.now()-feed.receivedAt<8000&&feed.seats[a.index]?.working;
  const pose=live?a.motion.step(delta,working):routePose(a.route,elapsed+Math.floor(a.index/2)*45);
  a.position.set(pose.x,.80,pose.z);a.mode=pose.mode;a.working=Boolean(working);
  const seated=pose.seated;
  a.position.z-=.90*seated;office.setChair(a.index,seated);
  let yaw=pose.yaw;
  const difference=Math.atan2(Math.sin(yaw-a.yaw),Math.cos(yaw-a.yaw));a.yaw+=difference*Math.min(1,delta*10);
  q.setFromAxisAngle(axis,a.yaw);root.compose(a.position,q,scale);body.setMatrixAt(a.index,root);
  const clip=a.mode.startsWith('idle-')?a.mode:{walk:'walk',typing:'officeTyping','sit-down':'officeSitDown','stand-up':'officeStandUp',talk:'talk',idle:'idle'}[a.mode];
  const frame=frameFor(rig.clips[clip],pose.age);frames.setX(a.index,frame);
  attachMatrixAt(rig,frame,rig.attachSlot.get('head'),bone);heads.update(a.index,root,bone,elapsed,seated>0?'work':a.mode);
  attachMatrixAt(rig,frame,rig.attachSlot.get('hand.r'),bone);props.update(a.index,root,bone,a.mode,pose.age,a.yaw);
 }
 frames.needsUpdate=true;body.instanceMatrix.needsUpdate=true;heads.flush();
}
const pauseButton=document.querySelector('#pause');
function labelPause(){pauseButton.textContent=paused?'Resume':'Pause';pauseButton.setAttribute('aria-pressed',String(paused));}
function togglePause(){paused=!paused;labelPause();}labelPause();
pauseButton.onclick=togglePause;document.querySelector('#reset').onclick=reset;
document.querySelector('#full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{document.querySelector('#full').textContent='Use browser full screen';}};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===document.body){e.preventDefault();togglePause();}});
document.addEventListener('visibilitychange',()=>{last=performance.now();});
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();update(1);loading.hidden=true;
// Local, read-only diagnostics make this small visual demo easy to inspect.
window.officeDemo={snapshot:()=>({characters:agents.length,desks:8,elapsed,paused,live,feedAvailable:feed.available,active:feed.active||0,agents:agents.map(a=>({index:a.index,x:a.position.x,z:a.position.z,activity:a.mode,working:a.working}))})};
renderer.setAnimationLoop(now=>{const delta=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;if(!paused){elapsed+=delta;update(delta);}labelActivity();controls.update();renderer.render(scene,camera);});
}
