import test from 'node:test'
import assert from 'node:assert/strict'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const PARENT = '10000000-0000-4000-8000-000000000000'
const EDGE_CHILD = '20000000-0000-4000-8000-000000000000'
const SOURCE_CHILD = '30000000-0000-4000-8000-000000000000'
const META_CHILD = '40000000-0000-4000-8000-000000000000'
const DB_CHILD = '50000000-0000-4000-8000-000000000000'
const source = (name = 'worker') => ({ subagent: { thread_spawn: { parent_thread_id: PARENT, agent_path: `/root/${name}` } } })
const sessionMeta = () => JSON.stringify({ type: 'session_meta', payload: { id: PARENT, cwd: os.tmpdir(), source: 'cli' } }) + '\n'

async function fixture(t) {
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), 'bot-crossing-subagents-'))
  const oldHome = process.env.CODEX_HOME
  const oldOptIn = process.env.BOT_CROSSING_INCLUDE_SUBAGENTS
  const oldParent = process.env.BOT_CROSSING_PARENT_THREAD_ID
  t.after(async () => {
    if (oldHome === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = oldHome
    if (oldOptIn === undefined) delete process.env.BOT_CROSSING_INCLUDE_SUBAGENTS
    else process.env.BOT_CROSSING_INCLUDE_SUBAGENTS = oldOptIn
    if (oldParent === undefined) delete process.env.BOT_CROSSING_PARENT_THREAD_ID
    else process.env.BOT_CROSSING_PARENT_THREAD_ID = oldParent
    await fsp.rm(home, { recursive: true, force: true })
  })
  const day = path.join(home, 'sessions', '2026', '09', '22')
  await fsp.mkdir(day, { recursive: true })
  return {
    home,
    async rollout(id, sessionSource) {
      const records = [
        { type: 'session_meta', payload: { id, cwd: home, source: sessionSource } },
        { type: 'response_item', payload: { type: 'message', role: 'user', content: 'build collector' } },
        { type: 'event_msg', payload: { type: 'task_started' } },
      ]
      const file = path.join(day, `rollout-2026-09-22-${id}.jsonl`)
      await fsp.writeFile(file, records.map(JSON.stringify).join('\n') + '\n')
      return file
    },
    async scan(optIn, parent, options) {
      process.env.CODEX_HOME = home
      if (optIn === undefined) delete process.env.BOT_CROSSING_INCLUDE_SUBAGENTS
      else process.env.BOT_CROSSING_INCLUDE_SUBAGENTS = optIn
      if (parent === undefined) delete process.env.BOT_CROSSING_PARENT_THREAD_ID
      else process.env.BOT_CROSSING_PARENT_THREAD_ID = parent
      const { default: adapter } = await import(`../server/harnesses/codex.mjs?fixture=${encodeURIComponent(home)}&opt=${optIn}&parent=${parent}`)
      return adapter.scanThreads(options)
    },
  }
}

test('transcript-only subagents require exact opt-in and expose their parent and task name', async (t) => {
  const f = await fixture(t)
  await f.rollout(PARENT, 'cli')
  await f.rollout(META_CHILD, source('collector'))
  for (const optIn of [undefined, '0', 'true']) {
    const threads = await f.scan(optIn)
    assert.deepEqual(threads.map(x => x.id), [`codex:${PARENT}`])
    assert.equal(threads[0].title, 'build collector')
  }
  const threads = await f.scan('1')
  const child = threads.find(x => x.id === `codex:${META_CHILD}`)
  assert.equal(threads.length, 2)
  assert.equal(child.title, '[Subagent] collector')
  assert.equal(child.parentThreadId, `codex:${PARENT}`)
  assert.equal(child.agentPath, '/root/collector')
  assert.equal(child.isSubagent, true)
  assert.equal(child.running, true)
  assert.ok(child.sizeBytes > 0)
})

test('active shell binding opts in only its exact worker across an old parent filter',async t=>{
  const f=await fixture(t)
  await f.rollout(PARENT,'cli')
  await f.rollout(META_CHILD,source('shell-worker'))
  await f.rollout(SOURCE_CHILD,source('unrelated-worker'))
  const options={workerBindings:[{parentThreadId:`codex:${PARENT}`,agentPath:'/root/shell-worker'}]}
  for(const optIn of [undefined,'1']) {
    const records=await f.scan(optIn,'a-different-old-parent',options)
    assert.deepEqual(records.map(t=>t.id).sort(),[`codex:${PARENT}`,`codex:${META_CHILD}`].sort())
  }
  assert.deepEqual((await f.scan(undefined,'a-different-old-parent')).map(t=>t.id),[`codex:${PARENT}`])
})

test('long turns stay active, while appended completion and abort invalidate the cached lifecycle', async (t) => {
  const f = await fixture(t)
  const file = await f.rollout(PARENT, 'cli')
  // One oversized record crosses several chunks, followed by enough short records to push the
  // lifecycle beyond the original 64 KB tail. Emoji also exercise UTF-8 chunk boundaries.
  const output = JSON.stringify({ type: 'response_item', payload: { content: '☀️'.repeat(50000) } }) + '\n'
  const event = (type, error = false) => JSON.stringify({ type: 'event_msg', payload: { type, error } }) + '\n'
  await fsp.appendFile(file, output + ('{"type":"response_item","payload":{}}\n'.repeat(4000)))
  assert.equal((await f.scan())[0].running, true)
  assert.equal((await f.scan())[0].running, true, 'unchanged scan uses the same cached result')
  await fsp.appendFile(file, event('task_complete', true) + output)
  let [thread] = await f.scan()
  assert.equal(thread.running, false)
  assert.equal(thread.hasError, true, 'a completion outside the tail supersedes cached task_started')
  await fsp.appendFile(file, event('task_started') + output)
  assert.equal((await f.scan())[0].running, true)
  await fsp.appendFile(file, event('turn_aborted') + output)
  ;[thread] = await f.scan()
  assert.equal(thread.running, false)
  assert.equal(thread.hasError, false)
  await fsp.appendFile(file, event('task_started') + output)
  const old = new Date(Date.now() - 6 * 60 * 60 * 1000)
  await fsp.utimes(file, old, old)
  assert.equal((await f.scan())[0].running, false, 'an old unfinished turn still expires')
  await fsp.writeFile(file, sessionMeta() + event('task_complete'))
  assert.equal((await f.scan())[0].running, false, 'file truncation invalidates lifecycle cache')
})

test('a lifecycle marker split across backward chunk boundaries is recognized', async (t) => {
  const f = await fixture(t)
  const file = await f.rollout(PARENT, 'cli')
  // EOF is exactly 64 KB plus half the marker after its beginning.
  await fsp.writeFile(file, sessionMeta() + '{"type":"event_msg","payload":{"type":"task_started"}}\n' + ' '.repeat(65536 - 20))
  assert.equal((await f.scan())[0].running, true)
})

test('recent writes alone never imply activity, and partial completion records wait for valid JSON', async (t) => {
  const f = await fixture(t)
  const file = await f.rollout(PARENT, 'cli')
  await fsp.writeFile(file, sessionMeta() + '{"type":"response_item","payload":{}}\n')
  assert.equal((await f.scan())[0].running, false)
  await fsp.appendFile(file, '{"type":"event_msg","payload":{"type":"task_started"}}\n')
  await fsp.appendFile(file, '{"type":"event_msg","payload":{"type":"task_complete"')
  assert.equal((await f.scan())[0].running, true)
  await fsp.appendFile(file, '}}\n')
  assert.equal((await f.scan())[0].running, false)
})

test('optional parent scope limits workers while retaining ordinary conversations', async (t) => {
  const f = await fixture(t)
  await f.rollout(PARENT, 'cli')
  await f.rollout(META_CHILD, source('collector'))
  const other = source('unrelated')
  other.subagent.thread_spawn.parent_thread_id = EDGE_CHILD
  await f.rollout(SOURCE_CHILD, other)
  const threads = await f.scan('1', PARENT)
  assert.deepEqual(new Set(threads.map(x => x.id)), new Set([`codex:${PARENT}`, `codex:${META_CHILD}`]))
  assert.deepEqual((await f.scan(undefined, PARENT)).map(x => x.id), [`codex:${PARENT}`])
})

test('transient transcript read failure is retried without changing file size or timestamps', async (t) => {
  const f = await fixture(t)
  const file = await f.rollout(PARENT, 'cli')
  const open = fsp.open.bind(fsp)
  let fail = true
  t.mock.method(fsp, 'open', async (...args) => {
    if (args[0] === file && fail) { fail = false; throw new Error('Transient sharing violation') }
    return open(...args)
  })
  assert.deepEqual(await f.scan(), [], 'unreadable transcript is omitted until it can be classified')
  assert.equal((await f.scan())[0].running, true, 'unchanged file recovers on the next poll')
})

test('fresh database metadata cannot revive an old unfinished transcript', async (t) => {
  const sqlite = await import('node:sqlite').catch(() => null)
  if (!sqlite?.DatabaseSync) return t.skip('node:sqlite unavailable')
  const f = await fixture(t)
  const file = await f.rollout(PARENT, 'cli')
  const old = new Date(Date.now() - 6 * 60 * 60 * 1000)
  await fsp.utimes(file, old, old)
  const updated = Date.now()
  const db = new sqlite.DatabaseSync(path.join(f.home, 'state_1.sqlite'))
  db.exec('CREATE TABLE threads (id TEXT, cwd TEXT, updated_at_ms INTEGER)')
  db.prepare('INSERT INTO threads VALUES (?, ?, ?)').run(PARENT, f.home, updated)
  db.close()
  const [thread] = await f.scan()
  assert.equal(thread.lastActivityAt, updated, 'metadata still affects sorting')
  assert.equal(thread.running, false, 'activity freshness comes only from the transcript')
})

test('partial session metadata is retried and never exposes an unclassified worker', async (t) => {
  const f = await fixture(t)
  const file = await f.rollout(META_CHILD, source('collector'))
  const record = JSON.stringify({ type: 'session_meta', payload: { id: META_CHILD, cwd: f.home, source: source('collector') } }) + '\n'
  const split = Math.floor(record.length / 2)
  await fsp.writeFile(file, record.slice(0, split))
  assert.deepEqual(await f.scan(), [])
  await fsp.appendFile(file, record.slice(split))
  assert.deepEqual(await f.scan(), [], 'completed worker metadata respects default exclusion')
  const [child] = await f.scan('1')
  assert.equal(child.isSubagent, true)
  assert.equal(child.parentThreadId, `codex:${PARENT}`)
})

test('a transient append read failure preserves known worker classification', async (t) => {
  const f = await fixture(t)
  const file = await f.rollout(META_CHILD, source('collector'))
  assert.deepEqual(await f.scan(), [])
  await fsp.appendFile(file, '{"type":"response_item","payload":{}}\n')
  const open = fsp.open.bind(fsp)
  let fail = true
  t.mock.method(fsp, 'open', async (...args) => {
    if (args[0] === file && fail) { fail = false; throw new Error('Transient sharing violation') }
    return open(...args)
  })
  assert.deepEqual(await f.scan(), [], 'cached source metadata still hides the worker')
  assert.deepEqual(await f.scan(), [], 'next poll retries successfully')
})

test('append-only polling reads new bytes rather than rescanning a long active turn', async (t) => {
  const f = await fixture(t)
  const file = await f.rollout(PARENT, 'cli')
  await fsp.appendFile(file, JSON.stringify({ type: 'response_item', payload: { text: 'x'.repeat(3 * 1024 * 1024) } }) + '\n')
  assert.equal((await f.scan())[0].running, true)
  const open = fsp.open.bind(fsp)
  let bytes = 0
  t.mock.method(fsp, 'open', async (...args) => {
    const handle = await open(...args)
    if (args[0] === file) {
      const read = handle.read.bind(handle)
      handle.read = async (...readArgs) => { const result = await read(...readArgs); bytes += result.bytesRead; return result }
    }
    return handle
  })
  for (let i = 0; i < 5; i++) {
    await fsp.appendFile(file, '{"type":"response_item","payload":{}}\n')
    assert.equal((await f.scan())[0].running, true)
  }
  assert.ok(bytes < 65536, `five small appends read ${bytes} bytes, not the 3 MB history`)
  await fsp.appendFile(file, '{"type":"event_msg","payload":{"type":"task_complete"}}\n')
  assert.equal((await f.scan())[0].running, false)
})

test('recent transcript timestamps preserve live Windows turns whose open-file mtime is stale', async (t) => {
  const f = await fixture(t)
  const file = await f.rollout(PARENT, 'cli')
  const old = new Date(Date.now() - 6 * 60 * 60 * 1000)
  await fsp.appendFile(file, JSON.stringify({ timestamp: old.toISOString(), type: 'response_item', payload: {} }) + '\n')
  await fsp.utimes(file, old, old)
  assert.equal((await f.scan())[0].running, false)
  await fsp.appendFile(file, JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: {} }) + '\n')
  await fsp.utimes(file, old, old)
  assert.equal((await f.scan())[0].running, true, 'appended record timestamps update activity despite stale mtime')
  assert.equal((await f.scan('0'))[0].running, true, 'cold scan also reads the newest transcript timestamp')
})

test('replacement and a larger in-place rewrite invalidate append lifecycle state', async (t) => {
  const f = await fixture(t)
  const file = await f.rollout(PARENT, 'cli')
  assert.equal((await f.scan())[0].running, true)
  const replacement = file + '.replacement'
  await fsp.writeFile(replacement, sessionMeta() + '{"type":"event_msg","payload":{"type":"turn_aborted"}}\n' + ' '.repeat(1000))
  await fsp.rename(replacement, file)
  assert.equal((await f.scan())[0].running, false)
  await fsp.writeFile(file, sessionMeta() + '{"type":"event_msg","payload":{"type":"task_started"}}\n' + ' '.repeat(2000))
  assert.equal((await f.scan())[0].running, true)
})

test('database child exclusion survives rollout merging, including edge-only and source-only workers', async (t) => {
  const sqlite = await import('node:sqlite').catch(() => null)
  if (!sqlite?.DatabaseSync) return t.skip('node:sqlite unavailable')
  const f = await fixture(t)
  const db = new sqlite.DatabaseSync(path.join(f.home, 'state_1.sqlite'))
  db.exec('CREATE TABLE threads (id TEXT, cwd TEXT, title TEXT, source TEXT, thread_source TEXT); CREATE TABLE thread_spawn_edges (parent_thread_id TEXT, child_thread_id TEXT)')
  const insert = db.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?)')
  insert.run(PARENT, f.home, 'parent', '{malformed source', 'user')
  // The spawn edge may precede its thread row; the rollout still has only a CLI source.
  insert.run(SOURCE_CHILD, f.home, '', JSON.stringify(source('reflector')), null)
  insert.run(DB_CHILD, f.home, 'database child', 'cli', 'subagent')
  db.prepare('INSERT INTO thread_spawn_edges VALUES (?, ?)').run(PARENT, EDGE_CHILD)
  db.prepare('INSERT INTO thread_spawn_edges VALUES (?, ?)').run(PARENT, '60000000-0000-4000-8000-000000000000')
  db.close()
  await f.rollout(PARENT, 'cli')
  await f.rollout(EDGE_CHILD, 'cli')
  await f.rollout(SOURCE_CHILD, 'cli')
  await f.rollout(META_CHILD, source('transcript-only'))
  assert.deepEqual((await f.scan()).map(x => x.id), [`codex:${PARENT}`])
  const threads = await f.scan('1')
  assert.equal(threads.length, 5)
  assert.equal(new Set(threads.map(x => x.id)).size, 5, 'database and rollout merge once')
  assert.equal(threads.find(x => x.id === `codex:${EDGE_CHILD}`).parentThreadId, `codex:${PARENT}`)
  assert.equal(threads.find(x => x.id === `codex:${SOURCE_CHILD}`).title, '[Subagent] reflector')
  assert.equal(threads.find(x => x.id === `codex:${DB_CHILD}`).isSubagent, true)
  assert.equal(threads.find(x => x.id === `codex:${DB_CHILD}`).parentThreadId, '')
  assert.equal(threads.find(x => x.id === `codex:${PARENT}`).isSubagent, false)
})
