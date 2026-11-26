import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createSower } from './avatar.js'
import { createHelmet } from './helmet.js'
import { createMissionBase } from './base.js'
import { createCheckpointExpansion } from './expansion.js'
import { observedConstruction, constructionStages } from './progress.mjs'
import { DESIGN_THREADS, mergeBroadcastThreads, visibleThreads } from './telemetry.mjs'
import { shouldRender } from './render-budget.mjs'
import './style.css'

const $ = selector => document.querySelector(selector)
const params = new URLSearchParams(location.search)
const app = $('#app'), host = $('#scene')
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
let mode = params.get('preview') === '1' ? 'demo' : 'live'
let threads = [], visible = [], selectedId = null, lastScan = 0, warnings = []
let broadcast = false, follow = false, orbit = false, paused = reducedMotion, stale = false
const entries = new Map(), slots = new Map()
let renderer, scene, camera, controls
const labels = { working: 'Working in the field', review: 'Ready for review', waiting: 'Waiting for you',
  idle: 'At the outpost', complete: 'Reported complete', error: 'Needs attention' }
const positions = [[-10, 3], [1, -10], [12, 4], [-21, -10], [17, -12], [-8, 18], [8, 20], [-25, 8], [27, 6]]
const clock = new THREE.Clock()
const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster()
const target = new THREE.Vector3(), desiredTarget = new THREE.Vector3()
let focusPending = false
let polling = false, modeVersion = 0
let page = 0, pageThreads = []
let lastBroadcastThreads = [], broadcastConfigured = false
let compact = innerWidth <= 700, compactFramedId = null
let renderDirty=true,lastRender=-Infinity,wasHidden=false
let updatingControls=false

function element(tag, className, value) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (value !== undefined) node.textContent = value
  return node
}
function colorCss(color) { return `#${new THREE.Color(color).getHexString()}` }
function notify(message) {
  $('#notice').textContent = message
  $('#notice').hidden = false
  clearTimeout(notify.timer)
  notify.timer = setTimeout(() => { $('#notice').hidden = true }, 6000)
}

function mesh(geometry, color, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color,roughness:.85}))
  object.position.set(x,y,z)
  object.castShadow = object.receiveShadow = true
  return object
}

function setupScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#e9dfcf')
  scene.fog = new THREE.Fog('#e9dfcf', 65, 140)
  camera = new THREE.PerspectiveCamera(37, 1, .1, 220)
  camera.position.set(33, 31, 41)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25
  host.append(renderer.domElement)
  renderer.domElement.setAttribute('aria-label', 'Sowers base. Drag to orbit, scroll to zoom, select a Sower to inspect.')
  renderer.domElement.tabIndex=0
  renderer.domElement.setAttribute('role','img')
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = .06
  controls.minDistance = 8
  controls.maxDistance = 110
  controls.maxPolarAngle = Math.PI * .47
  controls.minPolarAngle = .15
  controls.target.set(0, 0, 0)
  controls.addEventListener('start', () => { focusPending = false; setFollow(false);renderDirty=true })
  controls.addEventListener('change', () => {if(!updatingControls)renderDirty=true})
  renderer.domElement.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key))return
    event.preventDefault();setFollow(false);focusPending=false
    const offset=camera.position.clone().sub(controls.target)
    if(event.key==='ArrowLeft' || event.key==='ArrowRight')offset.applyAxisAngle(new THREE.Vector3(0,1,0),event.key==='ArrowLeft'?.12:-.12)
    else if(event.key==='+' || event.key==='=')offset.multiplyScalar(.9)
    else if(event.key==='-')offset.multiplyScalar(1.1)
    else offset.y=Math.max(2,offset.y+(event.key==='ArrowUp'?1:-1))
    offset.clampLength(controls.minDistance,controls.maxDistance)
    camera.position.copy(controls.target).add(offset);controls.update()
  })
  scene.add(new THREE.HemisphereLight('#fff3d4', '#8b6756', 2.7))
  const sun = new THREE.DirectionalLight('#fff0d5', 3.5)
  sun.position.set(-22, 38, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048,2048)
  Object.assign(sun.shadow.camera, {left:-45,right:45,top:45,bottom:-45,near:1,far:100})
  sun.shadow.normalBias = .03
  sun.shadow.bias = -.0002
  sun.shadow.radius = 4
  scene.add(sun)
  const ground = mesh(new THREE.CylinderGeometry(100,100,1,96), '#bf8e70',0,-.52,0)
  scene.add(ground)
  const clearing = mesh(new THREE.CylinderGeometry(28,29,.04,80), '#cfa88a',0,.008,0)
  clearing.receiveShadow = true
  scene.add(clearing)
  let randomSeed = 1125
  const rand = () => { randomSeed = Math.imul(randomSeed,1664525) + 1013904223 | 0; return (randomSeed>>>0)/4294967296 }
  const rockGeo = new THREE.IcosahedronGeometry(1,0)
  const rockMat = new THREE.MeshStandardMaterial({color:'#ad8068',roughness:1,flatShading:true})
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 240)
  const dummy = new THREE.Object3D()
  for(let i=0;i<240;i++) {
    const a=rand()*Math.PI*2,r=30+rand()*55,s=.2+rand()*.9
    dummy.position.set(Math.cos(a)*r,-.03,Math.sin(a)*r)
    dummy.scale.set(s,.3+s*.7,s*.7)
    dummy.rotation.set(rand(),rand()*6,rand())
    dummy.updateMatrix(); rocks.setMatrixAt(i,dummy.matrix)
  }
  rocks.castShadow = rocks.receiveShadow = true
  scene.add(rocks)
  for(let i=0;i<13;i++) {
    const a=i/13*Math.PI*2,r=72+rand()*15
    const mountain=mesh(new THREE.ConeGeometry(8+rand()*8,7+rand()*10,5),'#bd9b82',Math.sin(a)*r,2,Math.cos(a)*r)
    mountain.scale.z=.6;scene.add(mountain)
  }
  // Mission marker is scenery; it never implies a completed task.
  const hub = new THREE.Group()
  hub.name='mission-marker'
  hub.add(mesh(new THREE.CylinderGeometry(2.4,2.8,.35,8),'#4a554d',0,.15,0))
  hub.add(mesh(new THREE.CylinderGeometry(.07,.07,4,10),'#e1dfce',0,2.3,0))
  const flag = mesh(new THREE.BoxGeometry(1.25,.65,.04),'#d77642',.62,3.75,0)
  hub.add(flag)
  const accent = mesh(new THREE.BoxGeometry(.32,.32,.05),'#f6edce',.45,3.75,.03)
  accent.rotation.z=Math.PI/4;hub.add(accent)
  scene.add(hub)
  new ResizeObserver(resize).observe(host)
  resize()
  let down
  renderer.domElement.addEventListener('pointerdown', e => { down=[e.clientX,e.clientY] })
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX-down[0],e.clientY-down[1])>6) return
    const rect=renderer.domElement.getBoundingClientRect()
    pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1)
    raycaster.setFromCamera(pointer,camera)
    for(const hit of raycaster.intersectObjects([...entries.values()].map(x=>x.group),true)) {
      let object=hit.object
      while(object && !object.userData.sowerId) object=object.parent
      if(object?.userData.sowerId){select(object.userData.sowerId);break}
    }
  })
}

function resize() {
  renderDirty=true
  if(!renderer) return
  camera.aspect=host.clientWidth/host.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(host.clientWidth,host.clientHeight)
  const nextCompact=innerWidth<=700
  if(nextCompact!==compact) {
    compact=nextCompact;compactFramedId=null
    for(const entry of entries.values())entry.group.visible=!compact || entry.thread.id===selectedId
    const hub=scene.getObjectByName('mission-marker');if(hub)hub.visible=!compact
    if(compact)focusSelected()
    else {controls.target.set(0,0,0);camera.position.set(33,31,41);focusPending=false}
  }
}

function disposeEntry(entry) {
  scene.remove(entry.group)
  entry.label.remove()
  entry.expansion.userData.dispose()
  const geometries=new Set(),materials=new Set()
  entry.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m)})
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())
}

function renderWorld() {
  renderDirty=true
  if(!renderer) return
  const desired=new Set(pageThreads.map(t=>t.id))
  for(const [id,entry] of entries) if(!desired.has(id)){disposeEntry(entry);entries.delete(id)}
  const occupied=new Set([...entries.values()].map(e=>e.slot))
  for(const thread of pageThreads) {
    const observation=observedConstruction(thread)
    let entry=entries.get(thread.id)
    if(!entry) {
      let slot=slots.get(thread.id)
      if(slot===undefined || occupied.has(slot)) slot=positions.findIndex((_,i)=>!occupied.has(i))
      occupied.add(slot);slots.set(thread.id,slot)
      const [x,z]=positions[slot]
      const group=new THREE.Group();group.position.set(x,0,z);group.userData.sowerId=thread.id
      const base=createMissionBase({seed:thread.id,progress:observation.fraction ?? .12,kind:['habitat','power','relay'][thread.seed%3],color:thread.color})
      group.add(base)
      const expansion=createCheckpointExpansion({seed:thread.id,color:thread.color});group.add(expansion)
      const avatar=createSower({color:thread.color,seed:thread.seed,helmetFactory:createHelmet})
      avatar.position.set(-2.2,.03,4.2);avatar.scale.setScalar(1);group.add(avatar)
      const ring=mesh(new THREE.RingGeometry(.8,.86,40),'#f9e6ac')
      ring.rotation.x=-Math.PI/2;ring.position.set(-2.2,.04,4.2);group.add(ring)
      const label=element('div','ground-label');host.append(label)
      entry={group,base,expansion,avatar,ring,label,slot,thread,observation}
      entries.set(thread.id,entry);scene.add(group)
    }
    entry.thread=thread;entry.observation=observation
    entry.base.userData.setProgress(observation.fraction ?? .12)
    entry.expansion.userData.setCheckpoints(thread.checkpoints)
    entry.label.textContent=thread.name.slice(0,24).toUpperCase()
    entry.ring.visible=thread.id===selectedId
    entry.group.visible=!compact || thread.id===selectedId
    if(paused)for(let i=0;i<16;i++)entry.avatar.userData.animate?.(0,.1,{status:stale?'idle':thread.status,selected:thread.id===selectedId})
  }
}

function drawRoster() {
  const roster=$('#roster'),focusedId=roster.contains(document.activeElement)?document.activeElement.dataset.id:null
  roster.replaceChildren()
  $('#crew-count').textContent=String(visible.length).padStart(2,'0')
  if(!visible.length) roster.append(element('div','empty',mode==='live'?'No matching sessions. Try another search, or open Design preview to explore the Sowers.':'No matching Sowers.'))
  for(const thread of pageThreads) {
    const row=element('button',`crew-row${thread.id===selectedId?' selected':''}`)
    row.dataset.id=thread.id
    row.setAttribute('aria-pressed',String(thread.id===selectedId))
    const icon=element('span','crew-icon');icon.style.setProperty('--suit',colorCss(thread.color))
    const text=element('span','crew-text')
    text.append(element('strong','',thread.name),element('small','',thread.project))
    const dot=element('span',`status-dot ${thread.status}`);dot.title=labels[thread.status]
    row.append(icon,text,dot);row.addEventListener('click',()=>select(thread.id));roster.append(row)
  }
  const shown=pageThreads.length
  $('#pagination').hidden=visible.length<=9
  $('#previous').disabled=page===0
  $('#next').disabled=(page+1)*9>=visible.length
  $('#page-label').textContent=`${page*9+1}–${page*9+shown} of ${visible.length}`
  $('#roster-note').textContent=`${mode==='demo'?'Illustrative fixtures':'Read-only · 8 second refresh'}${visible.length>shown?` · showing ${shown} of ${visible.length}`:''}`
  if(focusedId)[...roster.querySelectorAll('button')].find(button=>button.dataset.id===focusedId)?.focus({preventScroll:true})
}

function drawDetail() {
  renderDirty=true
  const thread=visible.find(t=>t.id===selectedId)
  const detail=$('#detail');detail.replaceChildren()
  if(!thread){detail.append(element('h2','','Waiting for a signal'),element('p','','Select an agent or open Design preview.'));return}
  const observation=observedConstruction(thread)
  detail.append(element('h2','',thread.name),element('div','detail-project',thread.project),
    element('span',`status-pill ${thread.status}`,stale || thread.broadcastStale?'Last observed · signal stale':labels[thread.status]),
    element('p','',thread.preview || thread.title || 'No task description reported.'))
  if(thread.activity?.text) {
    const activityTime=thread.activity.at?new Date(thread.activity.at).toLocaleString([],{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'source time not reported'
    detail.append(element('div','detail-divider'),element('div','eyebrow','LATEST PUBLIC ACTIVITY'),element('p','micro',`Source record · ${activityTime}`),element('p','activity-message',thread.activity.kind==='tool'?`Last tool: ${thread.activity.text}`:thread.activity.text))
  }
  detail.append(element('div','detail-divider'))
  const progressLabel=element('div','progress-label')
  progressLabel.append(element('span','','BASE CONSTRUCTION'),element('strong','',observation.fraction===null?'Unmeasured':`${Math.round(observation.fraction*100)}%`))
  detail.append(progressLabel)
  const track=element('div','progress-track');track.setAttribute('aria-label',observation.label)
  track.setAttribute('role',observation.fraction===null?'img':'progressbar')
  if(observation.fraction!==null){track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(Math.round(observation.fraction*100)))}
  for(const stage of constructionStages) track.append(element('i',observation.fraction!==null && observation.fraction>=stage.end?'done':''))
  detail.append(track,element('p','micro',observation.fraction===null?'Scaffold reserved. Reported checkpoints add cargo; task completion has no measured denominator.':`${observation.label}. This measure comes from the source record.`))
  const checkpointTitle=element('div','eyebrow',`${thread.checkpoints.length} REPORTED CHECKPOINT${thread.checkpoints.length===1?'':'S'}`)
  detail.append(checkpointTitle)
  for(const milestone of thread.checkpoints.slice(-3)) detail.append(element('div','checkpoint',milestone.title || milestone.name || 'Checkpoint reported'))
  const observed=thread.broadcastObservedAt?new Date(thread.broadcastObservedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''
  const provenance=thread.source==='broadcast'?`Checkpoint broadcast · ${thread.broadcastStale?'historical':'observed'} ${observed}`
    :`${thread.harnessName || thread.harness || 'Local session'} · ${thread.gitBranch || 'branch not reported'}${thread.broadcastMeasured?` · checkpoint broadcast ${observed}`:''}`
  detail.append(element('p','micro',mode==='demo'?'DESIGN PREVIEW · fictional agents and fixed construction stages':provenance))
  if(mode==='live' && thread.broadcastEvidenceStale)detail.append(element('p','source-warning','Checkpoint broadcast is stale. Native session lifecycle is observed independently.'))
}

function update() {
  visible=visibleThreads(threads,$('#search').value,mode==='demo'?'all':$('#scope').value)
  page=Math.min(page,Math.max(0,Math.ceil(visible.length/9)-1))
  pageThreads=visible.slice(page*9,(page+1)*9)
  if(!pageThreads.some(t=>t.id===selectedId)) selectedId=pageThreads[0]?.id || null
  renderWorld();drawRoster();drawDetail()
  if(compact && compactFramedId!==selectedId){focusSelected();compactFramedId=selectedId}
  if(scene?.getObjectByName('mission-marker'))scene.getObjectByName('mission-marker').visible=!compact
  $('#activity-count').textContent=visible.filter(t=>t.status==='working').length
  $('#checkpoint-count').textContent=visible.reduce((sum,t)=>sum+t.checkpoints.length,0)
  $('#scene-caption').textContent=mode==='demo'?'MARS / DESIGN PREVIEW':'MARS / LOCAL AGENT OUTPOST'
  $('#source-note').textContent=mode==='demo'?'Illustrative agents · fixed stages · no live work represented':'Live local sessions · task completion is shown only when measured'
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode))})
  $('#source-description').textContent=mode==='demo'?'Design preview: three fictional agents and fixed construction stages.':`Native local session records${broadcastConfigured?' plus configured checkpoint broadcast':'; checkpoint broadcast is not configured'}. Last scan ${lastScan?new Date(lastScan).toLocaleTimeString():'pending'}.`
  $('#source-warnings').replaceChildren(...(mode==='live'?warnings:[]).map(warning=>element('li','',warning)))
  $('#source-info').textContent=mode==='live' && warnings.length?'ⓘ !':'ⓘ'
}

async function poll() {
  if(mode!=='live' || polling)return
  polling=true
  const version=modeVersion
  try {
    const [response,broadcastResponse]=await Promise.all([
      fetch('/api/threads',{cache:'no-store',signal:AbortSignal.timeout(20000)}),
      fetch('/api/sowers/broadcast',{cache:'no-store',signal:AbortSignal.timeout(10000)}).catch(()=>null),
    ])
    if(!response.ok)throw Error(`Local observer returned ${response.status}`)
    const body=await response.json()
    let broadcastBody
    try {
      if(!broadcastResponse?.ok)throw Error('Checkpoint broadcast could not be read')
      broadcastBody=await broadcastResponse.json()
      if(!Array.isArray(broadcastBody.threads))throw Error('Checkpoint broadcast returned an invalid observation')
      broadcastConfigured=Boolean(broadcastBody.configured)
      lastBroadcastThreads=broadcastBody.threads
    } catch(error) {
      broadcastBody={threads:lastBroadcastThreads.map(thread=>({...thread,running:false,broadcastStale:true})),warnings:[`${error.message}. Any retained broadcast observation is historical.`]}
    }
    if(!Array.isArray(body.threads))throw Error('Local observer returned an invalid session list')
    if(mode!=='live' || version!==modeVersion)return
    threads=mergeBroadcastThreads(body.threads,broadcastBody.threads || []);lastScan=Date.now();stale=false;warnings=[...(body.warnings || []),...(broadcastBody.warnings || [])]
    $('#connection').textContent=warnings.length?'Local signal · source warning':'Local signal connected'
    $('#connection').className='live'
    $('#connection').title=warnings.join('\n')
    update()
  } catch(error) {
    if(mode!=='live' || version!==modeVersion)return
    stale=true
    $('#connection').textContent='Local signal unavailable'
    $('#connection').className='error'
    $('#connection').title=error.message
    drawDetail()
    if(!threads.length)$('#roster').replaceChildren(element('div','empty','Could not read local sessions. The design preview is available while the connection is restored.'))
  } finally {polling=false}
}

function select(id) {
  selectedId=id;drawRoster();drawDetail()
  for(const entry of entries.values())entry.ring.visible=entry.thread.id===id
  if(compact)for(const entry of entries.values())entry.group.visible=entry.thread.id===id
  focusSelected()
}
function focusSelected() {
  renderDirty=true
  if(!controls)return
  const entry=entries.get(selectedId)
  if(!entry)return
  desiredTarget.copy(entry.group.position).add(new THREE.Vector3(0,1,1.5))
  focusPending=true
  if(compact) {
    desiredTarget.z-=1.5
    controls.target.copy(desiredTarget)
    camera.position.copy(desiredTarget).add(new THREE.Vector3(20,22,32))
    focusPending=false;compactFramedId=selectedId
    return
  }
  const direction=camera.position.clone().sub(controls.target).normalize()
  camera.position.copy(controls.target).addScaledVector(direction,23)
}
function setFollow(value){follow=value;$('#follow').setAttribute('aria-pressed',String(follow))}
function setBroadcast(value) {
  broadcast=value;app.classList.toggle('broadcast',value);$('#exit-broadcast').hidden=!value
  $('#broadcast').setAttribute('aria-pressed',String(value));resize()
  if(value)notify(mode==='demo'?'Broadcast composition · design preview':'Broadcast composition · local sessions · press Esc to exit')
}

function animate(timestamp=performance.now()) {
  requestAnimationFrame(animate)
  if(mode==='live' && lastScan && Date.now()-lastScan>30000 && !stale){stale=true;$('#connection').textContent='Signal stale · last observation';$('#connection').className='error';drawDetail()}
  if(!renderer)return
  const controlDelta=Math.min((timestamp-(animate.lastCallback??timestamp))/1000,.05)
  animate.lastCallback=timestamp
  if(document.hidden){clock.getDelta();wasHidden=true;return}
  if(wasHidden){clock.getDelta();wasHidden=false;renderDirty=true}
  controls.autoRotate=orbit && !paused
  controls.autoRotateSpeed=.35
  updatingControls=true
  const controlsMoved=controls.update(controlDelta)
  updatingControls=false
  const cameraMoving=controlsMoved || focusPending || follow && !paused
  if(!shouldRender({now:timestamp,lastRender,paused,dirty:renderDirty,cameraMoving,hidden:document.hidden}))return
  const delta=Math.min(clock.getDelta(),.05)
  lastRender=timestamp;renderDirty=false
  if(!paused)animate.elapsed=(animate.elapsed||0)+delta
  const elapsed=animate.elapsed || 0
  for(const entry of entries.values()) {
    if(!entry.group.visible){entry.label.hidden=true;continue}
    const active=!stale && !entry.thread.broadcastStale && entry.thread.status==='working'
    const phase=elapsed*.4+entry.slot*2
    const moving=active && Math.sin(phase)>.55
    if(!paused) {
      const x=-2.2+(moving?Math.sin(elapsed*1.3+entry.slot)*.7:0)
      entry.avatar.position.x=THREE.MathUtils.damp(entry.avatar.position.x,x,5,delta)
      entry.avatar.rotation.y=THREE.MathUtils.damp(entry.avatar.rotation.y,moving?Math.sin(elapsed*1.3+entry.slot)*.3:Math.sin(phase)*.14,5,delta)
      entry.avatar.userData.animate?.(elapsed,delta,{status:stale || entry.thread.broadcastStale?'idle':entry.thread.status,moving,selected:entry.thread.id===selectedId})
      entry.base.userData.animate?.(elapsed,delta)
    }
    entry.ring.position.x=entry.avatar.position.x
  }
  if(follow && entries.has(selectedId)) {
    const entry=entries.get(selectedId)
    desiredTarget.copy(entry.group.position).add(entry.avatar.position)
    focusPending=true
  }
  if(focusPending) {
    target.copy(controls.target).lerp(desiredTarget,1-Math.exp(-delta*3))
    const offset=target.clone().sub(controls.target)
    camera.position.add(offset);controls.target.copy(target)
    if(target.distanceTo(desiredTarget)<.02 && !follow)focusPending=false
  }
  camera.lookAt(controls.target)
  camera.updateMatrixWorld()
  for(const entry of entries.values()) {
    if(!entry.group.visible)continue
    const labelPosition=entry.group.position.clone().add(new THREE.Vector3(0,.1,5.7)).project(camera)
    entry.label.hidden=labelPosition.z>1 || labelPosition.z< -1
    entry.label.style.left=`${(labelPosition.x*.5+.5)*host.clientWidth}px`
    entry.label.style.top=`${(-labelPosition.y*.5+.5)*host.clientHeight}px`
    entry.label.style.transform='translate(-50%,-50%)'
  }
  renderer.render(scene,camera)
}

try {setupScene()} catch(error) {
  host.append(element('div','fallback',`The 3D view could not start. ${error.message}. The agent roster remains available.`))
  for(const button of document.querySelectorAll('.scene-controls button'))button.disabled=true
}
$('#search').addEventListener('input',()=>{page=0;update()})
$('#scope').addEventListener('change',()=>{page=0;update()})
$('#previous').addEventListener('click',()=>{page--;update()})
$('#next').addEventListener('click',()=>{page++;update()})
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
  mode=button.dataset.mode;modeVersion++;threads=mode==='demo'?DESIGN_THREADS:[];stale=false;selectedId=null;page=0
  $('#connection').textContent=mode==='demo'?'Design preview · fictional agents':'Connecting to local agents'
  $('#connection').className='';update();if(mode==='live')poll()
}))
$('#overview').addEventListener('click',()=>{setFollow(false);focusPending=false;controls?.target.set(0,0,0);camera?.position.set(33,31,41)})
$('#follow').addEventListener('click',()=>{setFollow(!follow);if(follow)focusSelected()})
$('#orbit').addEventListener('click',()=>{orbit=!orbit;$('#orbit').setAttribute('aria-pressed',String(orbit))})
$('#motion').setAttribute('aria-pressed',String(paused))
$('#motion').innerHTML=paused?'▶ <span>Resume motion</span>':'Ⅱ <span>Pause motion</span>'
$('#motion').setAttribute('aria-label',paused?'Resume motion':'Pause motion')
$('#motion').addEventListener('click',()=>{paused=!paused;$('#motion').setAttribute('aria-pressed',String(paused));$('#motion').innerHTML=paused?'▶ <span>Resume motion</span>':'Ⅱ <span>Pause motion</span>';$('#motion').setAttribute('aria-label',paused?'Resume motion':'Pause motion')})
$('#broadcast').addEventListener('click',()=>setBroadcast(!broadcast))
$('#source-info').addEventListener('click',()=>{
  $('#source-notes').hidden=!$('#source-notes').hidden
  $('#source-info').setAttribute('aria-expanded',String(!$('#source-notes').hidden))
})
$('#exit-broadcast').addEventListener('click',()=>setBroadcast(false))
addEventListener('keydown',event=>{if(event.key==='Escape')setBroadcast(false)})
if(mode==='demo') {threads=DESIGN_THREADS;$('#connection').textContent='Design preview · fictional agents'}
update();poll();setInterval(poll,8000);animate()
if(params.get('broadcast')==='1')setBroadcast(true)
