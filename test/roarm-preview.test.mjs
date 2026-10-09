import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {createRoArmModel} from '../src/world/roarm-model.js'
import {createRoArmPreview,ROARM_PREVIEW_LIMITS_RAD,ROARM_PREVIEW_MAX_MOVES} from '../src/world/roarm-preview.js'
import {RoArmPreviewPanel} from '../src/ui/roarm-preview.js'

const t0=Date.parse('2026-10-09T07:00:00.000Z')
const basePose={base:0,shoulder:.1,elbow:1.1,gripper:3.1}
const targetPose={base:.2,shoulder:.2,elbow:1.3,gripper:2.8}
const observation=(patch={})=>({source:'hardware',state:'live',observedAt:new Date(t0).toISOString(),pose:{...basePose},...patch})

test('preview ghost is separate from the measured model and never updates its joints',()=>{
  let now=t0
  const scene=new THREE.Scene(),measured=createRoArmModel(),preview=createRoArmPreview(scene,{now:()=>now})
  scene.add(measured.group)
  measured.updateObservation({source:'hardware',state:'measured',observedAt:new Date(t0).toISOString(),pose:basePose})
  const before=measured.observation.pose
  assert.notEqual(preview.group,measured.group)
  assert.equal(preview.group.userData.simulationOnly,true)
  assert.equal(preview.group.visible,false)
  assert.equal(preview.preview({startPose:observation(),moves:[targetPose]}).status,'previewing')
  assert.equal(preview.group.visible,true)
  assert.equal(preview.group.userData.source,'simulation-preview')
  assert.deepEqual(measured.observation.pose,before)
  assert.equal(preview.snapshot().simulationOnly,true)
  assert.equal(preview.snapshot().clearance,'unverified')
  const after=preview.update(.3)
  assert.ok(after.pose.shoulder>basePose.shoulder&&after.pose.shoulder<targetPose.shoulder)
  assert.deepEqual(measured.observation.pose,before)
  preview.clear();assert.equal(preview.group.visible,false);assert.equal(preview.snapshot().pose,null)
  preview.dispose();measured.dispose()
  assert.equal(scene.children.length,0)
})

test('preview rejects stale, offline, future, malformed and out-of-range starts before displaying a ghost',()=>{
  let now=t0
  const scene=new THREE.Scene(),preview=createRoArmPreview(scene,{now:()=>now})
  const reject=observation=>assert.throws(()=>preview.preview({startPose:observation,moves:[targetPose]}))
  reject(observation({state:'offline'}))
  reject(observation({state:'stale'}))
  reject(observation({source:null}))
  reject(observation({observedAt:new Date(t0-5001).toISOString()}))
  reject(observation({observedAt:new Date(t0+1).toISOString()}))
  reject(observation({pose:{...basePose,base:NaN}}))
  reject(observation({pose:{...basePose,shoulder:ROARM_PREVIEW_LIMITS_RAD.shoulder[1]+.01}}))
  assert.equal(preview.group.visible,false)
  assert.equal(preview.snapshot().status,'idle')
  now=t0+5001
  assert.throws(()=>preview.preview({startPose:observation(),moves:[targetPose]}),/stale/)
  preview.dispose()
})

test('preview accepts no more than ten finite absolute joint targets inside illustrative bounds',()=>{
  let now=t0
  const scene=new THREE.Scene(),preview=createRoArmPreview(scene,{now:()=>now})
  assert.equal(ROARM_PREVIEW_MAX_MOVES,10)
  const moves=Array.from({length:10},(_,index)=>({...targetPose,base:index*.01}))
  assert.equal(preview.preview({startPose:observation(),moves}).totalMoves,10)
  assert.throws(()=>preview.preview({startPose:observation(),moves:[...moves,targetPose]}),/1 to 10/)
  assert.throws(()=>preview.preview({startPose:observation(),moves:[{...targetPose,elbow:Infinity}]}),/finite radians/)
  assert.throws(()=>preview.preview({startPose:observation(),moves:[{...targetPose,gripper:0}]}),/simulation range/)
  assert.equal(preview.snapshot().totalMoves,10)
  assert.throws(()=>preview.update(Infinity),/finite and nonnegative/)
  preview.clear();assert.equal(preview.snapshot().status,'idle')
  preview.dispose()
})

test('preview sequence is finite and completes without changing the measured source',()=>{
  let now=t0
  const scene=new THREE.Scene(),measured=createRoArmModel(),preview=createRoArmPreview(scene,{now:()=>now})
  const measuredInput=observation({source:'simulator'})
  measured.updateObservation({...measuredInput,pose:measuredInput.pose})
  preview.preview({startPose:measuredInput,moves:[targetPose,{...targetPose,base:.35}]})
  for(let i=0;i<20;i++)preview.update(.25)
  const result=preview.snapshot()
  assert.equal(result.status,'complete')
  assert.equal(result.completedMoves,2)
  assert.equal(result.pose.base,.35)
  assert.equal(result.source,'simulator')
  assert.deepEqual(measured.observation.pose,basePose)
  preview.dispose();measured.dispose()
})

class FakeElement {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.value='';this.disabled=false;this.parent=null}
  append(...items){for(const item of items){item.parent=this;this.children.push(item)}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this)}
  setAttribute(name,value){this.attributes[name]=String(value)}
  dispatchEvent(event){this[`on${event.type}`]?.(event);return true}
  querySelectorAll(selector){const results=[];const visit=node=>{for(const child of node.children){if(selector==='button'&&child.tagName==='BUTTON')results.push(child);visit(child)}};visit(this);return results}
}

test('panel labels simulator-only behavior, starts from fresh measured observation, and reset only clears preview',()=>{
  const oldDocument=globalThis.document,oldEvent=globalThis.Event
  globalThis.document={createElement:tag=>new FakeElement(tag)}
  globalThis.Event=class {constructor(type){this.type=type}}
  try {
    let now=Date.now(),current=null
    const root=new FakeElement('div'),scene=new THREE.Scene(),preview=createRoArmPreview(scene,{now:()=>now})
    const panel=RoArmPreviewPanel(root,preview,()=>current)
    assert.match(panel.element.children[1].textContent,/Simulation only.*collision clearance unverified/)
    assert.match(panel.element.children[2].textContent,/open reference is uncalibrated/)
    const [start,reset]=panel.element.querySelectorAll('button')
    assert.equal(start.disabled,true)
    current=observation({observedAt:new Date(now).toISOString()});panel.refresh()
    assert.equal(start.disabled,false)
    assert.equal(panel.element.children[4].children[2].children[1].value,'5.7')
    start.onclick()
    assert.equal(preview.snapshot().status,'previewing')
    current={...current,state:'offline',observedAt:new Date(now-6000).toISOString()};panel.refresh()
    assert.equal(start.disabled,true)
    reset.onclick()
    assert.equal(preview.snapshot().status,'idle')
    assert.match(panel.element.children.at(-1).textContent,/No robot command was sent/)
    panel.dispose();preview.dispose()
    assert.equal(root.children.length,0)
  } finally {
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument
    if(oldEvent===undefined)delete globalThis.Event;else globalThis.Event=oldEvent
  }
})
