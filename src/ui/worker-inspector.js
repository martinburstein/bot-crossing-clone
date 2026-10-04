import {workerInspection} from './worker-data.mjs'
import './worker-inspector.css'

export class WorkerInspector {
  constructor(root,card,onResize=()=>{}) {
    this.card=card;this.onResize=onResize;this.expanded=false
    this.section=document.createElement('section');this.section.className='worker-inspection';this.section.hidden=true
    this.section.setAttribute('aria-label','Worker telemetry')
    this.list=document.createElement('dl');this.detail=document.createElement('dl');this.detail.className='worker-debug'
    this.toggle=document.createElement('button');this.toggle.type='button';this.toggle.className='worker-debug-toggle';this.toggle.onclick=()=>this.toggleDebug()
    this.section.append(this.list,this.toggle,this.detail);card.append(this.section)
    this.bubble=document.createElement('div');this.bubble.className='worker-speech';this.bubble.hidden=true;this.bubble.setAttribute('role','status');root.append(this.bubble)
    this.resize=new ResizeObserver(()=>onResize());this.resize.observe(card)
    this.toggleDebug(false)
  }
  select(agent,thread) {
    const eligible=thread?.worldProfile==='15-3A'
    if(this.id!==agent?.id){this.sample=null;this.next=0;this.signature=null}
    this.id=agent?.id;this.agent=eligible?agent:null
    this.section.hidden=!eligible;this.card.classList.toggle('magi-inspection',!!eligible)
    if(!eligible)this.bubble.hidden=true
  }
  toggleDebug(force) {
    this.expanded=force??!this.expanded;this.detail.hidden=!this.expanded
    this.toggle.textContent=`F3 · ${this.expanded?'Less':'More'} telemetry`;this.toggle.setAttribute('aria-expanded',String(this.expanded));this.onResize()
  }
  update(agent,fleet,context,screen,elapsed) {
    if(!this.agent||this.agent.id!==agent?.id){this.bubble.hidden=true;return}
    const onScreen=screen&&screen.x>=0&&screen.y>=0&&screen.x<=innerWidth&&screen.y<=innerHeight
    this.bubble.hidden=!(onScreen&&agent.mounted&&fleet)
    if(!this.bubble.hidden){
      const x=Math.round(Math.max(100,Math.min(innerWidth-100,screen.x))),y=Math.round(Math.max(36,screen.y-28))
      this.bubble.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-100%)`
    }
    if(elapsed<this.next)return
    this.next=elapsed+.25
    let speed=null
    if(fleet&&this.sample?.fleet===fleet&&elapsed>this.sample.time)speed=Math.max(0,(fleet.rolling-this.sample.rolling)/(elapsed-this.sample.time))
    this.sample=fleet?{fleet,rolling:fleet.rolling,time:elapsed}:null
    const data=workerInspection(agent,fleet,{...context,speed})
    if(this.bubble.textContent!==data.speech)this.bubble.textContent=data.speech
    const signature=JSON.stringify([data.rows,data.detail])
    if(signature===this.signature)return
    this.signature=signature;this.renderRows(this.list,data.rows);this.renderRows(this.detail,data.detail)
  }
  renderRows(list,rows) {
    const nodes=rows.flatMap(([key,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;return [dt,dd]})
    list.replaceChildren(...nodes)
  }
}
