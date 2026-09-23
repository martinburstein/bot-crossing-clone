import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as adapter from '../server/swarm.mjs'
import {resolveSwarmRoot} from '../server/swarm-location.mjs'
import {allocateCells} from '../src/world/plots.js'

const roster={createdAt:1,shells:Array.from({length:10},(_,i)=>({id:'s'+String(i+1).padStart(2,'0'),name:'Color '+i,color:'#'+(0x100000+i).toString(16)}))}
const binding={parentThreadId:'codex:fixture-parent',agentPath:'/root/fixture-agent'}
const active={runId:'fixture-run',objective:'Synthetic visual test',createdAt:2,assignments:roster.shells.map((s,i)=>({
 shellId:s.id,role:'Role '+i,task:'Task',output:'Fixture output',acceptance:'Fixture',reviewer:roster.shells[(i+1)%10].id,
 dependsOn:[],state:i===0?'assigned':'queued',binding:i===0?binding:null
}))}
test('ten independent hexagons retain identities across role changes and reorder',()=>{
 const before=adapter.projectShells([],{roster,active:null},'/fixture')
 const after=adapter.projectShells([],{roster,active},'/fixture')
 assert.equal(new Set(after.map(s=>s.project)).size,10)
 assert.equal(new Set(after.map(s=>s.projectPath)).size,10)
 assert.equal(new Set(after.map(s=>s.suitColor)).size,10)
 assert.ok(after.every(s=>s.suitColor===s.projectAccent))
 assert.deepEqual(after.map(s=>s.project),before.map(s=>s.project))
 assert.deepEqual(after.map(s=>s.projectPath),before.map(s=>s.projectPath))
 assert.ok(after.every((s,i)=>s.projectLabel.includes('Role '+i)))
 const layout=allocateCells(after.map(s=>({id:s.project,size:1})))
 assert.ok([...layout.values()].every(c=>c.length===1))
 assert.equal(new Set([...layout.values()].flat().map(c=>c.q+','+c.r)).size,10)
 assert.deepEqual(allocateCells([...after].reverse().map(s=>({id:s.project,size:1})),layout),layout)
 assert.ok(before.every(s=>s.shellStatus==='Ready' && !s.running && !s.canOpen))
})
test('exact worker projection deduplicates and never fabricates queued execution',()=>{
 const worker={id:'codex:worker',...binding,running:true,canOpen:true,ref:{sessionId:'worker'}}
 const unrelated={...worker,id:'codex:unrelated',parentThreadId:'codex:other-parent'}
 const result=adapter.projectShells([worker,unrelated],{roster,active})
 assert.equal(result.length,11)
 assert.equal(result[0].shellStatus,'Working')
 assert.equal(result[0].boundThreadId,worker.id)
 assert.deepEqual(result[0].ref,worker.ref)
 assert.ok(result.slice(1,10).every(s=>s.shellStatus==='Queued'&&!s.running&&!s.canOpen))
 assert.equal(result.filter(s=>s.id===worker.id).length,0)
 assert.equal(adapter.projectShells([],{roster,active})[0].shellStatus,'Not observed')
 assert.equal(adapter.projectShells([{...worker,running:false}],{roster,active})[0].shellStatus,'Idle')
 assert.equal(adapter.projectShells([worker,{...worker,id:'duplicate'}],{roster,active})[0].shellStatus,'Not observed')
})
test('external read-only adapter reads changed data and restricts scroll paths',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'swarm-reader-'))
 t.after(()=>fs.rm(root,{recursive:true,force:true}))
 await fs.mkdir(path.join(root,'lib'))
 await fs.copyFile(new URL('./fixtures/swarm-reader.mjs',import.meta.url),path.join(root,'lib','state.mjs'))
 await fs.writeFile(path.join(root,'roster.json'),JSON.stringify(roster))
 await fs.writeFile(path.join(root,'active.json'),JSON.stringify(active))
 const dir=path.join(root,'runs',active.runId,'s01')
 await fs.mkdir(dir,{recursive:true})
 await fs.writeFile(path.join(dir,'AGENT.md'),'fixture scroll')
 assert.equal((await adapter.loadSwarm(root)).active.runId,active.runId)
 assert.equal(await adapter.scrollFor('s01',root),'fixture scroll')
 assert.equal(await adapter.scrollFor('../roster.json',root),null)
 await fs.writeFile(path.join(root,'active.json'),'null')
 assert.equal((await adapter.loadSwarm(root)).active,null)
 assert.equal(await adapter.scrollFor('s01',root),null)
 for(const name of ['prepareRun','updateRun','closeRun','editSwarm']) assert.equal(adapter[name],undefined)
})
test('viewer location is explicit and independent of process working directory',()=>{
 const base=path.resolve('fixture-viewer')
 assert.equal(resolveSwarmRoot({base,env:{},config:{root:'../Swarm'}}),path.resolve(base,'../Swarm'))
 assert.equal(resolveSwarmRoot({base,env:{BOT_CROSSING_SWARM_ROOT:'../Other'},config:{root:'../Swarm'}}),path.resolve(base,'../Other'))
 assert.equal(resolveSwarmRoot({base,env:{BOT_CROSSING_SWARM_ROOT:'../Other'}}),path.resolve(base,'../Other'))
 assert.throws(()=>resolveSwarmRoot({base,env:{},config:{root:''}}),/Configure/)
})
