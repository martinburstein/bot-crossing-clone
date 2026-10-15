import * as THREE from 'three'
import {createRoArmWorksite} from './roarm-worksite.js'
import {createFreeCampusScene} from './free-campus-scene.js'

export const CAMPUS = Object.freeze({camp:{x:0,z:-38},melchior:{x:-27,z:-50},balthasar:{x:0,z:-53},casper:{x:28,z:-50},pilotPod:{x:-27,z:-42}})
export const campusPods=Object.freeze(Array.from({length:15},(_,i)=>Object.freeze({roleId:`r${String(i+1).padStart(2,'0')}`,x:20+(i%5)*5.3,z:-38+Math.floor(i/5)*5.4})))
export const campusSeats=Object.freeze(Array.from({length:13},(_,i)=>{const a=Math.PI*.12+i*Math.PI*1.76/12;return Object.freeze({x:Math.cos(a)*8.6,z:-38+Math.sin(a)*8.6})}))
export const freeCampusSeats=Object.freeze(Array.from({length:15},(_,i)=>{const a=i*Math.PI*2/15;return Object.freeze({x:Math.cos(a)*10,z:-38+Math.sin(a)*10})}))
export const CHARGER=Object.freeze({x:41,z:-47})

/** Scenic state follows the protocol; this module cannot command the arm. */
export function createRoArmCampus(scene) {
  const base=createRoArmWorksite(scene),group=new THREE.Group();group.name='roarm-campus';scene.add(group)
  base.camp.group.visible=false
  const materials={},geometries=new Set()
  for(const [name,color,glow] of [['stone',0x9a927b,0],['wood',0x705739,0],['leaf',0x849b62,.15],['cushion',0xd6a777,0],['dark',0x293a40,0],['blue',0x30bcff,1],['green',0x80f59b,1],['white',0xe7f8ff,.25],['water',0x67a9a8,.25],['fire',0xffb04c,1]])materials[name]=new THREE.MeshStandardMaterial({color,emissive:glow?color:0,emissiveIntensity:glow*.65,roughness:.65,metalness:name==='dark'?.4:0})
  function mesh(g,m,x,y,z,parent=group){geometries.add(g);const o=new THREE.Mesh(g,materials[m]);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  const box=(x,y,z,w,h,d,m,p)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,p)
  const cyl=(x,y,z,r,h,m,p,s=8)=>mesh(new THREE.CylinderGeometry(r,r,h,s),m,x,y,z,p)
  function beam(a,b,r,m){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const o=mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),m,...start.add(end).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o}
  function sign(text,x,y,z,color='#eaf7ee') {
    if(typeof document==='undefined')return
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#263a37';ctx.fillRect(0,0,512,96);ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,256,61)
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace
    const material=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide});const g=new THREE.PlaneGeometry(9,1.7);geometries.add(g);const o=new THREE.Mesh(g,material);o.position.set(x,y,z);o.userData.labelTexture=map;o.name=`campus-label-${text}`;group.add(o)
  }
  // Low stone terraces and an open fire circle keep all seated bodies visible.
  cyl(0,.35,-38,14,.7,'stone',group,24);cyl(0,.72,-38,12.8,.12,'wood',group,24)
  cyl(0,1,-38,2.1,.65,'stone',group,12);cyl(0,1.38,-38,1.55,.15,'dark',group,12)
  const fire=mesh(new THREE.ConeGeometry(.8,1.5,7),'fire',0,2.1,-38);fire.name='campus-hearth'
  const seats=[]
  campusSeats.forEach((p,i)=>{const seat=new THREE.Group();seat.position.set(p.x,0,p.z);seat.rotation.y=Math.atan2(-p.x,-38-p.z);seat.name=`campus-lounge-${i+1}`;group.add(seat);box(0,1,0,2.5,.6,1.8,'wood',seat);box(0,1.36,0,2.35,.2,1.6,'cushion',seat);box(0,1.8,-.65,2.5,1,.3,'cushion',seat);seats.push(seat)})
  const extraSeats=[]
  for(let i=13;i<15;i++){const p=freeCampusSeats[i],seat=new THREE.Group();seat.position.set(p.x,0,p.z);seat.name=`campus-lounge-${i+1}`;group.add(seat);box(0,1,0,2.5,.6,1.8,'wood',seat);box(0,1.36,0,2.35,.2,1.6,'cushion',seat);box(0,1.8,-.65,2.5,1,.3,'cushion',seat);seat.visible=false;extraSeats.push(seat)}
  // Warm bathhouse corner, towels, stepping stones and communal tea table.
  cyl(-17,.25,-34,5.3,.5,'stone',group,16);cyl(-17,.52,-34,4.2,.1,'water',group,16)
  for(let i=0;i<8;i++){const a=i*Math.PI/4;box(-17+Math.cos(a)*4.7,.8,-34+Math.sin(a)*4.7,1.3,1.1,1.2,'stone')}
  box(-16,1,-27,5,.3,1.5,'wood');for(let i=0;i<3;i++)box(-17+i,1.3,-27,.7,.4,1,'cushion')
  cyl(-4,1.1,-36,1.2,.2,'wood');for(let i=0;i<3;i++)cyl(-4+(i-1)*.5,1.32,-36,.14,.25,'white')
  sign('CAMPFIRE · REST & REMEMBER',0,4.2,-51)
  const cores={}
  for(const [id,color] of [['melchior','blue'],['balthasar','green'],['casper','white']]) {
    const p=CAMPUS[id],core=new THREE.Group();core.name=`campus-supercomputer-${id}`;group.add(core);core.position.set(p.x,0,p.z);cores[id]=core
    cyl(0,.5,0,4,1,'stone',core,12)
    for(let i=-1;i<=1;i++){box(i*1.6,3,0,1.35,4.4,2,'dark',core);for(let j=0;j<5;j++)box(i*1.6,1.6+j*.7,1.02,1.04,.15,.08,color,core)}
    sign(id.toUpperCase(),p.x,6.1,p.z+1.2,color==='blue'?'#6cdbff':color==='green'?'#a0ffb5':'#ffffff')
  }
  // Balthasar's permanent body: a slow rooted tree, with a warm face and canopy.
  const camper=new THREE.Group();camper.name='campus-camper-root-body';camper.position.set(0,0,-47);group.add(camper)
  mesh(new THREE.CylinderGeometry(1,1.65,4.5,7),'wood',0,2.6,0,camper)
  for(const x of [-.55,.55])box(x,3.65,1.02,.38,.18,.13,'green',camper)
  box(0,3,1.18,.6,.1,.12,'cushion',camper)
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;mesh(new THREE.IcosahedronGeometry(2.1,0),'leaf',Math.cos(a)*1.6,5.2+(i%2)*.6,Math.sin(a)*1.3,camper)}
  const roots=[],rootMeshes=[]
  for(const p of [CAMPUS.melchior,CAMPUS.balthasar,CAMPUS.casper,CAMPUS.camp,{x:0,z:-8},{x:-46,z:-22},{x:-22,z:22}]){
    const mid=[p.x*.55,.3,(-47+p.z)/2];const a=beam([0,.5,-47],mid,.22,'wood'),b=beam(mid,[p.x,.3,p.z],.15,'green');a.name=b.name='campus-energy-root';rootMeshes.push(a,b);roots.push({from:'camper',to:{...p}})
  }
  function pod(p,color,scale=1) {
    const g=new THREE.Group();g.name=`campus-pod-${p.roleId||'pilot'}`;g.position.set(p.x,0,p.z);group.add(g)
    box(0,.6,0,3.5*scale,.9,3.5*scale,'dark',g);box(0,1.08,0,2.9*scale,.12,3*scale,color,g)
    for(const side of [-1,1])box(side*1.6*scale,2.15,-.3,.2,3,3*scale,'stone',g)
    box(0,3.55,-.3,3.5*scale,.25,3.1*scale,'stone',g);box(0,2.2,-1.7*scale,3.3*scale,2.5,.18,'dark',g)
    box(0,2.6,-1.58*scale,1.7,.3,.1,color,g)
    const light=box(0,3.74,0,1.2,.08,1.2,color,g);g.userData.light=light;return g
  }
  const oldPower=[]
  const pods=campusPods.map(p=>{const g=pod(p,'white');g.userData.roleId=p.roleId;oldPower.push(beam([CAMPUS.casper.x,.18,CAMPUS.casper.z],[p.x,.18,p.z],.07,'white'));return g})
  const pilotPod=pod(CAMPUS.pilotPod,'blue',1.3);oldPower.push(beam([-27,.2,-50],[-27,.2,-42],.12,'blue'))
  const charger=new THREE.Group();charger.name='campus-independent-charger';charger.position.set(CHARGER.x,0,CHARGER.z);group.add(charger)
  box(0,.7,0,5,1.4,3,'stone',charger);box(0,2,0,4,1.5,2.2,'dark',charger);for(let i=-1;i<=1;i++)box(i*1.1,2.1,1.12,.65,.85,.1,'white',charger)
  const chargeWires=campusPods.map(p=>beam([CHARGER.x,.16,CHARGER.z],[p.x,.16,p.z],.07,'white'))
  charger.visible=false;chargeWires.forEach(w=>w.visible=false)
  const signals={}
  for(const [id,color]of [['melchior',0x30bcff],['balthasar',0x80f59b],['casper',0xe7f8ff]]){
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);geometries.add(geometry)
    const material=new THREE.LineBasicMaterial({color,transparent:true,opacity:.65});materials[`signal-${id}`]=material
    const line=new THREE.Line(geometry,material);line.name=`campus-instructions-${id}`;line.visible=false;group.add(line);signals[id]=line
  }
  const freeScene=createFreeCampusScene(scene,base)
  let projection=null,unitSlots=[],disposed=false,stale=true
  function update(data={}){
    if(!data.campus&&projection?.dispatchMode==='free-15-3A')data={...data,campus:projection,executorSlots:unitSlots.map(s=>({...s,status:'idle',occupied:false}))}
    base.update(data);stale=data.stale!==false;projection=data.campus||null;unitSlots=data.executorSlots||[];group.userData.campus=projection
    const free=projection?.dispatchMode==='free-15-3A',awake=projection?.mode==='awake'
    group.visible=!free;freeScene.update(data)
    charger.visible=free;chargeWires.forEach(w=>w.visible=free);oldPower.forEach(w=>w.visible=!free);rootMeshes.forEach(w=>w.visible=!free)
    camper.visible=!free||(awake&&Object.values(projection.free.assignments).includes('camper'))
    pilotPod.visible=!free||(awake&&Object.values(projection.free.assignments).includes('pilot'))
    for(const [i,seat]of [...seats,...extraSeats].entries()){seat.visible=free||i<13;const p=free?freeCampusSeats[i]:campusSeats[i];if(p){seat.position.set(p.x,0,p.z);seat.rotation.y=Math.atan2(-p.x,-38-p.z)}}
    for(const g of pods){g.userData.occupied=projection?.mode==='sleeping'||(free?projection.free.chargingRoleIds.includes(g.userData.roleId):projection?.chargingRoleId===g.userData.roleId);g.userData.light.scale.setScalar(g.userData.occupied?1.3:.65)}
    pilotPod.userData.occupied=!free&&['download','sleep'].includes(projection?.pilot?.instructionState)
    for(const [id,core]of Object.entries(cores)){const slot=unitSlots.find(s=>s.slotId===id);core.userData.unitState=slot?.status??'idle';core.userData.roleId=free?projection.free.assignments[id]:null}
  }
  function animate(elapsed,agents=[]){
    const free=projection?.dispatchMode==='free-15-3A'
    if(free){freeScene.animate(elapsed,agents);return}
    for(const [index,[id,core]]of Object.entries(cores).entries()){
      const running=core.userData.unitState==='running',slot=unitSlots.find(s=>s.slotId===id),signal=signals[id]
      core.children.forEach((part,i)=>{if(part.isMesh&&part.geometry.type==='BoxGeometry'&&part.position.z>1)part.scale.x=free?(.8+.2*Math.sin(elapsed*(running?5:1.2)+i*.6+index)):1})
      const bot=free&&!stale&&slot?.occupied?agents.find(a=>a.thread?.roleId===slot.roleId&&a.state!=='gone'):null
      signal.visible=Boolean(bot&&projection.mode==='awake')
      if(bot){const a=signal.geometry.attributes.position,p=CAMPUS[id];a.setXYZ(0,p.x,4,p.z+1);a.setXYZ(1,bot.pos.x,bot.pos.y+1.7,bot.pos.z);a.needsUpdate=true;signal.geometry.computeBoundingSphere();signal.material.opacity=.45+.2*Math.sin(elapsed*3)}
    }
  }
  const vec=p=>new THREE.Vector3(p.x,0,p.z)
  function target(thread,elapsed=0,agent=null){const c=projection;
    if(c?.dispatchMode==='free-15-3A')return freeScene.target(thread,elapsed,agent)
    if(c?.dispatchMode==='free-15-3A'){
      if(thread.roleId==='camper')return {position:new THREE.Vector3(0,0,-47),look:vec(CAMPUS.camp),activity:'talk'}
      if(thread.roleId==='pilot')return {position:vec(CAMPUS.pilotPod),look:vec(CAMPUS.camp),activity:'pilot-rest'}
      const i=Number(thread.roleId?.slice(1))-1,podPoint=campusPods[i]
      if(!podPoint)return null
      if(c.mode==='sleeping'||c.free.chargingRoleIds.includes(thread.roleId))return {position:vec(podPoint),look:vec(CHARGER),activity:'pilot-rest'}
      const assigned=Object.entries(c.free.assignments).find(([,r])=>r===thread.roleId)
      if(assigned)return {position:vec({x:CAMPUS[assigned[0]].x,z:CAMPUS[assigned[0]].z+7}),look:vec(CAMPUS[assigned[0]]),activity:'talk'}
      const step=Math.floor((elapsed+i*4)/22)%4
      const p=step<2?freeCampusSeats[i]:step===2?{x:-15+(i%4)*1.7,z:-27+(i%3)*1.8}:freeCampusSeats[(i+4)%15]
      return {position:vec(p),look:vec(CAMPUS.camp),activity:step<2?'talk':'stroll'}
    }
    if(thread.roleId==='camper')return {position:new THREE.Vector3(0,0,-47),look:vec(CAMPUS.camp),activity:'talk'}
    if(thread.roleId==='pilot')return {position:vec(CAMPUS.pilotPod),look:vec(CAMPUS.melchior),activity:'pilot-rest'}
    const podPoint=campusPods.find(p=>p.roleId===thread.roleId)
    if(!podPoint)return null
    if(c?.mode==='sleeping'||c?.chargingRoleId===thread.roleId||c?.activeRoleId===thread.roleId)return {position:vec(podPoint),look:vec(CAMPUS.casper),activity:'pilot-rest'}
    const index=c?.campRoleIds?.indexOf(thread.roleId)??-1,p=campusSeats[Math.max(0,index)]
    return {position:vec(p),look:vec(CAMPUS.camp),activity:'talk'}
  }
  const clearings=[{x:0,z:-40,r:19},{x:-17,z:-34,r:6},{x:-27,z:-46,r:8},{x:31,z:-37,r:17},{x:0,z:-53,r:5}]
  const current=(name,legacy)=>projection?.dispatchMode==='free-15-3A'?freeScene[name]:legacy
  return {...base,profile:'roarm-campus',campusGroup:group,freeScene,
    get pods(){return current('pods',pods)},get pilotPod(){return current('pilotPod',pilotPod)},get cores(){return current('cores',cores)},get camper(){return current('camper',camper)},roots,
    get seats(){return current('seats',seats)},get charger(){return current('charger',charger)},get signals(){return current('signals',signals)},target,update,animate,
    updateObservation(data){const result=base.updateObservation(data);if(projection?.dispatchMode==='free-15-3A')base.armModel.group.visible=false;return result},
    surfaceHeight(x,z){if(projection?.dispatchMode==='free-15-3A')return freeScene.surfaceHeight(x,z);if(campusSeats.some(p=>Math.hypot(x-p.x,z-p.z)<1.1))return 1.45;if(Math.hypot(x,z+38)<14)return .78;if(campusPods.some(p=>Math.abs(x-p.x)<1.8&&Math.abs(z-p.z)<1.8))return 1.15;if(Math.abs(x+27)<2.2&&Math.abs(z+42)<2.2)return 1.15;return base.surfaceHeight(x,z)},
    clearings:()=>projection?.dispatchMode==='free-15-3A'?freeScene.clearings():[...base.clearings(),...clearings],obstacles:()=>projection?.dispatchMode==='free-15-3A'?freeScene.obstacles():base.obstacles().filter(o=>!o.campSeat),
    dispose(){if(disposed)return;disposed=true;freeScene.dispose();base.dispose();scene.remove(group);group.traverse(o=>{if(o.userData.labelTexture){o.userData.labelTexture.dispose();o.material.dispose()}});geometries.forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose())}}
}
