import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createOffice} from './office.js';
import {PROFILES} from './profiles.js';
import {loadCrew,decorateSkinned,attachMatrixAt,frameFor} from './crew.js';
import {tailorOfficeMaterial} from './suit.js';
import {createOriginalHeads} from './original-heads.js';
import {makeRoute} from './idle-routes.js';
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
 return {...p,route:makeRoute(p),yaw:Math.PI,position:new THREE.Vector3(),mode:'work'};
});
const root=new THREE.Matrix4(),bone=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(1.65,1.65,1.65),axis=new THREE.Vector3(0,1,0);
let elapsed=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,last=performance.now();
function update(delta){
 for(const a of agents){
  const t=(elapsed+Math.floor(a.index/2)*45)%a.route.total;
  const segment=a.route.segments.find(s=>t>=s.start&&t<s.start+s.duration)||a.route.segments[0];
  const progress=Math.min(1,(t-segment.start)/segment.duration);
  a.position.set(THREE.MathUtils.lerp(segment.a.x,segment.b.x,progress),.80,THREE.MathUtils.lerp(segment.a.z,segment.b.z,progress));
  a.mode=segment.mode;
  const smooth=progress*progress*(3-2*progress);
  const seated=a.mode==='typing'?1:a.mode==='sit-down'?smooth:a.mode==='stand-up'?1-smooth:0;
  a.position.z-=.90*seated;office.setChair(a.index,seated);
  let yaw=a.mode==='walk'?Math.atan2(segment.b.x-segment.a.x,segment.b.z-segment.a.z):segment.yaw??Math.PI;
  const difference=Math.atan2(Math.sin(yaw-a.yaw),Math.cos(yaw-a.yaw));a.yaw+=difference*Math.min(1,delta*10);
  q.setFromAxisAngle(axis,a.yaw);root.compose(a.position,q,scale);body.setMatrixAt(a.index,root);
  const clip=a.mode.startsWith('idle-')?a.mode:{walk:'walk',typing:'officeTyping','sit-down':'officeSitDown','stand-up':'officeStandUp',talk:'talk',idle:'idle'}[a.mode];
  const frame=frameFor(rig.clips[clip],t-segment.start);frames.setX(a.index,frame);
  attachMatrixAt(rig,frame,rig.attachSlot.get('head'),bone);heads.update(a.index,root,bone,elapsed,seated>0?'work':a.mode);
  attachMatrixAt(rig,frame,rig.attachSlot.get('hand.r'),bone);props.update(a.index,root,bone,a.mode,t-segment.start,a.yaw);
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
window.officeDemo={snapshot:()=>({characters:agents.length,desks:8,elapsed,paused,agents:agents.map(a=>({index:a.index,x:a.position.x,z:a.position.z,activity:a.mode}))})};
renderer.setAnimationLoop(now=>{const delta=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;if(!paused){elapsed+=delta;update(delta);}controls.update();renderer.render(scene,camera);});
}
