import {OFFICE_PROFILES} from '../office/profiles.js';
import {bankSummary} from '../office/paper-bank.js';
const money=n=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
export function mountPaperBank(root,controller,{focusBank,focusProfile}){
  const el=document.createElement('details');el.className='office-paper-panel';
  el.innerHTML=`<summary>Cash bank <strong>$137,000</strong><small>137 bricks · $1,000 each</small></summary><div class="paper-bank-body">
    <p class="paper-bank-counts"></p><p class="paper-bank-caption">Paper simulations use the same 137 principal bricks. Assumed returns are scenarios; profits and losses appear in the log.</p>
    <button type="button" data-bank-view>View the bank</button>
    <form><label>Agent<select name="profile" aria-label="Simulation agent"></select></label>
    <label>Investment idea<input name="idea" aria-label="Investment idea" placeholder="Name the idea to test" maxlength="180" required></label>
    <label>Allocation ($)<input name="amount" aria-label="Simulation allocation" type="number" min="1000" max="137000" step="1000" value="1000" required></label>
    <label>Assumed total return (%)<input name="returnPct" aria-label="Assumed total return percent" type="number" min="-100" max="1000" step="0.1" value="0" required></label>
    <button type="submit">Start paper simulation</button></form><p class="paper-bank-error" role="alert"></p><div class="paper-bank-jobs"></div></div>`;
  root.append(el);el.querySelector('[data-bank-view]').onclick=focusBank;
  for(const p of OFFICE_PROFILES){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;el.querySelector('select').append(option);}
  el.querySelector('form').onsubmit=async event=>{event.preventDefault();const f=event.currentTarget;if(!f.reportValidity())return;const submit=f.querySelector('[type=submit]');submit.disabled=true;
    try{await controller.action({type:'start',id:`sim-${crypto.randomUUID()}`,profileId:f.elements.profile.value,amount:Number(f.elements.amount.value),returnPct:Number(f.elements.returnPct.value),idea:f.elements.idea.value,source:'Office scenario controls'});el.querySelector('.paper-bank-error').textContent='';focusProfile(f.elements.profile.value);}
    catch(e){el.querySelector('.paper-bank-error').textContent=e.message;}finally{submit.disabled=false;}
  };
  return {el,open(){el.open=true;},update(){
    const state=controller.state;if(!state){el.querySelector('.paper-bank-counts').textContent=controller.error??'Reading saved paper capital…';return;}
    const summary=bankSummary(state);el.querySelector('summary strong').textContent=money(summary.available);el.querySelector('summary small').textContent=`${137-summary.allocated} available / 137 bricks · $1,000 each`;
    el.querySelector('.paper-bank-counts').textContent=`${summary.atBank} in bank · ${summary.carried} being carried · ${summary.atDesks} on desks`;
    const error=el.querySelector('.paper-bank-error');error.textContent=controller.error??'';
    const list=el.querySelector('.paper-bank-jobs');list.replaceChildren();
    for(const job of [...state.jobs].reverse().slice(0,12)){
      const row=document.createElement('article'),name=document.createElement('strong'),info=document.createElement('p');
      name.textContent=`${OFFICE_PROFILES.find(p=>p.id===job.profileId)?.short} · ${job.idea}`;
      info.textContent=`${money(job.amount)} · ${job.stage.replaceAll('-',' ')} · ${job.delivered.length}/${job.bricks.length} bricks at desk`;
      row.append(name,info);
      if(job.result){const result=document.createElement('p');result.className='paper-bank-result';result.textContent=`Modeled value ${money(job.result.endingValue)} · P/L ${money(job.result.pnl)} (${job.returnPct}% assumed total return)`;row.append(result);}
      const view=document.createElement('button');view.type='button';view.textContent='View agent';view.onclick=()=>focusProfile(job.profileId);row.append(view);
      if(['running','complete'].includes(job.stage)){const back=document.createElement('button');back.type='button';back.textContent='Return bricks';back.onclick=async()=>{try{await controller.action({type:'release',id:job.id});}catch(e){error.textContent=e.message;}};row.append(back);}
      list.append(row);
    }
  }};
}
