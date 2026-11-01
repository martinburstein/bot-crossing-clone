import * as THREE from 'three'
import {createLabRuntime} from './runtime.js'
import {createFreeCampusScene} from '../world/free-campus-scene.js'
import {createFloatingIsland} from './island.js'
import {createFlower,flowerPosition} from './flowers.js'
import {createRenewal,restoreRenewal,nextTrio,idleWaves,beginPreviewWave,finishPreviewWave,finishPlanting} from './renewal.js'
import {TEAM,UNITS,assignRole,releaseRole,replaceDefinition} from './team.js'
import {createResearchTeam} from './researcher.js'
import {createWorkshop} from './workshop.js'
import {FACILITIES,WORKPLACES,previewPhase} from './facilities.js'
import './style.css'

const app=document.querySelector('#app')
app.innerHTML=`<main class="lab"><div id="world" aria-label="Grasslands spacesuit research laboratory"></div>
 <header><div class="brand-mark">K<span>✳</span></div><div><p class="eyebrow">KESTREL / FIELD NOTES 003</p><h1>A little island for big ideas.</h1><p class="subtitle">One suit. A whole world of tools.</p></div><div class="view-actions"><button class="quiet" id="garden-button" aria-expanded="false" aria-controls="garden">Garden</button><button class="quiet" id="lab-tour" aria-expanded="false" aria-controls="equipment">＋ Lab tour</button><button class="quiet" id="home" aria-label="Reset camera">↗ Overview</button></div></header>
 <aside class="dispatch"><div class="dispatch-heading"><span class="eyebrow">THE SUPERCOMPUTERS</span><span id="capacity">0 / 3 hired</span></div><div id="slots"></div><p class="preview-note">A visual sample. Hiring here stages a role; it doesn’t launch a model.</p></aside>
 <section class="selection" aria-live="polite"><span id="selected-number"></span><div><p class="eyebrow" id="selected-role"></p><h2 id="selected-name"></h2><p id="selected-focus"></p><p id="coat-name"></p></div><button id="view-uniform">View uniform ↗</button><label class="file-button">Replace role file<input id="role-file" type="file" accept=".md,.txt,text/plain,text/markdown"/></label><span id="file-state"></span></section>
 <aside id="equipment" class="equipment" aria-label="Laboratory equipment" hidden><div class="equipment-heading"><div><p class="eyebrow">THE SHARED WORKSHOP</p><h2>Every tool they need.</h2></div><button id="close-equipment" aria-label="Close lab tour">×</button></div><nav id="facility-list" aria-label="Test and fabrication bays"></nav><div id="facility-detail"></div><button id="preview-cycle">Preview cycle</button><div class="cycle-track"><span id="cycle-progress"></span></div><p id="cycle-status" role="status">Animated equipment preview · no measurements.</p></aside>
 <aside id="garden" class="equipment garden" aria-label="Flower garden and renewal ritual" hidden><div class="equipment-heading"><div><p class="eyebrow">THE FLOWER GARDEN</p><h2>A little life, remembered.</h2></div><button id="close-garden" aria-label="Close garden">×</button></div><p class="garden-contract">3 working · 9 holding context · 3 planting.<br>Same fifteen bodies. A fresh agent after the flower.</p><div id="garden-state" role="status"></div><div id="garden-pool"></div><div id="garden-history"></div><label class="handoff-label" for="handoff-note">A note for the next generation</label><textarea id="handoff-note" rows="2" maxlength="4000" placeholder="Optional handoff note for this preview trio"></textarea><button id="garden-action"></button><p class="garden-preview">Lifecycle preview · no model calls or research completions.</p></aside>
 <p class="camera-help">Drag to pan · Right-drag to rotate · Scroll to zoom <button id="orbit" aria-pressed="false">Orbit</button></p><footer><div class="roster-heading"><div><span class="eyebrow">YOUR DEPARTMENT HEADS</span><p>15 specialties. Building one suit together.</p></div><span class="roster-hint">Choose a resident, then hire into an open unit.</span></div><nav id="roster" aria-label="Choose a researcher"></nav></footer><div class="toast" id="notice" role="status" hidden></div></main>`
const storageKey='botcrossing.kestrel-field-lab.v1'
let selected='r01',slots={},definitions={}
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');for(const unit of UNITS)if(TEAM.some(r=>r.id===saved.slots?.[unit])&&!Object.values(slots).includes(saved.slots[unit]))slots[unit]=saved.slots[unit];for(const p of TEAM)if(typeof saved.definitions?.[p.id]?.text==='string'&&saved.definitions[p.id].text.length<=65536)definitions[p.id]=saved.definitions[p.id]}catch{}
const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify({slots,definitions}))}catch{notify('Browser storage is unavailable; this session still works.')}}
const gardenKey='botcrossing.kestrel.renewal-preview.v1'
let renewal=createRenewal(),gardenError=null,gardenFlower=null
try{const raw=localStorage.getItem(gardenKey);if(raw)renewal=restoreRenewal(JSON.parse(raw))}catch(e){gardenError=e.message}
if(renewal.phase==='working')slots=Object.fromEntries(UNITS.map((u,i)=>[u,renewal.active[i]]))
const saveGarden=()=>{try{localStorage.setItem(gardenKey,JSON.stringify(renewal))}catch{notify('Garden storage is unavailable; keep this page open to retain this preview.')}}
function notify(text){const el=document.querySelector('#notice');el.textContent=text;el.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.hidden=true,4500)}
const stage=document.querySelector('#world'),runtime=createLabRuntime(stage)
const {engine,rig,scene,camera,renderer}=runtime
document.querySelector('#orbit').onclick=()=>{document.querySelector('#orbit').setAttribute('aria-pressed',String(rig.toggleOrbit()))}
scene.background=new THREE.Color('#dce8de');scene.fog=new THREE.Fog('#dce8de',280,650)
const home=()=>runtime.home()
scene.add(new THREE.HemisphereLight(0xf4f5dc,0x6e8a55,1.6));const sun=new THREE.DirectionalLight(0xfff0d4,1.9);sun.position.set(-45,90,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:220});sun.shadow.normalBias=.06;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun)
createFloatingIsland(scene)
// Reuse the actual three supercomputer monuments and common hearth, stripping all other campus scenery in this view only.
const campus=createFreeCampusScene(scene,{group:new THREE.Group()},{sharpLabels:true});const keep=new Set(['free-campus-common',...UNITS.map(u=>`campus-supercomputer-${u}`)])
for(const child of [...campus.group.children])if(!keep.has(child.name))child.removeFromParent()
campus.group.visible=true
const camp=campus.group.getObjectByName('free-campus-common');camp.position.set(-29,0,39);camp.scale.setScalar(.43)
for(const child of [...camp.children])if(/^camp-resident-seat-(16|17)$/.test(child.name))child.removeFromParent()
const unitPositions={melchior:[-36,-49],balthasar:[-12,-52],casper:[12,-49]}
for(const [id,core]of Object.entries(campus.cores)){core.position.set(unitPositions[id][0],0,unitPositions[id][1]);core.rotation.y=0;core.scale.setScalar(.48)}
// The island has no perimeter wall and never reads or modifies old memorials.
const flowers=new Map()
function syncFlowers(){for(const [i,record]of [...renewal.flowers,...renewal.pending].entries())if(!flowers.has(record.id)){const f=createFlower(record,i);if(renewal.pending.some(p=>p.id===record.id))f.root.scale.setScalar(0);flowers.set(record.id,f);scene.add(f.root)}}
syncFlowers()
const workshop=createWorkshop(scene)
let facilityId='assembly',cycleStart=null,elapsed=0
function closeEquipment(){document.querySelector('#equipment').hidden=true;document.querySelector('.lab').classList.remove('inspecting');document.querySelector('#lab-tour').setAttribute('aria-expanded','false');workshop.select(null)}
function closeGarden(){document.querySelector('#garden').hidden=true;document.querySelector('.lab').classList.remove('remembering');document.querySelector('#garden-button').setAttribute('aria-expanded','false')}
function openGarden(focus=true){closeEquipment();document.querySelector('#garden').hidden=false;document.querySelector('.lab').classList.add('remembering');document.querySelector('#garden-button').setAttribute('aria-expanded','true');renderGarden();if(focus)runtime.focus(new THREE.Vector3(9,1,43),{distance:130,polar:1})}
function renderGarden(){
 const names=ids=>ids.map(id=>TEAM.find(p=>p.id===id).name).join(', ')
 document.querySelector('#garden-state').textContent=gardenError?`Saved state needs review: ${gardenError}`:`Preview wave ${renewal.nextWave} · ${renewal.flowers.length} flowers${renewal.pending.length?' · three planting':''}`
 document.querySelector('#garden-pool').innerHTML=TEAM.map(p=>{const b=renewal.bodies[p.id],planting=renewal.pending.some(f=>f.bodyId===p.id),working=renewal.active.includes(p.id);return `<span class="pool-body ${working?'working':planting?'planting':''}" title="${p.name}: generation ${b.generation}; ${idleWaves(renewal,p.id)} idle waves">${p.name}<small>G${b.generation} · ${working?'work':planting?'plant':b.lastWave===null?'fresh':`${idleWaves(renewal,p.id)}/3 idle`}</small></span>`}).join('')
 const record=renewal.flowers.find(f=>f.id===gardenFlower)||renewal.flowers.at(-1),history=document.querySelector('#garden-history');history.replaceChildren()
 const title=document.createElement('strong');title.textContent=record?`${TEAM.find(p=>p.id===record.bodyId).name} · generation ${record.generation}`:'The field is waiting.';history.append(title)
 const detail=document.createElement('p');detail.textContent=record?(record.notes.length?record.notes.map(n=>n.text).join('\n'):'No handoff note was entered for this preview generation.'):`Next trio: ${names(nextTrio(renewal))}. First flowers appear during preview wave 5, after three idle stages.`;history.append(detail)
 const note=document.querySelector('#handoff-note');note.disabled=renewal.phase!=='working'
 const button=document.querySelector('#garden-action');button.disabled=Boolean(gardenError)||renewal.pending.length>0;button.textContent=renewal.pending.length?'The retiring trio is planting…':renewal.phase==='working'?`Finish preview wave ${renewal.nextWave}`:`Start preview wave ${renewal.nextWave}`
}
document.querySelector('#garden-button').onclick=()=>document.querySelector('#garden').hidden?openGarden():closeGarden()
document.querySelector('#close-garden').onclick=closeGarden
document.querySelector('#garden-action').onclick=()=>{try{if(renewal.phase==='working'){renewal=finishPreviewWave(renewal,document.querySelector('#handoff-note').value);slots={};document.querySelector('#handoff-note').value=''}else{renewal=beginPreviewWave(renewal);slots=Object.fromEntries(UNITS.map((u,i)=>[u,renewal.active[i]]));syncFlowers()}saveGarden();save();renderUi();renderGarden()}catch(e){notify(e.message)}}
function inspectFacility(id,focus=true){closeGarden();facilityId=id;const f=FACILITIES.find(f=>f.id===id);document.querySelector('#equipment').hidden=false;document.querySelector('.lab').classList.add('inspecting');document.querySelector('#lab-tour').setAttribute('aria-expanded','true');workshop.select(id);cycleStart=null;workshop.setActive(null)
 document.querySelector('#facility-list').innerHTML=FACILITIES.map((f,i)=>`<button data-facility="${f.id}" aria-pressed="${f.id===id}" style="--facility-color:${f.color}"><span>${String(i+1).padStart(2,'0')}</span>${f.name}</button>`).join('')
 document.querySelectorAll('[data-facility]').forEach(b=>b.onclick=()=>inspectFacility(b.dataset.facility))
 document.querySelector('#facility-detail').innerHTML=`<p>${f.description}</p><ul>${f.equipment.map(e=>`<li>${e}</li>`).join('')}</ul>`
 document.querySelector('#preview-cycle').textContent=`▶ ${f.cycle}`;document.querySelector('#preview-cycle').disabled=false;document.querySelector('#cycle-status').textContent='Animated equipment preview · no measurements.';document.querySelector('#cycle-progress').style.width='0%'
 if(focus)runtime.focus(workshop.stations.get(id).focus.clone().add(new THREE.Vector3(12,0,0)),{distance:145})
}
document.querySelector('#lab-tour').onclick=()=>document.querySelector('#equipment').hidden?inspectFacility(facilityId,false):closeEquipment()
document.querySelector('#close-equipment').onclick=closeEquipment
document.querySelector('#home').onclick=()=>{closeEquipment();closeGarden();home()}
document.querySelector('#preview-cycle').onclick=()=>{cycleStart=elapsed;workshop.setActive(facilityId);document.querySelector('#preview-cycle').disabled=true;document.querySelector('#cycle-status').textContent='Visual sequence running · no measurements.'}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeEquipment();closeGarden()}})
const researchTeam=await createResearchTeam(scene,TEAM)
const crew=researchTeam.residents;crew.forEach(a=>scene.add(a.root))
document.querySelector('#view-uniform').onclick=()=>{const a=crew.find(a=>a.profile.id===selected),yaw=a.root.rotation.y,right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));runtime.focus(a.root.position.clone().add(new THREE.Vector3(0,3,0)).addScaledVector(right,4),{distance:32,azimuth:yaw,polar:1.03})}
const campHomes=WORKPLACES.map(p=>new THREE.Vector3(p.x,.45,p.z))
function deliveryPath(home){
 const points=home.z>18?[[home.x,33],[-25,33],[-25,14]]:home.x>-25&&home.z>0?[[home.x,14],[-25,14]]:[[-25,home.z],[-25,14]]
 return [home.clone(),...points.map(([x,z])=>new THREE.Vector3(x,.45,z)),new THREE.Vector3(-23,.45,14),new THREE.Vector3(-23,.45,8)]
}
function plantingPath(home,p){
 const points=home.z>18?[[home.x,36]]:home.x>-25&&home.z>0?[[home.x,14],[-25,14],[-25,36]]:[[-25,home.z],[-25,36]]
 return [home.clone(),...points.map(([x,z])=>new THREE.Vector3(x,.45,z)),new THREE.Vector3(p.x,0,39),new THREE.Vector3(p.x,0,p.z+2.5)]
}
const labels=crew.map(a=>{const el=document.createElement('button');el.className='resident-label';el.textContent=a.profile.name;el.style.setProperty('--role-color',a.profile.color);el.onclick=()=>select(a.profile.id);stage.append(el);return el})
function select(id){selected=id;closeEquipment();closeGarden();renderUi()}
function renderUi(){
 const p=TEAM.find(p=>p.id===selected),occupied=Object.values(slots),full=occupied.length===3
 document.querySelector('#capacity').textContent=`${occupied.length} / 3 hired`
 document.querySelector('#selected-number').textContent=p.id.slice(1).padStart(2,'0');document.querySelector('#selected-number').style.background=p.color
 document.querySelector('#selected-name').textContent=p.name;document.querySelector('#selected-role').textContent=p.title;document.querySelector('#selected-focus').textContent=p.focus;document.querySelector('#coat-name').textContent=`${p.coat.name} coat · ${p.coat.detail}`
 document.querySelector('#file-state').textContent=definitions[p.id]?`Role file · v${definitions[p.id].generation}`:'Role file · loading'
 document.querySelector('#roster').innerHTML=TEAM.map(r=>`<button class="role-card ${r.id===selected?'selected':''} ${occupied.includes(r.id)?'hired':''}" data-role="${r.id}" aria-pressed="${r.id===selected}" style="--role-color:${r.color}"><span class="suit-icon">◉<i></i></span><span><strong>${r.name}</strong><small>${r.role}</small></span><em>${occupied.includes(r.id)?'HIRED':r.id.slice(1)}</em></button>`).join('')
 document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>select(b.dataset.role))
 document.querySelector('#slots').innerHTML=UNITS.map((u,i)=>{const role=TEAM.find(r=>r.id===slots[u]);return `<div class="unit"><span class="unit-light ${role?'on':''}"></span><div><strong>${u[0].toUpperCase()+u.slice(1)}</strong><small>${role?`${role.name} / ${role.role}`:'Open unit · choose a resident'}</small></div><button data-unit="${u}" ${renewal.phase==='working'||!role&&(full||occupied.includes(selected))?'disabled':''}>${renewal.phase==='working'?'On wave':role?'Release':'Hire'}</button></div>`}).join('')
 document.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>{const u=b.dataset.unit;try{slots=slots[u]?releaseRole(slots,u):assignRole(slots,u,selected);save();renderUi()}catch(e){notify(e.message)}})
 for(const [id,core]of Object.entries(campus.cores)){const role=TEAM.find(r=>r.id===slots[id]);for(const child of core.children)if(child.userData.draw&&child.geometry?.parameters?.width===20)child.userData.draw(id.toUpperCase(),role?`${role.name.toUpperCase()} / PREVIEW`:'OPEN UNIT / CHOOSE A ROLE');core.userData.unitState=role?'preview':'idle'}
}
document.querySelector('#role-file').onchange=async event=>{const f=event.target.files[0];if(!f)return;const id=selected;try{if(f.size>65536)throw Error('Choose a role file under 64 KiB');definitions=replaceDefinition(definitions,id,await f.text());save();renderUi();notify(`${TEAM.find(p=>p.id===id).name} has a new role file. Nothing was executed.`)}catch(e){notify(e.message)}event.target.value=''}
Promise.all(TEAM.map(async p=>{if(definitions[p.id])return;try{const r=await fetch(p.file);if(!r.ok)throw Error('Missing role file');const text=await r.text();if(!definitions[p.id])definitions=replaceDefinition(definitions,p.id,text)}catch{definitions=replaceDefinition(definitions,p.id,`# ${p.role}\n${p.focus}\nPresentation only; await an explicit research assignment.`)}})).then(()=>renderUi())
renderUi()
const pickPoint=new THREE.Vector3();let down=null
renderer.domElement.addEventListener('pointerdown',e=>down=e.button===0&&!e.shiftKey&&!e.ctrlKey&&!e.altKey?{x:e.clientX,y:e.clientY}:null)
renderer.domElement.addEventListener('pointercancel',()=>down=null)
renderer.domElement.addEventListener('pointerup',e=>{const start=down;down=null;if(!start||!rig.wasClick||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;const rect=stage.getBoundingClientRect();let nearest=null,best=22;for(const a of crew){pickPoint.copy(a.root.position).y+=3.8;pickPoint.project(camera);if(Math.abs(pickPoint.z)>1)continue;const distance=Math.hypot((pickPoint.x*.5+.5)*rect.width-(e.clientX-rect.left),(-pickPoint.y*.5+.5)*rect.height-(e.clientY-rect.top));if(distance<best){best=distance;nearest=a}}if(nearest){select(nearest.profile.id);return}const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const blossom=ray.intersectObjects([...flowers.values()].map(f=>f.root),true)[0];if(blossom){let o=blossom.object;while(o&&!o.userData.flowerId)o=o.parent;if(o){gardenFlower=o.userData.flowerId;openGarden(false);return}}const hit=ray.intersectObjects([...workshop.stations.values()].map(s=>s.bay),true)[0];if(hit){let o=hit.object;while(o&&!o.userData.facilityId)o=o.parent;if(o)inspectFacility(o.userData.facilityId)}})
const point=new THREE.Vector3(),reduced=runtime.settings.get('reducedMotion')
function animate(dt,t){
 rig.update(dt)
 document.querySelector('#orbit').setAttribute('aria-pressed',String(rig.orbiting))
 elapsed=t
 crew.forEach((a,i)=>{const unit=UNITS.find(u=>slots[u]===a.profile.id),planting=renewal.pending.find(f=>f.bodyId===a.profile.id),held=renewal.phase==='working'?renewal.flowers.find(f=>f.bodyId===a.profile.id&&f.plantedDuringWave===renewal.nextWave):null,ritual=planting||held;const visitor=!ritual&&!reduced&&Math.floor(t/64)%15===i;const deliveryStage=`${Math.floor(t/32)}`
  if(ritual){const flower=flowers.get(ritual.id);if(a.ritualId!==ritual.id){a.ritualId=ritual.id;a.plantTime=0;a.plantPath=plantingPath(campHomes[i],flower.position);a.plantIndex=held?a.plantPath.length-1:0}if(a.root.position.distanceTo(a.plantPath[a.plantIndex])<.4&&a.plantIndex<a.plantPath.length-1)a.plantIndex++;a.target.copy(a.plantPath[a.plantIndex]);if(held)a.target.set(flower.position.x+3.4,0,flower.position.z+3.5);a.delivery=null}
  else if(unit){a.ritualId=null;a.delivery=null;const [x,z]=unitPositions[unit];a.target.set(x,0,z+8)}else if(visitor){a.ritualId=null;if(a.delivery!==deliveryStage){a.delivery=deliveryStage;a.path=deliveryPath(campHomes[i]);if(t%64>=32)a.path.reverse();a.pathIndex=0}if(a.root.position.distanceTo(a.path[a.pathIndex])<.4&&a.pathIndex<a.path.length-1)a.pathIndex++;a.target.copy(a.path[a.pathIndex])}else{a.ritualId=null;a.delivery=null;const home=campHomes[i],phase=reduced?0:Math.sin(t*.17+i)*.25;a.target.set(home.x+Math.sin(i*2.7)*phase,.45,home.z+Math.cos(i*2.7)*phase)}
  if(!a.initialized){a.root.position.copy(campHomes[i]);a.initialized=true}
  const distance=Math.hypot(a.target.x-a.root.position.x,a.target.z-a.root.position.z),moving=distance>.12
  if(moving){const direction=a.target.clone().sub(a.root.position);direction.y=0;direction.normalize();a.root.position.addScaledVector(direction,Math.min(distance,dt*5));const yaw=Math.atan2(direction.x,direction.z);a.root.rotation.y+=Math.atan2(Math.sin(yaw-a.root.rotation.y),Math.cos(yaw-a.root.rotation.y))*Math.min(1,dt*7)}else{const station=workshop.stations.get(visitor?'assembly':WORKPLACES[i].facility).focus;const look=ritual?flowers.get(ritual.id).root.position:unit?new THREE.Vector3(unitPositions[unit][0],0,unitPositions[unit][1]):station;const yaw=Math.atan2(look.x-a.root.position.x,look.z-a.root.position.z);a.root.rotation.y+=Math.atan2(Math.sin(yaw-a.root.rotation.y),Math.cos(yaw-a.root.rotation.y))*Math.min(1,dt*2)}
  a.root.position.y=a.target.y
  a.animate(t,moving,!!unit,dt,reduced,ritual?'plant':WORKPLACES[i].facility==='assembly'?'tinker':'board');a.halo.material.opacity=(a.profile.id===selected ? .85 : .18)
  if(planting&&!moving&&a.plantIndex===a.plantPath.length-1){a.plantTime+=dt;const growth=Math.min(1,a.plantTime/2.5);flowers.get(planting.id).root.scale.setScalar(growth*growth*(3-2*growth))}
  labels[i].textContent=`${a.profile.name} · G${renewal.bodies[a.profile.id].generation}`
  point.copy(a.root.position).y+=5.6;point.project(camera);const x=(point.x*.5+.5)*stage.clientWidth,y=(-point.y*.5+.5)*stage.clientHeight;labels[i].style.transform=`translate(-50%,-50%) translate(${x}px,${y}px)`;labels[i].hidden=(a.profile.id!==selected&&!unit)||point.z>1||point.z< -1;labels[i].classList.toggle('active',a.profile.id===selected)
 })
 if(renewal.pending.length&&renewal.pending.every(f=>crew.find(a=>a.profile.id===f.bodyId)?.plantTime>=3.5)){renewal=finishPlanting(renewal,renewal.pending.map(f=>f.id));saveGarden();renderGarden();renderUi()}
 const flame=camp.getObjectByName('campfire');if(flame&&!reduced)flame.scale.set(1.7,2.2+Math.sin(t*4)*.15,1.7)
 for(const core of Object.values(campus.cores))for(const [i,lamp]of core.userData.lamps.entries())lamp.scale.x=.8+Math.sin(t*.8+i)*.15
 if(cycleStart!==null){const phase=previewPhase(cycleStart,t);document.querySelector('#cycle-progress').style.width=`${phase.progress*100}%`;if(!phase.active){cycleStart=null;workshop.setActive(null);document.querySelector('#preview-cycle').disabled=false;document.querySelector('#cycle-status').textContent='Preview complete · no test data generated.'}}
 scene.fog.near=rig.distance+45;scene.fog.far=rig.distance+320
 engine.setFocusDistance(rig.distance)
 workshop.update(t,reduced);researchTeam.flush(t)
}
engine.add({update:animate})
engine.start()
