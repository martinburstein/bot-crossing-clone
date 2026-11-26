import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeMagiObservation,magiInfrastructureReady,magiObservedThreads,createMagiObservationGuard} from '../sowers/magi-observation.mjs'
const id='00000000-0000-7000-8000-000000000009'
const fixture=()=>({id:'test-wave',number:1,sequence:1,phase:'working',admittedAt:100,coordinator:{model:'gpt-6.1-sol',effort:'high',threadId:id},agents:[0,1,2].map(i=>({id:'agent:'+i,nativeId:'codex:00000000-0000-7000-8000-'+String(i+1).padStart(12,'0'),name:'Luna '+i,role:'Test task '+i,model:'gpt-6-luna',effort:'medium',state:'working',startedAt:100,endedAt:null,accepted:false})),readiness:{agents:true,computer:true,dispenser:true,campfire:false}})
test('MAGI observations require exactly three distinct actual participant records and terminal timing',()=>{
 const f=fixture();assert.equal(normalizeMagiObservation(f).agents.length,3)
 assert.throws(()=>normalizeMagiObservation({...f,agents:f.agents.slice(1)}))
 assert.throws(()=>normalizeMagiObservation({...f,agents:[f.agents[0],f.agents[0],f.agents[2]]}))
 assert.throws(()=>normalizeMagiObservation({...f,phase:'campfire'}))
 f.agents[0].state='complete';assert.throws(()=>normalizeMagiObservation(f))
 f.agents[0].endedAt=120;assert.equal(normalizeMagiObservation(f).agents[0].state,'complete')
})
test('visual work state cannot award construction without explicit accepted work or readiness',()=>{
 const f=normalizeMagiObservation(fixture());assert.equal(magiInfrastructureReady(f),false)
 assert(magiObservedThreads(f).every(t=>t.milestones.length===0&&!Object.hasOwn(t,'constructionProgress')))
 f.stale=true;assert(magiObservedThreads(f).every(t=>!t.running))
 f.readiness.campfire=true;assert.equal(magiInfrastructureReady(f),true)
 f.agents[0].state='complete';f.agents[0].accepted=true;f.agents[0].endedAt=200
 assert.equal(magiObservedThreads(f)[0].constructionProgress,1)
})

test('future, unbound and regressed observations never become fresh admissions',()=>{
 const f=fixture(),guard=createMagiObservationGuard();guard.accept(f,1000);
 const bad=structuredClone(f);delete bad.agents[0].nativeId;assert.throws(()=>normalizeMagiObservation(bad));
 assert.throws(()=>guard.accept({...f,admittedAt:2000},1000));
 const closed=structuredClone(f);closed.sequence=2;closed.phase='campfire';closed.agents.forEach(a=>{a.state='error';a.endedAt=200});
 guard.accept(closed,1000);assert.equal(guard.last.phase,'campfire');
 assert.throws(()=>guard.accept(f,1100));assert.throws(()=>guard.accept({...closed,phase:'complete',sequence:3},1100));
 assert.throws(()=>guard.accept({...closed,sequence:2,readiness:{...closed.readiness,campfire:true}},1100));
 const done=structuredClone(closed);done.phase='complete';done.sequence=3;done.agents.forEach(a=>{a.state='complete';a.accepted=true;a.memorialId=a.id+':image'});
 guard.accept(done,1100);assert.equal(guard.last.phase,'complete');
 assert.throws(()=>guard.accept({...done,id:'different',number:2,sequence:1,admittedAt:1200},1300));
});
test('recorded working state cannot override a stopped or differently bound native worker',()=>{
 const f=normalizeMagiObservation(fixture())
 const source=f.agents.map(a=>({id:a.nativeId,agentPath:a.id,parentThreadId:'codex:'+f.coordinator.threadId,running:true}))
 assert.equal(magiObservedThreads(f,source).filter(t=>t.running).length,3)
 source[0].running=false;source[1].parentThreadId='codex:00000000-0000-7000-8000-000000000099'
 const rows=magiObservedThreads(f,source);assert.equal(rows.filter(t=>t.running).length,1);assert.equal(rows[1].broadcastStale,true)
})
test('an older protocol observation never suppresses fresh bound native activity or replays admission',()=>{
 const f=normalizeMagiObservation(fixture());f.stale=true
 const native=f.agents.map(a=>({id:a.nativeId,agentPath:a.id,parentThreadId:'codex:'+f.coordinator.threadId,running:true}))
 const rows=magiObservedThreads(f,native);assert(rows.every(r=>r.running&&!r.broadcastStale&&r.broadcastEvidenceStale));assert.equal(f.stale,true)
})
