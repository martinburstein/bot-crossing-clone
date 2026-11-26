import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeMagiObservation,magiInfrastructureReady,magiObservedThreads} from '../sowers/magi-observation.mjs'
const id='00000000-0000-7000-8000-000000000009'
const fixture=()=>({id:'test-wave',number:1,phase:'working',admittedAt:100,coordinator:{model:'gpt-6.1-sol',effort:'high',threadId:id},agents:[0,1,2].map(i=>({id:'agent:'+i,name:'Luna '+i,role:'Test task '+i,model:'gpt-6-luna',effort:'medium',state:'working',startedAt:100,endedAt:null,accepted:false})),readiness:{agents:true,computer:true,dispenser:true,campfire:false}})
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
