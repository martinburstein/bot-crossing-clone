// Bot Crossing is a read-only visual adapter. Protocol mutations live in Desktop/Swarm.
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {SWARM_ROOT} from './swarm-location.mjs'
export {SWARM_ROOT} from './swarm-location.mjs'
const reader=root=>import(pathToFileURL(path.join(root,'lib','state.mjs')).href)
export async function loadSwarm(root=SWARM_ROOT) { return (await reader(root)).loadSwarm(root) }
export async function scrollFor(shellId,root=SWARM_ROOT) { return (await reader(root)).scrollFor(shellId,root) }
export function projectShells(threads, {roster, active}, root = SWARM_ROOT) {
  const claimed = new Set()
  const shells = roster.shells.map((shell, index) => {
    const task = active?.assignments.find(a=>a.shellId === shell.id)
    const binding = task?.binding
    const matches = binding ? threads.filter(t=>t.parentThreadId === binding.parentThreadId && t.agentPath === binding.agentPath) : []
    const worker = matches.length === 1 ? matches[0] : null
    if(worker) claimed.add(worker.id)
    const shellStatus = !task ? 'Ready' : !binding ? 'Queued' : !worker ? 'Not observed' : worker.archived ? 'Worker archived' : worker.hasError ? 'Error' : worker.running ? 'Working' : 'Idle'
    return {...worker,
      id:`swarm:${shell.id}`, isShell:true, shellId:shell.id, shellName:shell.name,
      suitColor:parseInt(shell.color.slice(1),16), shellColor:shell.color, shellStatus,
      assignmentState:task?.state || 'standby', assignmentRole:task?.role || '',
      scrollUrl:task ? `/api/swarm/scroll?shell=${shell.id}` : null,
      runId:active?.runId || null, boundThreadId:worker?.id || null,
      title:`${shell.name} · ${task?.role || 'Ready — no task loaded'}`,
      // Stable identity owns a hexagon; task changes must not relocate it.
      project:`Swarm · ${shell.name}`, projectPath:path.join(root,'shells',shell.id),
      projectLabel:`${shell.name} · ${task?.role || 'Ready'}`,
      projectAccent:parseInt(shell.color.slice(1),16), archived:false,
      createdAt:roster.createdAt + index, lastActivityAt:worker?.lastActivityAt || active?.createdAt || roster.createdAt,
      running:!!worker?.running && !worker.archived, hasError:!!worker?.hasError && !worker.archived,
      unread:!!worker?.unread && !worker.archived,
      canOpen:!!worker && worker.canOpen !== false,
      sizeBytes:worker?.sizeBytes || 0, harness:worker?.harness || '', harnessName:worker?.harnessName || 'Swarm shell',
    }
  })
  return [...shells, ...threads.filter(t=>!claimed.has(t.id))]
}
