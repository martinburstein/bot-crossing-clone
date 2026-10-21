/** Idle cinematic director: hold each subject, then smoothly trail another. */
export class ActionCamera {
  constructor(rig, { idleDelay = 10, shotDuration = 22 } = {}) {
    this.rig = rig
    this.idleDelay = idleDelay
    this.shotDuration = shotDuration
    this.enabled = false
    this.subjectId = null
    this.idle = 0
    this.shotAge = 0
    this.shotIndex = 0
    this.subjects = []
  }

  setEnabled(on) {
    this.enabled = Boolean(on)
    this.rig.stopFollowing()
    this.subjectId = null
    this.idle = this.idleDelay // Explicitly enabling starts a shot immediately.
  }

  interrupt() {
    this.rig.stopFollowing()
    this.idle = 0
    this.shotAge = 0
  }

  update(dt, subjects) {
    this.subjects = subjects.filter(a => a.pos && Number.isFinite(a.yaw))
    if (!this.enabled) return
    if (this.rig.interacting) { this.interrupt(); return }
    this.idle += dt
    if (this.idle < this.idleDelay || !this.subjects.length) return
    this.shotAge += dt
    const present = this.subjects.some(a => a.id === this.subjectId)
    if (this.rig.following && present && this.shotAge < this.shotDuration) return
    const candidates = this.subjects.filter(a => a.id !== this.subjectId)
    const pool = candidates.length ? candidates : this.subjects
    // Prefer walking characters, then real work; rotate ties to vary quiet scenes.
    const score = a => (a.groundSpeed > .12 ? 2 : 0) + (a.thread?.running ? 1 : 0)
    const best = Math.max(...pool.map(score))
    const choices = pool.filter(a => score(a) === best)
    const subject = choices[this.shotIndex % choices.length]
    this.subjectId = subject.id
    const shots = [
      { distance: 14, side: 0, polar: 1.05 },
      { distance: 18, side: .45, polar: .95 },
      { distance: 15, side: -.35, polar: 1.1 },
    ]
    this.rig.followSubject(() => this.subjects.find(a => a.id === this.subjectId), shots[this.shotIndex % shots.length])
    this.shotIndex++
    this.shotAge = 0
  }
}
