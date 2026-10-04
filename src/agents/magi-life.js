import * as THREE from 'three'
import {MAGI_CLUSTERS,HANGAR} from '../game/magi-world.js'
import {createVehicle,chooseVehicle} from '../world/mars-vehicles.js'
import {createHangar} from '../world/mars-hangar.js'
import {createMessageBoard} from '../world/message-boards.js'
import {vehicleJob,confirmedVehicleWorker} from '../game/vehicle-jobs.js'
import {createVehicleMission} from '../world/vehicle-mission.js'
import {Navigation} from './navigation.js'

export const IDLE_LABELS={tinker:'Tinkering',talk:'Chatting',board:'Reading the board',snack:'Snack break',drive:'Operating vehicle'}
// Shared cluster clock pairs off-duty personas while the on-shift crew stays at work.
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
  job(agent) {return vehicleJob(agent.thread,this.choices[agent.thread.shellId]||agent.thread.vehicleId)}
  choice(agent) {return this.job(agent).vehicle}
  setNavigationObstacles(obstacles,half) {
    if(!this.vehicleNav||this.vehicleNav.half!==half)this.vehicleNav=new Navigation({half})
    this.vehicleNav.rebuild(obstacles.filter(o=>!o.parking).map(o=>({...o,r:o.r+2})))
  }
  missionStops(job,agent,bay) {
    const camp=this.camps.get(agent.thread.clusterId),gate=camp?.group.position.clone().multiplyScalar(.68)||bay.work.clone()
    gate.y=0
    if(['drill','claw','intercept'].includes(job.operation))return [bay.work.clone().add(new THREE.Vector3(0,0,10)),bay.work.clone().add(new THREE.Vector3(0,0,16)),bay.work.clone()]
    if(job.operation==='report') {
      const index=MAGI_CLUSTERS.findIndex(c=>c.id===agent.thread.clusterId),next=this.camps.get(MAGI_CLUSTERS[(index+1)%3].id)
      return [gate,next?.group.position.clone().multiplyScalar(.68)||gate.clone(),bay.work.clone()]
    }
    if(job.id==='remote-survey'||job.id==='air-scout') {
      const index=MAGI_CLUSTERS.findIndex(c=>c.id===agent.thread.clusterId),next=this.camps.get(MAGI_CLUSTERS[(index+1)%3].id)
      const remote=next?.group.position.clone().multiplyScalar(.68)||gate.clone().add(new THREE.Vector3(12,0,0))
      return [gate,remote,bay.work.clone()]
    }
    if(job.operation==='scan'){const radius=job.id==='perimeter'?10:5;return [gate.clone().add(new THREE.Vector3(-radius,0,0)),gate.clone().add(new THREE.Vector3(radius,0,0)),bay.work.clone()]}
    return [gate,bay.work.clone()]
  }
  moveMission(item,dt) {
    const nav=this.vehicleNav,p=item.model.position,target=item.stops[item.stopIndex]
    if(item.dwell>0){item.dwell=Math.max(0,item.dwell-dt);item.operating=true;item.operationTime+=dt;return 0}
    item.operating=false
    if(!item.path||item.pathVersion!==nav?.version) {
      item.path=nav?nav.findPath(p.x,p.z,target.x,target.z):[{x:target.x,z:target.z}]
      item.pathAt=0;item.pathVersion=nav?.version
      // Never fall back to driving through buildings when a route is unavailable.
      if(!item.path){item.routeBlocked=true;return 0}
    }
    let distance=0,budget=item.job.speed*dt
    while(budget>0&&item.pathAt<item.path.length) {
      const wp=item.path[item.pathAt],dx=wp.x-p.x,dz=wp.z-p.z,length=Math.hypot(dx,dz)
      if(length<.025){item.pathAt++;continue}
      const step=Math.min(length,budget)
      p.x+=dx/length*step;p.z+=dz/length*step;distance+=step;budget-=step
      item.model.rotation.y=Math.atan2(dx,dz)-item.model.userData.seatYaw
      if(step===length)item.pathAt++
    }
    item.routeBlocked=false
    if(item.pathAt===item.path.length){
      item.visitedStops.push(item.stopIndex)
      if(item.visitedStops.length>12)item.visitedStops.shift()
      item.dwell=item.job.operation==='intercept'?12:['drill','claw'].includes(item.job.operation)?7:3
      item.stopIndex=(item.stopIndex+1)%item.stops.length;item.path=null;item.operating=true;item.operationTime=0
    }
    return distance
  }
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
    item.active=false;item.phase='parked'
    if(agent){agent.mounted=false;agent.magiSeat=null;if(!['leaving','gone'].includes(agent.state)){agent.pos.copy(item.bay.dock);agent.pos.y=world.groundAt(agent.pos.x,agent.pos.z);agent.groundY=agent.pos.y;agent.groundAt=null;agent.state='at-site';agent.pathVersion=-1}agent.magiActivity=null}
    if(item.mission){this.scene.remove(item.mission.group);item.mission.dispose()}
    item.model.position.copy(item.bay.position);item.model.rotation.y=item.model.userData.seatYaw;item.model.userData.animate(0,false)
    item.bay.model=item.model;item.bay.parkedAt=++this.returnOrder;item.bay.rented=false;this.fleet.delete(id)
    try {if(this.persist)localStorage.setItem('botcrossing.15-3A.parked.v2',JSON.stringify(this.hangar.bays.map(b=>b.model?.userData.spec.id||b.lastChoice||'eagle')))}catch{/* Optional history. */}
  }
  update(agents,world,elapsed) {
    const dt=Math.max(0,Math.min(.25,elapsed-this.elapsed));this.elapsed=elapsed
    const reduced=this.settings.get('reducedMotion'),motionDt=reduced?0:dt;this.returnOrder ??= 3
    if(!this.hangar)return
    const idleIds=new Set(agents.filter(a=>a.status==='idle'&&a.state!=='leaving'&&!a.mounted).map(a=>a.thread.shellId))
    for(const camp of this.camps.values())camp.group.position.y=world.groundAt(camp.group.position.x,camp.group.position.z)+.03
    // Only the confirmed live persona of each cluster gets a moving rental.
    const occupied=new Set(),active=agents.filter(agent=>{if(!confirmedVehicleWorker(agent)||occupied.has(agent.thread.clusterId)||occupied.size>=3)return false;occupied.add(agent.thread.clusterId);return true})
    for(const [id,item] of this.fleet){const agent=active.find(a=>a.id===id);if(!agent||this.choice(agent)!==item.choice)this.release(id,item,agents.find(a=>a.id===id),world)}
    for(const agent of active)if(!this.fleet.has(agent.id)) {
      const available=this.hangar.bays.filter(b=>!b.rented).sort((a,b)=>a.parkedAt-b.parkedAt)
      const choice=this.choice(agent),bay=available.find(b=>b.model?.userData.spec.id===choice)||available[0]
      if(!bay)continue
      if(bay.model?.userData.spec.id!==choice)this.parkModel(bay,choice)
      const job=this.job(agent),mission=createVehicleMission(job,agent.thread.shellId)
      const item={choice,job,mission,bay,model:bay.model,home:bay.work.clone(),seat:new THREE.Vector3(),dock:bay.dock.clone(),active:true,travel:0,rolling:0,phase:'outbound',stopIndex:0,visitedStops:[],dwell:0,operationTime:0}
      item.stops=this.missionStops(job,agent,bay);this.scene.add(mission.group)
      // A status change deploys the seated pilot immediately; activity is visible
      // without waiting for a long walk from the far side of the colony.
      agent.mounted=true;agent.pathVersion=-1
      bay.rented=true;bay.lastChoice=choice;bay.model=null;this.fleet.set(agent.id,item)
    }
    for(const [id,item] of this.fleet) {
      const agent=active.find(a=>a.id===id),p=item.model.position
      let distance=0
      if(item.phase==='outbound'){
        const before=item.travel;item.travel=Math.min(1,item.travel+motionDt/5)
        p.lerpVectors(item.bay.position,item.bay.work,item.travel)
        distance=item.bay.position.distanceTo(item.bay.work)*(item.travel-before)
        if(item.travel===1)item.phase='working'
      }else distance=this.moveMission(item,motionDt)
      // Bay threshold is a short ramp; the remainder rests on the sampled terrain.
      const ground=world.groundAt(p.x,p.z);p.y=ground
      const air=item.model.userData.spec.kind==='air'
      if(air){
        item.altitude??=0;item.motionTime=(item.motionTime||0)+motionDt
        const altitude=(item.operating?1:6)*Math.min(1,item.travel)
        item.altitude+=(altitude-item.altitude)*Math.min(1,motionDt*2)
        p.y+=item.altitude+Math.sin(item.motionTime*1.4)*.025
      }
      item.model.updateMatrixWorld(true)
      item.seat.copy(item.model.userData.seat).applyAxisAngle(new THREE.Vector3(0,1,0),item.model.rotation.y).add(p)
      item.active=true;item.rolling+=distance
      item.model.userData.animate(elapsed,!reduced,reduced,item.rolling,{working:!!item.operating})
      item.mission.group.rotation.y=item.model.rotation.y+item.model.userData.seatYaw
      item.mission.update(new THREE.Vector3(p.x,ground,p.z),item.operationTime,!!item.operating,reduced,p.y-ground)
      agent.magiActivity='drive';agent.magiGoal.copy(item.dock);agent.magiLook.copy(p);agent.magiSeat=item.seat;agent.magiYaw=item.model.rotation.y+item.model.userData.seatYaw
    }
    for(const agent of agents) {
      if(agent.thread.worldProfile!=='15-3A'||this.fleet.has(agent.id))continue
      if(agent.status==='idle') {
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
    for(const [id,f] of this.fleet)this.release(id,f,this.agents?.find(a=>a.id===id),this.world)
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
