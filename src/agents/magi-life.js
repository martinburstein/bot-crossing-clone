import * as THREE from 'three'
import {MAGI_CLUSTERS} from '../game/magi-world.js'
import {createVehicle,chooseVehicle} from '../world/mars-vehicles.js'
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
    this.scene=scene;this.settings=settings;this.fleet=new Map();this.camps=new Map();this.choices={};this.elapsed=0
    try {this.choices=JSON.parse(localStorage.getItem('botcrossing.15-3A.vehicles')||'{}')} catch { /* Browser storage is optional. */ }
  }
  choose(workerId,vehicleId) {
    this.choices[workerId]=chooseVehicle(workerId,vehicleId)
    try {localStorage.setItem('botcrossing.15-3A.vehicles',JSON.stringify(this.choices))} catch { /* Session choice still works. */ }
  }
  choice(agent) {return chooseVehicle(agent.thread.shellId,this.choices[agent.thread.shellId]||agent.thread.vehicleId)}
  sync(agents,world) {
    this.agents=agents;this.world=world
    const eligible=agents.filter(a=>a.thread.worldProfile==='15-3A'&&a.state!=='leaving'&&a.state!=='gone')
    const ids=new Set(eligible.map(a=>a.id))
    for(const [id,item] of this.fleet)if(!ids.has(id)){this.scene.remove(item.model);item.model.userData.dispose();this.fleet.delete(id)}
    const clusters=new Set(eligible.map(a=>a.thread.clusterId))
    for(const [id,camp] of this.camps)if(!clusters.has(id)){this.scene.remove(camp.group);camp.dispose();this.camps.delete(id)}
    for(const cluster of MAGI_CLUSTERS)if(clusters.has(cluster.id)&&!this.camps.has(cluster.id)) {
      const camp=createCamp(cluster);this.scene.add(camp.group);this.camps.set(cluster.id,camp)
    }
    for(const agent of eligible) {
      const choice=this.choice(agent);let item=this.fleet.get(agent.id)
      if(item?.choice!==choice){
        if(item){
          if(agent.mounted){agent.pos.copy(item.dock);agent.pos.y=world.groundAt(agent.pos.x,agent.pos.z);agent.groundY=agent.pos.y;agent.groundAt=null;agent.state='at-site';agent.pathVersion=-1}
          this.scene.remove(item.model);item.model.userData.dispose()
        }
        item=null;agent.mounted=false
      }
      if(!item) {
        item={choice,model:createVehicle(choice),home:agent.home.clone(),seat:new THREE.Vector3(),dock:new THREE.Vector3(),active:false}
        this.scene.add(item.model);this.fleet.set(agent.id,item)
      }
      item.home.copy(agent.home)
      agent.magiGoal ||= new THREE.Vector3()
      agent.magiLook ||= new THREE.Vector3()
    }
  }
  obstacles() {
    return [...this.camps.values()].flatMap(c=>c.obstacles).concat([...this.fleet.values()].map(f=>({x:f.home.x,z:f.home.z,r:f.model.userData.footprint+.65})))
  }
  clearings() {return [...this.camps.values()].map(c=>({x:c.group.position.x,z:c.group.position.z,r:6}))}
  update(agents,world,elapsed) {
    this.elapsed=elapsed
    const reduced=this.settings.get('reducedMotion')
    const idleIds=new Set(agents.filter(a=>a.status==='idle'&&a.thread.assignmentState!=='unknown'&&a.state!=='leaving').map(a=>a.thread.shellId))
    for(const camp of this.camps.values())camp.group.position.y=world.groundAt(camp.group.position.x,camp.group.position.z)+.03
    for(const agent of agents) {
      const item=this.fleet.get(agent.id)
      if(!item)continue
      const active=agent.status==='working'&&agent.thread.running===true
      const model=item.model,air=model.userData.spec.kind==='air'
      // Vehicle operates inside its reserved central bay, clear of the six build slots.
      const t=reduced?0:elapsed
      model.position.set(item.home.x,world.groundAt(item.home.x,item.home.z),item.home.z)
      if(active&&agent.mounted&&!air&&!reduced){model.position.x+=Math.sin(t*.25)*.32;model.position.z+=Math.cos(t*.25)*.32}
      model.rotation.y=Math.PI*.18+(active&&agent.mounted&&!reduced?Math.sin(t*.18)*.22:0)
      if(air&&active&&agent.mounted)model.position.y+=.6+(reduced?0:Math.sin(t*1.4)*.06)
      model.updateMatrixWorld(true)
      item.seat.copy(model.userData.seat).applyAxisAngle(new THREE.Vector3(0,1,0),model.rotation.y).add(model.position)
      item.dock.set(item.home.x+model.userData.footprint+.85,0,item.home.z)
      if(agent.mounted&&!active) {
        agent.pos.copy(item.dock);agent.pos.y=world.groundAt(agent.pos.x,agent.pos.z);agent.groundY=agent.pos.y;agent.groundAt=null
        agent.state='at-site';agent.mounted=false;agent.pathVersion=-1
      }
      model.userData.animate(elapsed,active&&agent.mounted,reduced)
      if(active) {
        agent.magiActivity='drive';agent.magiGoal.copy(item.dock);agent.magiLook.copy(model.position)
        if(Math.hypot(agent.pos.x-item.dock.x,agent.pos.z-item.dock.z)<.9)agent.mounted=true
        agent.magiSeat=item.seat;agent.magiYaw=model.rotation.y
      } else if(agent.status==='idle'&&agent.thread.assignmentState!=='unknown') {
        const plan=idlePlan(agent.thread.shellId,elapsed,idleIds),camp=this.camps.get(agent.thread.clusterId)
        if(!camp)continue
        const slot=plan.activity==='board'&&plan.role===3?2:plan.role%camp.targets[plan.activity].length
        agent.magiActivity=plan.activity;agent.magiGoal.copy(camp.targets[plan.activity][slot]).add(camp.group.position)
        agent.magiLook.copy(camp.looks[plan.activity]).add(camp.group.position)
        if(plan.activity==='talk') {
          const peer=agents.find(a=>a.thread.shellId===plan.peer)
          if(peer)agent.magiLook.copy(peer.pos)
        }
      } else {agent.magiActivity=null;agent.mounted=false}
      item.active=active&&agent.mounted
    }
  }
  dispose(){for(const f of this.fleet.values()){this.scene.remove(f.model);f.model.userData.dispose()}for(const c of this.camps.values()){this.scene.remove(c.group);c.dispose()}this.fleet.clear();this.camps.clear()}
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
