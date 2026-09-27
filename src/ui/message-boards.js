import './message-boards.css'
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
export class MessageBoardPanel{
  constructor(root,focus){
    this.focus=focus;this.board='global';this.data=null;this.shells=[]
    this.launch=el('button','Message boards','board-launch');this.launch.hidden=true;this.launch.onclick=()=>this.open('global')
    this.panel=el('section',undefined,'board-panel');this.panel.hidden=true
    this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','Message boards')
    const header=el('header');this.heading=el('h2','Message boards')
    const close=el('button','Close');close.setAttribute('aria-label','Close message board');close.onclick=()=>{this.panel.hidden=true;this.launch.focus()}
    header.append(this.heading,close)
    this.tabs=el('nav');this.tabs.setAttribute('aria-label','Choose a message board')
    this.status=el('p','','board-status');this.list=el('ol',undefined,'board-messages')
    this.list.setAttribute('aria-label','Messages, oldest first')
    this.panel.append(header,this.tabs,this.status,this.list);root.append(this.launch,this.panel)
    this.panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close.click()}})
  }
  open(id){this.board=id;this.panel.hidden=false;this.render();this.focus(id)}
  update(data,shells){
    const changed=this.data?.projectId!==data?.projectId
    this.data=data;this.shells=shells;this.launch.hidden=!shells.length
    if(changed)this.board='global'
    if(!shells.length)this.panel.hidden=true
    if(!this.panel.hidden)this.render()
  }
  stale(){if(!this.panel.hidden)this.status.textContent='Connection interrupted. Showing the last saved messages.'}
  render(){
    const shell=this.shells.find(s=>s.shellId===this.board)
    this.heading.textContent=shell?`${shell.shellName}’s message board`:'Shared room · spaceship'
    const choices=[{id:'global',name:'Shared room',color:'#b8bebc'},...this.shells.map(s=>({id:s.shellId,name:s.shellName,color:s.shellColor}))]
    const tabsSignature=JSON.stringify([this.board,choices])
    if(this.tabsSignature!==tabsSignature){
      this.tabsSignature=tabsSignature;this.tabs.replaceChildren()
      for(const c of choices){
        const b=el('button',c.name);b.style.setProperty('--board-color',c.color)
        b.setAttribute('aria-pressed',String(c.id===this.board));b.onclick=()=>this.open(c.id);this.tabs.append(b)
      }
    }
    const messages=(this.data?.messages||[]).filter(m=>m.board===this.board).sort((a,b)=>a.sequence-b.sequence)
    this.status.textContent=`${messages.length} saved ${messages.length===1?'message':'messages'} · oldest first · everyone can read`
    const signature=JSON.stringify([this.data?.projectId,this.board,messages])
    if(signature===this.signature)return
    this.signature=signature;const atEnd=this.list.scrollHeight-this.list.scrollTop-this.list.clientHeight<40
    this.list.replaceChildren()
    if(!messages.length){this.list.append(el('li','No notes yet. This board is ready for the next handoff.','board-empty'));return}
    for(const m of messages){
      const li=el('li'),meta=el('div',undefined,'board-meta'),author=el('strong',m.authorName)
      author.style.color=/^#[a-f0-9]{6}$/i.test(m.color)?m.color:'#b8bebc'
      const time=el('time',new Date(m.createdAt).toLocaleString());time.dateTime=new Date(m.createdAt).toISOString()
      meta.append(author,time)
      if(m.to){const target=this.shells.find(s=>s.shellId===m.to);meta.append(el('span','To '+(target?.shellName||m.to)))}
      li.append(meta,el('p',m.text));this.list.append(li)
    }
    if(atEnd)this.list.scrollTop=this.list.scrollHeight
  }
}
