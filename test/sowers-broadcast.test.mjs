import test from 'node:test'
import assert from 'node:assert/strict'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadSowersBroadcast } from '../server/sowers-broadcast.mjs'
import { observedConstruction } from '../sowers/progress.mjs'

async function fixture(t) {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'sowers-broadcast-'))
  const file = path.join(directory, 'observation.json')
  t.after(() => fsp.rm(directory, { recursive: true, force: true }))
  return { directory, file, async write(snapshot) {
    await fsp.writeFile(file, typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot))
    return loadSowersBroadcast({ file })
  } }
}
const snapshot = threads => ({ version: 1, observedAt: Date.now(), threads })
const checkpoint = overrides => ({ id: 'pad', title: 'Pad laid', level: 'minor', accepted: true, status: 'accepted', ...overrides })

test('missing configuration is graceful; configured missing and relative paths are unavailable', async t => {
  assert.deepEqual(await loadSowersBroadcast({ file: '' }), { threads: [], configured: false, observedAt: null, warnings: [] })
  for (const file of ['relative.json', null, path.join(os.tmpdir(), 'missing-sowers-broadcast-file.json')]) {
    const result = await loadSowersBroadcast({ file })
    assert.equal(result.configured, true)
    assert.deepEqual(result.threads, [])
    assert.equal(result.observedAt, null)
    assert.equal(result.warnings.length, 1)
  }
  const f = await fixture(t)
  await f.write(snapshot([{ id: 'environment-selected' }]))
  const previous = process.env.SOWERS_BROADCAST_FILE
  t.after(() => {
    if (previous === undefined) delete process.env.SOWERS_BROADCAST_FILE
    else process.env.SOWERS_BROADCAST_FILE = previous
  })
  process.env.SOWERS_BROADCAST_FILE = f.file
  assert.equal((await loadSowersBroadcast()).threads[0].id, 'environment-selected')
})

test('fresh snapshots preserve identity, explicit activity, plan denominator and checkpoint evidence', async t => {
  const f = await fixture(t)
  const id = 'codex:10000000-0000-4000-8000-000000000000'
  const result = await f.write(snapshot([{ id, title: 'Habitat', project: 'Sowers', running: true,
    assignmentState: 'review', constructionProgress: .4,
    plan: { steps: [{ title: 'Pad', status: 'completed' }, { title: 'Frame', status: 'pending' }] },
    milestones: [checkpoint(), checkpoint({ id: 'old', retractedAt: Date.now() })],
    tokens: 100000, runClosed: true, sizeBytes: 100000, arbitrary: { unsafe: true },
  }]))
  assert.deepEqual(result.warnings, [])
  assert.equal(result.configured, true)
  const thread = result.threads[0]
  assert.equal(thread.id, id)
  assert.equal(thread.running, true)
  assert.equal(thread.broadcastStale, false)
  assert.equal(thread.broadcastObservedAt, result.observedAt)
  assert.equal(thread.constructionProgress, .4)
  assert.deepEqual(thread.plan.steps.map(s => s.status), ['completed', 'pending'])
  assert.equal(thread.milestones[1].retractedAt > 0, true)
  for (const key of ['tokens', 'runClosed', 'sizeBytes', 'arbitrary']) assert.equal(Object.hasOwn(thread, key), false)
})

test('old and future observations are historical and cannot claim current running activity', async t => {
  const f = await fixture(t)
  for (const observedAt of [Date.now() - 120_000, Date.now() + 60_000]) {
    const result = await f.write({ version: 1, observedAt, threads: [{ id: 'agent', running: true, constructionProgress: .6 }] })
    assert.equal(result.observedAt, observedAt)
    assert.equal(result.threads[0].running, false)
    assert.equal(result.threads[0].broadcastStale, true)
    assert.equal(result.threads[0].constructionProgress, .6)
    assert.match(result.warnings[0], /stale|future/)
  }
})

test('staleness limit is configurable and invalid configuration falls back visibly', async t => {
  const f = await fixture(t)
  const previous = process.env.SOWERS_BROADCAST_MAX_AGE_MS
  t.after(() => {
    if (previous === undefined) delete process.env.SOWERS_BROADCAST_MAX_AGE_MS
    else process.env.SOWERS_BROADCAST_MAX_AGE_MS = previous
  })
  process.env.SOWERS_BROADCAST_MAX_AGE_MS = '1000'
  let result = await f.write({ ...snapshot([{ id: 'a', running: true }]), observedAt: Date.now() - 5000 })
  assert.equal(result.threads[0].broadcastStale, true)
  process.env.SOWERS_BROADCAST_MAX_AGE_MS = '60000'
  result = await loadSowersBroadcast({ file: f.file })
  assert.equal(result.threads[0].broadcastStale, false)
  process.env.SOWERS_BROADCAST_MAX_AGE_MS = 'Infinity'
  result = await loadSowersBroadcast({ file: f.file })
  assert.match(result.warnings[0], /Invalid SOWERS_BROADCAST_MAX_AGE_MS/)
})

test('malformed snapshots, duplicate identities and malformed nested lists reject the whole observation', async t => {
  const f = await fixture(t)
  for (const value of [
    '{broken', null, [], { ...snapshot([]), version: 2 }, { ...snapshot([]), observedAt: 'now' },
    { ...snapshot([]), observedAt: -1 }, { ...snapshot([]), threads: {} },
    snapshot([null]), snapshot([{ id: ' ' }]), snapshot([{ id: 'x' }, { id: 'x' }]),
    snapshot([{ id: 'x', running: 'true' }]), snapshot([{ id: 'x', milestones: null }]),
    snapshot([{ id: 'x', milestones: [checkpoint(), checkpoint()] }]),
    snapshot([{ id: 'x', milestones: [checkpoint({ accepted: 'yes' })] }]),
    snapshot([{ id: 'x', milestones: [checkpoint({ retractedAt: 0 })] }]),
    snapshot([{ id: 'x', plan: { steps: 'done' } }]), snapshot([{ id: 'x', plan: { steps: [null] } }]),
    snapshot([{ id: 'x', plan: { steps: [{ status: 'unknown' }] } }]),
  ]) {
    const result = await f.write(JSON.stringify(value) === undefined ? String(value) : JSON.stringify(value))
    assert.deepEqual(result.threads, [], `accepted malformed ${JSON.stringify(value)}`)
    assert.equal(result.observedAt, null)
    assert.equal(result.configured, true)
    assert.equal(result.warnings.length, 1)
  }
})

test('progress accepts finite numeric fractions only; elapsed, token and closure fields prove nothing', async t => {
  const f = await fixture(t)
  for (const value of [-.1, 1.1, '0.5', null]) {
    const result = await f.write(snapshot([{ id: 'a', constructionProgress: value }]))
    assert.deepEqual(result.threads, [])
    assert.match(result.warnings[0], /finite number from 0 to 1/)
  }
  for (const value of [0, .5, 1]) {
    const result = await f.write(snapshot([{ id: 'a', constructionProgress: value }]))
    assert.equal(result.threads[0].constructionProgress, value)
  }
  for (const raw of ['1e309', '-1e309']) {
    const result = await f.write(`{"version":1,"observedAt":${Date.now()},"threads":[{"id":"a","constructionProgress":${raw}}]}`)
    assert.deepEqual(result.threads, [])
    assert.match(result.warnings[0], /finite number from 0 to 1/)
  }
  const result = await f.write(snapshot([{ id: 'a', running: true, tokens: 1e9, elapsed: 1e9, runClosed: true,
    milestones: [checkpoint({ accepted: undefined, status: undefined })] }]))
  assert.equal(observedConstruction(result.threads[0]).fraction, null)
  assert.equal(observedConstruction(result.threads[0]).completed, 0)
  const accepted = await f.write(snapshot([{ id: 'a', milestones: [
    checkpoint({ status: undefined }), checkpoint({ id: 'contradicted', status: 'pending' }),
  ] }]))
  assert.equal(accepted.threads[0].milestones[0].status, 'accepted')
  assert.equal(accepted.threads[0].milestones[1].status, 'pending')
  assert.equal(observedConstruction(accepted.threads[0]).completed, 1)
})

test('1 MiB bound and regular-file check reject oversized or non-file sources', async t => {
  const f = await fixture(t)
  let result = await f.write(' '.repeat(1024 * 1024 + 1))
  assert.deepEqual(result.threads, [])
  assert.match(result.warnings[0], /1 MiB/)
  result = await loadSowersBroadcast({ file: f.directory })
  assert.deepEqual(result.threads, [])
  assert.match(result.warnings[0], /regular file/)
  // Exactly the limit remains a valid observation, rather than an off-by-one rejection.
  const value = JSON.stringify(snapshot([]))
  result = await f.write(value + ' '.repeat(1024 * 1024 - Buffer.byteLength(value)))
  assert.deepEqual(result.warnings, [])
})

test('repeated observations perform no source writes or sidecar creation and retry failures', async t => {
  const f = await fixture(t)
  await f.write(snapshot([{ id: 'a' }]))
  const bytes = await fsp.readFile(f.file)
  const before = await fsp.stat(f.file)
  for (const name of ['writeFile', 'appendFile', 'mkdir', 'rename', 'unlink', 'rm', 'truncate']) {
    t.mock.method(fsp, name, () => { throw new Error(`unexpected mutation ${name}`) })
  }
  for (let i = 0; i < 3; i++) assert.equal((await loadSowersBroadcast({ file: f.file })).threads.length, 1)
  t.mock.restoreAll()
  const after = await fsp.stat(f.file)
  assert.equal(before.mtimeMs, after.mtimeMs)
  assert.equal(before.size, after.size)
  assert.deepEqual(await fsp.readFile(f.file), bytes)
  assert.deepEqual(await fsp.readdir(f.directory), ['observation.json'])
  await fsp.writeFile(f.file, '{')
  assert.equal((await loadSowersBroadcast({ file: f.file })).threads.length, 0)
  assert.equal((await f.write(snapshot([{ id: 'repaired' }]))).threads[0].id, 'repaired')
})
