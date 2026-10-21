import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {readCrashLab} from '../server/crash-lab.mjs'
test('the optional paper study stays isolated to its configured office directory',async t=>{
  const officeRoot=await fs.mkdtemp(path.join(os.tmpdir(),'bot-crash-lab-'))
  t.after(()=>{assert.equal(path.dirname(path.resolve(officeRoot)),path.resolve(os.tmpdir()));return fs.rm(officeRoot,{recursive:true,force:true})})
  assert.deepEqual((await readCrashLab({officeRoot})).positions,[])
  const valid={schemaVersion:1,paperOnly:true,positions:[{ticker:'SYNTHETIC'}]}
  await fs.writeFile(path.join(officeRoot,'crash-lab.json'),JSON.stringify(valid))
  assert.deepEqual(await readCrashLab({officeRoot}),valid)
  await fs.writeFile(path.join(officeRoot,'crash-lab.json'),JSON.stringify({...valid,paperOnly:false}))
  await assert.rejects(readCrashLab({officeRoot}),/Invalid paper/)
  await fs.writeFile(path.join(officeRoot,'crash-lab.json'),' '.repeat(300001))
  await assert.rejects(readCrashLab({officeRoot}),/too large/)
})
