import * as THREE from 'three'
import {MAGI_CLUSTERS,HANGAR} from '../game/magi-world.js'
import {createVehicle,chooseVehicle} from '../world/mars-vehicles.js'
import {createHangar} from '../world/mars-hangar.js'
import {createMessageBoard} from '../world/message-boards.js'

export const IDLE_LABELS={tinker:'Tinkering',talk:'Chatting',board:'Reading the board',snack:'Snack break',drive:'Operating vehicle'}
// Shared cluster clock creates real pairs. Working, failed and unknown agents never join.
export function idlePlan(workerId,seconds,idleIds) {
  const index=(Number(workerId.slice(1))-1)%5, epoch=Math.floor(seconds/64)
  const role=(index+epoch)%5
  const group=Math.floor((Number(workerId.slice(1))-1)/5)*5
  const peer=`w${String(group+((role===0?1:0)-epoch%5+5)%5+1).padStart(2,'0')}`
  return {activity:role<2&&idleIds.has(peer)?'talk':role===2?'tinker':role===4?'snack':'board',role,epoch,peer}
}

export class MagiLife {
  constructor(scene,settings) {
    this.scene=scene;this.settings=settings;this.fleet=new Map();this.camps=new Map();this.choices={};this.elapsed=0;this.persist=!settings.transient
    try {if(this.persist)this.choices=JSON.parse(localStorage.getItem('botcrossing.15-3A.vehicles')||'{}')} catch { /* Storage is optional. */ }
  }
  choose(workerId,vehicleId) {
    this.choices[workerId]=chooseVehicle(workerId,vehicleId)
    try {if(this.persist)localStorage.setItem('botcrossing.15-3A.vehicles',JSON.stringify(this.choices))} catch { /* Session choice still works. */ }
  }
  choice(agent) {return chooseVehicle(agent.thread.shellId,this.choices[agent.thread.shellId]||agent.thread.vehicleId)}
  parkModel(bay,id) {
    if(bay.model){this.scene.remove(bay.model);bay.model.userData.dispose()}
    bay.model=createVehicle(id);bay.model.rotation.y=bay.model.userData.seatYaw;bay.model.position.copy(bay.position);this.scene.add(bay.model)
  }
  sync(agents,world) {
    this.agents=agents;this.world=world
    const eligible=agents.filter(a=>a.thread.worldProfile==='15-3A'&&a.state!=='leaving'&&a.state!=='gone')
    if(eligible.length&&!this.hangar){
      this.hangar=createHangar();this.scene.add(this.hangar.group)
      let parked=['eagle','trike','drill-unit']
      try {const saved=this.persist?JSON.parse(localStorage.getItem('botcrossing.15-3A.parked.v2')||'null'):null;if(Array.isArray(saved)&&saved.length===3)parked=saved.map((id,i)=>chooseVehicle(`w0${i+1}`,id))}catch{/* Optional local display history. */}
      this.hangar.bays.forEach((b,i)=>this.parkModel(b,parked[i]))
    }
    if(!eligible.length){this.dispose();return}
    const clusters=new Set(eligible.map(a=>a.thread.clusterId))
    for(const [id,camp] of this.camps)if(!clusters.has(id)){this.scene.remove(camp.group);camp.dispose();this.camps.delete(id)}
    for(const cluster of MAGI_CLUSTERS)if(clusters.has(cluster.id)&&!this.camps.has(cluster.id)) {
      const camp=createCamp(cluster);this.scene.add(camp.group);this.camps.set(cluster.id,camp)
    }
    for(const agent of eligible){agent.magiGoal ||= new THREE.Vector3();agent.magiLook ||= new THREE.Vector3()}
  }
  obstacles() {return [...this.camps.values()].flatMap(c=>c.obstacles).concat(this.hangar?.obstacles||[])}
  clearings() {return [...this.camps.values()].map(c=>({x:c.group.position.x,z:c.group.position.z,r:6})).concat(this.hangar?.clearings||[])}
  pickHangar(camera,x,y){return !!this.hangar?.pick(camera,x,y)}
  release(id,item,agent,world) {
    if(agent){agent.mounted=false;agent.magiSeat=null;agent.pos.copy(item.bay.dock);agent.pos.y=world.groundAt(agent.pos.x,agent.pos.z);agent.groundY=agent.pos.y;agent.groundAt=null;agent.state='at-site';agent.pathVersion=-1;agent.magiActivity=null}
    item.model.position.copy(item.bay.position);item.model.rotation.y=item.model.userData.seatYaw;item.model.userData.animate(0,false)
    item.bay.model=item.model;item.bay.parkedAt=++this.returnOrder;item.bay.rented=false;this.fleet.delete(id)
    try {if(this.persist)localStorage.setItem('botcrossing.15-3A.parked.v2',JSON.stringify(this.hangar.bays.map(b=>b.model?.userData.spec.id||b.lastChoice||'eagle')))}catch{/* Optional history. */}
  }
  update(agents,world,elapsed) {
    const dt=Math.max(0,Math.min(.25,elapsed-this.elapsed));this.elapsed=elapsed
    const reduced=this.settings.get('reducedMotion');this.returnOrder ??= 3
    if(!this.hangar)return
    const idleIds=new Set(agents.filter(a=>a.status==='idle'&&a.thread.assignmentState!=='unknown'&&a.state!=='leaving'&&!a.mounted).map(a=>a.thread.shellId))
    for(const camp of this.camps.values())camp.group.position.y=world.groundAt(camp.group.position.x,camp.group.position.z)+.03
    // A rental is a real, bounded visual object. There are never more than three.
    for(const agent of agents)if(agent.thread.worldProfile==='15-3A'&&agent.status==='working'&&agent.thread.running&&!this.fleet.has(agent.id)) {
      const available=this.hangar.bays.filter(b=>!b.rented).sort((a,b)=>a.parkedAt-b.parkedAt)
      const choice=this.choice(agent),bay=available.find(b=>b.model?.userData.spec.id===choice)||available[0]
      if(!bay)continue
      if(bay.model?.userData.spec.id!==choice)this.parkModel(bay,choice)
      const item={choice,bay,model:bay.model,home:bay.work.clone(),seat:new THREE.Vector3(),dock:bay.dock.clone(),active:false,travel:0,rolling:0,phase:'boarding'}
      bay.rented=true;bay.lastChoice=choice;bay.model=null;this.fleet.set(agent.id,item)
    }
    for(const [id,item] of this.fleet) {
      const agent=agents.find(a=>a.id===id),working=agent?.status==='working'&&agent.thread.running&&agent.state!=='leaving'&&agent.state!=='gone'
      if((!working||this.choice(agent)!==item.choice)&&item.phase!=='returning')item.phase='returning'
      if(item.phase==='boarding'&&agent&&Math.hypot(agent.pos.x-item.dock.x,agent.pos.z-item.dock.z)<.9){agent.mounted=true;item.phase='outbound';agent.pathVersion=-1}
      if(item.phase==='outbound'){item.travel=Math.min(1,item.travel+dt/5);if(item.travel===1)item.phase='working'}
      if(item.phase==='returning'){item.travel=Math.max(0,item.travel-dt/5);if(item.travel===0){this.release(id,item,agent,world);continue}}
      const p=item.model.position;p.lerpVectors(item.bay.position,item.bay.work,item.travel)
      // Bay threshold is a short ramp; the remainder rests on the sampled terrain.
      const ground=world.groundAt(p.x,p.z);p.y=ground
      const air=item.model.userData.spec.kind==='air',inUse=agent?.mounted&&item.phase!=='boarding'
      if(air&&inUse)p.y+=.6*Math.min(1,item.travel*5)+(reduced?0:Math.sin(elapsed*1.4)*.025*Math.min(1,item.travel*5))
      item.model.rotation.y=item.model.userData.seatYaw;item.model.updateMatrixWorld(true)
      item.seat.copy(item.model.userData.seat).applyAxisAngle(new THREE.Vector3(0,1,0),item.model.rotation.y).add(p);item.active=!!(working&&agent?.mounted&&item.phase!=='returning')
      if(inUse&&!reduced)item.rolling+=dt*(item.phase==='returning'?-1:1)
      item.model.userData.animate(elapsed,inUse&&!reduced,reduced,item.rolling)
      if(agent){agent.magiActivity=item.phase==='returning'?'return':'drive';agent.magiGoal.copy(item.dock);agent.magiLook.copy(p);agent.magiSeat=item.seat;agent.magiYaw=item.model.rotation.y+item.model.userData.seatYaw}
    }
    for(const agent of agents) {
      if(agent.thread.worldProfile!=='15-3A'||this.fleet.has(agent.id))continue
      if(agent.status==='idle'&&agent.thread.assignmentState!=='unknown') {
        const plan=idlePlan(agent.thread.shellId,elapsed,idleIds),camp=this.camps.get(agent.thread.clusterId)
        if(!camp)continue
        const slot=plan.activity==='board'&&plan.role===3?2:plan.role%camp.targets[plan.activity].length
        agent.magiActivity=plan.activity;agent.magiGoal.copy(camp.targets[plan.activity][slot]).add(camp.group.position)
        agent.magiLook.copy(camp.looks[plan.activity]).add(camp.group.position)
        if(plan.activity==='talk') {const peer=agents.find(a=>a.thread.shellId===plan.peer);if(peer)agent.magiLook.copy(peer.pos)}
      } else {agent.magiActivity=null;agent.mounted=false}
    }
  }
  dispose(){
    for(const f of this.fleet.values()){this.scene.remove(f.model);f.model.userData.dispose()}
    for(const c of this.camps.values()){this.scene.remove(c.group);c.dispose()}
    if(this.hangar){for(const b of this.hangar.bays)if(b.model){this.scene.remove(b.model);b.model.userData.dispose()}this.scene.remove(this.hangar.group);this.hangar.dispose();this.hangar=null}
    this.fleet.clear();this.camps.clear()
  }
}

function createCamp(cluster) {
  const group=new THREE.Group();group.name=`camp-${cluster.id}`
  group.position.set(11.4*cluster.q,0,7.6*Math.sqrt(3)*(cluster.r+cluster.q/2))
  const materials={white:new THREE.MeshStandardMaterial({color:0xeae4da,roughness:.7}),dark:new THREE.MeshStandardMaterial({color:0x404b53,roughness:.8}),orange:new THREE.MeshStandardMaterial({color:0xe9a45b,roughness:.5}),blue:new THREE.MeshStandardMaterial({color:0x80d4dd,emissive:0x316779,emissiveIntensity:.3})}
  function box(x,y,z,w,h,d,key){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),materials[key]);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m}
  const board=createMessageBoard(0xe9a45b);board.position.set(0,0,-2.2);group.add(board)
  // Furniture belongs to the starting camp; it does not represent earned token additions.
  box(-2.7,.72,1,1.7,.14,.95,'white');for(const x of [-3.3,-2.1])box(x,.35,1,.1,.7,.65,'dark')
  box(-2.7,.94,1,.48,.28,.42,'orange');box(-2.7,1.12,1,.22,.08,.25,'blue')
  box(2.65,.72,1.25,1.5,.15,1.1,'white');box(2.65,.36,1.25,.3,.72,.3,'dark')
  for(const x of [2.2,3.1])box(x,.86,1.2,.2,.17,.2,'orange')
  box(2.65,.3,2.5,1.7,.2,.5,'orange');for(const x of [2.1,3.2])box(x,.13,2.5,.1,.26,.38,'dark')
  const v=(x,z)=>new THREE.Vector3(x,0,z)
  const targets={talk:[v(-.9,2.6),v(.9,2.6)],tinker:[v(-2.7,2.1)],board:[v(-.7,-.65),v(.7,-.65),v(0,.3)],snack:[v(2.65,2.4)]}
  const looks={talk:v(0,2.6),tinker:v(-2.7,1),board:v(0,-2.2),snack:v(2.65,1.25)}
  const obstacles=[{x:0,z:-2.2,r:1.1},{x:-2.7,z:1,r:1},{x:2.65,z:1.25,r:.95}].map(o=>({...o,x:o.x+group.position.x,z:o.z+group.position.z}))
  return {group,targets,looks,obstacles,dispose(){board.userData.dispose();group.traverse(o=>o.geometry?.dispose());Object.values(materials).forEach(m=>m.dispose())}}
}
