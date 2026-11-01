import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {createFreeCampusScene} from '../world/free-campus-scene.js'
import {createMemorialWall} from '../world/memorial-wall.js'
import {TEAM,UNITS,assignRole,releaseRole,replaceDefinition} from './team.js'
import {createResearcher} from './researcher.js'
import './style.css'

const app=document.querySelector('#app')
app.innerHTML=`<main class="lab"><div id="world" aria-label="Grasslands spacesuit research laboratory"></div>
 <header><div class="brand-mark">K<span>✳</span></div><div><p class="eyebrow">KESTREL / FIELD NOTES 001</p><h1>A little room for big ideas.</h1><p class="subtitle">Spacesuit research, out in the grasslands.</p></div><button class="quiet" id="home" aria-label="Reset camera">↗ Overview</button></header>
 <aside class="dispatch"><div class="dispatch-heading"><span class="eyebrow">THE SUPERCOMPUTERS</span><span id="capacity">0 / 3 hired</span></div><div id="slots"></div><p class="preview-note">A visual sample. Hiring here stages a role; it doesn’t launch a model.</p></aside>
 <section class="selection" aria-live="polite"><span id="selected-number"></span><div><p class="eyebrow" id="selected-role"></p><h2 id="selected-name"></h2><p id="selected-focus"></p></div><label class="file-button">Replace role file<input id="role-file" type="file" accept=".md,.txt,text/plain,text/markdown"/></label><span id="file-state"></span></section>
 <footer><div class="roster-heading"><div><span class="eyebrow">YOUR RESEARCH TEAM</span><p>15 different suits. Any role, on demand.</p></div><span class="roster-hint">Choose a resident, then hire into an open unit.</span></div><nav id="roster" aria-label="Choose a researcher"></nav></footer><div class="toast" id="notice" role="status" hidden></div></main>`
const storageKey='botcrossing.kestrel-field-lab.v1'
let selected='r01',slots={},definitions={}
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');for(const unit of UNITS)if(TEAM.some(r=>r.id===saved.slots?.[unit])&&!Object.values(slots).includes(saved.slots[unit]))slots[unit]=saved.slots[unit];for(const p of TEAM)if(typeof saved.definitions?.[p.id]?.text==='string'&&saved.definitions[p.id].text.length<=65536)definitions[p.id]=saved.definitions[p.id]}catch{}
const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify({slots,definitions}))}catch{notify('Browser storage is unavailable; this session still works.')}}
function notify(text){const el=document.querySelector('#notice');el.textContent=text;el.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.hidden=true,4500)}
const stage=document.querySelector('#world'),scene=new THREE.Scene();scene.background=new THREE.Color('#dce8cf');scene.fog=new THREE.Fog('#dce8cf',150,330)
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;stage.append(renderer.domElement)
const camera=new THREE.OrthographicCamera(-60,60,60,-60,.1,600)
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=1.25;controls.minPolarAngle=.25;controls.minZoom=.7;controls.maxZoom=3;controls.enablePan=true
function home(){controls.target.set(7,0,-9);camera.position.set(10,145,160);camera.zoom=1.10;camera.updateProjectionMatrix();controls.update()}
home();document.querySelector('#home').onclick=home
scene.add(new THREE.HemisphereLight(0xf4f5dc,0x6e8a55,1.6));const sun=new THREE.DirectionalLight(0xfff0d4,1.9);sun.position.set(-45,90,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:220});sun.shadow.normalBias=.06;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun)
const groundGeo=new THREE.PlaneGeometry(550,550,80,80);groundGeo.rotateX(-Math.PI/2);const pos=groundGeo.attributes.position,colors=[]
for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),outside=Math.max(0,Math.hypot(x,z+5)-67);pos.setY(i,Math.sin(x*.034)*Math.cos(z*.028)*Math.min(9,outside*.07)-.12);const c=new THREE.Color().lerpColors(new THREE.Color('#578845'),new THREE.Color('#82a65d'),.5+.22*Math.sin(x*.13)*Math.cos(z*.11));colors.push(c.r,c.g,c.b)}
groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));groundGeo.computeVertexNormals();const ground=new THREE.Mesh(groundGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));ground.receiveShadow=true;ground.name='grasslands';scene.add(ground)
// Reuse the actual three supercomputer monuments and common hearth, stripping all other campus scenery in this view only.
const campus=createFreeCampusScene(scene,{group:new THREE.Group()},{sharpLabels:true});const keep=new Set(['free-campus-common',...UNITS.map(u=>`campus-supercomputer-${u}`)])
for(const child of [...campus.group.children])if(!keep.has(child.name))child.removeFromParent()
campus.group.visible=true
const camp=campus.group.getObjectByName('free-campus-common');camp.position.set(0,0,12);camp.scale.setScalar(.65)
for(const child of [...camp.children])if(/^camp-resident-seat-(16|17)$/.test(child.name))child.removeFromParent()
const unitPositions={melchior:[25,-11],balthasar:[0,-35],casper:[-25,-11]}
for(const [id,core]of Object.entries(campus.cores)){core.position.set(unitPositions[id][0],0,unitPositions[id][1]);core.rotation.y=0;core.scale.setScalar(.70)}
const wall=createMemorialWall(scene);wall.group.scale.set(.66,.8,.52);wall.group.position.z=9;wall.crate.visible=false
// Existing wall marks are read-only and only loaded when this local installation has an archive.
fetch('/api/financial-office/memorials').then(r=>r.ok?r.json():null).then(d=>{if(Array.isArray(d?.entries))wall.update(d.entries);else if(Array.isArray(d))wall.update(d)}).catch(()=>{})
let seed=317;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const blades=new THREE.InstancedMesh(new THREE.ConeGeometry(.09,.6,3),new THREE.MeshStandardMaterial({color:0x6d914c,roughness:1}),1600);const dummy=new THREE.Object3D()
for(let i=0;i<1600;i++){let x,z;do{x=(random()-.5)*145;z=(random()-.5)*135-8}while(Math.abs(x)<42&&z>-49&&z<37);dummy.position.set(x,.1,z);dummy.rotation.y=random()*Math.PI;dummy.scale.setScalar(.6+random());dummy.updateMatrix();blades.setMatrixAt(i,dummy.matrix)}scene.add(blades)
const crew=TEAM.map(createResearcher);crew.forEach(a=>scene.add(a.root))
const campHomes=TEAM.map((_,i)=>{const angle=i/15*Math.PI*2;return new THREE.Vector3(Math.sin(angle)*15.8,0,12+Math.cos(angle)*12.8)})
const labels=crew.map(a=>{const el=document.createElement('button');el.className='resident-label';el.textContent=a.profile.name;el.style.setProperty('--role-color',a.profile.color);el.onclick=()=>select(a.profile.id);stage.append(el);return el})
function select(id){selected=id;renderUi()}
function renderUi(){
 const p=TEAM.find(p=>p.id===selected),occupied=Object.values(slots),full=occupied.length===3
 document.querySelector('#capacity').textContent=`${occupied.length} / 3 hired`
 document.querySelector('#selected-number').textContent=p.id.slice(1).padStart(2,'0');document.querySelector('#selected-number').style.background=p.color
 document.querySelector('#selected-name').textContent=p.name;document.querySelector('#selected-role').textContent=p.role;document.querySelector('#selected-focus').textContent=p.focus
 document.querySelector('#file-state').textContent=definitions[p.id]?`Role file · v${definitions[p.id].generation}`:'Role file · loading'
 document.querySelector('#roster').innerHTML=TEAM.map(r=>`<button class="role-card ${r.id===selected?'selected':''} ${occupied.includes(r.id)?'hired':''}" data-role="${r.id}" aria-pressed="${r.id===selected}" style="--role-color:${r.color}"><span class="suit-icon">◉<i></i></span><span><strong>${r.name}</strong><small>${r.role}</small></span><em>${occupied.includes(r.id)?'HIRED':r.id.slice(1)}</em></button>`).join('')
 document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>select(b.dataset.role))
 document.querySelector('#slots').innerHTML=UNITS.map((u,i)=>{const role=TEAM.find(r=>r.id===slots[u]);return `<div class="unit"><span class="unit-light ${role?'on':''}"></span><div><strong>${u[0].toUpperCase()+u.slice(1)}</strong><small>${role?`${role.name} / ${role.role}`:'Open unit · choose a resident'}</small></div><button data-unit="${u}" ${!role&&(full||occupied.includes(selected))?'disabled':''}>${role?'Release':'Hire'}</button></div>`}).join('')
 document.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>{const u=b.dataset.unit;try{slots=slots[u]?releaseRole(slots,u):assignRole(slots,u,selected);save();renderUi()}catch(e){notify(e.message)}})
 for(const [id,core]of Object.entries(campus.cores)){const role=TEAM.find(r=>r.id===slots[id]);for(const child of core.children)if(child.userData.draw&&child.geometry?.parameters?.width===20)child.userData.draw(id.toUpperCase(),role?`${role.name.toUpperCase()} / PREVIEW`:'OPEN UNIT / CHOOSE A ROLE');core.userData.unitState=role?'preview':'idle'}
}
document.querySelector('#role-file').onchange=async event=>{const f=event.target.files[0];if(!f)return;const id=selected;try{if(f.size>65536)throw Error('Choose a role file under 64 KiB');definitions=replaceDefinition(definitions,id,await f.text());save();renderUi();notify(`${TEAM.find(p=>p.id===id).name} has a new role file. Nothing was executed.`)}catch(e){notify(e.message)}event.target.value=''}
Promise.all(TEAM.map(async p=>{if(definitions[p.id])return;try{const r=await fetch(p.file);if(!r.ok)throw Error('Missing role file');const text=await r.text();if(!definitions[p.id])definitions=replaceDefinition(definitions,p.id,text)}catch{definitions=replaceDefinition(definitions,p.id,`# ${p.role}\n${p.focus}\nPresentation only; await an explicit research assignment.`)}})).then(()=>renderUi())
renderUi()
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null
renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY})
renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const rect=stage.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(crew.map(a=>a.root),true)[0];if(hit){let o=hit.object;while(o&&!o.userData.roleId)o=o.parent;if(o)select(o.userData.roleId)}})
function resize(){const w=stage.clientWidth,h=stage.clientHeight,aspect=w/h;camera.left=-61*aspect;camera.right=61*aspect;camera.top=61;camera.bottom=-61;camera.updateProjectionMatrix();renderer.setSize(w,h)}
new ResizeObserver(resize).observe(stage);resize()
const clock=new THREE.Clock(),point=new THREE.Vector3();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime
 crew.forEach((a,i)=>{const unit=UNITS.find(u=>slots[u]===a.profile.id);if(unit){const [x,z]=unitPositions[unit];a.target.set(x,0,z+12.2)}else{const home=campHomes[i],phase=reduced?0:Math.sin(t*.17+i)*.65;a.target.set(home.x+Math.sin(i*2.7)*phase,0,home.z+Math.cos(i*2.7)*phase)}
  if(!a.initialized){a.root.position.copy(campHomes[i]);a.initialized=true}
  const distance=Math.hypot(a.target.x-a.root.position.x,a.target.z-a.root.position.z),moving=distance>.12
  if(moving){const direction=a.target.clone().sub(a.root.position);direction.y=0;direction.normalize();a.root.position.addScaledVector(direction,Math.min(distance,dt*5));const yaw=Math.atan2(direction.x,direction.z);a.root.rotation.y+=Math.atan2(Math.sin(yaw-a.root.rotation.y),Math.cos(yaw-a.root.rotation.y))*Math.min(1,dt*7)}else{const look=unit?new THREE.Vector3(unitPositions[unit][0],0,unitPositions[unit][1]):new THREE.Vector3(0,0,12);const yaw=Math.atan2(look.x-a.root.position.x,look.z-a.root.position.z);a.root.rotation.y+=Math.atan2(Math.sin(yaw-a.root.rotation.y),Math.cos(yaw-a.root.rotation.y))*Math.min(1,dt*2)}
  if(!reduced)a.animate(t,moving,!!unit);a.halo.material.opacity=(a.profile.id===selected ? .85 : .18)
  point.copy(a.root.position).y+=5.6;point.project(camera);const x=(point.x*.5+.5)*stage.clientWidth,y=(-point.y*.5+.5)*stage.clientHeight;labels[i].style.transform=`translate(-50%,-50%) translate(${x}px,${y}px)`;labels[i].hidden=(a.profile.id!==selected&&!unit)||point.z>1||point.z< -1;labels[i].classList.toggle('active',a.profile.id===selected)
 })
 const flame=camp.getObjectByName('campfire');if(flame&&!reduced)flame.scale.set(1.7,2.2+Math.sin(t*4)*.15,1.7)
 for(const core of Object.values(campus.cores))for(const [i,lamp]of core.userData.lamps.entries())lamp.scale.x=.8+Math.sin(t*.8+i)*.15
 controls.update();renderer.render(scene,camera)
}
animate()
