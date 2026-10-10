import * as THREE from 'three'
import {campfireExchange} from './campfire-philosophy.js'
import './campfire-speech.css'

/** Imagined camp talk, anchored to the existing bodies; no execution side effects. */
export class CampfireSpeech {
  constructor(root) {
    this.layer = document.createElement('div'); this.layer.className = 'campfire-speech'
    this.layer.setAttribute('aria-label', 'Imagined campfire conversation')
    this.note = document.createElement('small'); this.note.className = 'campfire-speech-note'
    this.note.textContent = 'Campfire · imagined conversation'
    this.role = this.bubble(); this.camper = this.bubble('balthasar')
    this.layer.append(this.note, this.role.el, this.camper.el); root.append(this.layer)
    this.point = new THREE.Vector3(); this.next = 0
  }
  bubble(kind = 'role') {
    const el = document.createElement('div'); el.className = 'campfire-bubble ' + kind
    const name = document.createElement('strong'), text = document.createElement('span')
    el.append(name, text); return {el, name, text}
  }
  place(bubble, position, height, camera, viewport) {
    this.point.set(position.x, position.y + height, position.z).project(camera)
    const {w, h} = viewport, x = (this.point.x * .5 + .5) * w, y = (-this.point.y * .5 + .5) * h, ndcZ = this.point.z
    // Cap the close-up size; perspective makes distant voices occupy less screen.
    const depth = -this.point.set(position.x, position.y + height, position.z).applyMatrix4(camera.matrixWorldInverse).z
    const scale = Math.min(1, 24 / Math.max(1, depth)), halfWidth = 90 * scale + 8
    const visible = ndcZ >= -1 && ndcZ <= 1 && x >= 0 && x <= w && y >= 0 && y <= h
    bubble.el.hidden = !visible
    if (visible) bubble.el.style.transform = `translate(${Math.max(halfWidth, Math.min(w - halfWidth, x))}px,${Math.max(84 * scale + 8, y - 6 * scale)}px) translate(-50%,-100%) scale(${scale})`
    return visible
  }
  update(agents, worksite, projection, camera, viewport, elapsed) {
    // A modest refresh rate keeps these little DOM plates inexpensive.
    if (elapsed < this.next) return
    this.next = elapsed + .1
    const talk = projection?.profile === 'roarm-campus' && !projection.stale
      ? campfireExchange(projection.campus, elapsed, projection.roleCatalog) : null
    const speaker = talk && agents.find(a => a.thread?.roleId === talk.id && a.state !== 'gone')
    if (!talk || !speaker || !worksite?.camper) { this.layer.hidden = true; return }
    this.role.name.textContent = `Imagined ${talk.id.toUpperCase()} voice${talk.remote ? ' · from charging pod' : ''}`
    this.role.text.textContent = talk.thought
    this.camper.name.textContent = `${talk.hostName} · imagined host`; this.camper.text.textContent = talk.reply
    this.camper.el.classList.toggle('balthasar',talk.hostSlotId==='balthasar')
    this.role.el.classList.toggle('speaking', !talk.replying)
    this.camper.el.classList.toggle('speaking', talk.replying)
    const roleVisible = this.place(this.role, speaker.pos, 2, camera, viewport)
    this.role.el.hidden ||= talk.replying
    const hostBody=talk.hostSlotId==='balthasar'?worksite.camper:worksite.cores?.[talk.hostSlotId]
    if(!hostBody){this.layer.hidden=true;return}
    hostBody.getWorldPosition(this.point)
    const camperPosition = this.point.clone()
    const camperVisible = this.place(this.camper, camperPosition, 7, camera, viewport)
    this.camper.el.hidden ||= !talk.replying
    this.layer.hidden = talk.replying ? !camperVisible : !roleVisible
  }
}
