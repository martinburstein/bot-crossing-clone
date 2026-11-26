import * as THREE from 'three';
import { createRig } from './rig.mjs';
const canvas=document.querySelector('#view'), loading=document.querySelector('#loading');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene(); scene.background=new THREE.Color('#f6efe3');
const camera=new THREE.PerspectiveCamera(34,1,.1,100); camera.position.set(0,1.76,8.2); camera.lookAt(0,1.76,0);
scene.add(new THREE.HemisphereLight(0xfff6e8,0x8d6e55,2.1)); const key=new THREE.DirectionalLight(0xffedd7,3.0); key.position.set(-3,7,6); scene.add(key); const fill=new THREE.DirectionalLight(0xffffff,1.2); fill.position.set(4,3,-4); scene.add(fill);
const floor=new THREE.Mesh(new THREE.CircleGeometry(2.6,64),new THREE.MeshStandardMaterial({color:0xe7d8c5,roughness:1})); floor.rotation.x=-Math.PI/2; floor.position.y=-.025; scene.add(floor);
const rig=createRig(scene); loading.hidden=true;
let pose='neutral',view='front',paused=true,progress=0;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const pauseButton=document.querySelector('#pause'); if(reduceMotion){pauseButton.disabled=true;pauseButton.textContent='Reduced motion';}
function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.render(scene,camera);}
new ResizeObserver(resize).observe(canvas); resize();
const views={front:[0,1.76,8.2],side:[8.2,1.76,0],threequarter:[5.1,1.96,6.4]};
function setView(v){view=v;camera.position.set(...views[v]);camera.lookAt(0,1.76,0);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));renderer.render(scene,camera);}
function setPose(p){pose=p;progress=p==='neutral'?0:p==='reach'?1:.5;document.querySelector('#scrub').value=Math.round(progress*100);document.querySelectorAll('[data-pose]').forEach(b=>b.classList.toggle('active',b.dataset.pose===p));apply();renderer.render(scene,camera);}
function apply(){rig.setPose(pose,progress);}
document.querySelectorAll('[data-pose]').forEach(b=>b.addEventListener('click',()=>setPose(b.dataset.pose)));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelector('#scrub').addEventListener('input',e=>{progress=Number(e.target.value)/100;apply();renderer.render(scene,camera);});
document.querySelector('#pause').addEventListener('click',e=>{if(reduceMotion)return;paused=!paused;e.currentTarget.textContent=paused?'Paused':'Playing';e.currentTarget.setAttribute('aria-pressed',String(paused));if(!paused)requestAnimationFrame(tick);});
function tick(now){if(!paused){progress=(now%2400)/2400;document.querySelector('#scrub').value=Math.round(progress*100);apply();renderer.render(scene,camera);requestAnimationFrame(tick);}}
setPose('neutral');setView('threequarter');renderer.render(scene,camera);
window.__mascot={rig,renderer,scene,setPose,setView,render:()=>renderer.render(scene,camera),getState:()=>({pose,view,paused,progress,geometryCount:rig.geometryCount,groundY:rig.root.position.y,reduceMotion})};
