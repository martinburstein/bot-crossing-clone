import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createCheckpointExpansion } from '../sowers/expansion.js'

const records = n => Array.from({ length: n }, (_, i) => ({ id: `checkpoint-${i}`, title: `Installed ${i}` }))
const signature = root => {
  const result = []
  root.traverse(o => { if (o.isMesh) result.push([o.geometry.type, o.position.toArray(), o.quaternion.toArray(), o.scale.toArray(), o.material.color.getHex()]) })
  return result
}
const childMap = root => new Map(root.children.map(c => [c.userData.checkpointKey, c]))

function watchDisposal(group) {
  const resources = new Set(), counts = new Map()
  group.traverse(o => {
    if (o.geometry) resources.add(o.geometry)
    if (o.material) resources.add(o.material)
  })
  for (const resource of resources) {
    counts.set(resource, 0)
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1))
  }
  return () => [...counts.values()]
}

test('checkpoints create seeded hardware without implying task completion', () => {
  const milestones = records(12)
  const a = createCheckpointExpansion({ seed: 'Astra' }), b = createCheckpointExpansion({ seed: 'Astra' })
  assert.equal(a.children.length, 0)
  assert.equal(a.userData.checkpointCount, 0)
  assert.equal(a.userData.setCheckpoints(milestones), a)
  b.userData.setCheckpoints([...milestones].reverse())
  assert.deepEqual(signature(a), signature(b))
  assert.ok(new Set(a.children.map(c => c.userData.hardware)).size >= 4)
  assert.equal(a.userData.checkpointCount, 12)
  assert.equal(a.userData.displayedCount, 12)
  assert.equal(a.userData.overflowCount, 0)
  assert.equal(a.userData.progress, undefined)
  assert.equal(a.userData.fraction, undefined)
  a.userData.dispose(); b.userData.dispose()
})

test('reordering, fallback property order and acceptance changes preserve surviving modules', () => {
  const expansion = createCheckpointExpansion()
  const fallback = { title: 'Power connected', evidence: { path: 'output', lines: 12 } }
  const initial = [{ id: 'A' }, { id: 'B', accepted: true }, fallback]
  expansion.userData.setCheckpoints(initial)
  const before = childMap(expansion), transforms = new Map([...before].map(([k, v]) => [k, v.position.toArray()]))
  expansion.userData.setCheckpoints([{ evidence: { lines: 12, path: 'output' }, title: 'Power connected', status: 'completed', accepted: true }, initial[1], initial[0]])
  assert.deepEqual(childMap(expansion), before)
  for (const [key, module] of childMap(expansion)) assert.deepEqual(module.position.toArray(), transforms.get(key))
  const victim = [...before.values()].find(c => c.userData.checkpointKey.includes('string:A'))
  const disposal = watchDisposal(victim)
  expansion.userData.setCheckpoints([{ id: 'A', retractedAt: 123 }, initial[1], fallback])
  assert.equal(expansion.children.length, 2)
  assert.equal(victim.parent, null)
  assert.ok(disposal().every(n => n === 1))
  for (const module of expansion.children) {
    assert.equal(module, before.get(module.userData.checkpointKey))
    assert.deepEqual(module.position.toArray(), transforms.get(module.userData.checkpointKey))
  }
  expansion.userData.setCheckpoints([{ id: 'C' }, initial[1], fallback])
  assert.equal(expansion.children.length, 3)
  for (const module of expansion.children) if (before.has(module.userData.checkpointKey)) assert.deepEqual(module.position.toArray(), transforms.get(module.userData.checkpointKey))
  expansion.userData.dispose()
})

test('canonical acceptance, duplicate records and bounded overflow are explicit', () => {
  const expansion = createCheckpointExpansion()
  expansion.userData.setCheckpoints([
    { id: 'default' }, { id: 'yes', accepted: true }, { id: 'no', accepted: false },
    ...['pending', 'unaccepted', 'rejected', 'retracted'].map(status => ({ id: status, status })),
    { id: 'retracted', retractedAt: 123 }, { id: 'bool-retracted', retracted: true }, null, false, [], 4,
  ])
  assert.equal(expansion.userData.checkpointCount, 2)
  expansion.userData.setCheckpoints([{id:'same',accepted:true},{id:'same',accepted:true}])
  assert.equal(expansion.children.length,1)
  expansion.userData.setCheckpoints([{id:'same',accepted:true},{id:'same',status:'retracted'}])
  assert.equal(expansion.children.length,0)
  expansion.userData.setCheckpoints([{ title: 'same' }, { title: 'same' }])
  assert.equal(expansion.children.length, 2)
  const many = records(40)
  expansion.userData.setCheckpoints(many)
  assert.equal(expansion.children.length, 12)
  assert.equal(expansion.userData.checkpointCount, 40)
  assert.equal(expansion.userData.overflowCount, 28)
  const before = childMap(expansion), victim = expansion.children[0]
  const victimId = JSON.parse(victim.userData.checkpointKey)[0].slice('id:string:'.length)
  expansion.userData.setCheckpoints(many.filter(r => r.id !== victimId))
  assert.equal(expansion.children.length, 12)
  assert.equal(expansion.userData.overflowCount, 27)
  for (const module of expansion.children) if (before.has(module.userData.checkpointKey)) assert.equal(module, before.get(module.userData.checkpointKey))
  expansion.userData.dispose()
})

test('all hardware is finite, bounded and clear of core, solar and forward path', () => {
  const types = new Set()
  for (const seed of ['Sowers', 'Astra', 'Finch', 'Mesa', NaN, Infinity, null]) {
    const expansion = createCheckpointExpansion({ seed, color: NaN })
    expansion.userData.setCheckpoints(records(40))
    expansion.updateMatrixWorld(true)
    for (const module of expansion.children) {
      types.add(module.userData.hardware)
      const b = new THREE.Box3().setFromObject(module)
      assert.ok([...b.min.toArray(), ...b.max.toArray()].every(Number.isFinite))
      assert.ok(b.min.x >= -5.5 && b.max.x <= 5.5 && b.min.z >= -5.5 && b.max.z <= 5.5)
      assert.ok(b.min.y >= 0 && b.max.y < 5)
      assert.ok(b.max.x < -3.5 || b.min.x > 3.5 || b.max.z < -3.2 || b.min.z > 3.2)
      // All front modules also leave the full central avatar path open.
      assert.ok(b.max.x < -2.2 || b.min.x > 2.2 || b.max.z < 3.5 || b.min.z > 5)
      module.traverse(o => { if (o.isMesh) assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite)) })
    }
    expansion.userData.dispose()
  }
  assert.equal(types.size, 6)
})

test('malformed snapshots and nonfinite identity data stay safe; disposal is complete and idempotent', () => {
  const expansion = createCheckpointExpansion({ seed: {}, color: Infinity }), parent = new THREE.Group()
  parent.add(expansion)
  const cycle = { title: 'cyclic', id: NaN }; cycle.loop = cycle
  expansion.userData.setCheckpoints([cycle, { id: Infinity, amount: NaN }])
  assert.equal(expansion.children.length, 2)
  const removed = watchDisposal(expansion)
  expansion.userData.setCheckpoints(null)
  assert.equal(expansion.children.length, 0)
  assert.ok(removed().every(n => n === 1))
  expansion.userData.setCheckpoints(records(12))
  const final = watchDisposal(expansion)
  expansion.userData.dispose(); expansion.userData.dispose()
  assert.ok(final().every(n => n === 1))
  assert.equal(expansion.children.length, 0)
  assert.equal(expansion.parent, null)
  assert.equal(expansion.userData.disposed, true)
  expansion.userData.setCheckpoints(records(1))
  assert.equal(expansion.children.length, 0)
})
