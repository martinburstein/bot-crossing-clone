import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {CameraRig} from '../src/core/camera.js'
import {readFile} from 'node:fs/promises'

// Exercise the real camera's bound event handlers, not a replacement navigation
// implementation. EventTarget stands in for the window/canvas without WebGL.
function fixture(){
 const old=globalThis.window
 globalThis.window=new EventTarget()
 const canvas=new EventTarget();canvas.style={};canvas.getBoundingClientRect=()=>({left:0,top:0,width:800,height:800})
 const camera=new THREE.PerspectiveCamera(38,1,.5,900)
 const rig=new CameraRig(camera,canvas,{get:()=>false})
 const event=(type,props={})=>Object.assign(new Event(type,{cancelable:true}),{pointerId:1,button:0,clientX:400,clientY:400,...props})
 const send=(type,props)=>{(type==='pointerdown'||type==='wheel'?canvas:globalThis.window).dispatchEvent(event(type,props))}
 const settle=()=>{for(let i=0;i<60;i++)rig.update(1/60)}
 return {rig,camera,canvas,send,settle,dispose(){rig.dispose();globalThis.window=old}}
}

test('standard Bot Crossing right-drag rotates and tilts; modifier drag also rotates',()=>{
 const f=fixture()
 try{
  const start=f.camera.position.clone(),target=f.rig.target.clone(),az=f.rig.azimuth,polar=f.rig.polar
  f.send('pointerdown',{button:2});f.send('pointermove',{clientX:500,clientY:440});f.send('pointerup',{button:2,clientX:500,clientY:440});f.settle()
  assert.ok(Math.abs(f.rig.azimuth-az)>.5);assert.ok(Math.abs(f.rig.polar-polar)>.15)
  assert.ok(f.camera.position.distanceTo(start)>10);assert.ok(f.rig.target.distanceTo(target)<.001);assert.equal(f.rig.wasClick,false)
  const before=f.rig.azimuth
  f.send('pointerdown',{shiftKey:true});f.send('pointermove',{clientX:460,shiftKey:true});f.send('pointerup',{clientX:460});f.settle()
  assert.ok(Math.abs(f.rig.azimuth-before)>.3)
 }finally{f.dispose()}
})

test('standard left-drag pans and wheel zooms; later input still works after focus',()=>{
 const f=fixture()
 try{
  f.rig.focus(new THREE.Vector3(-10,2,0),{distance:120,elevated:true});f.settle()
  const target=f.rig.target.clone(),az=f.rig.azimuth
  f.send('pointerdown');f.send('pointermove',{clientX:470});f.send('pointerup',{clientX:470});f.settle()
  assert.ok(f.rig.target.distanceTo(target)>3);assert.ok(Math.abs(f.rig.azimuth-az)<.001)
  const distance=f.rig.distance
  f.send('wheel',{deltaY:-100,deltaMode:0});f.settle();assert.ok(f.rig.distance<distance*.9)
  f.send('pointerdown',{button:2});f.send('pointermove',{clientX:450});f.send('pointerup',{button:2,clientX:450});f.settle();assert.ok(Math.abs(f.rig.azimuth-az)>.25)
 }finally{f.dispose()}
})

test('lab uses shared engine and camera; there is no parallel renderer or frame loop',async()=>{
 const root=new URL('../src/suit-lab/',import.meta.url)
 const [runtime,main,css]=await Promise.all(['runtime.js','main.js','style.css'].map(f=>readFile(new URL(f,root),'utf8')))
 for(const module of ['engine','camera','settings'])assert.ok(runtime.includes(`../core/${module}.js`))
 assert.ok(main.includes('engine.add({update:animate})')&&main.includes('engine.start()'))
 assert.ok(!/new THREE\.(WebGLRenderer|OrthographicCamera|Clock)|requestAnimationFrame|OrbitControls/.test(main))
 assert.ok(css.includes('#world>.bot-crossing-canvas'))
})
