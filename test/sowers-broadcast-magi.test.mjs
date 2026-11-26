import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {loadSowersBroadcast} from '../server/sowers-broadcast.mjs'
const uuid=n=>`00000000-0000-7000-8000-${String(n).padStart(12,'0')}`
function frame(now){return {version:1,observedAt:now,threads:[],magi:{id:'fixture-wave',number:1,sequence:1,phase:'working',admittedAt:now-1000,coordinator:{model:'gpt-6.1-sol',effort:'high',threadId:uuid(9)},agents:[1,2,3].map(n=>({id:'fixture:'+n,nativeId:'codex:'+uuid(n),name:'Luna '+n,role:'Fixture task',model:'gpt-6-luna',effort:'medium',state:'working',startedAt:now-1000,endedAt:null,accepted:false})),readiness:{agents:true,computer:true,dispenser:true,campfire:true}}}}
test('MAGI transport never replays a regressed/future frame or drops retained history on read errors',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sowers-magi-source-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'observation.json'),now=Date.now()
 const write=async value=>fs.writeFile(file,JSON.stringify(value))
 const initial=frame(now);await write(initial);let r=await loadSowersBroadcast({file});assert.equal(r.magi.sequence,1);assert.equal(r.magi.stale,false)
 const future=structuredClone(initial);future.magi.admittedAt=now+360000;await write(future);r=await loadSowersBroadcast({file});assert.equal(r.magi.sequence,1);assert.equal(r.magi.stale,true);assert.match(r.warnings.join(' '),/future/)
 const next=structuredClone(initial);next.magi.sequence=2;next.magi.phase='validating';next.magi.agents.forEach(a=>{a.state='complete';a.endedAt=now-500});await write(next);r=await loadSowersBroadcast({file});assert.equal(r.magi.sequence,2);assert.equal(r.magi.stale,false)
 await write({...initial,observedAt:Date.now()});r=await loadSowersBroadcast({file});assert.equal(r.magi.sequence,2);assert.equal(r.magi.phase,'validating');assert.equal(r.magi.stale,true)
 await fs.writeFile(file,'{partial');r=await loadSowersBroadcast({file});assert.equal(r.readError,true);assert.equal(r.magi.sequence,2);assert.equal(r.magi.stale,true)
 await write({version:1,observedAt:Date.now(),threads:[]});r=await loadSowersBroadcast({file});assert.equal(r.magi.sequence,2);assert.equal(r.magi.stale,true)
})
test('unbound source participants are rejected before they can be labelled live',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sowers-unbound-source-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'observation.json'),data=frame(Date.now());delete data.magi.agents[1].nativeId;await fs.writeFile(file,JSON.stringify(data));const r=await loadSowersBroadcast({file});assert.equal(r.magi,null);assert.match(r.warnings.join(' '),/native binding/)
})
