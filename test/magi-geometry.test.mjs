import test from 'node:test'
import assert from 'node:assert/strict'
import {auditVehicle} from '../tools/vehicle-geometry-audit.mjs'
import {VEHICLES,createVehicle} from '../src/world/mars-vehicles.js'
import {MAGI_CLUSTERS,allocateMagiCells,standbyMagiThreads,clusterOpening,infrastructureCell} from '../src/game/magi-world.js'
import * as THREE from 'three'
import {createHangar} from '../src/world/mars-hangar.js'
import {Navigation} from '../src/agents/navigation.js'

test('pilots finish a hangar corner before taking the next waypoint',()=>{
 const hangar=createHangar(),nav=new Navigation({half:96});nav.rebuild(hangar.obstacles)
 const path=nav.findPath(-10,1,-3.15,1),wp=path[0],next=path[1]
 const pos=new THREE.Vector3(wp.x,0,wp.z-.51),site=new THREE.Vector3(-3.15,0,1)
 assert.equal(nav.lineOfSight(pos.x,pos.z,next.x,next.z),false)
 assert.equal(nav.canAdvanceWaypoint(pos.x,pos.z,wp,next,.55),false)
 assert.equal(nav.canAdvanceWaypoint(wp.x,wp.z,wp,next,.55),true)
 hangar.dispose()
})

test('every vehicle stays connected and clears other mechanisms and bodywork through its motion',()=>{
 for(const v of VEHICLES)for(const t of [0,1.2,2.4166,4.8332,7.2498]){
   const report=auditVehicle(v.id,t)
   assert.equal(report.components,1,JSON.stringify(report))
   assert.deepEqual(report.clearanceFailures,[],JSON.stringify(report))
 }
})

test('claw tank links circulate around both tracks and batching preserves their transforms',()=>{
 const plain=createVehicle('claw-tank',{merge:false}),batched=createVehicle('claw-tank')
 const start=plain.userData.tracks.map(t=>t.links.map(l=>l.position.clone()))
 for(const time of [.4,1.4,2.8,4.2,5.1]){
  plain.userData.animate(time,true);batched.userData.animate(time,true)
  for(let side=0;side<2;side++){
   const track=plain.userData.tracks[side],rendered=batched.userData.tracks[side]
   for(let i=0;i<track.links.length;i++){
    const link=track.links[i],matrix=new THREE.Matrix4();rendered.instance.getMatrixAt(i,matrix)
    assert.ok(link.position.distanceTo(start[side][i])>.05,'each tread must travel, not just spin in place')
    assert.ok(matrix.elements.every((v,j)=>Math.abs(v-link.matrix.elements[j])<1e-6))
   }
  }
 }
 const period=(2.2+2*Math.PI*.38)/.8
 plain.userData.animate(period,true)
 for(let s=0;s<2;s++)for(let i=0;i<24;i++)assert.ok(plain.userData.tracks[s].links[i].position.distanceTo(start[s][i])<1e-9)
 plain.userData.animate(2,true,true)
 for(let s=0;s<2;s++)for(let i=0;i<24;i++)assert.ok(plain.userData.tracks[s].links[i].position.distanceTo(start[s][i])<1e-9)
 plain.userData.dispose();batched.userData.dispose()
})

test('cockpit interior rays see one surface instead of coincident colored faces',()=>{
 for(const {id} of VEHICLES){
  const model=createVehicle(id,{merge:false});model.updateMatrixWorld(true)
  for(const y of [.08,.2,.35,.44])for(const z of [-.25,0,.25])for(const direction of [[1,0,0],[-1,0,0],[0,0,-1],[0,0,1],[0,-1,0]]){
   const origin=model.userData.seat.clone().add(new THREE.Vector3(0,y,z))
   const ray=new THREE.Raycaster(origin,new THREE.Vector3(...direction))
   const hits=ray.intersectObjects(model.userData.parts).filter(h=>!h.object.material.transparent)
   // A triangle seam can return the same mesh twice; compare distinct surfaces.
   const first=hits[0],next=hits.find(h=>h.object!==first?.object)
   assert.ok(first,`${id}: missing cockpit surface`)
   assert.ok(!next||next.distance-first.distance>.001,`${id}: ${first.object.name} overlaps ${next?.object.name}`)
  }
  model.userData.dispose()
 }
})
test('each outward opening is the first shared expansion and growth avoids the hangar and lander',()=>{
 const projects=standbyMagiThreads().map(t=>({...t,cells:1})),base=allocateMagiCells(projects)
 for(let c=0;c<3;c++) {
   const cluster=MAGI_CLUSTERS[c],opening=clusterOpening(cluster)
   const world=p=>({x:11.4*p.q,z:7.6*Math.sqrt(3)*(p.r+p.q/2)})
   const center=world(cluster),gap=world(opening)
   assert.ok((gap.x-center.x)*center.x+(gap.z-center.z)*center.z>0)
   assert.ok(![...base.values()].flat().some(p=>p.q===opening.q&&p.r===opening.r))
   for(let worker=c*5;worker<c*5+5;worker++) {
     const expanded=allocateMagiCells(projects.map((p,i)=>({...p,cells:i===worker?2:1})),base)
     assert.deepEqual(expanded.get(projects[worker].id)[1],opening)
   }
 }
 const grown=allocateMagiCells(projects.map(p=>({...p,cells:15})),base)
 for(const cells of grown.values())for(const c of cells)assert.equal(infrastructureCell(c),false)
})
