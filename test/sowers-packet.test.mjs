import test from 'node:test'
import assert from 'node:assert/strict'
import { createSowerPacket } from '../sowers/packet.js'

test('packet has numbered geometry and explicit sealed to empty states', () => {
  const p=createSowerPacket({number:2,color:0xffcc44,seed:'lot-2'})
  assert.equal(p.group.name,'Sower packet 02');assert.equal(p.state,'sealed')
  const candy=p.group.children.find(o=>o.userData.kind==='candy-sower');assert.ok(candy);assert.equal(candy.visible,false)
  p.setProgress(.2);assert.equal(p.state,'peeling');p.setProgress(.7);assert.equal(p.state,'open')
  assert.equal(candy.visible,true)
  assert.equal(p.group.userData.seed,'lot-2');assert.ok(p.group.userData.bounds.sealed.height>.78&&p.group.userData.bounds.sealed.height<.79)
  assert.ok(p.group.userData.bounds.sealed.depth>.30);assert.ok(p.group.userData.bounds.full.height>1.2)
  p.setProgress(1);assert.equal(p.state,'empty');assert.equal(p.progress,1);p.dispose();p.dispose();assert.equal(p.group.children.length,0)
})

test('opening is opt-in, finite, bounded, pauseable and reduced-motion safe', () => {
  const p=createSowerPacket();p.update(.05);assert.equal(p.progress,0)
  p.startOpening().update(.05,{paused:true});assert.equal(p.progress,0)
  p.update(.05,{reducedMotion:true});assert.equal(p.progress,0)
  p.update(100);assert.ok(p.progress>0&&p.progress<=.0451)
  const held=p.progress;p.update(.05,{paused:true});assert.equal(p.progress,held)
  p.setProgress(Infinity);assert.equal(p.progress,held);p.dispose()
})

test('repeated unchanged progress does not move the label and includeCandy false omits the Scout', () => {
  const p=createSowerPacket({number:3});p.setProgress(.45)
  const bars=[];p.group.traverse(o=>{if(o.isMesh&&o.geometry.type==='BoxGeometry'&&Math.abs(o.position.z-.22)<1e-7)bars.push(o)})
  const before=bars.map(o=>o.position.toArray())
  for(let i=0;i<20;i++)p.setProgress(.45)
  assert.deepEqual(bars.map(o=>o.position.toArray()),before);p.dispose()
  const bare=createSowerPacket({number:1,includeCandy:false});let bodyCount=0
  bare.group.traverse(o=>{if(o.name==='one-piece-candy-body')bodyCount++})
  assert.equal(bodyCount,0);assert.equal(bare.group.userData.includesCandy,false)
  assert.deepEqual(bare.group.userData.bounds.full,bare.group.userData.bounds.sealed)
  bare.setProgress(.7);bare.update(0);bare.dispose();bare.dispose();assert.equal(bare.group.children.length,0)
})
