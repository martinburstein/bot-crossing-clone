import { missionRows } from './mission-data.mjs'
import './mission.css'

export class MissionPanel {
  constructor(root, select) {
    this.select = select
    this.plan = null
    this.threads = []
    this.scanFresh = false
    this.requestVersion = 0
    this.el = document.createElement('details')
    this.el.className = 'mission-panel'
    this.el.hidden = true
    this.el.open = true
    const summary = document.createElement('summary')
    summary.textContent = 'Dyson build · ten specialist roles'
    this.summary = summary
    this.body = document.createElement('div')
    this.body.className = 'mission-body'
    this.freshness = document.createElement('p')
    this.freshness.className = 'mission-freshness'
    this.el.append(summary, this.freshness, this.body)
    root.append(this.el)
  }
  async update(threads) {
    const version = ++this.requestVersion
    this.threads = threads
    this.scanFresh = true
    this.lastScan = new Date().toLocaleTimeString()
    this.freshness.textContent = `Last successful scan: ${this.lastScan}`
    clearTimeout(this.scanTimer)
    this.scanTimer = setTimeout(() => this.stale(), 45000)
    if (this.plan) this.render()
    try {
      const response = await fetch('/artifacts/dyson/phase2/workflow.json', {cache:'no-store', signal:AbortSignal.timeout(5000)})
      if (!response.ok) throw new Error('No mission plan')
      const plan = await response.json()
      if (version !== this.requestVersion) return
      if (!Array.isArray(plan.roles) || !plan.parentThreadId) throw new Error('Invalid mission plan')
      this.plan = plan
      this.render()
    } catch {
      if (version === this.requestVersion && this.plan) this.freshness.textContent += ' · using last available plan'
    }
  }
  stale() {
    this.scanFresh = false
    this.freshness.textContent = `Live scan unavailable · last successful scan: ${this.lastScan || 'none'}`
    if (this.plan) this.render()
  }
  render() {
    const rows = missionRows(this.plan, this.threads, this.scanFresh)
    this.el.hidden = false
    const working = rows.filter(r=>r.live==='Working').length
    this.summary.textContent = this.scanFresh ? `Dyson build · ${working} working / ${this.plan.targetWorkers} roles` : 'Dyson build · live scan unavailable'
    const signature = JSON.stringify([this.plan.hardwareStatus, this.plan.observedConcurrentWorkerLimit, rows])
    if (signature === this.signature) return
    this.signature = signature
    this.body.replaceChildren()
    const note = document.createElement('p')
    note.textContent = `Observed limit: ${this.plan.observedConcurrentWorkerLimit} simultaneous workers. Queued roles are not running agents.`
    this.body.append(note)
    const list = document.createElement('ol')
    for (const row of rows) {
      const li = document.createElement('li')
      const title = document.createElement('button')
      title.textContent = `${row.id} · ${row.name}`
      title.disabled = !row.taskId
      title.onclick = ()=>this.select(row.taskId)
      const status = document.createElement('span')
      status.textContent = `${row.live} · ${row.state}`
      status.dataset.live = row.live
      li.append(title,status)
      if (['submitted','accepted','revision'].includes(row.state) && /^[\w/.-]+$/.test(row.deliverable) && !row.deliverable.includes('..')) {
        const link = document.createElement('a')
        link.textContent = 'Review output ↗'
        link.href = '/artifacts/dyson/phase2/'+row.deliverable
        link.target = '_blank'
        link.rel = 'noopener'
        li.append(link)
      }
      list.append(li)
    }
    const hardware = document.createElement('p')
    hardware.textContent = this.plan.hardwareStatus
    this.body.append(list,hardware)
  }
}
