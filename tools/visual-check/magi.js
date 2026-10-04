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
let offset=0,simTime=0,threads=standbyMagiThreads()
const sync=()=>colony.setThreads(threads)
sync();rig.focus(new THREE.Vector3(),{distance:160});rig.maxDistance=300
const byId=id=>document.getElementById(id)
byId('idle').onclick=()=>{threads=threads.map(t=>({...t,running:false,assignmentState:'idle',shellStatus:'Ready'}));sync()}
byId('active').onclick=()=>{threads=threads.map((t,i)=>({...t,running:i%5===0,assignmentState:i%5===0?'running':'idle',shellStatus:i%5===0?'Working':'Ready'}));sync()}
byId('unknown').onclick=()=>{threads=threads.map(t=>({...t,running:false,assignmentState:'unknown',shellStatus:'Unavailable'}));sync()}
byId('growth').onclick=()=>{threads=threads.map((t,i)=>({...t,tokenUsage:{total:i===0?525000:i===1?175000:0}}));sync()}
byId('step').onclick=()=>{for(let i=0;i<900;i++)colony.update(1/30,simTime+i/30,rig.target);offset+=30}
byId('advance').onclick=()=>{offset+=64}
byId('crew').onclick=()=>rig.focus(colony.astronauts.magiLife.camps.get('melchior').group.position,{distance:16})
byId('driver').onclick=()=>rig.focus(colony.astronauts.magiLife.fleet.values().next().value?.model.position||new THREE.Vector3(),{distance:28})
byId('overview').onclick=()=>rig.focus(new THREE.Vector3(),{distance:160})
for(const v of VEHICLES){const option=document.createElement('option');option.value=v.id;option.textContent=v.name;byId('vehicle').append(option)}
byId('vehicle').onchange=()=>{threads[0].vehicleId=byId('vehicle').value;sync()}
byId('board').onclick=()=>{for(const a of colony.astronauts.agents){const f=colony.astronauts.magiLife.fleet.get(a.id);a.pos.copy(a.thread.running&&f?f.dock:a.magiGoal);a.pos.y=colony.astronauts.world.groundAt(a.pos.x,a.pos.z);a.state='at-site';a.pathVersion=-1}}
let last=0
engine.add({update(dt,elapsed){rig.update(dt);simTime=elapsed+offset;colony.update(dt,simTime,rig.target);if(engine.scene.fog){engine.scene.fog.near=rig.distance+45;engine.scene.fog.far=rig.distance+320}engine.setFocusDistance(rig.distance);if(elapsed-last>.5){last=elapsed;byId('diagnostic').textContent=colony.astronauts.agents.map(a=>`${a.thread.shellId} ${a.status} ${a.magiActivity||'-'} ${a.clipKey} ${a.mounted?'MOUNTED':''} d=${a.magiGoal?Math.hypot(a.pos.x-a.magiGoal.x,a.pos.z-a.magiGoal.z).toFixed(1):'-'}`).join('\n')}}})
engine.start()
