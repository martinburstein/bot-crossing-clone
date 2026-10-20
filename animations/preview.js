import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadCrew,decorateSkinned,attachMatrixAt,frameFor} from '../src/agents/crew.js';
import {tailorOfficeMaterial} from './suit.js';
import {createOriginalHeads} from './original-heads.js';
import {createIdleProps} from '../src/world/office-idle-props.js';
import {createOffice} from './office.js';
import {PROFILES} from './profiles.js';
import {OFFICE_ANIMATIONS} from '../src/agents/office-animations.js';

const animations=OFFICE_ANIMATIONS.map(({id,label,description})=>[id,label,description]);
let selection=0,elapsed=0,paused=false,speed=1,ready=false,resetView=()=>{};
const duration=()=>selection===0?10.4:6;
const picker=document.querySelector('#picker');
animations.forEach(([id,name],index)=>{
 const button=document.createElement('button');button.innerHTML=`<span class="number">${String(index+1).padStart(2,'0')}</span>${name}`;
 button.setAttribute('aria-pressed',String(index===0));button.dataset.animation=id;button.onclick=()=>select(index);picker.appendChild(button);
});
function select(index){selection=index;elapsed=0;const [,name,description]=animations[index];
 [...picker.children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
 document.querySelector('#name').textContent=name;document.querySelector('#description').textContent=description;
 document.querySelector('#count').textContent=`${String(index+1).padStart(2,'0')} / ${animations.length}`;
 document.querySelector('#scrub').max=duration();document.querySelector('#progress').max=duration();resetView();
}
const pause=document.querySelector('#pause');pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Resume':'Pause';pause.setAttribute('aria-pressed',String(paused));};
document.querySelector('#replay').onclick=()=>{elapsed=0;paused=false;pause.textContent='Pause';pause.setAttribute('aria-pressed','false');};
document.querySelector('#speed').onchange=e=>{speed=Number(e.target.value);};
document.querySelector('#scrub').oninput=e=>{elapsed=Math.max(0,Math.min(duration()-.001,Number(e.target.value)));paused=true;pause.textContent='Resume';pause.setAttribute('aria-pressed','true');};
const stage=document.querySelector('#stage'),loading=document.querySelector('#loading');
try{await start();}catch(error){console.error(error);loading.hidden=false;loading.textContent='Preview could not load. Please reload this page.';}
async function start(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xecece4);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;stage.prepend(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(36,1,.1,100),controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=16;controls.maxPolarAngle=Math.PI*.48;
 function reset(){camera.position.set(...(selection===0?[-8.4,4.76,-4.9]:[3.8,3.2,7.4]));controls.target.set(0,1.6,selection===0?-1.8:0);controls.update();}resetView=reset;reset();document.querySelector('#camera').onclick=reset;
 for(const [id,point]of Object.entries({front:[0,2.8,8],side:[8,2.8,0],back:[-6,3.4,-3.5]}))document.querySelector('#'+id).onclick=()=>{camera.position.set(...point).multiplyScalar(selection===0?1.4:1);controls.target.set(0,1.6,selection===0?-1.8:0);controls.update();};
 scene.add(new THREE.HemisphereLight(0xfffae9,0x7c958b,2.7));
 const sun=new THREE.DirectionalLight(0xfff1d4,3);sun.position.set(-4,8,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:30});sun.shadow.normalBias=.02;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xecece4,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const platform=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.6,.16,64),new THREE.MeshStandardMaterial({color:0xd6ddcf,roughness:.9}));platform.position.y=.08;platform.receiveShadow=true;scene.add(platform);
 const office=createOffice(scene),desk=PROFILES[0].desk;
 office.group.position.set(-desk.x,-.63,-desk.z-3.8);
 for(const part of office.group.children)part.visible=part===office.desks[0]||part===office.chairs[0];
 const rig=await loadCrew(),geometry=rig.geometry.clone();
 const frames=new THREE.InstancedBufferAttribute(new Float32Array(2),1),styles=new THREE.InstancedBufferAttribute(new Float32Array(8),4);
 geometry.setAttribute('aFrame',frames);geometry.setAttribute('aOfficeStyle',styles);
 const uniforms={uBones:{value:rig.boneTexture},uFrameMax:{value:rig.frameCount-1}};
 const body=new THREE.InstancedMesh(geometry,tailorOfficeMaterial(decorateSkinned(new THREE.MeshStandardMaterial({roughness:.78}),uniforms)),2);body.castShadow=true;body.frustumCulled=false;
 body.customDepthMaterial=decorateSkinned(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),uniforms,{normals:false});scene.add(body);
 const heads=createOriginalHeads(scene,2),props=createIdleProps(scene,2);
 for(let i=0;i<2;i++){body.setColorAt(i,new THREE.Color(i?0x426e60:0x304f73));const c=new THREE.Color(i?0xe4d1a3:0xe2a260);styles.setXYZW(i,c.r,c.g,c.b,i+1);}
 const matrix=new THREE.Matrix4(),bone=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0);
 function update(){
  const sitting=selection===0,chat=animations[selection][0]==='chat',cycle=elapsed%duration();
  const phase=cycle<1.2?'officeSitDown':cycle<9.2?'officeTyping':'officeStandUp';
  const poseTime=cycle<1.2?cycle:cycle<9.2?cycle-1.2:cycle-9.2;
  const t=Math.min(1,poseTime/1.2),ease=t*t*(3-2*t),seated=phase==='officeSitDown'?ease:phase==='officeStandUp'?1-ease:1;
  const action=sitting?phase:'idle-'+animations[selection][0];
  office.group.visible=sitting;platform.visible=!sitting;office.setChair(0,sitting?seated:0);
  for(let i=0;i<2;i++){
   const visible=i===0||chat,yaw=sitting?Math.PI:chat?(i===0?Math.PI/2:-Math.PI/2):0;
   position.set(chat?(i===0?-1.1:1.1):0,.17,sitting?-.90*seated:0);quaternion.setFromAxisAngle(axis,yaw);scale.setScalar(visible?1.65:0);matrix.compose(position,quaternion,scale);body.setMatrixAt(i,matrix);
   const time=(sitting?poseTime:elapsed)+(i?1.8:0),frame=frameFor(rig.clips[action],time);frames.setX(i,frame);
   attachMatrixAt(rig,frame,rig.attachSlot.get('head'),bone);heads.update(i,matrix,bone,time,sitting?'work':action);
   attachMatrixAt(rig,frame,rig.attachSlot.get('hand.r'),bone);props.update(i,matrix,bone,visible?action:'idle',time,yaw);
  }
  frames.needsUpdate=true;body.instanceMatrix.needsUpdate=true;heads.flush();document.querySelector('#progress').value=elapsed%duration();
 }
 function resize(){renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();}
 addEventListener('resize',resize);resize();select(0);update();loading.hidden=true;ready=true;
 let last=performance.now();document.addEventListener('visibilitychange',()=>{last=performance.now();});
 renderer.setAnimationLoop(now=>{const delta=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;if(!paused)elapsed+=delta*speed;update();controls.update();renderer.render(scene,camera);});
}
