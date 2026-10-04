import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
const validId = id => /^Run-[1-9][0-9]{0,3}$/.test(id || '')
export async function archiveRoot(dataDir) {
  const config=JSON.parse(await fs.readFile(path.join(dataDir,'run-archives.json'),'utf8'))
  return fs.realpath(config.root)
}
export async function readArchive(root,id) {
  if(!validId(id))throw Error('Invalid saved run')
  const canonical=await fs.realpath(root), file=await fs.realpath(path.join(canonical,id,'snapshot.json'))
  const relative=path.relative(canonical,file)
  if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Saved run escaped archive root')
  const stat=await fs.stat(file);if(stat.size>4*1024*1024)throw Error('Saved run too large')
  const bytes=await fs.readFile(file), expected=(await fs.readFile(path.join(path.dirname(file),'snapshot.sha256'),'utf8')).trim()
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Saved run checksum failed')
  const data=JSON.parse(bytes)
  if(data.format!=='bot-crossing-run'||data.version!==1||data.id!==id||data.world?.threads?.length!==15||data.world.threads.some((t,i)=>t.id!==`magi:w${String(i+1).padStart(2,'0')}`||t.worldProfile!=='15-3A'||t.running||t.canOpen))throw Error('Invalid saved run projection')
  return data
}
export async function listArchives(root) {
  const rows=[]
  for(const entry of await fs.readdir(root,{withFileTypes:true}))if(entry.isDirectory()&&validId(entry.name)) {
    try {const a=await readArchive(root,entry.name);rows.push({id:a.id,label:a.label,savedAt:a.savedAt})}catch{/* Invalid evidence is never presented as a saved world. */}
  }
  return rows.sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))
}
