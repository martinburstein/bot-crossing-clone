import test from 'node:test'
import assert from 'node:assert/strict'
import {projectObservation,createObservationReader} from '../server/roarm.mjs'
import {apiMiddleware} from '../server/api.mjs'
import {createServer} from 'node:http'
const time=Date.parse('2026-10-09T06:00:00Z')
const sample=()=>({source:'hardware',connected:true,freshness:'live',measured:{source:'hardware',observedAt:new Date(time).toISOString(),base:.2,shoulder:.3,elbow:1.5,gripper:3.1},commanded:{base:999},movement:{unresolved:[{private:'never forward'}]},owner:'private'})
test('only fresh measured joints are projected; commanded and private data never escape',()=>{
 const p=projectObservation(sample(),time+1)
 assert.equal(p.state,'live');assert.equal(p.pose.base,.2);assert.equal(p.unresolvedMovementCount,1)
 assert.equal(JSON.stringify(p).includes('private'),false)
 for(const status of [{...sample(),measured:null},{...sample(),connected:false},{...sample(),freshness:'stale'}, {...sample(),measured:{...sample().measured,base:NaN}}])assert.equal(projectObservation(status,time+1).pose,null)
 assert.equal(projectObservation(sample(),time+5001).pose,null)
 assert.equal(projectObservation(sample(),time-1).pose,null)
 const simulated={...sample(),source:'simulator',simulated:{...sample().measured,source:'simulator',base:.6}}
 assert.equal(projectObservation(simulated,time).pose.base,.6)
 assert.equal(projectObservation(simulated,time).source,'simulator')
})
test('GET-only single-flight bridge freezes the last good pose on error and redacts credentials',async()=>{
 let now=time,calls=0,fail=false
 const read=createObservationReader({now:()=>now,readToken:async()=>'secret-sentinel',fetchImpl:async(url,options)=>{
   calls++;assert.equal(url,'http://127.0.0.1:8787/api/status');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.body,undefined)
   if(fail)throw Error('secret-sentinel');return {ok:true,json:async()=>sample()}
 }})
 const [a,b]=await Promise.all([read(),read()]);assert.deepEqual(a,b);assert.equal(calls,1)
 await read();assert.equal(calls,1)
 now+=1000;fail=true;const stale=await read();assert.equal(stale.state,'offline');assert.deepEqual(stale.pose,a.pose);assert.equal(stale.observedAt,a.observedAt)
 assert.equal(JSON.stringify(stale).includes('secret-sentinel'),false)
})
test('observation route rejects writes before touching the controller',async t=>{
 const server=createServer(apiMiddleware);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)))
 const origin=`http://127.0.0.1:${server.address().port}`
 for(const method of ['POST','PUT','DELETE']){const response=await fetch(origin+'/api/roarm/observation',{method,headers:{origin}});assert.equal(response.status,405)}
 const cross=await fetch(origin+'/api/roarm/observation',{headers:{origin:'http://example.com'}});assert.equal(cross.status,403)
})
