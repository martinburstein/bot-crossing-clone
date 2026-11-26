const COLORS = [0xf48246, 0x76b6aa, 0xd6b859, 0x91a6c3, 0xc78fba, 0xa6b675]
import { acceptedCheckpoints } from './evidence.mjs'
export { acceptedCheckpoints } from './evidence.mjs'

export function stableHash(value) {
  let hash = 2166136261
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return hash >>> 0
}

export function normalizeThread(thread) {
  const id = String(thread.id || '')
  const status = thread.hasError ? 'error' : thread.running ? 'working'
    : ['accepted', 'complete', 'completed'].includes(thread.assignmentState) || thread.prState?.toUpperCase() === 'MERGED'
      ? 'complete' : thread.unread ? 'waiting' : thread.assignmentState === 'review' ? 'review' : 'idle'
  const seed = stableHash(id)
  const suppliedColor = thread.suitColor ?? thread.projectAccent
  return { ...thread, id, status, seed,
    name: thread.shellName || thread.agentPath?.split('/').filter(Boolean).at(-1) || thread.title || 'Unnamed Sower',
    project: thread.projectLabel || thread.project || 'Local workspace',
    color: Number.isFinite(suppliedColor) ? suppliedColor : COLORS[seed % COLORS.length],
    checkpoints: acceptedCheckpoints(thread),
  }
}

export function visibleThreads(threads, query = '', scope = 'all', now = Date.now()) {
  const needle = query.trim().toLowerCase()
  return threads.filter(t => t && typeof t.id === 'string' && !t.archived)
    .map(normalizeThread)
    .filter(t => scope === 'all' || (scope === 'active' ? t.running : t.running || t.source === 'broadcast' || t.lastActivityAt >= now - 72*60*60*1000))
    .filter(t => !needle || `${t.name} ${t.project} ${t.title}`.toLowerCase().includes(needle))
    .sort((a, b) => Number(Boolean(b.running)) - Number(Boolean(a.running)) || Number(Boolean(b.isSubagent)) - Number(Boolean(a.isSubagent))
      || (b.lastActivityAt || 0) - (a.lastActivityAt || 0) || a.id.localeCompare(b.id))
}

/** Session lifecycle stays authoritative; optional broadcasts add measured work evidence. */
export function mergeBroadcastThreads(local, broadcast = []) {
  const byId = new Map(local.map(thread => [thread.id, {...thread}]))
  for (const reported of broadcast) {
    const session = byId.get(reported.id)
    if (!session) { byId.set(reported.id, {...reported}); continue }
    const merged = {...session, broadcastObservedAt:reported.broadcastObservedAt, broadcastEvidenceStale:reported.broadcastStale}
    // An older snapshot may be useful history, but must not roll back newer observations.
    if (!reported.broadcastStale) {
      for (const key of ['constructionProgress','plan','milestones']) {
        if (Object.hasOwn(reported,key)) merged[key]=reported[key]
      }
      merged.broadcastMeasured=true
    }
    byId.set(reported.id,merged)
  }
  return [...byId.values()]
}

// Fixed, explicitly labelled art-direction fixtures. No timed or synthetic live progress.
export const DESIGN_THREADS = [
  { id: 'preview:ember', shellName: 'Ember', title: 'Building the habitat', project: 'Habitat / 01', running: true,
    suitColor: 0xef844a, constructionProgress: .58, preview: 'Sealing the habitat shell. Systems are next.',
    milestones: [{title:'Landing pad laid', level:'minor'}, {title:'Frame assembled', level:'minor'}] },
  { id: 'preview:fern', shellName: 'Fern', title: 'Checking the solar array', project: 'Power / 02', assignmentState: 'review',
    suitColor: 0x6ba99c, constructionProgress: .78, preview: 'Power systems ready for review. Awaiting the next instruction.',
    milestones: [{title:'Array deployed', level:'major'}, {title:'Wiring checked', level:'minor'}, {title:'Storage installed', level:'minor'}] },
  { id: 'preview:moss', shellName: 'Moss', title: 'Relay station ready', project: 'Comms / 03', assignmentState: 'complete',
    suitColor: 0xd3b157, constructionProgress: 1, preview: 'Relay commissioned. Signal received, loud and clear.',
    milestones: [{title:'Relay commissioned', level:'major'}] },
]
