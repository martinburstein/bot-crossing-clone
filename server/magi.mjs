import {MAGI_COLOR} from '../src/game/magi-world.js'
import {assertCampusProjection,projectCampusState} from './campus-magi.mjs'
import {assertRoArm16Projection,projectRoArm16} from './roarm16-magi.mjs'
const WORKER_IDS = Array.from({ length: 15 }, (_, i) => `w${String(i + 1).padStart(2, '0')}`)
const CLUSTERS = [
  { id: 'melchior', workerIds: WORKER_IDS.slice(0, 5), color: '#55d890' },
  { id: 'balthasar', workerIds: WORKER_IDS.slice(5, 10), color: '#65a8ff' },
  { id: 'casper', workerIds: WORKER_IDS.slice(10, 15), color: '#d889ff' },
]
const CLUSTER_BY_WORKER = new Map(CLUSTERS.flatMap(cluster => cluster.workerIds.map(id => [id, cluster])))

export function magiSourceUrl(env = process.env) {
  const raw = env.BOT_CROSSING_MAGI_URL
  if (!raw) return null
  let url
  try { url = new URL(raw) } catch { throw new Error('BOT_CROSSING_MAGI_URL is not a valid URL') }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/api/state' || url.search || url.hash || url.username || url.password) {
    throw new Error('BOT_CROSSING_MAGI_URL must be a loopback /api/state URL')
  }
  return url.href
}

function assertProjection(state, now = Date.now()) {
  if(state?.magi?.profile==='roarm-campus')return assertCampusProjection(state,now)
  if(state?.magi?.profile==='roarm-16')return assertRoArm16Projection(state,now)
  if (!state || typeof state !== 'object' || state.schemaVersion !== 1 || !['live', 'standby'].includes(state.mode) ||
      !Number.isSafeInteger(state.revision) || typeof state.projectId !== 'string' || !state.projectId ||
      !Number.isFinite(state.observedAt) || now - state.observedAt > 20_000 || state.observedAt > now + 5_000 ||
      state.magi?.mode !== 'magi' || !Array.isArray(state.workers) || state.workers.length !== 15 ||
      !Array.isArray(state.magi.clusters) || state.magi.clusters.length !== 3 || !Array.isArray(state.tasks) ||
      !Array.isArray(state.milestones) || !Array.isArray(state.notes)) throw new Error('MAGI state is invalid or stale')
  const workers = new Map(state.workers.map(worker => [worker.id, worker]))
  if (workers.size !== 15 || WORKER_IDS.some(id => !workers.has(id))) throw new Error('MAGI state must contain exactly workers w01 through w15')
  for (const id of WORKER_IDS) {
    const worker = workers.get(id)
    if (typeof worker.name !== 'string' || typeof worker.bound !== 'boolean' ||
        !['idle', 'reserved', 'running', 'reviewing', 'submitted', 'accepted', 'failed'].includes(worker.status)) {
      throw new Error(`MAGI worker ${id} is invalid`)
    }
  }
  const runningCount = state.workers.filter(worker => ['running', 'reviewing'].includes(worker.status)).length
  const reservedCount = state.workers.filter(worker => worker.status === 'reserved').length
  if (state.capacity?.total !== 15 || state.capacity?.limit !== 3 || state.capacity.running !== runningCount ||
      state.capacity.reserved !== reservedCount || state.capacity.occupied !== runningCount + reservedCount ||
      state.capacity.occupied > 3) throw new Error('MAGI capacity summary is inconsistent with worker bindings')
  for (const expected of CLUSTERS) {
    const cluster = state.magi.clusters.find(item => item.id === expected.id)
    if (!cluster || !Array.isArray(cluster.workerIds) || cluster.workerIds.length !== 5 ||
        expected.workerIds.some((id, index) => cluster.workerIds[index] !== id) ||
        !['idle', 'reserved', 'running'].includes(cluster.status) || typeof cluster.occupied !== 'boolean') {
      throw new Error(`MAGI cluster ${expected.id} is invalid`)
    }
    if (cluster.occupied !== (cluster.status === 'reserved' || cluster.status === 'running')) throw new Error(`MAGI cluster ${expected.id} occupancy is inconsistent`)
    if (cluster.status === 'running' || cluster.status === 'reserved') {
      const active = workers.get(cluster.activeWorkerId)
      const activeStates = cluster.status === 'running' ? ['running', 'reviewing'] : ['reserved']
      if (!cluster.workerIds.includes(cluster.activeWorkerId) || !activeStates.includes(active?.status) || (cluster.status === 'running' && !active.bound)) {
        throw new Error(`MAGI cluster ${expected.id} has no confirmed ${cluster.status} worker`)
      }
    }
  }
  for (const worker of state.workers) {
    if (['running', 'reviewing', 'reserved'].includes(worker.status)) {
      const cluster = state.magi.clusters.find(item => item.id === CLUSTER_BY_WORKER.get(worker.id).id)
      if ((worker.status !== 'reserved' && !worker.bound) || cluster.activeWorkerId !== worker.id || cluster.status !== (worker.status === 'reserved' ? 'reserved' : 'running')) {
        throw new Error(`MAGI worker ${worker.id} activity is not confirmed by its cluster`)
      }
    }
  }
  for (const milestone of state.milestones) {
    if (!CLUSTER_BY_WORKER.has(milestone?.workerId) || !['minor', 'major'].includes(milestone.level) || typeof milestone.title !== 'string' || !milestone.title) {
      throw new Error('MAGI milestone is invalid')
    }
  }
  return state
}

export async function readMagiState({ env = process.env, fetchImpl = fetch, now = Date.now(), timeoutMs = 2500 } = {}) {
  const sourceUrl = magiSourceUrl(env)
  if (!sourceUrl) throw new Error('MAGI bridge is not configured')
  let response
  try {
    response = await fetchImpl(sourceUrl, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    throw new Error(`MAGI source is unavailable: ${error?.name === 'TimeoutError' ? 'request timed out' : 'request failed'}`)
  }
  if (!response.ok) throw new Error(`MAGI source returned HTTP ${response.status}`)
  let state
  try { state = await response.json() } catch { throw new Error('MAGI source returned invalid JSON') }
  return assertProjection(state, now)
}

function alignment(state) {
  const active = CLUSTERS.map(expected => {
    const cluster = state.magi.clusters.find(item => item.id === expected.id)
    const worker = state.workers.find(item => item.id === cluster.activeWorkerId)
    return cluster.status === 'running' && cluster.occupied && expected.workerIds.includes(worker?.id) && worker?.bound && ['running', 'reviewing'].includes(worker.status)
  })
  const count = active.filter(Boolean).length
  return { count, mode: ['off', 'red', 'green', 'rainbow'][count], clusters: active }
}

export function projectMagiState(state, now = Date.now(), usage = new Map()) {
  if(state?.magi?.profile==='roarm-campus')return projectCampusState(state,now,usage)
  if(state?.magi?.profile==='roarm-16')return projectRoArm16(state,now,usage)
  assertProjection(state, now)
  const colors = alignment(state)
  const threads = WORKER_IDS.map((workerId, index) => {
    const worker = state.workers.find(item => item.id === workerId)
    const cluster = CLUSTER_BY_WORKER.get(workerId)
    const status = worker.status
    const clusterState = state.magi.clusters.find(item => item.id === cluster.id)
    const running = clusterState.status === 'running' && ['running', 'reviewing'].includes(status) && worker.bound && clusterState.activeWorkerId === workerId
    const hasError = status === 'failed'
    const task = state.tasks.find(item => item.id === worker.taskId)
    const milestones = state.milestones.filter(item => item.workerId === workerId)
    return {
      id: `magi:${workerId}`, isShell: true, shellId: workerId, shellName: worker.name,
      shellColor: MAGI_COLOR, projectAccent: 0xe9a45b, suitColor: 0xf3f1ec, project: `MAGI ${workerId}`,
      worldProfile:'15-3A', clusterId:cluster.id, title:worker.name,
      tokenUsage: usage.get(workerId) || null, vehicleId:worker.vehicleId || null,
      earnedRewards: (state.magi.earnedRewards || []).filter(reward=>reward.workerId===workerId),
      projectLabel: worker.name, projectPath: '', projectRoot: '', constructionRunId: `magi:${state.projectId}`,
      milestones, running, hasError, archived: false, unread: false, canOpen: false,
      createdAt: index + 1, lastActivityAt: state.observedAt, sizeBytes: 0, dependencies: [], reviewer: null,
      assignmentRole: running ? (status === 'reviewing' ? 'review' : 'work') : (status === 'reserved' ? 'reserved' : 'idle'),
      assignmentState: status, shellStatus: hasError ? 'Failed' : running ? (status === 'reviewing' ? 'Reviewing' : 'Working') : status === 'reserved' ? 'Reserved' : status === 'accepted' ? 'Accepted' : status === 'submitted' ? 'Submitted for review' : 'Ready',
      runId: state.projectId, protocolExecution: status, attemptCount: 0, workerBackend: worker.bound ? (worker.backend || 'unknown') : null,
      workflow: 'MAGI 15/3', taskTitle: worker.taskTitle || task?.title || null,
      scrollUrl: null, alignment: colors,
    }
  })
  return { threads, alignment: colors, worksite: {
    pilot: state.magi.pilot || null,
    contracts: state.magi.contracts || [], earnedRewards: state.magi.earnedRewards || [],
    bounties: state.magi.bounties || [], serviceCredits: state.magi.serviceCredits || [],
    observedAt: state.observedAt, updatedAt: state.observedAt, revision: state.revision, stale: false,
  } }
}

export async function magiHealth(options = {}) {
  const sourceUrl = magiSourceUrl(options.env || process.env)
  const body = { service: 'bot-crossing-magi', sourceUrl, readOnly: true, ready: false }
  if (!sourceUrl) return body
  try {
    const state = await readMagiState(options)
    return { ...body, ready: true, observedAt: state.observedAt, revision: state.revision, workers: state.workers.length }
  } catch (error) {
    return { ...body, error: error.message }
  }
}

export const MAGI_WORKER_IDS = WORKER_IDS
