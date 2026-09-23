/**
 * Harness adapter: Codex (OpenAI) — the desktop app, the VS Code extension and the CLI together.
 *
 * Two stores, deliberately merged rather than picked between, the same shape `claude-code.mjs`
 * ended up in:
 *
 *   - `~/.codex/state_<n>.sqlite` holds one row per thread — title, cwd, branch, model, effort,
 *     archived — which is everything the colony wants and none of it inferred.
 *   - `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` holds the transcript, which is the only
 *     source for how big a thread is and whether it is mid-turn, and the only source at all for
 *     a session the database has not caught up with.
 *
 * They join on the session id, which appears in the row, in the rollout's filename and in its
 * `session_meta` record. Reading only the database loses transcript size and any CLI session it
 * has not indexed; reading only the transcripts means reconstructing metadata the database
 * already has correct.
 *
 * Read-only, without exception, and no subprocess anywhere. Codex has an archive of its own that
 * only its CLI can set, so archiving here is recorded in the colony alone — see the note on
 * archiving in `server/harnesses/README.md`.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { exists, jsonLines, listDirs, listFiles, num, readHead } from '../lib/fsutil.mjs'

const HOME = os.homedir()
const CODEX_HOME = process.env.CODEX_HOME || path.join(HOME, '.codex')
const SESSIONS_DIR = path.join(CODEX_HOME, 'sessions')
const SESSION_INDEX = path.join(CODEX_HOME, 'session_index.jsonl')
// Explicitly opt in to worker astronauts; ordinary conversations remain the default view.
const INCLUDE_SUBAGENTS = process.env.BOT_CROSSING_INCLUDE_SUBAGENTS === '1'
const PARENT_THREAD_ID = process.env.BOT_CROSSING_PARENT_THREAD_ID || ''

const HEAD_BYTES = 128 * 1024
const TAIL_BYTES = 64 * 1024
/** Codex writes nothing when it is killed, so a stale `task_started` needs a time bound too. */
const ACTIVE_WINDOW_MS = 30 * 60 * 1000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATE_DB = /^state_(\d+)\.sqlite$/

/** Prefixed, per the contract in `server/harnesses/README.md`. */
const ID = (raw) => `codex:${raw}`

/** Source is JSON in SQLite, but an object in session_meta. Older installs use a string. */
function agentSource(source) {
  if (typeof source === 'string') {
    if (source === 'subagent') return { isSubagent: true }
    try { source = JSON.parse(source) } catch { return {} }
  }
  if (!source || typeof source !== 'object' || !source.subagent) return {}
  const spawn = source.subagent?.thread_spawn
  return {
    isSubagent: true,
    parentId: typeof spawn?.parent_thread_id === 'string' && UUID.test(spawn.parent_thread_id)
      ? spawn.parent_thread_id : '',
    agentPath: typeof spawn?.agent_path === 'string' ? spawn.agent_path : '',
  }
}

/**
 * `node:sqlite` is imported lazily and its absence is survivable.
 *
 * It needs Node 22.13, which `package.json` asks for — but asking is not enforcing, and a top
 * level import would take the whole server down on an older Node rather than costing one
 * harness. This way the transcript half still works and `diagnostic()` explains the rest.
 */
let sqlitePromise
const sqliteApi = () => (sqlitePromise ??= import('node:sqlite').catch(() => null))

/** The newest schema version, not the most recently touched WAL sibling. */
async function latestStateDatabase() {
  let entries
  try {
    entries = await fsp.readdir(CODEX_HOME, { withFileTypes: true })
  } catch {
    return ''
  }
  return (
    entries
      .filter((e) => e.isFile() && STATE_DB.test(e.name))
      .map((e) => ({ file: path.join(CODEX_HOME, e.name), version: Number(e.name.match(STATE_DB)[1]) }))
      .sort((a, b) => b.version - a.version)[0]?.file || ''
  )
}

/**
 * Every column is probed before it is named.
 *
 * This is undocumented private state that changes shape between Codex versions — the filename is
 * versioned precisely because it does. A `SELECT` naming a column that has gone throws and costs
 * the whole harness its threads, so anything not load-bearing is asked for only if it is there.
 */
const column = (columns, name, fallback = "''") => (columns.has(name) ? `t.${name}` : fallback)

function timeExpr(columns, ms, secs) {
  if (columns.has(ms) && columns.has(secs)) return `COALESCE(t.${ms}, t.${secs} * 1000)`
  if (columns.has(ms)) return `t.${ms}`
  if (columns.has(secs)) return `t.${secs} * 1000`
  return '0'
}

/** The thread index, keyed by session id. Empty when there is no readable database. */
async function databaseRows() {
  const [file, sqlite] = await Promise.all([latestStateDatabase(), sqliteApi()])
  if (!file || !sqlite?.DatabaseSync) return new Map()

  let db
  try {
    db = new sqlite.DatabaseSync(file, { readOnly: true })
  } catch {
    // A WAL database whose shared-memory file cannot be used refuses a read-only open. The
    // transcripts still answer everything the colony needs to draw something.
    return new Map()
  }
  try {
    const tables = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name)
    )
    if (!tables.has('threads')) return new Map()
    const columns = new Set(db.prepare('PRAGMA table_info(threads)').all().map((r) => r.name))
    if (!['id', 'cwd'].every((n) => columns.has(n))) return new Map()

    // Keep child rows until after merging transcripts, or their rollouts resurrect hidden workers.
    const children = new Map()
    if (tables.has('thread_spawn_edges')) {
      const edge = new Set(db.prepare('PRAGMA table_info(thread_spawn_edges)').all().map((r) => r.name))
      if (edge.has('child_thread_id')) {
        const parent = edge.has('parent_thread_id') ? 'parent_thread_id' : "'' AS parent_thread_id"
        for (const r of db.prepare(`SELECT child_thread_id, ${parent} FROM thread_spawn_edges`).all()) {
          if (typeof r.child_thread_id === 'string') children.set(r.child_thread_id,
            typeof r.parent_thread_id === 'string' && UUID.test(r.parent_thread_id) ? r.parent_thread_id : '')
        }
      }
    }

    const rows = db
      .prepare(`
        SELECT
          t.id,
          t.cwd,
          ${column(columns, 'title')} AS title,
          ${column(columns, 'preview')} AS preview,
          ${column(columns, 'first_user_message')} AS first_user_message,
          ${column(columns, 'source')} AS source,
          ${column(columns, 'thread_source')} AS thread_source,
          ${column(columns, 'agent_path')} AS agent_path,
          ${column(columns, 'git_branch')} AS git_branch,
          ${column(columns, 'model')} AS model,
          ${column(columns, 'reasoning_effort')} AS reasoning_effort,
          ${column(columns, 'rollout_path')} AS rollout_path,
          ${column(columns, 'archived', '0')} AS archived,
          ${timeExpr(columns, 'created_at_ms', 'created_at')} AS created_at_ms,
          ${timeExpr(columns, 'updated_at_ms', 'updated_at')} AS updated_at_ms
        FROM threads t
      `)
      .all()
      .filter((r) => UUID.test(r.id || ''))

    const result = new Map(rows.map((r) => {
      const agent = agentSource(r.source)
      return [r.id, { ...r, isSubagent: children.has(r.id) || r.thread_source === 'subagent' || Boolean(agent.isSubagent),
        parentId: children.get(r.id) || agent.parentId || '', agentPath: r.agent_path || agent.agentPath || '' }]
    }))
    // Spawn edges can arrive before the corresponding thread row.
    for (const [id, parentId] of children) {
      if (UUID.test(id) && !result.has(id)) result.set(id, { isSubagent: true, parentId, edgeOnly: true })
    }
    return result
  } catch {
    return new Map()
  } finally {
    try {
      db.close()
    } catch {
      /* already gone */
    }
  }
}

/** Every rollout transcript on disk, keyed by the session id in its filename. */
async function scanRollouts() {
  const byId = new Map()
  for (const year of await listDirs(SESSIONS_DIR)) {
    for (const month of await listDirs(year)) {
      for (const day of await listDirs(month)) {
        for (const file of await listFiles(day, (n) => n.startsWith('rollout-') && n.endsWith('.jsonl'))) {
          const id = /([0-9a-f-]{36})\.jsonl$/i.exec(file)?.[1]
          if (!id || !UUID.test(id)) continue
          try {
            const st = await fsp.stat(file)
            byId.set(id, { id, file, size: st.size, mtime: st.mtimeMs, ctime: st.ctimeMs, ino: st.ino, dev: st.dev })
          } catch {
            /* vanished between listing and stat */
          }
        }
      }
    }
  }
  return byId
}

/** `thread_name` per session, when Codex has written one. Optional; transcripts are the truth. */
async function readIndex() {
  const out = new Map()
  try {
    for (const row of jsonLines(await fsp.readFile(SESSION_INDEX, 'utf8'))) {
      if (row?.id && UUID.test(row.id)) out.set(row.id, row)
    }
  } catch {
    /* no index — every field it carries has another source */
  }
  return out
}

const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim()

function contentText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((p) => (typeof p === 'string' ? p : p?.text || p?.input_text || '')).filter(Boolean).join('\n')
}

/** What the head of a transcript knows about itself, for a session the database has not indexed. */
function readHeadMeta(records) {
  const meta = { cwd: '', gitBranch: '', model: '', effort: '', createdAt: 0, prompt: '' }
  for (const r of records) {
    const p = r?.payload
    if (!p || typeof p !== 'object') continue
    if (r.type === 'session_meta') {
      meta.sessionMetaSeen = true
      Object.assign(meta, agentSource(p.source))
      if (p.thread_source === 'subagent') meta.isSubagent = true
      meta.cwd ||= p.cwd || ''
      meta.gitBranch ||= p.git?.branch || ''
      meta.createdAt ||= Date.parse(p.timestamp || r.timestamp || '') || 0
    } else if (r.type === 'turn_context') {
      meta.cwd = p.cwd || meta.cwd
      meta.model = p.model || meta.model
      meta.effort = p.effort || meta.effort
    } else if (r.type === 'response_item' && p.type === 'message' && p.role === 'user') {
      meta.prompt ||= clean(contentText(p.content))
    }
  }
  return meta
}

/**
 * The last lifecycle record. `task_started` with nothing after it is mid-turn; `turn_aborted` is
 * somebody pressing escape, which is not an error and must not redden an astronaut's eyes.
 */
function readLifecycle(records) {
  let last = null
  for (const r of records) {
    const p = r?.payload
    if (r?.type === 'event_msg' && ['task_started', 'task_complete', 'turn_aborted'].includes(p?.type)) {
      last = { type: p.type, error: Boolean(p.error) }
    }
  }
  return last
}

/**
 * Long turns can put megabytes between task_started and EOF. Walk backward in small chunks
 * until the newest lifecycle event, rather than treating an absent tail marker as idle.
 * Oversized JSONL records are skipped: lifecycle envelopes are small, tool output need not be.
 * Memory stays bounded even when one tool response spans many chunks.
 */
async function latestLifecycle(fh, size) {
  const maxRecordBytes = HEAD_BYTES
  let suffix = Buffer.alloc(0)
  let oversized = false
  let activityAt = 0
  const parse = (record) => {
    // Avoid parsing every model/tool response during a long turn.
    if (activityAt && !record.includes('event_msg')) return null
    const records = jsonLines(record.toString('utf8'))
    activityAt ||= Date.parse(records.at(-1)?.timestamp || '') || 0
    return readLifecycle(records)
  }
    let position = size
    while (position > 0) {
      const start = Math.max(0, position - TAIL_BYTES)
      const chunk = await readRange(fh, start, position - start)
      let end = chunk.length
      for (let i = chunk.length - 1; i >= 0; i--) {
        if (chunk[i] !== 10) continue
        if (!oversized && end - i - 1 + suffix.length <= maxRecordBytes) {
          const found = parse(Buffer.concat([chunk.subarray(i + 1, end), suffix]))
          if (found) return { lifecycle: found, activityAt }
        }
        suffix = Buffer.alloc(0)
        oversized = false
        end = i
      }
      if (!oversized && end + suffix.length <= maxRecordBytes) {
        suffix = Buffer.concat([chunk.subarray(0, end), suffix])
      } else {
        suffix = Buffer.alloc(0)
        oversized = true
      }
      position = start
    }
    const lifecycle = oversized ? null : parse(suffix)
    return { lifecycle, activityAt }
}

async function readRange(fh, start, length) {
  const buffer = Buffer.allocUnsafe(length)
  const { bytesRead } = await fh.read(buffer, 0, length, start)
  if (bytesRead !== length) throw new Error('Transcript changed during read')
  return buffer
}

/** Advance only new bytes, retaining a bounded partial line across polls. */
async function appendLifecycle(fh, previous, size) {
  let { lifecycle, pending, oversized, completeOffset, activityAt = 0 } = previous
  let offset = previous.size
  while (offset < size) {
    const chunk = await readRange(fh, offset, Math.min(TAIL_BYTES, size - offset))
    let start = 0
    for (let i = 0; i <= chunk.length; i++) {
      if (i !== chunk.length && chunk[i] !== 10) continue
      if (!oversized && pending.length + i - start <= HEAD_BYTES) {
        pending = Buffer.concat([pending, chunk.subarray(start, i)])
      } else {
        pending = Buffer.alloc(0)
        oversized = true
      }
      if (i < chunk.length) {
        if (!oversized) {
          const records = jsonLines(pending.toString('utf8'))
          lifecycle = readLifecycle(records) || lifecycle
          activityAt = Math.max(activityAt, Date.parse(records.at(-1)?.timestamp || '') || 0)
        }
        pending = Buffer.alloc(0)
        oversized = false
        completeOffset = offset + i + 1
      }
      start = i + 1
    }
    offset += chunk.length
  }
  return { lifecycle, pending, oversized, completeOffset, activityAt }
}

/** Parsing is kept against mtime and size, so an unchanged transcript is read once. */
const parseCache = new Map()
async function transcriptFacts(entry, needHead) {
  const cached = parseCache.get(entry.id)
  if (cached && cached.mtime === entry.mtime && cached.ctime === entry.ctime && cached.size === entry.size && cached.ino === entry.ino && cached.dev === entry.dev && (cached.head || !needHead)) {
    return cached.facts
  }
  const facts = { lifecycle: null, meta: null }
  let fh
  try {
    fh = await fsp.open(entry.file, 'r')
    const st = await fh.stat()
    let appended = Boolean(cached && cached.ino === st.ino && cached.dev === st.dev && st.size > cached.size)
    if (appended) {
      const prefix = await readRange(fh, 0, cached.prefix.length)
      const checkpoint = await readRange(fh, cached.size - cached.checkpoint.length, cached.checkpoint.length)
      appended = prefix.equals(cached.prefix) && checkpoint.equals(cached.checkpoint)
    }
    let lifecycleState
    if (appended) {
      lifecycleState = await appendLifecycle(fh, { ...cached, lifecycle: cached.facts.lifecycle }, st.size)
    } else {
      const latest = await latestLifecycle(fh, st.size)
      const tail = await readRange(fh, Math.max(0, st.size - HEAD_BYTES), Math.min(st.size, HEAD_BYTES))
      const newline = tail.lastIndexOf(10)
      lifecycleState = { ...latest, pending: newline >= 0 ? tail.subarray(newline + 1) : tail,
        oversized: newline < 0 && st.size > HEAD_BYTES,
        completeOffset: newline >= 0 ? st.size - tail.length + newline + 1 : 0 }
      if (lifecycleState.oversized) lifecycleState.pending = Buffer.alloc(0)
    }
    facts.lifecycle = lifecycleState.lifecycle
    facts.activityAt = lifecycleState.activityAt
    if (needHead) facts.meta = appended && cached.headReady ? cached.facts.meta : readHeadMeta(jsonLines(await readHead(entry.file, HEAD_BYTES)))
    const prefix = await readRange(fh, 0, Math.min(st.size, 4096))
    const checkpoint = await readRange(fh, Math.max(0, st.size - 128), Math.min(st.size, 128))
    parseCache.set(entry.id, { ...lifecycleState, mtime: st.mtimeMs, ctime: st.ctimeMs, size: st.size, ino: st.ino, dev: st.dev,
      prefix, checkpoint, head: needHead, headReady: Boolean(facts.meta?.sessionMetaSeen && (facts.meta.prompt || st.size >= HEAD_BYTES)), facts })
  } catch {
    // Do not cache failures: an unchanged file must be retried after a transient sharing error.
    return { lifecycle: null, meta: cached?.facts.meta || null }
  } finally {
    await fh?.close().catch(() => {})
  }
  return facts
}

function projectOf(cwd) {
  const dir = typeof cwd === 'string' && path.isAbsolute(cwd) ? cwd : ''
  return { projectPath: dir, project: dir ? path.basename(dir) : 'unknown' }
}

async function scanThreads({ workerBindings = [] } = {}) {
  const boundParents = new Set(workerBindings.map(b=>b.parentThreadId.replace(/^codex:/,'')))
  const [rows, rollouts, index] = await Promise.all([databaseRows(), scanRollouts(), readIndex()])
  const ids = new Set([...rows.keys(), ...rollouts.keys()])
  const now = Date.now()
  const out = []

  for (const id of ids) {
    const row = rows.get(id)
    const entry = rollouts.get(id)
    if (row?.edgeOnly && !entry) continue
    // Known hidden database workers need no transcript I/O. The final check below also covers
    // workers discovered only in session_meta and rows whose parent metadata is incomplete.
    if (row?.isSubagent && !INCLUDE_SUBAGENTS && !workerBindings.length) continue
    if (row?.isSubagent && PARENT_THREAD_ID && row.parentId && row.parentId !== PARENT_THREAD_ID && !boundParents.has(row.parentId)) continue
    // Source metadata in the cached head also identifies transcript-only workers.
    const facts = entry ? await transcriptFacts(entry, true) : { lifecycle: null, meta: null }
    const meta = facts.meta || {}
    // An unreadable or unfinished transcript cannot safely be classified as an ordinary task.
    if ((!row || row.edgeOnly) && !meta.sessionMetaSeen) continue
    const isSubagent = Boolean(row?.isSubagent || meta.isSubagent)
    const parentId = row?.parentId || meta.parentId || ''
    const agentPath = clean(row?.agentPath || meta.agentPath)
    const explicitlyBound = workerBindings.some(b=>b.parentThreadId === ID(parentId) && b.agentPath === agentPath)
    if (isSubagent && !explicitlyBound && (!INCLUDE_SUBAGENTS || (PARENT_THREAD_ID && parentId !== PARENT_THREAD_ID))) continue

    const cwd = row?.cwd || meta.cwd || ''
    const { projectPath, project } = projectOf(cwd)
    const prompt = clean(row?.preview || row?.first_user_message || meta.prompt || '')
    const title = clean(row?.title) || clean(index.get(id)?.thread_name) || prompt || 'Untitled thread'
    const lastActivityAt = Math.max(num(row?.updated_at_ms), entry?.mtime || 0)

    out.push({
      id: ID(id),
      title: (isSubagent ? `[Subagent] ${agentPath.split('/').filter(Boolean).at(-1) || title}` : title).slice(0, 120),
      isSubagent,
      parentThreadId: parentId ? ID(parentId) : '',
      agentPath,
      preview: prompt.slice(0, 240),
      project,
      projectPath,
      // Codex has no worktree concept of its own, and guessing one from the path would put a
      // branch name on a thread that never had one.
      worktree: '',
      cwd,
      gitBranch: row?.git_branch || meta.gitBranch || '',
      model: row?.model || meta.model || '',
      effort: row?.reasoning_effort || meta.effort || '',
      createdAt: num(row?.created_at_ms) || meta.createdAt || entry?.mtime || 0,
      lastActivityAt,
      // Codex records no focus history, so "have you looked at this" is unknowable — not false.
      lastFocusedAt: 0,
      unread: false,
      // Windows may defer mtime updates while Codex holds the rollout open. Record timestamps
      // are transcript activity too; database renames/pins are not.
      running: facts.lifecycle?.type === 'task_started' && Boolean(entry) && now - Math.max(entry.mtime, facts.activityAt || 0) < ACTIVE_WINDOW_MS,
      hasError: facts.lifecycle?.type === 'task_complete' && facts.lifecycle.error,
      starred: false,
      routine: '',
      prState: '',
      archived: row?.archived === 1 || row?.archived === true,
      // Bytes, like every other harness: the field is a shared log scale across the whole map,
      // and a token count would make Codex buildings taller than Claude ones for the same work.
      sizeBytes: entry?.size || 0,
      source: row?.source === 'vscode' ? 'vscode' : 'cli',
      canOpen: true,
      ref: { sessionId: id },
    })
  }
  return out
}

/** `codex://` is registered by the Codex desktop app; the OS opener does the rest. */
function openThread(ref) {
  const id = ref?.sessionId
  if (typeof id !== 'string' || !UUID.test(id)) {
    return { ok: false, error: 'No openable Codex session id on that thread' }
  }
  return { ok: true, url: `codex://threads/${id}` }
}

function newSession(dir) {
  return { ok: true, url: `codex://threads/new?${new URLSearchParams({ path: dir })}` }
}

/** Claim the machine if either store is there — a CLI-only install has no database. */
async function detect() {
  return (await exists(SESSIONS_DIR)) || Boolean(await latestStateDatabase())
}

/**
 * Why a present Codex might still look thin. Without this the Node case is invisible: the
 * database is simply skipped, every thread loses its title and model, and nothing says why.
 */
async function diagnostic() {
  if (!(await latestStateDatabase())) return ''
  if (!(await sqliteApi())?.DatabaseSync) {
    return `Codex threads need Node 22.13 or newer for their titles and models (running ${process.versions.node})`
  }
  return ''
}

export default {
  id: 'codex',
  name: 'Codex',
  detect,
  diagnostic,
  scanThreads,
  openThread,
  newSession,
  paths: { CODEX_HOME, SESSIONS_DIR },
}
