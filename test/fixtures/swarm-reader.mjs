// Synthetic external-provider contract fixture, not a bundled Swarm implementation.
import fs from 'node:fs/promises'
import path from 'node:path'
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'))
export async function loadSwarm(root) {
 return {roster:await read(path.join(root,'roster.json')),active:await read(path.join(root,'active.json'))}
}
export async function scrollFor(id,root) {
 const {roster,active}=await loadSwarm(root)
 if(!active || !roster.shells.some(s=>s.id===id)) return null
 return fs.readFile(path.join(root,'runs',active.runId,id,'AGENT.md'),'utf8')
}
