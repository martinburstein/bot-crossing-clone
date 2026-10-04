import * as THREE from 'three'
import {Settings} from '../../src/core/settings.js'
import {Engine} from '../../src/core/engine.js'
import {CameraRig} from '../../src/core/camera.js'
import {Colony} from '../../src/game/colony.js'
import {loadKit} from '../../src/world/kit.js'
import {loadCrew,crewRig} from '../../src/agents/crew.js'
import {standbyMagiThreads} from '../../src/game/magi-world.js'
import {VEHICLES} from '../../src/world/mars-vehicles.js'
const settings=new Settings();settings.transient=true;Object.assign(settings.values,{planet:'mars',timeOfDay:.46,dayCycle:false,tiltShift:false,reducedMotion:false,showLabels:false,autoQuality:false})
// Test settings are deliberately in-memory; no Settings.set/apply calls.
const engine=new Engine(settings).mount(document.querySelector('#world')),rig=new CameraRig(engine.camera,engine.canvas,settings),colony=new Colony(engine.scene,settings,engine.camera,engine.renderer)
await Promise.all([loadKit(),loadCrew()]);colony.astronauts.setRig(crewRig());colony.onAssetsReady()
let offset=0,simTime=0,paused=false,threads=standbyMagiThreads()
const sync=()=>colony.setThreads(threads)
const advance=seconds=>{const start=simTime;for(let i=1;i<=seconds*30;i++)colony.update(1/30,start+i/30,rig.target);offset+=seconds;simTime=start+seconds}
const focusWorker=worker=>rig.focus(colony.astronauts.magiLife.fleet.get(`magi:${worker}`)?.model.position||new THREE.Vector3(),{distance:28})
// Fixture-only inspection surface. No live view, protocol call or persistence.
window.magiVisualCheck={snapshot(){return {active:threads.filter(t=>t.running).length,crew:colony.astronauts.agents.map(a=>({id:a.id,status:a.status,activity:a.magiActivity,badge:colony._badgeFor(a)})),fleet:[...colony.astronauts.magiLife.fleet].map(([id,item])=>({id,vehicle:item.choice,job:item.job.id,phase:item.phase,operating:item.operating,visitedStops:item.visitedStops,routeBlocked:!!item.routeBlocked,meteorVisible:!!item.mission.group.getObjectByName('incoming-large-meteor')?.visible,beamVisible:!!item.mission.group.getObjectByName('meteor-intercept-beam')?.visible,position:item.model.position.toArray()})),mounted:colony.astronauts.agents.filter(a=>a.mounted).length,idle:colony.astronauts.agents.filter(a=>a.status==='idle').length}},
  fronts(){const life=colony.astronauts.magiLife;return [...life.fleet].map(([id,item])=>({id,stops:item.stops.map(p=>p.toArray()),target:item.stopIndex,pathLength:item.path?.length,navHalf:life.vehicleNav?.half,routeBlocked:!!item.routeBlocked}))},
  growAll(total){threads=threads.map(t=>({...t,tokenUsage:{total}}));sync()},
  offShift(assignmentState){threads=threads.map(t=>({...t,running:false,hasError:assignmentState==='failed',assignmentState,shellStatus:assignmentState==='failed'?'Failed':'Unavailable'}));sync()},
  advance,focusWorker,pause(value){paused=value},task(index,title,vehicle){threads[index].taskTitle=title;threads[index].vehicleId=vehicle;sync()}}
sync();rig.focus(new THREE.Vector3(),{distance:160});rig.maxDistance=300
const byId=id=>document.getElementById(id)
byId('idle').onclick=()=>{threads=threads.map(t=>({...t,running:false,assignmentState:'idle',shellStatus:'Ready'}));sync()}
byId('active').onclick=()=>{threads=threads.map((t,i)=>({...t,running:i%5===0,assignmentState:i%5===0?'running':'idle',shellStatus:i%5===0?'Working':'Ready'}));sync()}
byId('unknown').onclick=()=>{threads=threads.map(t=>({...t,running:false,assignmentState:'unknown',shellStatus:'Unavailable'}));sync()}
byId('growth').onclick=()=>{threads=threads.map((t,i)=>({...t,tokenUsage:{total:i===0?525000:i===1?175000:0}}));sync()}
byId('step').onclick=()=>advance(30)
byId('advance').onclick=()=>{offset+=64}
byId('crew').onclick=()=>rig.focus(colony.astronauts.magiLife.camps.get('melchior').group.position,{distance:16})
byId('driver').onclick=()=>focusWorker('w01')
byId('overview').onclick=()=>rig.focus(new THREE.Vector3(),{distance:160})
for(const v of VEHICLES){const option=document.createElement('option');option.value=v.id;option.textContent=v.name;byId('vehicle').append(option)}
byId('vehicle').onchange=()=>{threads[0].vehicleId=byId('vehicle').value;sync()}
byId('board').onclick=()=>{for(const a of colony.astronauts.agents){const f=colony.astronauts.magiLife.fleet.get(a.id);a.pos.copy(a.thread.running&&f?f.dock:a.magiGoal);a.pos.y=colony.astronauts.world.groundAt(a.pos.x,a.pos.z);a.state='at-site';a.pathVersion=-1}}
let last=0
engine.add({update(dt,elapsed){rig.update(dt);if(!paused){simTime=elapsed+offset;colony.update(dt,simTime,rig.target)}if(engine.scene.fog){engine.scene.fog.near=rig.distance+45;engine.scene.fog.far=rig.distance+320}engine.setFocusDistance(rig.distance);if(elapsed-last>.5){last=elapsed;byId('diagnostic').textContent=colony.astronauts.agents.map(a=>`${a.thread.shellId} ${a.status} ${a.magiActivity||'-'} ${a.clipKey} ${a.mounted?'MOUNTED':''} d=${a.magiGoal?Math.hypot(a.pos.x-a.magiGoal.x,a.pos.z-a.magiGoal.z).toFixed(1):'-'}`).join('\n')}}})
engine.start()
