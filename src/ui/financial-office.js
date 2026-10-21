import {OFFICE_PROFILES} from '../office/profiles.js';
import './financial-office.css';

export function mountFinancialOffice(root,{focusProfile,focusOffice,focusCamp,focusCampus,toggleActionCam}){
  const el=document.createElement('section');el.className='financial-office-hud';el.setAttribute('aria-label','Financial research office');
  el.innerHTML=`<header class="office-masthead"><span>CRYPTO RESEARCH LAB</span><h1>The Big Short</h1><p>Eight perspectives. One research floor.</p></header>
    <div class="office-execution" role="status"><i></i><span>3 MAGI computers · ready</span><small>8 characters / up to 3 real turns</small></div>
    <nav class="office-camera" aria-label="Office camera"><button data-view="office">Office floor</button><button data-view="camp">Campfire</button><button data-view="campus">Whole campus</button><button data-view="action" aria-pressed="false" title="Automatic trailing shots of the characters. Camera controls pause it; shots resume after 10 seconds idle.">Action cam</button><span class="office-camera-subject" aria-live="polite"></span></nav>
    <div class="office-roster" aria-label="Eight research simulations"></div>
    <details class="office-ledger"><summary>Campfire ledger <span></span></summary><div class="office-ledger-body"></div></details>`;
  root.append(el);
  el.querySelector('[data-view="office"]').onclick=focusOffice;el.querySelector('[data-view="camp"]').onclick=focusCamp;el.querySelector('[data-view="campus"]').onclick=focusCampus;
  const actionButton=el.querySelector('[data-view="action"]'),cameraSubject=el.querySelector('.office-camera-subject');
  actionButton.onclick=toggleActionCam;
  const buttons=new Map();
  for(const p of OFFICE_PROFILES){const b=document.createElement('button');b.type='button';b.className='office-person';b.style.setProperty('--suit',`#${p.color.toString(16).padStart(6,'0')}`);b.innerHTML='<i></i><span></span><small>OFF DUTY</small>';b.querySelector('span').textContent=p.short;b.title=`${p.name} · ${p.role}\n${p.style}\nResearch simulation`;b.onclick=()=>focusProfile(p.id);el.querySelector('.office-roster').append(b);buttons.set(p.id,b);}
  let digest=null;
  let cameraKey='';
  return {el,setCamera(profileId,following,enabled){
    const key=`${profileId}:${following}:${enabled}`;if(key===cameraKey)return;cameraKey=key;
    actionButton.setAttribute('aria-pressed',String(enabled));
    cameraSubject.textContent=enabled?(following?`Following ${OFFICE_PROFILES.find(p=>p.id===profileId)?.name??'character'}`:'Action cam · resumes when idle'):'';
    for(const [id,button] of buttons)button.setAttribute('aria-pressed',String(id===profileId));
  },update(value){
    const office=value?.worksite?.office??{},active=value?.threads?.filter(t=>t.running)??[];
    const status=el.querySelector('.office-execution');status.classList.toggle('active',active.length>0);
    status.querySelector('span').textContent=value?.worksite?.stale?'Work status needs refresh':value.officeActivity?`${active.length} / 3 research agents active`:active.length?`${active.length} / 3 MAGI units working`:'0 / 3 MAGI units working';
    status.querySelector('small').textContent=office.council?'Campfire council · eight colleagues':active.length?`${8-active.length} colleagues off duty`:'Eight colleagues · research standby';
    if(value.officeActivity)status.querySelector('small').textContent=value.officeActivity.stale?'Last observation expired':value.officeActivity.terminal?'Research tasks complete · coordinator observed':'Collaboration agents · coordinator observed';
    for(const t of value?.threads??[]){const b=buttons.get(t.officeProfileId);if(!b)continue;b.classList.toggle('active',t.running);b.querySelector('small').textContent=value?.worksite?.stale?'UNKNOWN':t.running?(value.officeActivity?'RESEARCHING':t.clusterId.toUpperCase()):value.officeActivity?.completedProfiles?.includes(t.officeProfileId)?'COMPLETE':'OFF DUTY';}
    const history=office.history??{};el.querySelector('.office-ledger summary span').textContent=`${history.totalEntries??0} saved notes`;
    if(history.digest===digest)return;digest=history.digest;
    const body=el.querySelector('.office-ledger-body');body.replaceChildren();
    const info=document.createElement('p');info.className='office-ledger-context';info.textContent='Saved source notes, questions and accepted work. Playback is ambient; planning reads a compact, source-linked digest.';body.append(info);
    for(const entry of [...(history.entries??[])].reverse()){
      const item=document.createElement('article'),by=document.createElement('strong'),text=document.createElement('p'),source=document.createElement('small');
      const profile=OFFICE_PROFILES.find(p=>p.id===entry.speaker);by.textContent=`${profile?.name??'Office'} · ${entry.kind.replaceAll('-',' ')}`;text.textContent=entry.text;source.textContent=entry.sources.join(' · ');item.append(by,text,source);body.append(item);
    }
  }};
}
