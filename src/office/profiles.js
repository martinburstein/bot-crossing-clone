// Public identity/style metadata only. Research, history and live bindings stay in the project.
export const OFFICE_PROFILES = Object.freeze([
  ['steve-eisman','Steve Eisman','EISMAN','Institutional incentives',0x304f73,0xe2a260,'navy / copper tie','peak'],
  ['michael-burry','Michael Burry','BURRY','Documents & cash-flow clocks',0x444a51,0x8bc8c3,'charcoal / sea-glass tie','notch'],
  ['charlie-ledley','Charlie Ledley','LEDLEY','Uncertainty & opposing cases',0x977552,0x456b80,'sand tweed / blue tie','patch'],
  ['jamie-mai','Jamie Mai','MAI','Asymmetry & portfolio design',0x426e60,0xe4d1a3,'forest / ivory open collar','double'],
  ['vincent-daniel','Vincent Daniel','DANIEL','Forensic accounting',0x71617f,0xe9d5b6,'plum / champagne tie','pinstripe'],
  ['danny-moses','Danny Moses','MOSES','Execution & dealer incentives',0x824e51,0x92b8d0,'burgundy / ice-blue tie','peak'],
  ['porter-collins','Porter Collins','COLLINS','Operating economics',0x78918e,0xf2dfbd,'sage / cream open collar','notch'],
  ['ben-hockett','Ben Hockett','HOCKETT','Counterparties & collectibility',0x394654,0xbd9659,'midnight / brass tie','double'],
].map(([id,name,short,role,color,accent,style,cut],index)=>Object.freeze({id,name,short,role,color,accent,style,cut,index,
  desk:Object.freeze({x:[-23,-7.7,7.7,23][index%4],z:index<4?-11:12}),
  home:Object.freeze({q:[-2,-.67,.67,2][index%4],r:(index<4?-11:12)/(7.6*Math.sqrt(3))-[-2,-.67,.67,2][index%4]/2}),
})));

export const OFFICE_BY_ID=Object.freeze(Object.fromEntries(OFFICE_PROFILES.map(p=>[p.id,p])));
export const OFFICE_SCENE='financial-office';

const completionQuips=Object.freeze({
  options:Object.freeze({
    'michael-burry':'Five contract terms walked into OCC. None agreed to identify themselves.',
    'steve-eisman':'A cheap put without a clean quote is just expensive fan fiction.',
    'ben-hockett':'No deliverable, no multiplier, no victory lap.',
  }),
  identity:Object.freeze({
    'michael-burry':'The wallet had an address. Provenance declined to comment.',
    'steve-eisman':'Great strategy. Tiny problem: nobody can prove whose wallet it is.',
    'ben-hockett':'A wallet without provenance is a counterparty wearing sunglasses.',
  }),
  loans:Object.freeze({
    'michael-burry':'The total showed up. The facility mix sent its regrets.',
    'steve-eisman':'One big loan number, zero useful labels. Accounting remains undefeated.',
    'ben-hockett':'The liability is real; the lender name is apparently classified.',
  }),
  dividend:Object.freeze({
    'michael-burry':'The dividend has a date, a price, and no guest list.',
    'steve-eisman':'Per-share amount confirmed. Share count still hiding under the table.',
    'ben-hockett':'Record date found. Entitled shares remain fashionably late.',
  }),
  fees:Object.freeze({
    'michael-burry':'The fee formula is precise. The principal remains interpretive dance.',
    'steve-eisman':'Ten percent annualized—on an amount nobody will put in writing.',
    'ben-hockett':'The contract brought a formula and forgot the confirmation.',
  }),
  review:Object.freeze({
    'michael-burry':'The footnotes survived. The thesis gets no such courtesy.',
    'steve-eisman':'Reviewed twice. Still allergic to wishful arithmetic.',
    'ben-hockett':'The hashes match. The victory lap remains unsecured.',
  }),
});

function quipTopic(task=''){
  if(/\b(glxy|option|put|cboe|occ|series|contract)\b/i.test(task))return 'options';
  if(/\b(btcs|wallet|address|aave|identity|provenance)\b/i.test(task))return 'identity';
  if(/\b(galaxy|loan|facility|lender|collateral)\b/i.test(task))return 'loans';
  if(/\b(chad|dividend|entitled|record date|shares?)\b/i.test(task))return 'dividend';
  if(/\b(dfdv|bitgo|principal|fee|confirmation)\b/i.test(task))return 'fees';
  return 'review';
}

export function completionQuip(profileId,task){
  return completionQuips[quipTopic(task)]?.[profileId]??completionQuips.review[profileId]??'Filed, checked, and still asking better questions.';
}

export function withOfficeActivity(response,activity,now=Date.now()){
  if(activity?.terminal&&(response.threads??[]).some(t=>t.running))return response;
  if(!activity?.available)return activity?.reason==='invalid'?{...response,threads:[],worksite:{stale:true},officeActivity:{stale:true}}:response;
  const fresh=activity.fresh&&Number.isFinite(activity.observedAt)&&activity.observedAt<=now+5000&&(activity.terminal||now-activity.observedAt<=60000);
  const slots=['melchior','balthasar','casper'];
  return {...response,scannedAt:now,threads:fresh?activity.agents.map((a,i)=>{
    const lastCompletedTask=a.lastCompletedTask??(a.status==='completed'?a.task:null);
    return {runId:'crypto-swarm-2026-10-15',officeProfileId:a.profileId,taskTitle:a.task,taskId:a.profileId,shellId:`collaboration-${i+1}`,running:a.status==='running',assignmentState:a.status==='running'?'running':'idle',clusterId:slots[i],workerBackend:'codex-collaboration-observed',lastCompletedTask,completionQuip:lastCompletedTask?completionQuip(a.profileId,lastCompletedTask):null};
  }):[],worksite:{stale:!fresh},officeActivity:{stale:!fresh,terminal:activity.terminal,completedProfiles:activity.agents.filter(a=>a.status==='completed').map(a=>a.profileId),observedAt:activity.observedAt,kind:activity.kind}};
}

export function profileForThread(thread){
  if(OFFICE_BY_ID[thread?.officeProfileId])return OFFICE_BY_ID[thread.officeProfileId];
  return OFFICE_PROFILES.find(p=>thread?.taskId===p.id||String(thread?.taskTitle??'').startsWith(`${p.name} [simulation]`))??null;
}

// Projection only: eight identities sit above rotating transport workers, never eight sessions.
export function financialOfficeResponse(response={},history=null){
  const candidates=(response.threads??[]).filter(t=>t.runId==='crypto-swarm-2026-10-15'),usedClusters=new Set(),assignments=new Map();
  const fresh=!response.worksite?.stale&&Number.isFinite(response.scannedAt)&&Date.now()-response.scannedAt<20000;
  for(const t of candidates){
    const p=profileForThread(t);
    if(!p||!fresh||!t.running||!t.workerBackend||!['running','reviewing'].includes(t.assignmentState)||!['melchior','balthasar','casper'].includes(t.clusterId)||usedClusters.has(t.clusterId)||assignments.has(p.id)||usedClusters.size>=3)continue;
    usedClusters.add(t.clusterId);assignments.set(p.id,t);
  }
  const threads=OFFICE_PROFILES.map(p=>{
    const source=assignments.get(p.id),pending=candidates.find(t=>profileForThread(t)?.id===p.id);
    return {id:`office:${p.id}`,shellId:`w${String(p.index+1).padStart(2,'0')}`,isShell:true,worldProfile:'15-3A',sceneLayout:OFFICE_SCENE,
      officeProfileId:p.id,officeStyle:p,officeThought:pending?.completionQuip??history?.thoughts?.profiles?.[p.id]??null,officeThoughtKind:pending?.completionQuip?'completion-quip':'saved-quip',displayRoleId:p.id,shellName:p.name,title:p.name,project:`Research / ${p.name}`,projectLabel:p.name,
      shellColor:'#d1b786',projectAccent:p.color,suitColor:p.color,constructionRunId:'financial-office-2026-10-15',
      running:!!source,hasError:false,archived:false,unread:false,canOpen:false,createdAt:p.index+1,lastActivityAt:response.scannedAt??Date.now(),sizeBytes:0,
      assignmentRole:source?.assignmentRole??'idle',assignmentState:source?.assignmentState??'idle',shellStatus:source?'At work':'Between assignments',
      clusterId:source?.clusterId??'office',carrierWorkerId:source?.shellId??null,taskId:source?.taskId??null,taskTitle:source?.taskTitle??pending?.taskTitle??null,
      workerBackend:source?.workerBackend??null,tokenUsage:source?.tokenUsage??null,dependencies:[],milestones:[],workflow:'Financial research office',
    };
  });
  const executorSlots=['melchior','balthasar','casper'].map(slotId=>{
    const person=threads.find(t=>t.running&&t.clusterId===slotId);
    return {slotId,status:person?'running':'idle',roleId:person?.officeProfileId??null,profileName:person?.shellName??null};
  });
  return {...response,threads,worksite:{sceneLayout:OFFICE_SCENE,stale:!fresh,executorSlots,
    office:{profiles:8,active:assignments.size,history:history??{entries:[],digest:null},maxConcurrent:3,
      council:threads.some(t=>t.running&&/campfire/i.test(String(t.taskTitle??'')))},
    campus:{mode:'awake',dispatchMode:'free-15-3A',free:{chargingRoleIds:[],history:[]}}}};
}
