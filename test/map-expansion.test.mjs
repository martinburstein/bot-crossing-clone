import test from 'node:test'
import assert from 'node:assert/strict'
import {PLANETS,createTerrain,fitColonyTerrain,COLONY_RADIUS} from '../src/world/planet.js'
import {Navigation} from '../src/agents/navigation.js'

test('open ground has twice the former area before and after colony growth, without compounding on polls',()=>{
  const check=(oldSide,oldRadius)=>{
    const mesh=createTerrain(PLANETS.mars,'low')
    const {width,height}=mesh.geometry.parameters
    assert.ok(Math.abs(width*height/(oldSide*oldSide)-2)<1e-12)
    assert.ok(Math.abs(COLONY_RADIUS**2/oldRadius**2-2)<1e-12)
    assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite))
    mesh.geometry.dispose();mesh.material.dispose()
  }
  check(340,46)
  assert.equal(fitColonyTerrain(85),true);check(352,96)
  assert.equal(fitColonyTerrain(85),false);check(352,96)
  assert.equal(fitColonyTerrain(240),true);check(640,240)
  assert.equal(fitColonyTerrain(240),false)
  assert.equal(fitColonyTerrain(46),false);check(640,240)
})

test('the expanded navigation grid can route into open ground beyond the former colony boundary',()=>{
  const nav=new Navigation({half:Math.ceil((COLONY_RADIUS+8)/16)*16})
  nav.rebuild([])
  assert.equal(nav.isBlocked(130,0),false)
  const route=nav.findPath(0,0,130,0)
  assert.ok(route?.length>0)
  assert.ok(Math.abs(route.at(-1).x-130)<1)
})
