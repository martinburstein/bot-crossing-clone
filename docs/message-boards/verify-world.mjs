import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {readWorld} from '../../../Swarm/lib/world-save.mjs'
const [oldFile,newFile]=process.argv.slice(2)
if(!oldFile||!newFile)throw Error('Pass the before and after world saves')
const old=(await readWorld(oldFile)).payload,next=(await readWorld(newFile)).payload
assert.equal(next.projectId,old.projectId)
assert.equal(next.growthPolicy.version,2)
assert.equal(next.boardLayout.length,8)
assert.equal(new Set(next.boardLayout.map(b=>b.id)).size,8)
assert.equal(next.boardLayout.find(b=>b.id==='global').color,0xb8bebc)
for(const shell of old.shells){
  const now=next.shells.find(s=>s.id===shell.id)
  assert.deepEqual(now.construction.structures,shell.construction.structures)
  assert.deepEqual(next.layout[shell.id].slice(0,old.layout[shell.id].length),old.layout[shell.id])
  const board=next.boardLayout.find(b=>b.id===shell.id)
  assert.equal(board.color,parseInt(shell.color.slice(1),16))
  assert.ok(Number.isFinite(board.x)&&Number.isFinite(board.z))
}
for(const f of old.files)assert.equal(next.files.find(n=>n.path===f.path)?.sha256,f.sha256)
assert.equal(next.shells[0].construction.capacityExpansions,1)
assert.ok(next.messageBoards.messages.length>=2)
const {plots}=await (await fetch('http://127.0.0.1:5275/api/state')).json()
for(const shell of next.shells){
  const key=shell.stationKey+'@'+next.projectId
  assert.deepEqual(plots[key],next.layout[shell.id].map(c=>[c.q,c.r]),'Live saved layout matches world snapshot: '+shell.id)
}
const result={passed:true,projectId:next.projectId,oldFile,newFile,oldCanonicalFilesUnchanged:old.files.length,
  preservedExistingStructures:true,preservedOldHexagonCoordinates:true,liveLayoutMatchesSave:true,
  boards:next.boardLayout.length,messages:next.messageBoards.messages.length,
  capacityExpansions:next.shells.map(s=>({shell:s.id,count:s.construction.capacityExpansions}))}
await fs.writeFile(new URL('./world-verification.json',import.meta.url),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
