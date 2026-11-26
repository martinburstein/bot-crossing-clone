import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldRender } from '../sowers/render-budget.mjs'

test('hidden mission never renders, including dirty or first frames', () => {
  assert.equal(shouldRender({now:0, hidden:true, dirty:true}), false)
  assert.equal(shouldRender({now:50, lastRender:0, hidden:true, cameraMoving:true}), false)
})
test('initial and resumed clock frames render', () => {
  assert.equal(shouldRender({now:0, paused:true}), true)
  assert.equal(shouldRender({now:10, lastRender:20}), true)
})
test('60Hz callbacks yield roughly 30 mission frames without rounding starvation', () => {
  let lastRender
  const rendered=[]
  for (let i=0;i<61;i++) {
    const now=i*16.666
    if (shouldRender({now,lastRender})) {rendered.push(i);lastRender=now}
  }
  assert.equal(rendered.length,31)
  assert.deepEqual(rendered.slice(0,5),[0,2,4,6,8])
})
test('paused unchanged scene sleeps while data and input remain responsive', () => {
  assert.equal(shouldRender({now:1000,lastRender:0,paused:true}),false)
  assert.equal(shouldRender({now:1,lastRender:0,paused:true,dirty:true}),true)
})
test('camera damping can repaint a paused scene at the mission cadence', () => {
  assert.equal(shouldRender({now:16.7,lastRender:0,paused:true,cameraMoving:true}),false)
  assert.equal(shouldRender({now:33.3,lastRender:0,paused:true,cameraMoving:true}),true)
})
test('an explicit alternate frame cap is honored', () => {
  assert.equal(shouldRender({now:33.3,lastRender:0,maxFps:15}),false)
  assert.equal(shouldRender({now:66.6,lastRender:0,maxFps:15}),true)
})
