import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptedCheckpoints, mergeBroadcastThreads, visibleThreads } from '../sowers/telemetry.mjs'

test('checkpoints remain independent of explicit fractions and declared plan steps',()=>{
  const thread={id:'worker:1',constructionProgress:.8,plan:{steps:[{status:'completed'}]},milestones:[
    {id:'kept',title:'Evidence checked'}, {id:'retracted',retractedAt:1}, {id:'pending',status:'pending'}, {id:'rejected',accepted:false},
  ]}
  assert.deepEqual(acceptedCheckpoints(thread).map(m=>m.id),['kept'])
  assert.equal(visibleThreads([thread])[0].checkpoints.length,1)
})

test('broadcasts enrich work measures without replacing native session lifecycle',()=>{
  const local=[{id:'worker:1',running:true,title:'Native session',milestones:[{id:'native'}]}]
  const reported=[{id:'worker:1',running:false,constructionProgress:.5,milestones:[{id:'fresh'}],broadcastStale:false}]
  const merged=mergeBroadcastThreads(local,reported)
  assert.equal(merged[0].running,true)
  assert.equal(merged[0].title,'Native session')
  assert.equal(merged[0].constructionProgress,.5)
  assert.equal(merged[0].milestones[0].id,'fresh')
  assert.equal(local[0].milestones[0].id,'native')
  const stale=mergeBroadcastThreads(local,[{...reported[0],broadcastStale:true}])
  assert.equal(stale[0].constructionProgress,undefined)
  assert.equal(stale[0].milestones[0].id,'native')
  assert.equal(stale[0].broadcastStale,undefined)
  assert.equal(stale[0].broadcastEvidenceStale,true)
})

test('retractions and conflicting identities cannot earn duplicate checkpoints',()=>{
  const milestones=[{id:'same',accepted:true},{id:'same',accepted:true},{id:'gone',accepted:true},
    {id:'gone',status:'retracted'},{id:'removed',retracted:true},{id:'status',status:'retracted'},
    {title:'Anonymous canonical evidence'}]
  assert.equal(acceptedCheckpoints({milestones}).length,2)
  assert.equal(acceptedCheckpoints({milestones}).filter(m=>m.id==='same').length,1)
})

test('session scope admits current work and recent observations, with stable identity colors',()=>{
  const now=Date.now()
  const sessions=[{id:'old',lastActivityAt:1},{id:'working',running:true,lastActivityAt:1},
    {id:'fresh',title:'Fresh',lastActivityAt:now},{id:'archived',archived:true,running:true}]
  assert.deepEqual(visibleThreads(sessions,'','recent',now).map(t=>t.id),['working','fresh'])
  assert.deepEqual(visibleThreads(sessions,'','active',now).map(t=>t.id),['working'])
  assert.equal(visibleThreads(sessions,'fresh')[0].color,visibleThreads([...sessions].reverse(),'fresh')[0].color)
})
