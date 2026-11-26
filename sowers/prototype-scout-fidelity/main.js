import * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

const canvas=document.querySelector('#model'),host=canvas.parentElement
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false})
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15
renderer.setClearColor('#fffdf6',1)
const scene=new THREE.Scene();scene.background=new THREE.Color('#fffdf6')
scene.add(new THREE.HemisphereLight(0xfff4d8,0x6e5941,1.05))
const key=new THREE.DirectionalLight(0xffffff,1.65);key.position.set(-25,40,45);scene.add(key)
const fill=new THREE.DirectionalLight(0xffd188,.62);fill.position.set(25,4,-32);scene.add(fill)
const camera=new THREE.OrthographicCamera(-17,17,20,-20,.1,300)
const target=new THREE.Vector3(0,15,3);const controls=new OrbitControls(camera,renderer.domElement)
controls.enableDamping=false;controls.enablePan=false;controls.minZoom=.55;controls.maxZoom=4;controls.target.copy(target)
const loader=new STLLoader(),loadState=document.querySelector('#load-state')
let geometry=null,mesh=null,report=null,viewName='front',loadGeneration=0
const material=new THREE.MeshStandardMaterial({color:0xe99329,roughness:.72,metalness:0,flatShading:false})
function resize(){const w=host.clientWidth,h=host.clientHeight,aspect=w/h,halfH=Math.max(17,14/aspect);camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();renderer.setSize(w,h,false);render()}
function render(){renderer.render(scene,camera)}
function pointView(name){viewName=name;const poses={front:[0,15,65],side:[65,15,3],'three-quarter':[43,36,52]};camera.position.set(...poses[name]);camera.up.set(0,1,0);camera.lookAt(target);controls.target.copy(target);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));render()}
function installVariant(i){const generation=++loadGeneration,v=report.variants[i];loadState.hidden=false;loadState.textContent='Loading the selected STL…';if(mesh){scene.remove(mesh);geometry.dispose();mesh=null;geometry=null}
 loader.load(`/${v.stl}`,g=>{if(generation!==loadGeneration){g.dispose();return}geometry=mergeVertices(g,1e-5);geometry.computeVertexNormals();mesh=new THREE.Mesh(geometry,material);scene.add(mesh);loadState.hidden=true;document.querySelector('#factor').textContent=v.label;document.querySelector('#dimensions').textContent=`${v.metrics.widthMm.toFixed(3)} × ${v.metrics.heightMm.toFixed(3)} × ${v.metrics.depthMm.toFixed(3)} mm`;document.querySelector('#volume').textContent=`${v.metrics.volumeMm3.toFixed(3)} mm³`;document.querySelector('#hash').textContent=v.metrics.stlSha256;pointView(viewName)},undefined,e=>{if(generation===loadGeneration)loadState.textContent=`Could not load STL: ${e.message}`})
 document.querySelectorAll('[data-variant]').forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)))
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>pointView(b.dataset.view)))
document.querySelector('#flat').addEventListener('change',e=>{material.flatShading=e.target.checked;material.needsUpdate=true;render()})
controls.addEventListener('change',render);window.addEventListener('resize',resize)
resize();pointView('front')
fetch('/sowers/prototypes/scout-fidelity/geometry-report.json').then(r=>{if(!r.ok)throw Error('geometry report unavailable');return r.json()}).then(data=>{report=data;const list=document.querySelector('#variants');report.variants.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.dataset.variant='';b.setAttribute('aria-pressed','false');b.textContent=v.label;b.addEventListener('click',()=>installVariant(i));list.append(b)});installVariant(0)}).catch(e=>{loadState.textContent=`Could not load study: ${e.message}`})
