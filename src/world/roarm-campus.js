import * as THREE from 'three'
import {createRoArmWorksite} from './roarm-worksite.js'

export const CAMPUS = Object.freeze({camp:{x:0,z:-38},melchior:{x:-27,z:-50},balthasar:{x:0,z:-53},casper:{x:28,z:-50},pilotPod:{x:-27,z:-42}})
export const campusPods=Object.freeze(Array.from({length:15},(_,i)=>Object.freeze({roleId:`r${String(i+1).padStart(2,'0')}`,x:20+(i%5)*5.3,z:-38+Math.floor(i/5)*5.4})))
export const campusSeats=Object.freeze(Array.from({length:13},(_,i)=>{const a=Math.PI*.12+i*Math.PI*1.76/12;return Object.freeze({x:Math.cos(a)*8.6,z:-38+Math.sin(a)*8.6})}))

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
  const roots=[]
  for(const p of [CAMPUS.melchior,CAMPUS.balthasar,CAMPUS.casper,CAMPUS.camp,{x:0,z:-8},{x:-46,z:-22},{x:-22,z:22}]){
    const mid=[p.x*.55,.3,(-47+p.z)/2];const a=beam([0,.5,-47],mid,.22,'wood'),b=beam(mid,[p.x,.3,p.z],.15,'green');a.name=b.name='campus-energy-root';roots.push({from:'camper',to:{...p}})
  }
  function pod(p,color,scale=1) {
    const g=new THREE.Group();g.name=`campus-pod-${p.roleId||'pilot'}`;g.position.set(p.x,0,p.z);group.add(g)
    box(0,.6,0,3.5*scale,.9,3.5*scale,'dark',g);box(0,1.08,0,2.9*scale,.12,3*scale,color,g)
    for(const side of [-1,1])box(side*1.6*scale,2.15,-.3,.2,3,3*scale,'stone',g)
    box(0,3.55,-.3,3.5*scale,.25,3.1*scale,'stone',g);box(0,2.2,-1.7*scale,3.3*scale,2.5,.18,'dark',g)
    box(0,2.6,-1.58*scale,1.7,.3,.1,color,g)
    const light=box(0,3.74,0,1.2,.08,1.2,color,g);g.userData.light=light;return g
  }
  const pods=campusPods.map(p=>{const g=pod(p,'white');g.userData.roleId=p.roleId;beam([CAMPUS.casper.x,.18,CAMPUS.casper.z],[p.x,.18,p.z],.07,'white');return g})
  const pilotPod=pod(CAMPUS.pilotPod,'blue',1.3);beam([-27,.2,-50],[-27,.2,-42],.12,'blue')
  let projection=null,disposed=false
  function update(data={}){base.update(data);projection=data.campus||null;group.userData.campus=projection;for(const g of pods){const c=projection;g.userData.occupied=c?.mode==='sleeping'||c?.chargingRoleId===g.userData.roleId;g.userData.light.scale.setScalar(g.userData.occupied?1.3:.65)}pilotPod.userData.occupied=['download','sleep'].includes(projection?.pilot?.instructionState)}
  const vec=p=>new THREE.Vector3(p.x,0,p.z)
  function target(thread){const c=projection;if(thread.roleId==='camper')return {position:new THREE.Vector3(0,0,-47),look:vec(CAMPUS.camp),activity:'talk'}
    if(thread.roleId==='pilot')return {position:vec(CAMPUS.pilotPod),look:vec(CAMPUS.melchior),activity:'pilot-rest'}
    const podPoint=campusPods.find(p=>p.roleId===thread.roleId)
    if(!podPoint)return null
    if(c?.mode==='sleeping'||c?.chargingRoleId===thread.roleId||c?.activeRoleId===thread.roleId)return {position:vec(podPoint),look:vec(CAMPUS.casper),activity:'pilot-rest'}
    const index=c?.campRoleIds?.indexOf(thread.roleId)??-1,p=campusSeats[Math.max(0,index)]
    return {position:vec(p),look:vec(CAMPUS.camp),activity:'talk'}
  }
  const clearings=[{x:0,z:-40,r:19},{x:-17,z:-34,r:6},{x:-27,z:-46,r:8},{x:31,z:-37,r:17},{x:0,z:-53,r:5}]
  return {...base,profile:'roarm-campus',campusGroup:group,pods,pilotPod,cores,camper,roots,seats,target,update,
    surfaceHeight(x,z){if(campusSeats.some(p=>Math.hypot(x-p.x,z-p.z)<1.1))return 1.45;if(Math.hypot(x,z+38)<14)return .78;if(campusPods.some(p=>Math.abs(x-p.x)<1.8&&Math.abs(z-p.z)<1.8))return 1.15;if(Math.abs(x+27)<2.2&&Math.abs(z+42)<2.2)return 1.15;return base.surfaceHeight(x,z)},
    clearings:()=>[...base.clearings(),...clearings],obstacles:()=>base.obstacles().filter(o=>!o.campSeat),
    dispose(){if(disposed)return;disposed=true;base.dispose();scene.remove(group);group.traverse(o=>{if(o.userData.labelTexture){o.userData.labelTexture.dispose();o.material.dispose()}});geometries.forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose())}}
}
