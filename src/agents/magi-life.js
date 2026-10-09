import * as THREE from 'three'
import {MAGI_CLUSTERS,HANGAR,clusterWorkFront} from '../game/magi-world.js'
import {createVehicle,chooseVehicle} from '../world/mars-vehicles.js'
import {createHangar} from '../world/mars-hangar.js'
import {vehicleJob,confirmedVehicleWorker} from '../game/vehicle-jobs.js'
import {createVehicleMission} from '../world/vehicle-mission.js'
import {Navigation} from './navigation.js'

export const IDLE_LABELS={tinker:'Tinkering',talk:'Chatting',board:'Reading the worksite console',snack:'Snack break',drive:'Operating vehicle'}
const PILOT_ID=/^w(?:0[1-9]|1[0-5])$/
const pilotId=workerId=>PILOT_ID.test(workerId||'')
const isRoArm16Pilot=(thread)=>thread?.worldProfile==='roarm-16'&&thread.slotId==='melchior'&&thread.workerId==='w00'
function canonicalPilotHistory(projection) {
  const {history,generation,workerId,previousWorkerId}=projection
  if(!Array.isArray(history)||history.length!==generation)return null
  let owner=null
  for(let index=0;index<history.length;index++) {
    const entry=history[index],expectedGeneration=index+1
    if(!entry||entry.generation!==expectedGeneration||typeof entry.operationId!=='string'||!entry.operationId||typeof entry.evidence!=='string'||!entry.evidence||!Number.isFinite(entry.at))return null
    if(index===0) {
      if(entry.kind!=='enable'||entry.fromWorkerId!==null||!pilotId(entry.toWorkerId))return null
    } else if(entry.kind!=='handoff'||entry.fromWorkerId!==owner||!pilotId(entry.toWorkerId)||entry.toWorkerId===owner)return null
    owner=entry.toWorkerId
  }
  const latest=history.at(-1)
  if(owner!==workerId||(generation>1&&latest.fromWorkerId!==previousWorkerId)||(generation===1&&previousWorkerId!==null))return null
  return history
}
function canonicalRoArm16PilotHistory(projection) {
  const {history,generation,duty}=projection
  if(!Array.isArray(history)||history.length!==generation)return null
  let current='off'
  for(let index=0;index<history.length;index++) {
    const entry=history[index]
    if(!entry||entry.generation!==index+1||typeof entry.operationId!=='string'||!entry.operationId||typeof entry.evidence!=='string'||!entry.evidence||!Number.isFinite(entry.at))return null
    if(index===0) {
      if(entry.kind!=='enable'||(entry.toWorkerId!==undefined&&entry.toWorkerId!=='w00')||
        (entry.toDuty!==undefined&&entry.toDuty!=='on'))return null
      current='on'
    } else {
      if(entry.kind!=='duty-change'||entry.fromDuty!==current||!['on','off'].includes(entry.toDuty)||entry.toDuty===current)return null
      current=entry.toDuty
    }
  }
  return current===duty?history:null
}
function completedSymbiosisForThread(thread,cycle) {
  const pair=thread?.symbiosisPair
  if(cycle?.phase!=='completed'||typeof cycle.id!=='string'||pair?.cycleId!==cycle.id||pair.phase!=='completed'||
    !['balthasar','casper'].includes(thread.slotId)||pair.partnerSlotId!==(thread.slotId==='balthasar'?'casper':'balthasar'))return false
  const role=thread.slotId==='balthasar'?cycle.bRoleId:cycle.cRoleId,task=cycle.taskIds?.[thread.slotId]
  return thread.roleId===role&&(!thread.taskId||thread.taskId===task)
}
function makePilotKey() {
  const key=new THREE.Group();key.name='roarm-pilot-control-key'
  const material=new THREE.MeshStandardMaterial({color:0xf2bd55,metalness:.55,roughness:.35})
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.11,.025,6,12),material);ring.name='pilot-control-key-ring'
  const stem=new THREE.Mesh(new THREE.BoxGeometry(.22,.035,.035),material);stem.position.x=.14;stem.name='pilot-control-key-stem'
  const tooth=new THREE.Mesh(new THREE.BoxGeometry(.035,.075,.035),material);tooth.position.set(.22,-.045,0);tooth.name='pilot-control-key-tooth'
  key.add(ring,stem,tooth);key.visible=false;return key
}
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
    this.pilotDuty=null;this.pilotFeed='unassigned';this.pilotHandoff=null;this.pilotLastSeat=null
    this.pilotKey=makePilotKey();this.scene.add(this.pilotKey)
    try {if(this.persist)this.choices=JSON.parse(localStorage.getItem('botcrossing.15-3A.vehicles')||'{}')} catch { /* Storage is optional. */ }
  }
  choose(workerId,vehicleId) {
    this.choices[workerId]=chooseVehicle(workerId,vehicleId)
    try {if(this.persist)localStorage.setItem('botcrossing.15-3A.vehicles',JSON.stringify(this.choices))} catch { /* Session choice still works. */ }
  }
  job(agent) {return vehicleJob(agent.thread,this.choices[agent.thread.shellId]||agent.thread.vehicleId)}
  choice(agent) {return this.job(agent).vehicle}
  setNavigationObstacles(obstacles,half) {
    if(!this.vehicleNav||this.vehicleNav.half!==half)this.vehicleNav=new Navigation({half,maxExpansions:24000})
    this.vehicleNav.rebuild(obstacles.filter(o=>!o.parking).map(o=>({...o,r:o.r+2})))
  }
  missionStops(job,agent,bay) {
    const stops=clusterWorkFront(agent.thread.clusterId).map(s=>{const v=new THREE.Vector3(s.x,0,s.z);v.workNormal=s.normal;return v})
    if(!stops.length)return [bay.work.clone()]
    return stops
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
      if(target.workNormal)item.model.rotation.y=Math.atan2(target.workNormal.x,target.workNormal.z)-item.model.userData.seatYaw
      item.visitedStops.push(item.stopIndex)
      if(item.visitedStops.length>12)item.visitedStops.shift()
      item.dwell=target.transit?0:item.job.operation==='intercept'?12:['drill','claw'].includes(item.job.operation)?7:3
      item.stopIndex=(item.stopIndex+1)%item.stops.length;item.path=null;item.operating=!target.transit;item.operationTime=0
    }
    return distance
  }
  parkModel(bay,id) {
    if(bay.model){this.scene.remove(bay.model);bay.model.userData.dispose()}
    bay.model=createVehicle(id);bay.model.rotation.y=bay.model.userData.seatYaw;bay.model.position.copy(bay.position);this.scene.add(bay.model)
  }
  sync(agents,world) {
    if(!this.pilotKey.parent){if(this.pilotKey.userData.disposed)this.pilotKey=makePilotKey();this.scene.add(this.pilotKey)}
    this.agents=agents;this.world=world
    const eligible=agents.filter(a=>['15-3A','roarm-16','roarm-campus'].includes(a.thread.worldProfile)&&a.state!=='leaving'&&a.state!=='gone')
    if(eligible.length&&!this.hangar){
      this.hangar=createHangar();this.scene.add(this.hangar.group)
      let parked=['eagle','trike','drill-unit']
      try {const saved=this.persist?JSON.parse(localStorage.getItem('botcrossing.15-3A.parked.v2')||'null'):null;if(Array.isArray(saved)&&saved.length===3)parked=saved.map((id,i)=>chooseVehicle(`w0${i+1}`,id))}catch{/* Optional local display history. */}
      this.hangar.bays.forEach((b,i)=>this.parkModel(b,parked[i]))
    }
    if(!eligible.length){this.dispose();return}
    this.syncPilotDuty(world?.worksiteProjection)
    const sharedCamp=eligible.length?world.worksite?.camp:null
    this.camps.clear()
    if(sharedCamp) {
      for(const cluster of MAGI_CLUSTERS)this.camps.set(cluster.id,sharedCamp)
      if(eligible.some(agent=>agent.thread.worldProfile==='roarm-16'))this.camps.set('roles',sharedCamp)
    }
    for(const agent of eligible){agent.magiGoal ||= new THREE.Vector3();agent.magiLook ||= new THREE.Vector3()}
    for(const [id,item] of this.fleet){
      const agent=eligible.find(a=>a.id===id)
      if(!agent)continue
      const stops=this.missionStops(item.job,agent,item.bay)
      const movedFront=stops.length!==item.stops.length||stops.some((p,i)=>p.distanceToSquared(item.stops[i])>.01)
      if(movedFront){
        item.stops=stops;item.stopIndex=0;item.path=null;item.dwell=0
        if(item.phase==='outbound'){
          const front=stops[0],normal=front.workNormal
          item.departureEnd=front.clone();item.departureStart=front.clone().add(new THREE.Vector3((normal?.x||0)*5,0,(normal?.z||1)*5))
          item.model.position.lerpVectors(item.departureStart,item.departureEnd,item.travel)
        }
      }
      // A newly earned tile can place buildings over the previous work front.
      // Relocate a covered rental to free ground before routing; never drive out through a wall.
      const nav=this.vehicleNav,p=item.model.position
      if(item.phase==='working'&&nav?.isBlocked(p.x,p.z)){
        const free=nav.nearestFree(p.x,p.z)
        if(free){p.x=nav.toWorld(free.ix);p.z=nav.toWorld(free.iz)}
        else {p.copy(stops[0]);item.phase='working';item.travel=1}
        item.path=null;item.dwell=0
      }
      if(item.phase==='working'&&movedFront&&nav&&!nav.findPath(p.x,p.z,stops[0].x,stops[0].z)){
        p.copy(stops[0]);item.path=null;item.dwell=0;item.travel=1
      }
    }
  }
  syncPilotDuty(worksiteProjection) {
    const projection=worksiteProjection?.pilot??worksiteProjection?.magi?.pilot
    const profile=worksiteProjection?.profile??worksiteProjection?.magi?.profile
    if(profile==='roarm-campus'){this.pilotDuty=null;this.pilotKey.visible=false;return}
    if(projection===undefined||projection===null){if(this.pilotDuty)this.pilotFeed='unknown';return}
    if(worksiteProjection?.stale===true||projection.stale===true) {if(this.pilotDuty)this.pilotFeed='unknown';return}
    if(profile==='roarm-16') {
      if(projection.workerId!=='w00'||projection.slotId!=='melchior'||projection.roleId!=='pilot'||
        !['on','off'].includes(projection.duty)||!Number.isSafeInteger(projection.generation)||projection.generation<1||
        !Number.isFinite(projection.changedAt)||typeof projection.evidence!=='string'||!projection.evidence||
        !canonicalRoArm16PilotHistory(projection)) {if(this.pilotDuty)this.pilotFeed='unknown';return}
      if(this.pilotDuty?.profile==='roarm-16') {
        if(projection.generation===this.pilotDuty.generation&&projection.workerId===this.pilotDuty.workerId&&projection.duty===this.pilotDuty.duty) {this.pilotFeed='confirmed';return}
        if(projection.generation<=this.pilotDuty.generation) {this.pilotFeed='unknown';return}
        const chain=projection.history.slice(this.pilotDuty.generation)
        if(chain.length!==projection.generation-this.pilotDuty.generation||chain[0]?.fromDuty!==this.pilotDuty.duty||chain.at(-1)?.toDuty!==projection.duty) {this.pilotFeed='unknown';return}
      }
      this.pilotDuty={profile:'roarm-16',workerId:'w00',slotId:'melchior',roleId:'pilot',duty:projection.duty,generation:projection.generation}
      this.pilotFeed='confirmed';this.pilotHandoff=null;return
    }
    if(profile&&profile!=='15-3A'){if(this.pilotDuty)this.pilotFeed='unknown';return}
    const workerId=projection.workerId,generation=projection.generation
    if(!pilotId(workerId)||!Number.isSafeInteger(generation)||generation<1){if(this.pilotDuty)this.pilotFeed='unknown';return}
    if(projection.history!==undefined&&!canonicalPilotHistory(projection)){this.pilotFeed='unknown';return}
    if(!this.pilotDuty||this.pilotDuty.profile==='roarm-16'){this.pilotDuty={profile:'15-3A',workerId,generation,duty:'on'};this.pilotFeed='confirmed';this.pilotHandoff=null;return}
    if(generation===this.pilotDuty.generation&&workerId===this.pilotDuty.workerId){this.pilotFeed='confirmed';return}
    if(generation<=this.pilotDuty.generation){this.pilotFeed='unknown';return}
    const previousWorkerId=this.pilotDuty.workerId
    let transfers
    if(generation===this.pilotDuty.generation+1&&projection.history===undefined&&projection.previousWorkerId===previousWorkerId) {
      // Preserve compatibility with one-step projections that predate history.
      transfers=[{from:previousWorkerId,to:workerId,generation,changedAt:projection.changedAt??null}]
    } else {
      const history=canonicalPilotHistory(projection)
      const chain=history?.slice(this.pilotDuty.generation)
      if(!chain||chain.length!==generation-this.pilotDuty.generation||chain[0]?.fromWorkerId!==previousWorkerId||chain.at(-1)?.toWorkerId!==workerId) {
        this.pilotFeed='unknown';return
      }
      transfers=chain.map(entry=>({from:entry.fromWorkerId,to:entry.toWorkerId,generation:entry.generation,changedAt:entry.at}))
    }
    this.pilotDuty={profile:'15-3A',workerId,generation,duty:'on'};this.pilotFeed='confirmed'
    const handoffPath=[previousWorkerId,...transfers.map(transfer=>transfer.to)]
    this.pilotHandoff={from:previousWorkerId,to:workerId,generation,changedAt:projection.changedAt??null,transfers,
      label:transfers.length===1?`Control key handed from ${transfers[0].from} to ${transfers[0].to}`:`Control key history: ${handoffPath.join(' → ')}`}
  }
  obstacles() {return this.hangar?.obstacles||[]}
  campusDepartureReady(agent,world,elapsed) {
    if(agent.thread.worldProfile!=='roarm-campus')return true
    const c=world?.worksiteProjection?.campus
    if(!c||c.mode!=='awake'||c.phase!=='working'||agent.thread.roleId!==c.activeRoleId)return false
    const key=`${c.cycleNumber}:${c.activeRoleId}`
    if(agent.campusDownload?.key!==key)agent.campusDownload={key,arrivedAt:null,ready:false}
    const state=agent.campusDownload
    if(state.ready)return true
    const target=world.worksite?.target?.(agent.thread)?.position
    if(target&&Math.hypot(agent.pos.x-target.x,agent.pos.z-target.z)<1) {
      state.arrivedAt??=elapsed
      if(elapsed-state.arrivedAt>=2)state.ready=true
    }
    return state.ready
  }
  clearings() {
    return this.hangar?.clearings||[]
  }
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
    this.syncPilotDuty(world?.worksiteProjection)
    const completedCycle=world?.worksiteProjection?.symbiosisCycle
    const completedParticipants=agent=>completedSymbiosisForThread(agent?.thread,completedCycle)
    // A canonical joint conclusion ends the visual worksite trip for both role
    // bodies, even if the underlying task label has not refreshed yet. This
    // does not change worker status or claim that a model turn is running.
    for(const [id,item] of this.fleet) {
      const agent=agents.find(candidate=>candidate.id===id)
      if(agent&&completedParticipants(agent))this.release(id,item,agent,world)
    }
    const reduced=this.settings.get('reducedMotion'),motionDt=reduced?0:dt;this.returnOrder ??= 3
    if(!this.hangar)return
    const idleIds=new Set(agents.filter(a=>a.status==='idle'&&a.state!=='leaving'&&!a.mounted).map(a=>a.thread.shellId))
    const camp=this.camps.get(MAGI_CLUSTERS[0].id)
    if(camp)camp.group.position.y=world.groundAt(camp.group.position.x,camp.group.position.z)+.03
    // Only the confirmed live persona of each cluster gets a moving rental.
    const pilotWorkerId=this.pilotDuty?.workerId
    const occupied=new Set(),active=agents.filter(agent=>{if(completedParticipants(agent)||agent.thread.shellId===pilotWorkerId||isRoArm16Pilot(agent.thread)||!confirmedVehicleWorker(agent)||!this.campusDepartureReady(agent,world,elapsed)||occupied.has(agent.thread.clusterId)||occupied.size>=3)return false;occupied.add(agent.thread.clusterId);return true})
    for(const [id,item] of this.fleet){const agent=active.find(a=>a.id===id);if(!agent||this.choice(agent)!==item.choice)this.release(id,item,agents.find(a=>a.id===id),world)}
    for(const agent of active)if(!this.fleet.has(agent.id)) {
      const available=this.hangar.bays.filter(b=>!b.rented).sort((a,b)=>a.parkedAt-b.parkedAt)
      const choice=this.choice(agent),bay=available.find(b=>b.model?.userData.spec.id===choice)||available[0]
      if(!bay)continue
      if(bay.model?.userData.spec.id!==choice)this.parkModel(bay,choice)
      const job=this.job(agent),mission=createVehicleMission(job,agent.thread.shellId)
      const item={choice,job,mission,bay,model:bay.model,home:bay.work.clone(),seat:new THREE.Vector3(),dock:bay.dock.clone(),active:true,travel:0,rolling:0,phase:'outbound',stopIndex:0,visitedStops:[],dwell:0,operationTime:0}
      item.stops=this.missionStops(job,agent,bay);this.scene.add(mission.group)
      const front=item.stops[0],normal=front.workNormal
      item.departureEnd=front.clone();item.departureStart=front.clone().add(new THREE.Vector3((normal?.x||0)*5,0,(normal?.z||1)*5))
      item.model.position.copy(item.departureStart)
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
        p.lerpVectors(item.departureStart,item.departureEnd,item.travel)
        distance=item.departureStart.distanceTo(item.departureEnd)*(item.travel-before)
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
      if(!['15-3A','roarm-16','roarm-campus'].includes(agent.thread.worldProfile)||this.fleet.has(agent.id))continue
      if(agent.thread.worldProfile==='roarm-campus') {
        const campus=world?.worksiteProjection?.campus,target=world.worksite?.target?.(agent.thread)
        agent.mounted=false;agent.magiSeat=null
        if(agent.thread.roleId==='pilot'&&campus?.mode==='awake'&&campus?.pilot?.instructionState==='station'&&world.worksiteProjection?.pilot?.duty==='on') {
          const seat=world.worksite?.pilotSeat?.()
          if(seat){agent.mounted=true;agent.magiActivity='pilot';agent.magiSeat=seat.position;agent.magiYaw=seat.yaw;agent.magiGoal.copy(seat.position);agent.magiLook.copy(seat.position);continue}
          agent.magiActivity='pilot';agent.magiGoal.set(0,0,-6);agent.magiLook.set(0,0,0);continue
        }
        if(target){agent.magiActivity=target.activity;agent.magiGoal.copy(target.position);agent.magiLook.copy(target.look)}
        continue
      }
      const legacyPilot=agent.thread.worldProfile==='15-3A'&&agent.thread.shellId===pilotWorkerId
      const captain=isRoArm16Pilot(agent.thread)
      const currentCaptain=this.pilotDuty?.profile==='roarm-16'&&this.pilotDuty.workerId==='w00'
      if(legacyPilot||(captain&&currentCaptain)) {
        const isResting=this.pilotDuty.profile==='roarm-16'&&this.pilotDuty.duty==='off'
        agent.magiPilotStatus=this.pilotFeed==='confirmed'?(isResting?'off-duty':'confirmed'):'unknown'
        agent.magiPilotGeneration=this.pilotDuty.generation;agent.magiPilotHandoff=this.pilotHandoff
        if(captain&&isResting) {
          // An explicit release sends the captain to a reserved camp rest spot;
          // the cab remains available for the next confirmed on-duty period.
          agent.mounted=false;agent.magiSeat=null;agent.magiActivity='pilot-rest'
          const camp=world.worksite?.camp,spot=camp?.restSpot||new THREE.Vector3(0,0,10.5)
          agent.magiGoal.copy(spot).add(camp?.group?.position||new THREE.Vector3(0,0,-38))
          agent.magiLook.copy(camp?.group?.position||new THREE.Vector3(0,0,-38))
          this.pilotKey.visible=false
          continue
        }
        const seat=world.worksite?.pilotSeat?.()
        if(seat?.position?.isVector3&&Number.isFinite(seat.yaw)) {
          this.pilotLastSeat={position:seat.position.clone(),yaw:seat.yaw}
          agent.mounted=true;agent.magiActivity=isResting?'pilot-rest':'pilot';agent.magiSeat=seat.position;agent.magiYaw=seat.yaw
          agent.magiGoal.copy(seat.position);agent.magiLook.copy(seat.position).add(new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),seat.yaw))
          this.pilotKey.visible=!isResting
          if(!isResting){this.pilotKey.position.copy(seat.position).add(new THREE.Vector3(.2,.3,0).applyAxisAngle(new THREE.Vector3(0,1,0),seat.yaw));this.pilotKey.rotation.y=seat.yaw}
          continue
        }
        // Without any observation the model is intentionally hidden. Keep the
        // captain beside the station and label the missing pose; do not invent a
        // seat transform or remove the permanent pilot from the scene.
        agent.mounted=false;agent.magiSeat=null;agent.magiPilotStatus=isResting?'off-duty-awaiting-telemetry':'awaiting-telemetry'
        agent.magiActivity=isResting?'pilot-rest':'pilot'
        const station=world.worksite?.layout?.arm||{x:0,z:0},goal=agent.magiGoal
        goal.set(station.x,0,station.z-6)
        agent.magiLook.set(station.x,0,station.z)
        this.pilotKey.visible=false
        continue
      }
      if(captain&&this.pilotDuty?.profile!=='roarm-16') {
        // The dedicated slot remains stationed while a profile/duty projection
        // is unavailable, but no key ownership or seated pose is inferred.
        agent.magiPilotStatus='unknown';agent.mounted=false;agent.magiSeat=null;agent.magiActivity='pilot'
        const station=world.worksite?.layout?.arm||{x:0,z:0}
        agent.magiGoal.set(station.x,0,station.z-6);agent.magiLook.set(station.x,0,station.z)
        this.pilotKey.visible=false
        continue
      }
      if(completedParticipants(agent)) {
        const camp=this.camps.get('roles')||this.camps.get('balthasar')
        const side=agent.thread.slotId==='balthasar'?0:1,targets=camp?.targets?.talk
        if(!camp||!Array.isArray(targets)||!targets[side])continue
        agent.mounted=false;agent.magiSeat=null;agent.magiActivity='symbiosis-handoff'
        agent.magiGoal.copy(targets[side]).add(camp.group.position)
        agent.magiLook.copy(camp.looks?.console?camp.looks.console.clone().add(camp.group.position):camp.group.position)
        continue
      }
      delete agent.magiPilotStatus;delete agent.magiPilotGeneration;delete agent.magiPilotHandoff
      agent.mounted=false;agent.magiSeat=null
      if(agent.status==='idle') {
        const plan=idlePlan(agent.thread.shellId,elapsed,idleIds),camp=this.camps.get(agent.thread.clusterId)
        if(!camp)continue
        const slot=Number(agent.thread.shellId.slice(1))-1,goal=camp.idleGoals?.[slot],look=camp.looks[plan.activity]
        if(!goal||!look)continue
        agent.magiActivity=plan.activity;agent.magiGoal.copy(goal).add(camp.group.position)
        agent.magiLook.copy(look).add(camp.group.position)
        if(plan.activity==='talk') {const peer=agents.find(a=>a.thread.shellId===plan.peer);if(peer)agent.magiLook.copy(peer.pos)}
      } else {agent.magiActivity=null;agent.mounted=false}
    }
  }
  dispose(){
    for(const [id,f] of this.fleet)this.release(id,f,this.agents?.find(a=>a.id===id),this.world)
    this.camps.clear()
    if(this.hangar){for(const b of this.hangar.bays)if(b.model){this.scene.remove(b.model);b.model.userData.dispose()}this.scene.remove(this.hangar.group);this.hangar.dispose();this.hangar=null}
    this.fleet.clear();this.camps.clear();this.pilotKey.visible=false;this.scene.remove(this.pilotKey)
    const geometries=new Set(),materials=new Set();this.pilotKey.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)})
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();this.pilotKey.userData.disposed=true
  }
}
