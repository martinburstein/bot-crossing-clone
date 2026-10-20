import test from 'node:test'
import assert from 'node:assert/strict'
import { Engine } from '../src/core/engine.js'

// Model a real canvas resize: it erases the last presented image until a draw.
function fixture({ post = false, fps = 30, scale = 1, autoFocus = false } = {}) {
  const engine = Object.create(Engine.prototype)
  const values = { autoQuality: true, renderScale: 1, bloom: post, autoFocus }
  let painted = true
  const events = []
  engine.settings = { get: key => values[key] }
  engine.canvas = { width: 800 * scale, height: 600 * scale, parentElement: { clientWidth: 800, clientHeight: 600 } }
  engine.viewport = { w: 800, h: 600, bw: 800 * scale, bh: 600 * scale, scale }
  engine.camera = { updateProjectionMatrix() {} }
  engine.timer = { update() {}, getDelta: () => 1 / 30 }
  engine.elapsed = 0
  engine.updaters = []
  const draw = () => { painted = true; events.push('draw') }
  engine.renderer = {
    info: { reset() {} },
    setSize(w, h) { painted = false; events.push('resize'); engine.canvas.width = w; engine.canvas.height = h },
    render: draw,
  }
  engine.composer = post ? { setSize() {}, render: draw } : null
  engine.perf = { fps, sample() {} }
  engine._lastGovern = -Infinity
  engine._slow = 2
  engine._fast = 7
  return { engine, events, painted: () => painted }
}

test('adaptive changes present a painted frame for both render paths', () => {
  const previous = globalThis.window
  globalThis.window = { devicePixelRatio: 1 }
  try {
    for (const post of [false, true]) {
      for (const options of [{ fps: 30, scale: 1 }, { fps: 60, scale: 0.5 }]) {
        const f = fixture({ post, ...options })
        f.engine._loop()
        assert.deepEqual(f.events, ['resize', 'draw'])
        assert.equal(f.painted(), true)
      }
    }
  } finally { globalThis.window = previous }
})

test('a redundant resize notification does not erase the displayed frame', () => {
  const previous = globalThis.window
  globalThis.window = { devicePixelRatio: 1 }
  try {
    const f = fixture()
    f.engine.resize()
    assert.deepEqual(f.events, [])
    assert.equal(f.painted(), true)
    f.engine.canvas.parentElement.clientWidth = 900
    f.engine.resize()
    assert.deepEqual(f.events, ['resize'])
    assert.equal(f.engine.canvas.width, 900)
    assert.equal(f.engine.camera.aspect, 1.5)
  } finally { globalThis.window = previous }
})

test('Auto Focus keeps resolution intact under sustained slow frames', () => {
  const previous = globalThis.window
  globalThis.window = { devicePixelRatio: 1 }
  try {
    const f = fixture({ autoFocus: true })
    for (let second = 0; second < 180; second++) {
      f.engine._lastGovern = -Infinity
      f.engine._loop()
    }
    assert.equal(f.engine.canvas.width, 800)
    assert.equal(f.engine.canvas.height, 600)
    assert.equal(f.events.includes('resize'), false)
  } finally { globalThis.window = previous }
})
