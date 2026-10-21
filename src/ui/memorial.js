import {PAINT_COLORS,MEMORIAL,assessMemorialLegibility,drawMemorial} from '../office/memorial.js';
import './memorial.css';
import {OFFICE_PROFILES} from '../office/profiles.js';

export function mountMemorial(root,{world,focusWall,focusPaint,focusSymbol,watchPainting,onStage}) {
  const el=document.createElement('section');el.className='memorial-panel';el.hidden=true;el.setAttribute('aria-label','Agent memorial');
  el.innerHTML=`<header><div><small>CAMPUS MEMORIAL</small><h2>Frontera de las Almas</h2></div><button data-action="close" aria-label="Close memorial">×</button></header>
    <p class="memorial-status" role="status">Loading the memorial…</p>
    <div class="memorial-actions"><button data-action="wall">Campus border</button><button data-action="paint">Paint box</button><button data-action="test">Try a symbol</button></div>
    <p class="memorial-ceremony-status" role="status"></p><div class="memorial-actions"><button data-action="watch" hidden>Watch painting</button><button data-action="stop" hidden>Stop painting</button><button data-action="inspect" hidden>Inspect symbol</button><button data-action="remove" hidden>Remove test</button></div>
    <div class="memorial-pages"><button data-action="prev" aria-label="Previous memorial page">←</button><span></span><button data-action="next" aria-label="Next memorial page">→</button></div>
    <div class="memorial-list"></div><article class="memorial-card" hidden></article>
    <form class="memorial-editor" hidden><p class="memorial-test-note">TEST CANVAS · temporary, never saved to the memorial.</p>
      <p>Each symbol lives within 1 × 1 office unit. Placement is free; there is no visible grid.</p>
      <label>Painting resident<select name="actor"><option value="">Nearest available bot</option>${OFFICE_PROFILES.map(p=>`<option value="office:${p.id}">${p.name}</option>`).join('')}</select></label>
      <label>Symbol name<input name="symbol" value="A new beginning" maxlength="160"></label>
      <p class="memorial-test-note">IMAGE ONLY · draw an entirely new symbol. Words and typed glyphs are not painted.</p>
      <div class="memorial-palette" role="group" aria-label="Classic Paint colors"></div>
      <canvas width="320" height="320" aria-label="Draw your symbol" tabindex="0"></canvas>
      <div class="memorial-actions"><button type="button" data-action="undo">Undo stroke</button><button type="button" data-action="clear">Clear drawing</button></div>
      <label>Task<input name="task" value="Try the memorial wall" maxlength="2000"></label>
      <label>Explanation<textarea name="explanation" maxlength="4000">A temporary mark to test the wall and its story card.</textarea></label>
      <div class="memorial-actions"><button type="submit">Preview image</button><button type="button" data-action="approve" hidden>Approve preview &amp; animate</button></div>
    </form>`;
  root.append(el);
  let archive={entries:[],nextIteration:1},page=0,color=PAINT_COLORS[20],strokes=[],current=null,preview=null,pendingPreview=null,lastWorld=null,digest='',error=null,lastStage='',selectedEntry=null;
  const status=el.querySelector('.memorial-status'),card=el.querySelector('.memorial-card'),editor=el.querySelector('form'),canvas=editor.querySelector('canvas'),ctx=canvas.getContext('2d');
  const value=name=>editor.elements.namedItem(name).value;
  const draft=()=>({color,glyph:'',strokes});
  function redraw(){drawMemorial(ctx,draft(),320);}
  for(const hex of PAINT_COLORS){const b=document.createElement('button');b.type='button';b.title=hex;b.setAttribute('aria-label',`Paint ${hex}`);b.style.background=hex;b.setAttribute('aria-pressed',String(hex===color));b.onclick=()=>{color=hex;for(const other of b.parentElement.children)other.setAttribute('aria-pressed',String(other===b));redraw();};el.querySelector('.memorial-palette').append(b);}
  const point=e=>{const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];};
  canvas.onpointerdown=e=>{if(e.button!==0||strokes.length>=256)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);current={color,width:.025,points:[point(e)]};strokes.push(current);redraw();};
  canvas.onpointermove=e=>{if(!current||current.points.length>=1000)return;current.points.push(point(e));redraw();};
  canvas.onpointerup=canvas.onpointercancel=()=>{current=null;};
  function show(entry){
    selectedEntry=entry;el.querySelector('[data-action="inspect"]').hidden=false;
    card.replaceChildren();card.hidden=false;
    const name=document.createElement('h3');name.textContent=entry.preview?'Test symbol':`Iteration ${entry.iteration}`;card.append(name);
    const dl=document.createElement('dl');
    for(const [label,text] of [['Research lane',entry.agent],['Duration',`${new Date(entry.startedAt).toLocaleString()} — ${new Date(entry.endedAt).toLocaleString()}`],['Task',entry.task],['Symbol',entry.symbol],['Explanation',entry.explanation]]){
      const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=text;dl.append(dt,dd);
    }card.append(dl);
  }
  function renderList(){
    status.textContent=error??(archive.entries.length?`${archive.entries.length} souls remembered · next iteration ${archive.nextIteration}`:'Ready for Iteration 1. A place for every soul.');
    const pages=Math.max(1,Math.ceil(archive.entries.length/100));page=Math.min(page,pages-1);
    el.querySelector('.memorial-pages span').textContent=`Archive page ${page+1} / ${pages}`;
    el.querySelector('[data-action="prev"]').disabled=page===0;el.querySelector('[data-action="next"]').disabled=page>=pages-1;
    const list=el.querySelector('.memorial-list');list.replaceChildren();
    for(const entry of archive.entries.slice(page*100,(page+1)*100)){
      const b=document.createElement('button');b.textContent=`Iteration ${entry.iteration}`;b.onclick=()=>show(entry);list.append(b);
    }
  }
  function sync(){const w=world();if(!w)return;if(w!==lastWorld){lastWorld=w;w.update(archive.entries);}}
  async function refresh(){try{const res=await fetch('/api/financial-office/memorials',{cache:'no-store'});if(!res.ok)throw Error('Archive unavailable. Existing marks are retained.');const next=await res.json();const nextDigest=JSON.stringify(next);error=null;if(nextDigest!==digest){archive=next;digest=nextDigest;lastWorld=null;}sync();renderList();}catch(e){error=e.message;renderList();}}
  function open(entry){el.hidden=false;document.body.classList.add('memorial-open');sync();if(entry)show(entry);else focusWall();}
  function test(){el.hidden=false;document.body.classList.add('memorial-open');editor.hidden=false;redraw();}
  const close=()=>{el.hidden=true;document.body.classList.remove('memorial-open');};
  const actions={close,wall:focusWall,paint:focusPaint,test,
    watch:()=>watchPainting?.(),stop:()=>{world()?.stop();tick();},inspect:()=>{if(selectedEntry)focusSymbol?.(selectedEntry);},
    prev:()=>{page--;world()?.setPage(page);renderList();},next:()=>{page++;world()?.setPage(page);renderList();},
    undo:()=>{strokes.pop();pendingPreview=null;el.querySelector('[data-action="approve"]').hidden=true;redraw();},clear:()=>{strokes=[];pendingPreview=null;el.querySelector('[data-action="approve"]').hidden=true;redraw();},
    approve:()=>{
      try{
        if(!pendingPreview)throw Error('Preview the current image first');
        const w=world();if(!w)throw Error('The campus is still loading');
        w.preview(pendingPreview,value('actor'));preview=w.ceremony.job.entry;preview.agent=`${OFFICE_PROFILES.find(p=>`office:${p.id}`===w.ceremony.job.agentId)?.name??'Resident'} · test animation`;
        pendingPreview=null;editor.hidden=true;show(preview);watchPainting?.();tick();
      }catch(e){status.textContent=e.message;}
    },
    remove:()=>{preview=null;pendingPreview=null;world()?.preview(null);card.hidden=true;editor.hidden=true;selectedEntry=null;el.querySelector('[data-action="inspect"]').hidden=true;el.querySelector('[data-action="approve"]').hidden=true;tick();},
  };
  for(const b of el.querySelectorAll('[data-action]'))b.onclick=actions[b.dataset.action];
  editor.onsubmit=e=>{
    e.preventDefault();if(!strokes.length){status.textContent='Draw an image first.';return;}
    const draftEntry={...draft(),strokes:structuredClone(strokes),preview:true,agent:'Test agent',symbol:value('symbol'),task:value('task'),explanation:value('explanation'),startedAt:new Date(Date.now()-60000).toISOString(),endedAt:new Date().toISOString()};
    try{
      const duplicateName=archive.entries.some(entry=>entry.symbol.trim().toLocaleLowerCase('en-US')===draftEntry.symbol.trim().toLocaleLowerCase('en-US'));
      if(duplicateName)throw Error('That symbol name already exists. Make an entirely new symbol.');
      pendingPreview=draftEntry;show(draftEntry);const check=assessMemorialLegibility(draftEntry);
      status.textContent=check.warnings.length?`Preview ready · ${check.warnings.join(' ')}`:'Preview ready · inspect the complete image before approving it.';
      el.querySelector('[data-action="approve"]').hidden=false;
    }catch(e){status.textContent=e.message;}
  };
  function tick(){
    const w=world(),j=w?.ceremony.job,s=w?.ceremony.snapshot();
    const key=s?`${s.agentId}:${s.stage}`:'';
    if(key!==lastStage){
      lastStage=key;el.querySelector('.memorial-ceremony-status').textContent=s?.label??'';
      if(j&&!j.entry.preview&&s.stage==='approach'){open(j.entry);watchPainting?.();}
      onStage?.(s);
      if(s?.stage==='complete'&&!s.preview&&selectedEntry)focusSymbol?.(selectedEntry);
    }
    el.querySelector('[data-action="watch"]').hidden=!j;el.querySelector('[data-action="stop"]').hidden=!j;el.querySelector('[data-action="remove"]').hidden=!preview;
    editor.querySelector('[type="submit"]').disabled=!!j;
  }
  el.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  redraw();void refresh();
  return {el,open,close,test,show,refresh,sync,tick,pick(hit){if(hit.entry)open(hit.entry);else if(hit.paint){open();test();focusPaint();}}};
}
