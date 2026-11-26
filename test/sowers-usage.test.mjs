import test from 'node:test'
import assert from 'node:assert/strict'
import {createSowersUsageReader,measuredChat} from '../server/sowers-usage.mjs'
const id=n=>`00000000-0000-7000-8000-${String(n).padStart(12,'0')}`
const report=(n,total=110)=>({chat:{id:n,status:'connected',reportedAt:'2026-11-26T08:00:00Z',totalTokens:total,usage:{input_tokens:100,cached_input_tokens:70,output_tokens:10}},account:{status:'connected',reportedAt:'2026-11-26T08:00:00Z',remainingPercent:0,windowMinutes:10080,resetsAt:1795842145}})
const observation=async()=>({agents:[1,2,3].map(n=>({id:'worker:'+n,nativeId:'codex:'+id(n)}))})
test('HUD measurements preserve zero, never double-count subsets, and deduplicate concurrent/cache reads',async()=>{
 let now=100,calls=[]
 const read=createSowersUsageReader({now:()=>now,file:'/test/monitor.cjs',threadId:id(9),observation,run:async(file,thread,account)=>{calls.push({thread,account});return report(thread)}})
 const [a,b]=await Promise.all([read(),read()]);assert.deepEqual(a,b);assert.equal(calls.length,4);assert.equal(calls.filter(c=>c.account).length,1)
 assert.equal(a.account.remainingPercent,0);assert.equal(a.waveTokens,330);assert.equal(a.chat.totalTokens,110)
 await read();assert.equal(calls.length,4);now+=60001;await read();assert.equal(calls.length,8)
})
test('missing worker reports stay unavailable instead of becoming zero or another chat',async()=>{
 const read=createSowersUsageReader({file:'/test/monitor.cjs',threadId:id(9),observation,run:async(file,thread)=>thread===id(2)?report(id(99)):report(thread,0)})
 const r=await read();assert.equal(r.waveTokens,null);assert.equal(r.workersMeasured,2);assert.equal(r.workers[0].totalTokens,0);assert.equal(r.workers[1].totalTokens,null)
 assert.equal(measuredChat(report(id(9)),id(4)).totalTokens,null)
})
test('failed refresh retains the last verified reading as explicitly stale, configuration remains local',async()=>{
 let now=0,failed=false
 const read=createSowersUsageReader({now:()=>now,file:'/test/monitor.cjs',threadId:id(9),observation,run:async(file,thread)=>{if(failed)throw Error('private error contents');return report(thread)}})
 const before=await read();failed=true;now=60001;const after=await read();assert.equal(after.chat.totalTokens,before.chat.totalTokens);assert.equal(after.stale,true);assert.doesNotMatch(JSON.stringify(after),/private error contents/)
 const missing=await createSowersUsageReader({file:'relative',threadId:'invalid',observation,run:()=>{throw Error('must not execute')}})();assert.equal(missing.account.remainingPercent,null)
})
