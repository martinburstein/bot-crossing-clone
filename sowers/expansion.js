import * as THREE from 'three'
import { acceptedCheckpoints } from './evidence.mjs'

const LIMIT = 12
const PADS = [[-4.6, -4], [4.6, -4], [-4.6, 4], [4.6, 4]]
const TYPES = ['battery', 'solar', 'relay', 'greenhouse', 'cooling', 'tank']
const EVIDENCE_FIELDS = new Set(['accepted', 'status', 'retractedAt', 'retracted', 'updatedAt'])

function hash(value) {
  let n = 2166136261
  for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619)
  return n >>> 0
}

// Fallback identities ignore acceptance changes and object-property order. Sources
// should supply ids when distinct records may otherwise have identical contents.
function recordKey(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (typeof value !== 'object' || seen.has(value)) return 'null'
  seen.add(value)
  const key = Array.isArray(value)
    ? `[${value.map(v => recordKey(v, seen)).join(',')}]`
    : `{${Object.keys(value).filter(k => !EVIDENCE_FIELDS.has(k)).sort().map(k => `${JSON.stringify(k)}:${recordKey(value[k], seen)}`).join(',')}}`
  seen.delete(value)
  return key
}

function identity(record) {
  const id = record.id
  return typeof id === 'string' && id.length || typeof id === 'number' && Number.isFinite(id)
    ? `id:${typeof id}:${id}` : `record:${recordKey(record)}`
}

function disposeGroup(group) {
  const geometries = new Set(), materials = new Set()
  group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry)
    for (const material of [].concat(object.material || [])) materials.add(material)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  group.removeFromParent()
}

function hardware(type, color, variant) {
  const group = new THREE.Group()
  group.name = `Checkpoint ${type}`
  group.userData.hardware = type
  const palette = {
    white: new THREE.MeshStandardMaterial({ color: 0xe8e7df, roughness: .6, metalness: .2 }),
    orange: new THREE.MeshStandardMaterial({ color, roughness: .5, metalness: .25 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x26333a, roughness: .6, metalness: .5 }),
    solar: new THREE.MeshStandardMaterial({ color: 0x183d64, roughness: .3, metalness: .65 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x86cab9, roughness: .25, transparent: true, opacity: .48, depthWrite: false }),
    green: new THREE.MeshStandardMaterial({ color: 0x609455, roughness: .8 }),
  }
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, palette[material])
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true
    group.add(mesh); return mesh
  }
  const box = (w, h, d, mat, x, y, z) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z)
  const cylinder = (radius, height, mat, x, y, z) => add(new THREE.CylinderGeometry(radius, radius, height, 12), mat, x, y, z)
  box(1.5, .12, 1.5, 'dark', 0, .06, 0)
  for (const x of [-.63, .63]) box(.09, .07, 1.38, 'orange', x, .155, 0)
  if (type === 'battery') {
    for (const x of [-.33, .33]) {
      box(.5, .85, 1.04, 'white', x, .58, 0)
      box(.52, .12, 1.06, 'orange', x, 1.04, 0)
      for (let i = 0; i < 3; i++) box(.29, .07, .025, 'solar', x, .4 + i * .17, .53)
      cylinder(.08, .14, 'dark', x, 1.17, -.22)
    }
  } else if (type === 'solar') {
    cylinder(.09, .5, 'white', 0, .4, 0)
    box(1.32, .1, 1.24, 'orange', 0, .72, 0)
    for (const x of [-.32, .32]) for (let z = 0; z < 3; z++) box(.56, .035, .33, 'solar', x, .79, (z - 1) * .39)
    box(.4, .19, .35, 'white', 0, .24, .4)
  } else if (type === 'relay') {
    box(.75, .37, .75, 'white', 0, .33, 0)
    cylinder(.07, .78, 'orange', 0, .86, 0)
    const dish = add(new THREE.SphereGeometry(.48, 16, 8, 0, Math.PI * 2, 0, .95), 'white', 0, 1.01, 0)
    dish.rotation.x = Math.PI / 2
    cylinder(.035, .23, 'dark', .37, 1.28, .2)
    box(.25, .08, .03, 'solar', 0, .35, .39)
  } else if (type === 'greenhouse') {
    cylinder(.63, .18, 'white', 0, .23, 0)
    add(new THREE.SphereGeometry(.61, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'glass', 0, .34, 0)
    for (const angle of [0, Math.PI / 2]) {
      const rib = add(new THREE.TorusGeometry(.62, .026, 5, 20, Math.PI), 'orange', 0, .34, 0)
      rib.rotation.y = angle
    }
    for (const x of [-.23, .23]) for (const z of [-.2, .2]) {
      cylinder(.06, .25, 'green', x, .46, z)
      const leaf = add(new THREE.SphereGeometry(.13, 6, 4), 'green', x, .59, z)
      leaf.scale.set(1, .55, 1)
    }
  } else if (type === 'cooling') {
    box(.9, .6, 1.08, 'white', 0, .48, 0)
    for (let i = 0; i < 5; i++) box(1.2, .065, 1.12, 'dark', 0, .3 + i * .16, 0)
    cylinder(.19, .14, 'orange', 0, 1.04, 0)
    for (const x of [-.4, .4]) cylinder(.07, .24, 'orange', x, .92, .38)
  } else {
    cylinder(.5, .16, 'dark', 0, .24, 0)
    cylinder(.46, .83, 'white', 0, .72, 0)
    cylinder(.48, .12, 'orange', 0, 1.16, 0)
    cylinder(.16, .16, 'dark', 0, 1.3, 0)
    box(.12, .4, .06, 'solar', 0, .74, .47)
    box(.3, .12, .16, 'orange', .51, .4, 0)
  }
  // Seeded marking varies appearance without changing the reserved footprint.
  box(.16 + variant * .035, .045, .18, 'orange', .4, .14, -.5)
  // Dispose only materials actually used by this module.
  const used = new Set(); group.traverse(o => { if (o.material) used.add(o.material) })
  for (const material of Object.values(palette)) if (!used.has(material)) material.dispose()
  return group
}

/** Earned checkpoint hardware, independent of task completion or its denominator. */
export function createCheckpointExpansion({ seed = 'Sowers', color = 0xf5823a } = {}) {
  const root = new THREE.Group()
  const seedKey = typeof seed === 'string' || typeof seed === 'number' && Number.isFinite(seed) ? String(seed) : 'Sowers'
  const tint = typeof color === 'number' && Number.isFinite(color) ? Math.max(0, Math.min(0xffffff, color)) : 0xf5823a
  const modules = new Map()
  let disposed = false
  root.name = `Checkpoint expansion · ${seedKey}`
  root.userData.limit = LIMIT
  root.userData.footprint = { minX: -5.35, maxX: 5.35, minZ: -4.75, maxZ: 4.75 }
  root.userData.setCheckpoints = milestones => {
    if (disposed) return root
    const occurrences = new Map(), wanted = new Set()
    for (const record of acceptedCheckpoints({milestones})) {
      const key = identity(record), ordinal = occurrences.get(key) || 0
      occurrences.set(key, ordinal + 1)
      wanted.add(JSON.stringify([key, ordinal]))
    }
    for (const [key, module] of modules) if (!wanted.has(key)) {
      disposeGroup(module); modules.delete(key)
    }
    const occupied = new Set([...modules.values()].map(module => module.userData.slot))
    for (const key of [...wanted].sort()) {
      if (modules.has(key) || modules.size >= LIMIT) continue
      let slot = 0; while (occupied.has(slot)) slot++
      occupied.add(slot)
      const h = hash(`${seedKey}:${key}`)
      const module = hardware(TYPES[h % TYPES.length], tint, h % 4)
      const [x, z] = PADS[slot % PADS.length]
      module.position.set(x, Math.floor(slot / PADS.length) * 1.65, z)
      module.userData.checkpointKey = key; module.userData.slot = slot
      modules.set(key, module); root.add(module)
    }
    root.userData.checkpointCount = wanted.size
    root.userData.displayedCount = modules.size
    root.userData.overflowCount = Math.max(0, wanted.size - modules.size)
    return root
  }
  root.userData.dispose = () => {
    if (disposed) return
    for (const module of modules.values()) disposeGroup(module)
    modules.clear(); disposed = true
    root.userData.disposed = true
    root.userData.displayedCount = 0
    root.removeFromParent()
  }
  root.userData.setCheckpoints([])
  return root
}
