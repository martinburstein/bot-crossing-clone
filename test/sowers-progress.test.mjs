import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { constructionStages, clampProgress, stageProgress, observedConstruction } from '../sowers/progress.mjs'
import { createMissionBase } from '../sowers/base.js'

test('completion requires a declared denominator; activity and closed runs cannot fabricate progress', () => {
  for (const thread of [{}, { sizeBytes: 1e9, tokens: 1e9, running: true }, { runClosed: true, status: 'Cancelled' }, { status: 'Complete' }]) {
    assert.equal(observedConstruction(thread).fraction, null)
  }
  const checkpoints=observedConstruction({ milestones: [{ title:'A' }, { accepted:true }, { accepted:false }, { status:'pending' }, { status:'rejected' }, { retractedAt:123 }] })
  assert.equal(checkpoints.completed,2)
  assert.equal(checkpoints.total,null)
  assert.equal(checkpoints.fraction,null)
  assert.equal(checkpoints.source,'milestones')
  assert.equal(observedConstruction({ constructionProgress:.7 }).fraction,.7)
  for(const value of [-1,2,NaN,Infinity,'0.8']) assert.equal(observedConstruction({constructionProgress:value}).fraction,null)
  assert.equal(observedConstruction({plan:{steps:[{status:'completed'},{status:'in_progress'},{status:'pending'}]}}).fraction,1/3)
})

test('stages are bounded, deterministic and monotonic', () => {
  for(const s of constructionStages) {
    let previous=0
    for(let i=0;i<=100;i++) {
      const next=stageProgress(i/100,s)
      assert.ok(next>=previous && next>=0 && next<=1)
      previous=next
    }
    assert.equal(stageProgress(s.end,s),1)
  }
  for(const v of [NaN,undefined,Infinity,'0.8']) assert.equal(clampProgress(v),0)
})

test('seeded modules stay fixed as construction advances, reveal in phase order, and fit the site', () => {
  function signature(base) {
    const values=[]
    base.traverse(o=>{if(o.isMesh) values.push([o.geometry.type,o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()])})
    return values
  }
  for(const kind of ['habitat','power','relay','lab']) for(const seed of ['Sowers','Astra','Finch','Mesa']) {
    const base=createMissionBase({seed,kind})
    const fixed=signature(base)
    assert.deepEqual(signature(createMissionBase({seed,kind})),fixed)
    let previous=0
    for(let i=0;i<=100;i++) {
      const fraction=i/100
      base.userData.setProgress(fraction)
      let visible=0
      for(const [id,parts] of Object.entries(base.userData.constructionParts)) {
        visible+=parts.filter(o=>o.visible).length
        if(parts.some(o=>o.visible)) {
          const index=constructionStages.findIndex(s=>s.id===id)
          for(const prior of constructionStages.slice(0,index)) assert.ok(base.userData.constructionParts[prior.id].every(o=>o.visible))
        }
      }
      assert.ok(visible>=previous); previous=visible
      assert.deepEqual(signature(base),fixed)
    }
    base.updateMatrixWorld(true)
    const bounds=new THREE.Box3().setFromObject(base)
    const size=bounds.getSize(new THREE.Vector3())
    assert.ok(size.x<=8 && size.z<=8 && bounds.min.y>=-.001 && bounds.max.y<=5,`${kind}/${seed}: ${size.toArray()}`)
    base.userData.setProgress(.24)
    assert.equal(base.getObjectByName('Temporary assembly gantry').visible,true)
    base.userData.setProgress(1)
    assert.equal(base.getObjectByName('Temporary assembly gantry').visible,false)
  }
  assert.notDeepEqual(signature(createMissionBase({seed:'Astra'})),signature(createMissionBase({seed:'Finch'})))
})
