import test from 'node:test'
import assert from 'node:assert/strict'
import {workerSpeech,workerInspection} from '../src/ui/worker-data.mjs'
import {VEHICLE_JOBS} from '../src/game/vehicle-jobs.js'
import {standbyMagiThreads} from '../src/game/magi-world.js'

const make=()=>({thread:{...standbyMagiThreads()[0],running:true,assignmentState:'running',taskTitle:'Deliver actual camp supplies',tokenUsage:{total:275000,cached:true,completedTurns:2,pendingTurns:1}},mounted:true,pos:{x:4,y:2,z:1}})
const fleetFor=job=>({job,phase:'working',operating:false,model:{position:{x:4,y:2,z:1},userData:{spec:{name:'Recon Dropship'}}},stops:[{x:7,z:5}],stopIndex:0,visitedStops:[0],pathAt:1,path:[{},{}]})

test('pilot bubbles stay within three words and describe the current mission phase',()=>{
 const agent=make()
 for(const job of Object.values(VEHICLE_JOBS)){
  const fleet=fleetFor(job)
  for(const flags of [{phase:'outbound'},{phase:'working',operating:false},{operating:true},{routeBlocked:true}]){
   Object.assign(fleet,{phase:'working',operating:false,routeBlocked:false},flags)
   assert.ok(workerSpeech(agent,fleet).trim().split(/\s+/).length<=3)
  }
 }
 const fleet=fleetFor(VEHICLE_JOBS['mining-truck'])
 assert.equal(workerSpeech(agent,fleet),'Heading to drill');fleet.operating=true
 assert.equal(workerSpeech(agent,fleet),'Drilling post holes')
 agent.thread.running=false;agent.mounted=false;agent.magiActivity='snack'
 assert.equal(workerSpeech(agent,fleet),'Snack break','A retired pilot must not report a previous mission')
})
test('inspection reports real assignment, vehicle position, route distance, receipts and render counters',()=>{
 const agent=make(),fleet=fleetFor(VEHICLE_JOBS.dropship)
 const result=workerInspection(agent,fleet,{speed:4.25,groundY:.5,perf:{fps:58,frameMs:17.2,drawCalls:35,triangles:102000},viewport:{bw:1440,bh:900}})
 const rows=Object.fromEntries(result.rows),detail=Object.fromEntries(result.detail)
 assert.equal(rows.Task,agent.thread.taskTitle);assert.equal(rows.XYZ,'4.0 / 2.0 / 1.0')
 assert.equal(rows.Destination,'Stop 1/1 · 5.0 u away');assert.equal(rows.Travel,'4.3 u/s · 1.5 u altitude')
 assert.equal(rows.Tokens,'275,000 · cached');assert.match(rows['Next growth'],/25,000.*225,000/)
 assert.equal(detail.Receipts,'2 completed · 1 pending');assert.equal(detail.Render,'58 FPS · 17.2 ms')
 agent.thread.assignmentState='unknown';agent.thread.running=false;agent.mounted=false
 const idle=workerInspection(agent,null,{stale:true})
 assert.equal(Object.fromEntries(idle.rows).Vehicle,'Off duty · at camp');assert.equal(Object.fromEntries(idle.detail).Feed,'Unavailable · crew off shift')
 assert.ok(!idle.rows.some(([label])=>label==='Mission'||label==='Destination'))
 const unchanged=JSON.stringify(agent.thread);workerInspection(agent,null);assert.equal(JSON.stringify(agent.thread),unchanged)
})
