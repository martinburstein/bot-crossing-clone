import fsp from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { normalizeMagiObservation } from '../sowers/magi-observation.mjs'

const MAX_BYTES = 1024 * 1024
const DEFAULT_MAX_AGE_MS = 30_000
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const own = (object, key) => Object.hasOwn(object, key)

function text(value, label, fallback = '') {
  if (value === undefined) return fallback
  if (typeof value !== 'string') throw new Error(`${label} must be a string`)
  return value
}

function identity(value, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) throw new Error(`${label} must be a nonempty string without outer whitespace`)
  return value
}

function boolean(value, label, fallback = false) {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`)
  return value
}

function list(value, label, normalize) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  const ids = new Set()
  return value.map((entry, index) => {
    if (!record(entry)) throw new Error(`${label}[${index}] must be an object`)
    const next = normalize(entry, `${label}[${index}]`)
    if (next.id !== undefined) {
      if (ids.has(next.id)) throw new Error(`${label} contains duplicate id`)
      ids.add(next.id)
    }
    return next
  })
}

function milestone(entry, label) {
  const next = {
    id: identity(entry.id, `${label}.id`),
    title: text(entry.title, `${label}.title`),
    level: text(entry.level, `${label}.level`, 'minor'),
    // A checkpoint must explicitly be accepted; its presence alone proves no acceptance.
    accepted: boolean(entry.accepted, `${label}.accepted`),
    status: text(entry.status, `${label}.status`, entry.accepted === true ? 'accepted' : 'pending'),
  }
  if (own(entry, 'retractedAt') && entry.retractedAt !== null) {
    if (!Number.isSafeInteger(entry.retractedAt) || entry.retractedAt <= 0) throw new Error(`${label}.retractedAt must be a positive epoch millisecond integer or null`)
    next.retractedAt = entry.retractedAt
  }
  return next
}

function thread(entry, label) {
  const next = {
    id: identity(entry.id, `${label}.id`),
    title: text(entry.title, `${label}.title`),
    project: text(entry.project, `${label}.project`),
    running: boolean(entry.running, `${label}.running`),
    hasError: boolean(entry.hasError, `${label}.hasError`),
    unread: boolean(entry.unread, `${label}.unread`),
    assignmentState: text(entry.assignmentState, `${label}.assignmentState`),
    milestones: own(entry, 'milestones') ? list(entry.milestones, `${label}.milestones`, milestone) : [],
    source: 'broadcast',
  }
  for (const key of ['shellName', 'agentPath', 'preview', 'projectLabel']) {
    if (own(entry, key)) next[key] = text(entry[key], `${label}.${key}`)
  }
  if (own(entry, 'constructionProgress')) {
    const value = entry.constructionProgress
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label}.constructionProgress must be a finite number from 0 to 1`)
    next.constructionProgress = value
  }
  if (own(entry, 'plan')) {
    if (!record(entry.plan)) throw new Error(`${label}.plan must be an object`)
    next.plan = { steps: list(entry.plan.steps, `${label}.plan.steps`, (step, stepLabel) => {
      const status = text(step.status, `${stepLabel}.status`)
      if (!['pending', 'in_progress', 'completed'].includes(status)) throw new Error(`${stepLabel}.status must be pending, in_progress or completed`)
      return { title: text(step.title, `${stepLabel}.title`), status }
    }) }
  }
  return next
}

/** Read an explicitly configured local observation; never creates or updates source state. */
export async function loadSowersBroadcast({ file = process.env.SOWERS_BROADCAST_FILE } = {}) {
  const result = { threads: [], configured: false, observedAt: null, warnings: [] }
  if (file === undefined || file === '') return result
  result.configured = true
  if (typeof file !== 'string' || !path.isAbsolute(file)) {
    result.warnings.push('Sowers broadcast file must be an absolute local path.')
    return result
  }
  let handle
  try {
    handle = await fsp.open(file, constants.O_RDONLY | (constants.O_NONBLOCK || 0))
    const before = await handle.stat()
    if (!before.isFile()) throw new Error('snapshot must be a regular file')
    if (before.size > MAX_BYTES) throw new Error('snapshot exceeds the 1 MiB size limit')
    // Read at most one byte over the limit, including if a producer grows the file after stat.
    const buffer = Buffer.alloc(MAX_BYTES + 1)
    let length = 0
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length)
      if (!bytesRead) break
      length += bytesRead
    }
    if (length > MAX_BYTES) throw new Error('snapshot exceeds the 1 MiB size limit')
    const after = await handle.stat()
    if (before.size !== length || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('snapshot changed during read; publish by atomic replacement')
    const snapshot = JSON.parse(buffer.subarray(0, length).toString('utf8'))
    if (!record(snapshot) || snapshot.version !== 1) throw new Error('snapshot version must be 1')
    if (!Number.isSafeInteger(snapshot.observedAt) || snapshot.observedAt <= 0) throw new Error('observedAt must be a positive epoch millisecond integer')
    const threads = list(snapshot.threads, 'threads', thread)
    let maxAge = DEFAULT_MAX_AGE_MS
    const configuredAge = process.env.SOWERS_BROADCAST_MAX_AGE_MS
    if (configuredAge !== undefined) {
      const age = Number(configuredAge)
      if (configuredAge.trim() && Number.isFinite(age) && age > 0 && age <= 86_400_000) maxAge = age
      else result.warnings.push('Invalid SOWERS_BROADCAST_MAX_AGE_MS; using 30000 ms.')
    }
    const now = Date.now()
    const stale = snapshot.observedAt > now || now - snapshot.observedAt > maxAge
    if (stale) result.warnings.push(snapshot.observedAt > now
      ? 'Sowers broadcast observation is in the future; showing historical evidence only.'
      : 'Sowers broadcast observation is stale; showing historical evidence only.')
    result.observedAt = snapshot.observedAt
    if (own(snapshot,'magi')) result.magi = {...normalizeMagiObservation(snapshot.magi),observedAt:snapshot.observedAt,stale}
    result.threads = threads.map(entry => ({ ...entry, running: stale ? false : entry.running,
      broadcastStale: stale, broadcastObservedAt: snapshot.observedAt }))
  } catch (error) {
    // Avoid returning local paths or raw JSON text in errors sent to the viewer.
    const detail = error instanceof SyntaxError ? 'snapshot is not valid JSON'
      : error?.code ? `snapshot is unreadable (${error.code})` : error.message
    result.warnings.push(`Sowers broadcast unavailable: ${detail}.`)
  } finally {
    await handle?.close().catch(() => {})
  }
  return result
}
