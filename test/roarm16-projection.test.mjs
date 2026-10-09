import test from 'node:test'
import assert from 'node:assert/strict'
import {projectMagiState} from '../server/magi.mjs'
import {allocateMagiCells} from '../src/game/magi-world.js'

const now=100000
function fixture(){
  const ids=['w00','balthasar','casper'],slots=['melchior','balthasar','casper']
  return {schemaVersion:1,mode:'live',revision:4,projectId:'role-pair-fixture',observedAt:now,
    tasks:[],notes:[],milestones:[],capacity:{total:3,limit:3,running:2,reserved:0,occupied:2},
    workers:ids.map((id,i)=>({id,name:slots[i],bound:i>0,status:i?'running':'idle',backend:'fixture'})),
    magi:{mode:'magi',profile:'roarm-16',personaCount:16,
      executorSlots:ids.map((workerId,i)=>({workerId,slotId:slots[i],roleId:i?'r05':'pilot',bound:i>0,status:i?'running':'idle',occupied:i>0})),
      roleCatalog:Array.from({length:15},(_,i)=>({id:`r${String(i+1).padStart(2,'0')}`,title:`Role ${i+1}`,purpose:`Purpose ${i+1}`})),
      pilot:{workerId:'w00',slotId:'melchior',roleId:'pilot',duty:'on',generation:1},earnedRewards:[],contracts:[]}}
}
test('same role in two slots keeps two confirmed sessions and sixteen village bodies',()=>{
  const state=fixture(),p=projectMagiState(state,now)
  assert.equal(p.threads.length,16)
  assert.equal(p.alignment.count,2)
  const live=p.threads.filter(t=>t.running)
  assert.deepEqual(live.map(t=>t.roleId),['r05','r05'])
  assert.deepEqual(live.map(t=>t.workerId),['balthasar','casper'])
  assert.equal(new Set(live.map(t=>t.id)).size,2)
  assert.equal(p.threads[0].pilotIdentity,true)
  assert.equal(p.threads[0].running,false)
  assert.equal(p.worksite.pilot.duty,'on')
  assert.equal(p.worksite.symbiosis.id,'r05-r05')
  const cells=allocateMagiCells(p.threads.map(t=>({...t,id:t.project})))
  assert.equal(cells.size,16)
  assert.deepEqual(cells.get('MAGI w00'),[{q:0,r:0}])
})
test('ordered pair swaps are distinguishable while rendering identities stay stable',()=>{
  const s=fixture();s.magi.executorSlots[1].roleId='r03';s.magi.executorSlots[2].roleId='r06'
  const first=projectMagiState(s,now)
  s.magi.executorSlots[1].roleId='r06';s.magi.executorSlots[2].roleId='r03'
  const second=projectMagiState(s,now)
  assert.equal(first.worksite.symbiosis.id,'r03-r06');assert.equal(second.worksite.symbiosis.id,'r06-r03')
  assert.deepEqual(first.threads.map(t=>t.id),second.threads.map(t=>t.id))
})
test('unconfirmed slot activity and stale projections fail closed',()=>{
  const s=fixture();s.magi.executorSlots[1].bound=false
  assert.throws(()=>projectMagiState(s,now),/matching worker/)
  assert.throws(()=>projectMagiState(fixture(),now+20001),/stale/)
  const invalid=fixture();invalid.magi.executorSlots[2].slotId='balthasar'
  assert.throws(()=>projectMagiState(invalid,now),/three slots/)
})
