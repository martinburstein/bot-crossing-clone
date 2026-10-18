// A presentation-only camera director. No colony, worker, or simulation mutations.
const lerp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt))
const angleNear = (angle, reference) => angle + Math.round((reference - angle) / (2 * Math.PI)) * 2 * Math.PI

export class IdleDirector {
  constructor(rig, { subjects = () => [], office = false, delay = 30, random = Math.random,
    enabled = true, blocked = () => false } = {}) {
    this.rig = rig
    this.subjects = subjects
    this.office = office
    this.delay = delay
    this.random = random
    this.enabled = enabled
    this.blocked = blocked
    this.idle = 0
    this.active = false
    this.shot = null
    this.shotCount = 0
    this.intent = rig.intentVersion ?? 0
  }

  interrupt() {
    if (this.active) {
      // Freeze at the visible frame so a click, drag, or wheel never inherits a glide.
      const r = this.rig
      r.desiredTarget.copy(r.target)
      r.desiredAzimuth = r.azimuth
      r.desiredPolar = r.polar
      r.desiredDistance = r.distance
    }
    this.idle = 0
    this.active = false
    this.shot = null
    this.rig.cinematic = false
  }

  setEnabled(on) {
    this.interrupt()
    this.enabled = Boolean(on)
    return this.enabled
  }

  start() {
    if (!this.enabled || this.rig.settings.get('reducedMotion') || this.blocked()) return false
    this.idle = this.delay
    return true
  }

  chooseShot() {
    const agents = this.subjects().filter(a => a?.pos && [a.pos.x, a.pos.y, a.pos.z].every(Number.isFinite))
    // Alternate scenic establishing shots and residents; never repeat a resident in a row.
    const follow = agents.length && this.shotCount % 2 === 1
    const previous = this.lastSubject
    const pool = agents.filter(a => (a.id ?? a.thread?.id) !== previous)
    const agent = follow ? (pool.length ? pool : agents)[Math.floor(this.random() * (pool.length || agents.length))] : null
    const anchors = this.office
      ? [{ x: 0, y: 3, z: 2, distance: 105 }, { x: 49, y: 2, z: 2, distance: 49 },
        { x: 0, y: 5, z: -49, distance: 100 }, { x: -24, y: 3, z: -22, distance: 50 }]
      : [{ x: this.rig.target.x, y: 3, z: this.rig.target.z, distance: Math.max(55, Math.min(210, this.rig.distance)) }]
    const anchor = anchors[Math.floor(this.shotCount / 2) % anchors.length]
    const yaw = this.rig.azimuth + (this.random() - .5) * 1.2
    const kind = agent ? (this.shotCount % 4 === 1 ? 'follow' : 'portrait') : 'scenic'
    this.shot = { kind, agent, anchor, age: 0, duration: 22 + this.random() * 12,
      yaw, polar: agent ? .98 + this.random() * .2 : .65 + this.random() * .38,
      distance: agent ? (kind === 'portrait' ? 24 : 38) : anchor.distance,
      direction: this.random() < .5 ? -1 : 1 }
    this.lastSubject = agent ? (agent.id ?? agent.thread?.id) : previous
    this.shotCount++
  }

  update(dt) {
    dt = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0))
    const r = this.rig
    if ((r.intentVersion ?? 0) !== this.intent) {
      this.intent = r.intentVersion ?? 0
      // Programmatic focus/reset already supplied its new destination. Do not erase it.
      this.active = false; this.shot = null; this.idle = 0; r.cinematic = false
    }
    if (!this.enabled || !r.enabled || r.interacting || r.orbiting || r.settings.get('reducedMotion') || this.blocked()) {
      this.interrupt()
      return
    }
    this.idle += dt
    if (this.idle < this.delay) return
    if (!this.active) { this.active = true; r._zoom = null; this.chooseShot() }
    r.cinematic = true
    if (this.shot.agent && !this.subjects().includes(this.shot.agent)) this.chooseShot()
    const s = this.shot
    s.age += dt
    if (s.age >= s.duration) { this.chooseShot(); return }
    const p = s.agent?.pos ?? s.anchor
    const elevation = s.agent ? 1.7 : 0
    r.desiredTarget.x = lerp(r.desiredTarget.x, p.x, .38, dt)
    r.desiredTarget.y = lerp(r.desiredTarget.y, p.y + elevation, .38, dt)
    r.desiredTarget.z = lerp(r.desiredTarget.z, p.z, .38, dt)
    r._clampTarget()
    r.desiredAzimuth = lerp(r.desiredAzimuth, angleNear(s.yaw + s.age * .014 * s.direction, r.desiredAzimuth), .24, dt)
    r.desiredPolar = lerp(r.desiredPolar, s.polar + Math.sin(s.age * .09) * .025, .22, dt)
    r.desiredDistance = lerp(r.desiredDistance, Math.min(r.maxDistance, s.distance), .2, dt)
  }

  snapshot() {
    return { enabled: this.enabled, active: this.active, idleSeconds: this.idle,
      delaySeconds: this.delay, shot: this.shot?.kind ?? null,
      subject: this.shot?.agent?.thread?.officeProfileId ?? this.shot?.agent?.id ?? null, shots: this.shotCount }
  }
}

export function mountIdleDirector(director, { window: win = window, document: doc = document } = {}) {
  const activity = () => director.interrupt()
  const move = e => { if (e.movementX || e.movementY || e.pointerType === 'touch') activity() }
  const key = e => {
    activity()
    if (e.code === 'KeyI' && !e.ctrlKey && !e.metaKey && !e.altKey &&
      !e.target?.closest?.('input,textarea,select,[contenteditable="true"]')) {
      const on = director.setEnabled(!director.enabled)
      try { win.localStorage.setItem('botcrossing.idle-camera.enabled', String(on)) } catch {}
    }
  }
  const events = [['pointerdown', activity], ['pointermove', move], ['wheel', activity], ['keydown', key]]
  for (const [name, fn] of events) win.addEventListener(name, fn, { capture: true, passive: true })
  doc.addEventListener('visibilitychange', activity)
  return () => {
    for (const [name, fn] of events) win.removeEventListener(name, fn, true)
    doc.removeEventListener('visibilitychange', activity)
    director.interrupt()
  }
}
