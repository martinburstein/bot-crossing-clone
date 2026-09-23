import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { artifactMiddleware, isPublicArtifact } from '../server/dyson-artifacts.mjs'

test('artifact serving reads changed mission data without rebuilding and excludes compiler caches', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'dyson-artifact-'))
  const middleware = artifactMiddleware(root)
  const request = async url => {
    const result = {}
    const res = {writeHead(status,headers){Object.assign(result,{status,headers});return this},end(body){result.body=body?.toString()}}
    await middleware({url},res,()=>{result.next=true})
    return result
  }
  try {
    await fs.writeFile(path.join(root,'workflow.json'),'{"revision":1}')
    assert.equal((await request('/artifacts/dyson/workflow.json')).body,'{"revision":1}')
    await fs.writeFile(path.join(root,'workflow.json'),'{"revision":2}')
    const updated = await request('/artifacts/dyson/workflow.json')
    assert.equal(updated.body,'{"revision":2}')
    assert.equal(updated.headers['Cache-Control'],'no-store')
    for(const relative of ['firmware/.tools/zig.exe','firmware/build/output.bin','telemetry/__pycache__/module.pyc','%2Etools/file','%2e%2e%5coutside']) {
      assert.equal((await request('/artifacts/dyson/'+relative)).status,404)
    }
    assert.equal((await request('/artifacts/dyson/missing.md')).status,404)
    assert.equal((await request('/elsewhere')).next,true)
    assert.equal(isPublicArtifact('firmware/evidence/compile.log'),true)
  } finally { await fs.rm(root,{recursive:true,force:true}) }
})
