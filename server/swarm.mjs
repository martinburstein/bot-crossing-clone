// Bot Crossing is a read-only visual adapter. Protocol mutations live in Desktop/Swarm.
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {SWARM_ROOT} from './swarm-location.mjs'
export {SWARM_ROOT} from './swarm-location.mjs'
const reader=root=>import(pathToFileURL(path.join(root,'lib','state.mjs')).href)
export async function loadSwarm(root=SWARM_ROOT) { return (await reader(root)).loadSwarm(root) }
export async function scrollFor(shellId,root=SWARM_ROOT) { return (await reader(root)).scrollFor(shellId,root) }
export function projectShells(threads, {roster, active, displayRun, projectHistory, externalWorkers=[]}, root = SWARM_ROOT) {
  const run=active || displayRun
  threads=[...threads,...externalWorkers]
  const claimed = new Set()
  const shells = roster.shells.map((shell, index) => {
    const task = run?.assignments.find(a=>a.shellId === shell.id)
    const binding = active ? task?.binding : null
    const matches = !binding ? [] : binding.backend==='swarms'
      ? threads.filter(t=>t.backend==='swarms' && t.workerId===binding.workerId && t.runId===binding.runId && t.shellId===shell.id)
      : threads.filter(t=>t.parentThreadId === binding.parentThreadId && t.agentPath === binding.agentPath)
    const worker = matches.length === 1 ? matches[0] : null
    if(worker) claimed.add(worker.id)
    const shellStatus = run?.closedAt ? (run.outcome==='accepted'?'Complete':'Cancelled') : !task ? 'Ready' : !binding ? 'Queued' : !worker ? 'Not observed' : worker.archived ? 'Worker archived' : worker.hasError ? 'Error' : worker.running ? 'Working' : 'Idle'
    return {...worker,
      id:`swarm:${shell.id}`, isShell:true, shellId:shell.id, shellName:shell.name,
      suitColor:parseInt(shell.color.slice(1),16), shellColor:shell.color, shellStatus,
      assignmentState:task?.state || 'standby', assignmentRole:task?.role || shell.role || '',
      // Assignment state belongs to the current run; construction belongs to
      // the stable project and is rebuilt from canonical milestone receipts.
      milestones:projectHistory?.milestonesByShell?.[shell.id] || task?.milestones || [],
      constructionRunId:projectHistory?.projectId || run?.projectId || run?.runId || 'standby', runClosed:!!run?.closedAt,
      protocolExecution:task?.execution || null, attemptCount:task?.attempts?.length || 0,
      dependencies:task?.dependsOn || [], reviewer:task?.reviewer || null, workflow:active?.workflow?.kind || null,
      workerBackend:binding?.backend || (binding?'codex':null),
      scrollUrl:active && task ? `/api/swarm/scroll?shell=${shell.id}` : null,
      runId:run?.runId || null, boundThreadId:worker?.id || null,
      title:`${shell.name} · ${task?.role || 'Ready — no task loaded'}`,
      // Stable identity owns a hexagon; task changes must not relocate it.
      project:shell.stationKey || `Swarm · ${shell.id}`, projectPath:path.join(root,'shells',shell.id),
      projectLabel:`${shell.name} · ${task?.role || shell.role || 'Ready'}`,
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
