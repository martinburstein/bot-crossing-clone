import test from 'node:test'
import assert from 'node:assert/strict'
import {auditVehicle} from '../tools/vehicle-geometry-audit.mjs'
import {VEHICLES} from '../src/world/mars-vehicles.js'
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
