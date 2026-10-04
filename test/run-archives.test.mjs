import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {readArchive,listArchives} from '../server/run-archives.mjs'
test('saved worlds require checksums, inert workers, and contained paths',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'bot-run-'))
  t.after(()=>fs.rm(root,{recursive:true,force:true}))
  await fs.mkdir(path.join(root,'Run-1'))
  const file=path.join(root,'Run-1','snapshot.json')
  const data={format:'bot-crossing-run',version:1,id:'Run-1',label:'Run-1',world:{threads:Array.from({length:15},(_,i)=>({id:`magi:w${String(i+1).padStart(2,'0')}`,worldProfile:'15-3A',running:false,canOpen:false}))}}
  async function save(){const bytes=JSON.stringify(data);await fs.writeFile(file,bytes);await fs.writeFile(path.join(root,'Run-1','snapshot.sha256'),createHash('sha256').update(bytes).digest('hex'))}
  await save();assert.equal((await readArchive(root,'Run-1')).id,'Run-1');assert.equal((await listArchives(root)).length,1)
  await assert.rejects(readArchive(root,'../Run-1'),/Invalid/)
  await fs.appendFile(file,' ');await assert.rejects(readArchive(root,'Run-1'),/checksum/);assert.equal((await listArchives(root)).length,0)
  data.world.threads[0].running=true;await save();await assert.rejects(readArchive(root,'Run-1'),/projection/)
})
