import test from 'node:test'
import assert from 'node:assert/strict'
import {Scene} from 'three'
import {createCanonicalCampus,canonicalCampusResponse} from '../src/world/canonical-campus.js'
import {allocateMagiCells,standbyMagiThreads} from '../src/game/magi-world.js'
import {FREE_CAMPUS,FREE_CAMPUS_HOMES} from '../src/world/free-campus-layout.js'

test('canonical scenery preserves actual worker evidence and the generic protocol profile',()=>{
  const native={threads:Array.from({length:17},()=>({worldProfile:'roarm-campus'}))}
  assert.equal(canonicalCampusResponse(native),native)
  const source={mode:'standby',threads:standbyMagiThreads(),worksite:{stale:false}}
  const original=structuredClone(source),result=canonicalCampusResponse(source)
  assert.deepEqual(source,original)
  assert.equal(result.threads.length,17)
  assert.equal(result.threads.filter(t=>t.displayOnly).length,2)
  for(const [i,t]of result.threads.filter(t=>!t.displayOnly).entries()){
    assert.equal(t.worldProfile,'15-3A');assert.equal(t.dispatchMode,undefined)
    assert.equal(t.running,false);assert.equal(t.roleId,undefined)
    assert.equal(t.id,source.threads[i].id);assert.equal(t.assignmentState,source.threads[i].assignmentState)
  }
  assert.ok(result.worksite.displaySlots.every(s=>s.status==='idle'&&s.roleId===null))
  source.threads[0].running=true;source.threads[0].assignmentState='reviewing'
  const active=canonicalCampusResponse(source)
  assert.deepEqual(active.worksite.displaySlots.map(s=>s.status),['running','idle','idle'])
  assert.equal(active.threads[0].assignmentState,'reviewing')
})

test('canonical campus uses all three computers, seventeen resident homes and fifteen worker identities',()=>{
  const scene=new Scene(),world=createCanonicalCampus(scene),data=canonicalCampusResponse({threads:standbyMagiThreads(),worksite:{stale:false}})
  world.update(data.worksite)
  assert.equal(world.campusGroup.visible,true);assert.equal(world.armModel.group.visible,false)
  assert.equal(world.pods.length,15)
  for(const id of ['melchior','balthasar','casper']){
    const core=world.cores[id];assert.equal(core.name,`campus-supercomputer-${id}`)
    assert.equal(core.position.x,FREE_CAMPUS[id].x);assert.equal(core.position.z,FREE_CAMPUS[id].z)
    assert.deepEqual(core.userData.footprint,{width:28,depth:28});assert.equal(core.userData.unitState,'idle')
  }
  const homes=allocateMagiCells(data.threads.map(t=>({...t,cells:1})))
  assert.equal(new Set([...homes.values()].map(v=>JSON.stringify(v))).size,17)
  for(const t of data.threads)assert.deepEqual(homes.get(t.id),[FREE_CAMPUS_HOMES[t.shellId]])
  world.update({stale:true});for(const core of Object.values(world.cores))assert.equal(core.userData.caption,'FEED UNAVAILABLE')
  world.dispose();assert.equal(scene.children.length,0)
})
