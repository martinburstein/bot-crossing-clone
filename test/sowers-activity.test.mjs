import test from 'node:test'
import assert from 'node:assert/strict'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const ID = '10000000-0000-4000-8000-000000000001'
const AT = '2026-11-25T18:00:00.000Z'
const line = (type, payload, timestamp = AT) => JSON.stringify({ type, payload, timestamp }) + '\n'
const message = (text, channel = 'commentary') => line('response_item', {
  type: 'message', role: 'assistant', channel, content: [{ type: 'output_text', text }],
})
const event = type => line('event_msg', { type })

async function fixture(t, records = '') {
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), 'sowers-activity-'))
  const old = process.env.CODEX_HOME
  process.env.CODEX_HOME = home
  const { default: adapter } = await import(`../server/harnesses/codex.mjs?activity=${encodeURIComponent(home)}`)
  if (old === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = old
  t.after(() => fsp.rm(home, { recursive: true, force: true }))
  const day = path.join(home, 'sessions', '2026', '11', '25')
  await fsp.mkdir(day, { recursive: true })
  const file = path.join(day, `rollout-2026-11-25-${ID}.jsonl`)
  await fsp.writeFile(file, line('session_meta', { id: ID, cwd: home, source: 'cli' }) + records)
  return { file, scan: async () => (await adapter.scanThreads())[0] }
}

test('only explicit assistant public output_text is shown; private and ambiguous shapes stay hidden', async t => {
  const f = await fixture(t, event('task_complete') + message('Public status') +
    message('PRIVATE ANALYSIS', 'analysis') +
    line('response_item', { type: 'reasoning', summary: [{ text: 'PRIVATE SUMMARY' }] }) +
    line('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'NO CHANNEL' }] }) +
    line('response_item', { type: 'message', role: 'user', channel: 'final', content: [{ type: 'output_text', text: 'USER TEXT' }] }) +
    line('response_item', { type: 'message', role: 'assistant', channel: 'final', content: [{ type: 'input_text', text: 'WRONG CONTENT' }] }) +
    line('response_item', { type: 'message', role: 'assistant', channel: 'final', content: 'STRING CONTENT' }) +
    line('event_msg', { type: 'agent_message', message: 'UNVERIFIED EVENT MESSAGE' }) +
    line('event_msg', { type: 'agent_reasoning', text: 'PRIVATE EVENT' }))
  const thread = await f.scan()
  assert.deepEqual(thread.activity, { kind: 'commentary', text: 'Public status', at: Date.parse(AT) })
  assert.equal(thread.running, false)
  for (const hidden of ['PRIVATE', 'NO CHANNEL', 'USER TEXT', 'WRONG CONTENT', 'STRING CONTENT', 'UNVERIFIED']) {
    assert.ok(!JSON.stringify(thread.activity).includes(hidden), `${hidden} must never enter public activity`)
  }
})

test('tool activity exposes only a validated name and cannot leak arguments, call IDs or output', async t => {
  const f = await fixture(t, event('task_started') + line('response_item', {
    type: 'function_call', name: 'functions.exec', arguments: '{"secret":"TOOL SECRET"}', call_id: 'PRIVATE ID',
  }) + line('response_item', { type: 'function_call_output', output: 'PRIVATE TOOL OUTPUT' }))
  let thread = await f.scan()
  assert.deepEqual(thread.activity, { kind: 'tool', text: 'functions.exec', at: Date.parse(AT) })
  assert.equal(thread.running, true)
  assert.ok(!JSON.stringify(thread).includes('PRIVATE'))
  assert.ok(!JSON.stringify(thread).includes('TOOL SECRET'))
  await fsp.appendFile(f.file, line('response_item', { type: 'function_call', name: 'exec({"secret":"BAD NAME"})', arguments: 'PRIVATE' }))
  thread = await f.scan()
  assert.equal(thread.activity.text, 'functions.exec')
  assert.ok(!JSON.stringify(thread).includes('BAD NAME'))
})

test('append cache updates public history across invalid and partial JSON without inventing running state', async t => {
  const f = await fixture(t, message('First'))
  assert.equal((await f.scan()).running, false)
  const next = message('Finished', 'final')
  await fsp.appendFile(f.file, '{invalid json}\n' + message('HIDDEN', 'analysis') + next.slice(0, -3))
  assert.equal((await f.scan()).activity.text, 'First', 'partial JSON waits for a completed record')
  await fsp.appendFile(f.file, next.slice(-3))
  let thread = await f.scan()
  assert.deepEqual(thread.activity, { kind: 'message', text: 'Finished', at: Date.parse(AT) })
  assert.equal(thread.running, false)
  await fsp.appendFile(f.file, event('task_started') + message('Working'))
  assert.equal((await f.scan()).running, true)
  await fsp.appendFile(f.file, event('task_complete') + message('PRIVATE', 'analysis'))
  thread = await f.scan()
  assert.equal(thread.running, false)
  assert.equal(thread.activity.text, 'Working', 'completion preserves the last observed public history')
})

test('public text is bounded and normalized with only output_text content included', async t => {
  const f = await fixture(t, line('response_item', { type: 'message', role: 'assistant', channel: 'final', content: [
    { type: 'output_text', text: 'A\u0000\n B' }, { type: 'reasoning_text', text: 'PRIVATE' },
    { type: 'output_text', text: 'x'.repeat(1000) },
  ] }, 'not-a-date'))
  const { activity } = await f.scan()
  assert.equal(activity.kind, 'message')
  assert.equal(activity.at, 0, 'unknown source timestamp remains unknown')
  assert.equal(activity.text.length, 480)
  assert.ok(activity.text.startsWith('A B xxx'))
  assert.ok(!activity.text.includes('PRIVATE'))
})

test('cold public lookup stays inside the 128 KiB tail even when lifecycle searches older history', async t => {
  const padding = line('response_item', { type: 'function_call_output', output: 'p'.repeat(200000) })
  const f = await fixture(t, event('task_started') + message('OLD PUBLIC') + padding)
  let thread = await f.scan()
  assert.equal(thread.running, true, 'lifecycle may be older than the public activity window')
  assert.equal(thread.activity, null, 'old public content outside the tail is not reconstructed')
  await fsp.appendFile(f.file, message('Recent public'))
  assert.equal((await f.scan()).activity.text, 'Recent public')
  await fsp.appendFile(f.file, padding + event('task_complete'))
  thread = await f.scan()
  assert.equal(thread.activity.text, 'Recent public', 'append cache retains already observed history beyond the tail')
  assert.equal(thread.running, false)
})

test('unchanged polls do no transcript reads and small appends do not rescan a large rollout', async t => {
  const f = await fixture(t, event('task_started') + line('response_item', { type: 'function_call_output', output: 'x'.repeat(3 * 1024 * 1024) }) + message('Ready'))
  assert.equal((await f.scan()).activity.text, 'Ready')
  const open = fsp.open.bind(fsp)
  let bytes = 0
  t.mock.method(fsp, 'open', async (...args) => {
    const handle = await open(...args)
    if (args[0] === f.file) {
      const read = handle.read.bind(handle)
      handle.read = async (...readArgs) => { const result = await read(...readArgs); bytes += result.bytesRead; return result }
    }
    return handle
  })
  await f.scan()
  assert.equal(bytes, 0)
  for (let i = 0; i < 5; i++) {
    await fsp.appendFile(f.file, message(`Update ${i}`))
    assert.equal((await f.scan()).activity.text, `Update ${i}`)
  }
  assert.ok(bytes < 65536, `five public appends read ${bytes} bytes for a 3 MiB rollout`)
  t.diagnostic(`Five public appends after initial 3 MiB scan: ${bytes} bytes read; unchanged poll: 0 bytes.`)
})

test('file truncation invalidates cached public history and complete records require a newline', async t => {
  const f = await fixture(t, message('Old public'))
  assert.equal((await f.scan()).activity.text, 'Old public')
  await fsp.writeFile(f.file, line('session_meta', { id: ID, cwd: os.tmpdir(), source: 'cli' }) + message('Pending').trimEnd())
  assert.equal((await f.scan()).activity, null)
  await fsp.appendFile(f.file, '\n')
  assert.equal((await f.scan()).activity.text, 'Pending')
})
