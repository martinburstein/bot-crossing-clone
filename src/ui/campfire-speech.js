import * as THREE from 'three'
import {campfireExchange} from './campfire-philosophy.js'
import {unitConversationFrame} from './unit-conversation.js'
import './campfire-speech.css'
import {OFFICE_BY_ID} from '../office/profiles.js'

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
    const free=this.layer.classList.contains('unit-conversation')||this.layer.classList.contains('office-oral-history')
    const scale = free?Math.max(.8,Math.min(1,40/Math.max(1,depth))):Math.min(1,24/Math.max(1,depth)), halfWidth = (free?130:90) * scale + 8
    const visible = ndcZ >= -1 && ndcZ <= 1 && x >= 0 && x <= w && y >= 0 && y <= h
    bubble.el.hidden = !visible
    if (visible) bubble.el.style.transform = `translate(${Math.max(halfWidth, Math.min(w - halfWidth, x))}px,${Math.max(84 * scale + 8, y - 6 * scale)}px) translate(-50%,-100%) scale(${scale})`
    return visible
  }
  update(agents, worksite, projection, camera, viewport, elapsed) {
    // A modest refresh rate keeps these little DOM plates inexpensive.
    if (elapsed < this.next) return
    this.next = elapsed + .1
    if(projection?.sceneLayout==='financial-office'){
      const entries=projection.office?.history?.entries??[]
      const entry=entries[Math.floor(elapsed/11)%Math.max(1,entries.length)]
      if(!entry||!worksite?.camp?.group){this.layer.hidden=true;return}
      this.layer.classList.remove('unit-conversation');this.layer.classList.add('office-oral-history')
      this.layer.setAttribute('aria-label','Saved financial-office oral history playback')
      this.role.el.hidden=true
      this.camper.name.textContent=`${OFFICE_BY_ID[entry.speaker]?.short??'OFFICE'} · ${entry.kind==='accepted-contribution'?'ACCEPTED HISTORY':'SOURCE NOTES'} · REPLAY`
      this.camper.text.textContent=entry.text;this.camper.el.title=entry.sources.join(' · ')
      this.note.textContent='Saved oral history · ambient replay · no model calls'
      worksite.camp.group.getWorldPosition(this.point)
      this.layer.hidden=!this.place(this.camper,this.point.clone(),5,camera,viewport)
      return
    }
    if(projection?.campus?.dispatchMode==='free-15-3A'){
      const line=!projection.stale&&unitConversationFrame(projection.campus,projection.executorSlots??[],elapsed)
      this.layer.classList.add('unit-conversation');this.layer.setAttribute('aria-label','Accepted Luna conversation playback')
      this.role.el.hidden=true
      if(!line){this.layer.hidden=true;return}
      const core=worksite?.cores?.[line.slotId]
      if(!core){this.layer.hidden=true;return}
      const name=line.slotId[0].toUpperCase()+line.slotId.slice(1)
      this.camper.name.textContent=`${name} · ${line.kind}`;this.camper.text.textContent=line.text
      this.note.textContent=`${name} · accepted Luna conversation · replay`
      this.note.title=`Contribution task: ${line.taskId}. Evidence tasks: ${line.sourceTaskIds.join(', ')||'none'}. Accepted ${new Date(line.acceptedAt).toLocaleString()}. Playback makes no model calls.`
      core.getWorldPosition(this.point)
      this.layer.hidden=!this.place(this.camper,this.point.clone(),7,camera,viewport)
      return
    }
    this.layer.classList.remove('unit-conversation');this.layer.setAttribute('aria-label','Imagined campfire conversation');this.note.textContent='Campfire · imagined conversation'
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
