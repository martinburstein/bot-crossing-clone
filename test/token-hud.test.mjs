import test from 'node:test'
import assert from 'node:assert/strict'
import {projectTokenHud} from '../server/token-hud.mjs'
import {apiMiddleware} from '../server/api.mjs'

test('HUD exposes readouts without private source data and preserves zero/unknown',()=>{
  const value=projectTokenHud({tokens:0,remaining:0,taskTitle:'Example',tasks:[{secret:'sentinel'}],tokenError:'private path',credentials:'sentinel'})
  assert.equal(value.tokens,0);assert.equal(value.remaining,0)
  assert.equal(value.accountAt,null)
  assert.equal(JSON.stringify(value).includes('sentinel'),false)
  assert.equal('tokenError' in value,false)
  assert.equal(projectTokenHud({}).tokens,null)
  assert.equal(projectTokenHud({}).remaining,null)
})
test('usage route refuses writes, foreign origins and rebound hosts before reading usage',async()=>{
  for(const [method,host,origin,status] of [
    ['POST','127.0.0.1:5274','http://127.0.0.1:5274',405],
    ['GET','127.0.0.1:5274','http://127.0.0.1:9000',403],
    ['GET','127.0.0.1:5274','https://example.com',403],
    ['GET','example.com:5274',undefined,403],
  ]) {
    let code
    const res={setHeader(){},writeHead(value){code=value;return this},end(){}}
    await apiMiddleware({url:'/api/token-hud',method,headers:{host,origin}},res)
    assert.equal(code,status)
  }
})
