import * as THREE from 'three'
import {Astronauts} from '../agents/astronauts.js'
import {loadCrew,frameFor} from '../agents/crew.js'
import {createLabCoats} from './lab-coats.js'
import {UNIFORM} from './uniforms.js'

// Reuse the real Bot Crossing bots: shared body, helmet, animated screen face,
// backpack, antenna and clips. Local preview positions never start MAGI sessions.
export async function createResearchTeam(scene,profiles) {
 const rig=await loadCrew()
 const settings={textureSize:512,shadowSize:2048,transient:true,
  get:key=>key==='maxAgents'?profiles.length:key==='reducedMotion'?matchMedia('(prefers-reduced-motion: reduce)').matches:false}
 const bots=new Astronauts(scene,settings);bots.setRig(rig)
 const origin=new THREE.Vector3()
 bots.setRoster(profiles.map(p=>({id:p.id,thread:{id:p.id,title:p.name,suitColor:new THREE.Color(UNIFORM.suit).getHex()},status:'idle',site:origin,anchor:origin,home:origin,known:true})),{groundAt:()=>0,shipDoor:()=>origin})
 const coats=createLabCoats(bots,profiles)
 const residents=profiles.map((profile,index)=>{
  const agent=bots.byId.get(profile.id)
  agent.scale=4;agent.state='at-site';agent.trim.set(profile.color);agent.colorDirty=true
  const root=new THREE.Group();root.name='researcher-'+profile.id;root.userData.roleId=profile.id
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.63,.055,6,40),new THREE.MeshBasicMaterial({color:profile.color,transparent:true,opacity:.6}))
  halo.rotation.x=-Math.PI/2;halo.position.y=.035;root.add(halo)
  return {root,profile,halo,index,target:new THREE.Vector3(),
   animate(t,moving,assigned,dt,reduced,activity='board'){
    agent.pos.copy(root.position);agent.yaw=root.rotation.y
    agent.groundSpeed=moving?5/agent.scale:0
    agent.magiActivity=assigned?'board':activity;agent.magiSettled=!moving
    bots._animate(agent,dt,reduced?0:1)
    if(activity==='plant'&&!moving){agent.clipKey='interact';agent.frame=frameFor(rig.clips.interact,reduced?0:t)}
    if(!reduced)bots._face(agent,dt)
   }}
 })
 return {residents,flush:t=>{bots._writeMatrices(t,1);coats.update()}}
}
