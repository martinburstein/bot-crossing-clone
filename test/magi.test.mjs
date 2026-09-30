import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { magiSourceUrl, readMagiState, projectMagiState, magiHealth } from '../server/magi.mjs'
import { apiMiddleware } from '../server/api.mjs'

const ids = Array.from({ length: 15 }, (_, i) => `w${String(i + 1).padStart(2, '0')}`)
function fixture(now = 10_000) {
  return {
    schemaVersion: 1, mode: 'live', projectId: 'fixture-project', revision: 2, observedAt: now,
    capacity: { total: 15, limit: 3, occupied: 1, running: 1, reserved: 0 },
    workers: ids.map((id, index) => ({ id, name: `Worker ${id}`, status: index === 0 ? 'running' : 'idle', bound: index === 0, taskId: index === 0 ? 'task-1' : null, taskTitle: index === 0 ? 'Fixture task' : null })),
    tasks: [{ id: 'task-1', title: 'Fixture task', workerId: 'w01', reviewerId: 'w06', state: 'running' }],
    milestones: [{ id: 'milestone-1', workerId: 'w01', level: 'minor', title: 'Verified fixture item' }], notes: [],
    magi: { mode: 'magi', clusters: [
      { id: 'melchior', workerIds: ids.slice(0, 5), status: 'running', occupied: true, activeWorkerId: 'w01' },
      { id: 'balthasar', workerIds: ids.slice(5, 10), status: 'idle', occupied: false, activeWorkerId: null },
      { id: 'casper', workerIds: ids.slice(10), status: 'idle', occupied: false, activeWorkerId: null },
    ] },
  }
}
const env = { BOT_CROSSING_MAGI_URL: 'http://127.0.0.1:5275/api/state' }

test('source URL is restricted to loopback read-only state endpoint', () => {
  assert.equal(magiSourceUrl(env), env.BOT_CROSSING_MAGI_URL)
  for (const value of ['https://127.0.0.1:1234/api/state', 'http://localhost:1234/api/state', 'http://127.0.0.1:1234/api/start', 'http://127.0.0.1:1234/api/state?token=x']) {
    assert.throws(() => magiSourceUrl({ BOT_CROSSING_MAGI_URL: value }))
  }
})

test('projection maps the exact 15 identities and only a confirmed running lease to working', () => {
  const state = fixture()
  const { threads, alignment: lights } = projectMagiState(state, 10_000)
  assert.equal(threads.length, 15)
  assert.deepEqual(threads.map(item => item.shellId), ids)
  assert.equal(new Set(threads.map(item => item.project)).size, 15)
  assert.equal(threads.filter(item => item.running).length, 1)
  assert.equal(threads[0].assignmentState, 'running')
  assert.equal(threads[1].assignmentState, 'idle')
  assert.equal(threads[0].milestones[0].level, 'minor')
  assert.deepEqual(lights, { count: 1, mode: 'red', clusters: [true, false, false] })
  state.workers[0].status = 'reserved'
  state.workers[0].bound = false
  state.magi.clusters[0].status = 'reserved'
  state.magi.clusters[0].activeWorkerId = 'w01'
  state.capacity.running = 0
  state.capacity.reserved = 1
  const reserved = projectMagiState(state, 10_000)
  assert.equal(reserved.threads[0].running, false)
  assert.equal(reserved.threads[0].shellStatus, 'Reserved')
  assert.deepEqual(reserved.alignment, { count: 0, mode: 'off', clusters: [false, false, false] })
})

test('fetch is GET-only and health is ready only for fresh fully valid state', async () => {
  const state = fixture()
  let request
  const fetchImpl = async (url, options) => {
    request = { url, options }
    return { ok: true, json: async () => state }
  }
  const read = await readMagiState({ env, fetchImpl, now: 10_000 })
  assert.equal(read, state)
  assert.equal(request.options.method, 'GET')
  assert.equal(request.options.redirect, 'error')
  assert.deepEqual(await magiHealth({ env, fetchImpl, now: 10_000 }), {
    service: 'bot-crossing-magi', sourceUrl: env.BOT_CROSSING_MAGI_URL, readOnly: true,
    ready: true, observedAt: 10_000, revision: 2, workers: 15,
  })
  state.workers.pop()
  await assert.rejects(readMagiState({ env, fetchImpl, now: 10_000 }), /invalid or stale/)
  assert.equal((await magiHealth({ env, fetchImpl, now: 10_000 })).ready, false)
})

test('stale, incomplete, and unreachable upstream state is rejected instead of inventing activity', async () => {
  await assert.rejects(readMagiState({ env, now: 40_000, fetchImpl: async () => ({ ok: true, json: async () => fixture(10_000) }) }), /invalid or stale/)
  await assert.rejects(readMagiState({ env, fetchImpl: async () => { throw new Error('offline') } }), /source is unavailable/)
})

test('MAGI API uses only the upstream projection and refuses legacy process controls', async t => {
  const upstreamState = fixture(Date.now())
  const upstream = createServer((req, res) => {
    assert.equal(req.method, 'GET')
    assert.equal(req.url, '/api/state')
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(upstreamState))
  })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  t.after(() => upstream.close())
  const prior = process.env.BOT_CROSSING_MAGI_URL
  process.env.BOT_CROSSING_MAGI_URL = `http://127.0.0.1:${upstream.address().port}/api/state`
  t.after(() => { if (prior === undefined) delete process.env.BOT_CROSSING_MAGI_URL; else process.env.BOT_CROSSING_MAGI_URL = prior })

  async function call(pathname, method = 'GET') {
    const req = { url: pathname, method, headers: { host: '127.0.0.1:5274', ...(method === 'POST' ? { origin: 'http://127.0.0.1:5274' } : {}) } }
    const response = { status: 0, headers: {}, body: '' , writeHead(status, headers) { this.status = status; this.headers = headers }, end(body = '') { this.body = body } }
    await apiMiddleware(req, response, () => { throw new Error('API route unexpectedly fell through') })
    return { ...response, json: JSON.parse(response.body || '{}') }
  }

  const threads = await call('/api/threads')
  assert.equal(threads.status, 200)
  assert.equal(threads.json.mode, 'magi')
  assert.equal(threads.json.threads.length, 15)
  assert.equal((await call('/api/magi/health')).json.ready, true)
  assert.equal((await call('/api/swarm/health')).status, 404)
  assert.equal((await call('/api/harnesses')).status, 404)
  assert.equal((await call('/api/new-session', 'POST')).status, 404)
  assert.equal((await call('/api/open', 'POST')).status, 404)
  upstreamState.observedAt = 0
  const stale = await call('/api/threads')
  assert.equal(stale.status, 503)
  assert.deepEqual(stale.json.threads, [])
  assert.equal(stale.json.alignment, null)
})
