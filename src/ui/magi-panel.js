import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {VEHICLES,createVehicle} from '../world/mars-vehicles.js'
import {vehicleJob,VEHICLE_JOBS} from '../game/vehicle-jobs.js'
import {MAGI_CLUSTERS,tokenConstruction,magiOnShift,magiShiftLabel} from '../game/magi-world.js'
import {crewRig} from '../agents/crew.js'
import {createPilotPreview} from '../agents/pilot-preview.js'
import './magi.css'
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
const number=n=>n.toLocaleString('en-US')

export class MagiPanel {
  constructor(root,colony,select,focus) {
    this.colony=colony;this.select=select;this.focus=focus;this.shells=[]
    this.el=el('section',undefined,'magi-panel');this.el.setAttribute('aria-label','15-3A mission control')
    const eyebrow=el('p','BOT CROSSING  /  ROARM WORKSITE','magi-eyebrow')
    const header=el('header');this.heading=el('h1','Swarm 15–3A');this.rosterTag=el('span','15 / 3','magi-tag');header.append(this.heading,this.rosterTag)
    this.status=el('p','Preparing the worksite…','magi-connection')
    const rule=el('div',undefined,'magi-rules');rule.append(el('span','One shared RoArm worksite'),el('span','Blockers → reviewed fixes → service credits'))
    this.total=el('p','','magi-total')
    const garage=el('button','Explore the vehicle hangar','magi-hangar-button');garage.onclick=()=>this.openHangar()
    const runs=el('select',undefined,'magi-run-selector');runs.setAttribute('aria-label','Saved runs');runs.append(new Option('Live world',''))
    fetch('/api/magi/archives').then(r=>r.json()).then(data=>{for(const run of data.runs||[])runs.append(new Option(run.label,run.id));runs.value=new URLSearchParams(location.search).get('run')||''}).catch(()=>{})
    runs.onchange=()=>{const url=new URL(location.href);if(runs.value)url.searchParams.set('run',runs.value);else url.searchParams.delete('run');location.assign(url)}
    this.groups=el('div',undefined,'magi-groups')
    const caption=el('p','Three computers. Fifteen personas. One shared camp.','magi-caption');this.caption=caption
    this.el.append(eyebrow,header,this.status,rule,this.total,garage,runs,this.groups,caption);root.append(this.el)
    this.root=root
  }
  update(shells,{stale=false,standby=false,replay=null}={}) {
    this.shells=shells
    this.flags={stale,standby,replay}
    const working=shells.filter(magiOnShift).length
    const campus=shells.some(s=>s.worldProfile==='roarm-campus')
    const dedicated=campus||shells.some(s=>s.worldProfile==='roarm-16')
    this.heading.textContent=campus?'RoArm � Campus':dedicated?'RoArm · 16 personas':'Swarm 15–3A';this.rosterTag.textContent=campus?'15 + 2 / 3':dedicated?'16 / 3':'15 / 3'
    this.caption.textContent=campus?'One pilot. One camper. Fifteen executor skills, one Casper.':dedicated?'One captain. Two independent role choices. 225 ordered symbioses.':'Three computers. Fifteen personas. One shared camp.'
    this.status.textContent=stale?'Connection unavailable · crew off shift':standby?'Standby · connect Swarm to begin':dedicated?`${working} / 3 sessions active · pilot duty shown separately`:`${working} / 3 sessions active · ${15-working} personas resting`
    this.status.dataset.state=stale?'stale':working?'live':'standby'
    if(replay)this.status.textContent=`${replay} replay · no live workers`
    const plans=shells.map(tokenConstruction),total=plans.reduce((n,p)=>n+p.tokens,0),measured=plans.filter(p=>p.measured).length
    this.total.textContent=`${campus?'1 pilot + 1 camper + 15 executors':dedicated?'1 pilot + 15 shared roles':'15 shared hexagons'} · ${measured?number(total)+' measured tokens':'usage not yet available'}`
    const signature=JSON.stringify(shells.map(s=>[s.shellId,s.shellName,s.shellStatus,s.tokenUsage,s.vehicleId,s.assignmentState,s.taskTitle,s.assignmentRole]))+stale
    if(signature===this.signature)return
    this.signature=signature
    const open=new Set([...this.groups.querySelectorAll('details[open]')].map(g=>g.dataset.cluster))
    this.groups.replaceChildren()
    for(const cluster of [...MAGI_CLUSTERS,...(dedicated&&!campus?[{id:'roles',name:'Shared role library'}]:[])]) {
      const details=el('details');details.dataset.cluster=cluster.id;details.open=open.has(cluster.id)
      const crew=shells.filter(s=>s.clusterId===cluster.id),summary=el('summary')
      const label=el('span',cluster.name),count=el('small',dedicated?(cluster.id==='roles'?'Available personas':`${crew.filter(magiOnShift).length} active · 1 session`):`${crew.filter(magiOnShift).length} active · 5 bots`)
      summary.append(label,count);details.append(summary)
      const fly=el('button','Go to crew','magi-link');fly.onclick=()=>this.focus(cluster.id);details.append(fly)
      for(const shell of crew) {
        const row=el('article',undefined,'magi-worker'),name=el('button',`${shell.shellId.toUpperCase()}  ${shell.shellName}`,'magi-worker-name')
        name.onclick=()=>this.select(shell.id)
        const p=tokenConstruction(shell),status=el('span',magiShiftLabel(shell),'magi-worker-status')
        const progress=el('p',p.measured?`${number(p.tokens)} measured tokens`:'Token usage unavailable','magi-worker-progress')
        row.append(name,status,progress)
        if(dedicated&&shell.rolePurpose)row.append(el('small',shell.rolePurpose))
        if(p.measured) {
          if(shell.tokenUsage.cached)row.append(el('small','Last measured usage · awaiting fresh receipt'))
          if(shell.tokenUsage.persistenceWarning)row.append(el('small','Usage cache could not be saved; keep receipts available'))
          if(shell.tokenUsage.pendingTurns)row.append(el('small',`${shell.tokenUsage.pendingTurns} turn(s) await usage receipts`))
        }
        const job=vehicleJob(shell,this.colony.astronauts.magiLife.choices[shell.shellId]||shell.vehicleId)
        if(magiOnShift(shell)&&!stale&&(!campus||shell.slotId==='casper'))row.append(el('p',`Visual mission: ${job.label}`,'magi-worker-progress'))
        const select=el('select');select.setAttribute('aria-label',`Vehicle preference for ${shell.shellName}`)
        for(const v of VEHICLES){const option=el('option',v.name);option.value=v.id;if(job.contextual&&v.id!==job.vehicle){option.disabled=true;option.title='This mission needs a different vehicle'}if(v.id==='defender'&&!job.meteorAlert){option.disabled=true;option.title='Available for an incoming meteor alert'}select.append(option)}
        select.value=job.vehicle
        select.onchange=()=>this.choose(shell.shellId,select.value)
        if(!campus||/^r/.test(shell.roleId||''))row.append(select);details.append(row)
      }
      this.groups.append(details)
    }
  }
  choose(workerId,vehicleId) {
    const life=this.colony.astronauts.magiLife
    life.choose(workerId,vehicleId);life.sync(this.colony.astronauts.agents,this.colony.astronauts.world);this.colony._rebuildNavigation()
  }
  openHangar() {
    if(this.hangar){this.hangar.hidden=false;this.resizeGarage();return}
    const modal=this.hangar=el('section',undefined,'vehicle-hangar');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Mars Mission vehicle hangar')
    const header=el('header'),head=el('div');head.append(el('p','ASTRONAUT FLEET  /  2007','magi-eyebrow'),el('h2','Vehicle hangar'))
    const close=el('button','Close ×');close.onclick=()=>{modal.hidden=true;this.el.querySelector('button').focus()};header.append(head,close)
    const body=el('div',undefined,'hangar-body'),catalog=el('nav',undefined,'vehicle-catalog');catalog.setAttribute('aria-label','Choose a vehicle')
    const view=el('div',undefined,'vehicle-view');this.canvas=el('canvas');this.canvas.setAttribute('aria-label','Interactive 3D vehicle preview; drag to rotate, scroll to zoom')
    this.vehicleTitle=el('h3');this.vehicleCue=el('p');this.vehicleSet=el('p',undefined,'magi-caption')
    const assign=el('div',undefined,'vehicle-assign'),label=el('label','Assign to ');this.workerSelect=el('select');this.workerSelect.setAttribute('aria-label','Bot receiving vehicle')
    for(const s of this.shells){const option=el('option',`${s.shellId.toUpperCase()} · ${s.shellName}`);option.value=s.shellId;this.workerSelect.append(option)}
    const equip=el('button','Save vehicle preference');equip.onclick=()=>{this.choose(this.workerSelect.value,this.vehicleId);equip.textContent='Preference saved ✓';this.signature=null;this.update(this.shells,this.flags)}
    assign.append(label,this.workerSelect,equip)
    view.append(this.canvas,this.vehicleTitle,this.vehicleCue,this.vehicleSet,assign,el('small','Drag to inspect · scroll to zoom. Three active missions at most. Vehicles park as soon as work stops; defense requires a meteor alert.'))
    for(const spec of VEHICLES){const b=el('button',spec.name);b.dataset.vehicle=spec.id;b.onclick=()=>{this.showVehicle(spec.id);equip.textContent='Save vehicle preference'};catalog.append(b)}
    body.append(catalog,view);modal.append(header,body);this.root.append(modal)
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0x18242c,1);this.renderer.toneMapping=THREE.ACESFilmicToneMapping
    this.garageScene=new THREE.Scene();this.garageScene.add(new THREE.HemisphereLight(0xffefd3,0x465f73,3))
    const sun=new THREE.DirectionalLight(0xfff1de,4);sun.position.set(4,7,5);this.garageScene.add(sun)
    const rim=new THREE.DirectionalLight(0x9dd4e3,2);rim.position.set(-4,2,-4);this.garageScene.add(rim)
    if(crewRig())this.pilot=createPilotPreview(this.garageScene,this.colony.settings,crewRig())
    this.garageCamera=new THREE.PerspectiveCamera(38,1,.1,80);this.garageCamera.position.set(4.5,3.4,5)
    this.controls=new OrbitControls(this.garageCamera,this.canvas);this.controls.target.set(0,1,0);this.controls.enableDamping=true;this.controls.minDistance=3;this.controls.maxDistance=16;this.controls.maxPolarAngle=Math.PI*.49
    this.resizeObserver=new ResizeObserver(()=>this.resizeGarage());this.resizeObserver.observe(this.canvas)
    modal.addEventListener('keydown',e=>{if(e.key==='Escape')close.click()})
    this.showVehicle(VEHICLES[0].id);this.resizeGarage();close.focus()
  }
  showVehicle(id) {
    if(this.vehicle){this.garageScene.remove(this.vehicle);this.vehicle.userData.dispose()}
    this.vehicleId=id;this.vehicle=createVehicle(id);this.garageScene.add(this.vehicle)
    const bounds=new THREE.Box3().setFromObject(this.vehicle),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3())
    const distance=Math.max(size.x,size.z,size.y)*1.6;this.controls.target.copy(center);this.garageCamera.position.copy(center).add(new THREE.Vector3(.62,.46,.72).applyAxisAngle(new THREE.Vector3(0,1,0),this.vehicle.userData.seatYaw).normalize().multiplyScalar(distance));this.controls.update()
    const spec=this.vehicle.userData.spec;this.vehicleTitle.textContent=spec.name;this.vehicleCue.textContent=spec.cue;this.vehicleSet.textContent=`Set ${spec.set} · ${VEHICLE_JOBS[id].label} · ${spec.kind==='air'?'Flight-capable':'Surface vehicle'}`
    for(const button of this.hangar.querySelectorAll('[data-vehicle]'))button.setAttribute('aria-pressed',String(button.dataset.vehicle===id))
  }
  resizeGarage() {if(!this.canvas||this.hangar.hidden)return;const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.garageCamera.aspect=w/h;this.garageCamera.updateProjectionMatrix()}
  tick(time) {if(!this.hangar||this.hangar.hidden)return;this.controls.update();const reduced=this.colony.settings.get('reducedMotion');this.vehicle?.userData.animate(time,true,reduced);if(this.vehicle)this.pilot?.update(reduced?0:time,this.vehicle.userData.seat,this.vehicle.userData.seatYaw);this.renderer.render(this.garageScene,this.garageCamera)}
}
