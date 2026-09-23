import test from 'node:test'
import assert from 'node:assert/strict'
import {missionRows} from '../src/ui/mission-data.mjs'
test('mission view distinguishes queued roles from real workers and isolates parent task',()=>{
  const plan={parentThreadId:'codex:parent',roles:[{id:'P01',agentPath:'/root/a',state:'assigned'},{id:'P02',agentPath:'/root/b',state:'queued'}]}
  const rows=missionRows(plan,[{id:'other',parentThreadId:'codex:other',agentPath:'/root/b',running:true},{id:'current',parentThreadId:'codex:parent',agentPath:'/root/a',running:true}])
  assert.equal(rows[0].live,'Working');assert.equal(rows[0].taskId,'current')
  assert.equal(rows[1].live,'Not observed');assert.equal(rows[1].taskId,null);assert.equal(rows[1].state,'queued')
})
test('submitted deliverable does not fabricate runtime completion',()=>{
  const plan={parentThreadId:'p',roles:[{agentPath:'/root/a',state:'submitted'}]}
  assert.equal(missionRows(plan,[{id:'a',parentThreadId:'p',agentPath:'/root/a',running:true}])[0].live,'Working')
})
test('a stale scan never represents cached activity as current',()=>{
  const plan={parentThreadId:'p',roles:[{agentPath:'/root/a',state:'assigned'},{agentPath:'/root/b',state:'queued'}]}
  const rows=missionRows(plan,[{id:'a',parentThreadId:'p',agentPath:'/root/a',running:true}],false)
  assert.deepEqual(rows.map(row=>row.live),['Unknown','Unknown'])
  assert.equal(rows[0].taskId,'a')
  assert.equal(rows[1].taskId,null)
})
