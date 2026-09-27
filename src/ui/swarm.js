import './mission.css'
import {constructionFor} from '../game/swarm-construction.js'

export class SwarmPanel {
  constructor(root, select) {
    this.select=select
    this.el=document.createElement('details')
    this.el.className='mission-panel swarm-panel'
    this.el.open=true
    this.el.hidden=true
    this.summary=document.createElement('summary')
    this.freshness=document.createElement('p')
    this.freshness.className='mission-freshness'
    this.body=document.createElement('div')
    this.body.className='mission-body'
    this.el.append(this.summary,this.freshness,this.body)
    root.append(this.el)
  }
  update(shells) {
    this.shells=shells
    this.el.hidden=!shells.length
    this.lastScan=new Date().toLocaleTimeString()
    this.freshness.textContent=`Last successful scan: ${this.lastScan}`
    clearTimeout(this.timer)
    this.timer=setTimeout(()=>this.stale(),45000)
    this.render(false)
  }
  stale() {
    if(this.el.hidden) return
    this.freshness.textContent=`Live scan unavailable · last scan ${this.lastScan}`
    this.render(true)
  }
  render(stale) {
    const working=this.shells.filter(s=>s.running).length
    this.summary.textContent=stale ? 'Swarm · live status unknown' : `Swarm · ${this.shells.length} shells · ${working} working`
    const signature=JSON.stringify([stale,this.shells.map(s=>[s.id,s.shellName,s.shellColor,s.shellStatus,s.assignmentState,s.assignmentRole,s.scrollUrl,s.runId,s.protocolExecution,s.attemptCount,s.workerBackend,s.dependencies,s.reviewer,s.workflow,s.milestones,s.growthPolicy])])
    if(this.signature===signature) return
    this.signature=signature
    this.body.replaceChildren()
    const note=document.createElement('p')
    const runId=this.shells.find(s=>s.runId)?.runId
    note.textContent=runId
      ? this.shells[0]?.runClosed ? `Archived project: ${runId}. Construction is preserved until the next activation.` : `Active run: ${runId} · ${this.shells.find(s=>s.workflow)?.workflow || 'task graph'}. Workers start as slots and accepted inputs become available.`
      : 'Say “activate the swarm” with a task. Each shell receives an AGENT.md scroll. Workers run within the available capacity.'
    const list=document.createElement('ol')
    for(const shell of this.shells) {
      const li=document.createElement('li'),button=document.createElement('button'),dot=document.createElement('i'),status=document.createElement('span')
      dot.className='shell-swatch'; dot.style.background=shell.shellColor
      button.append(dot,document.createTextNode(shell.shellName))
      button.onclick=()=>this.select(shell.id)
      status.textContent=`${stale?'Unknown':shell.shellStatus} · ${shell.assignmentRole || 'No scroll loaded'} · ${shell.assignmentState}`
      status.dataset.live=stale?'Unknown':shell.shellStatus
      li.append(button,status)
      const construction=constructionFor(shell),progress=document.createElement('small')
      progress.className='swarm-progress'
      progress.textContent=`${construction.cells} hexagon${construction.cells===1?'':'s'} · ${construction.minor} minor · ${construction.major} major${construction.capacityExpansions?' · '+construction.capacityExpansions+' space earned':''}`
      li.append(progress)
      if(construction.latest) {const checkpoint=document.createElement('small');checkpoint.className='swarm-progress';checkpoint.textContent=construction.latest.title;li.append(checkpoint)}
      if(shell.runId) {
        const detail=document.createElement('small')
        detail.className='swarm-progress'
        detail.textContent=[shell.workerBackend, shell.protocolExecution && `Protocol: ${shell.protocolExecution}`, `Attempts: ${shell.attemptCount}`, shell.dependencies.length && `Inputs: ${shell.dependencies.join(', ')}`, shell.reviewer && `Reviewer: ${shell.reviewer}`].filter(Boolean).join(' · ')
        li.append(detail)
      }
      if(shell.scrollUrl) {
        const link=document.createElement('a')
        link.href=shell.scrollUrl;link.textContent='Read AGENT.md ↗';link.target='_blank';link.rel='noopener'
        li.append(link)
      }
      list.append(li)
    }
    this.body.append(note,list)
  }
}
