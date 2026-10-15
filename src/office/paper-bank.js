import {OFFICE_BY_ID} from './profiles.js';
export const BRICK_COUNT=137,BRICK_VALUE=1000;
const check=(v,message)=>{if(!v)throw Error(message)};
export const scenarioResult=(amount,returnPct)=>({principal:amount,assumedTotalReturnPct:returnPct,pnl:Math.round(amount*returnPct)/100,endingValue:Math.round(amount*(1+returnPct/100)*100)/100,interpretation:'Hypothetical total-return scenario; no price forecast or executed trade.'});
export function newPaperBank(){return {schemaVersion:1,revision:0,capital:137000,brickValue:1000,bricks:Array.from({length:137},(_,id)=>({id,owner:null,place:'bank'})),jobs:[]};}
export function validatePaperBank(s){
  check(s.schemaVersion===1&&s.capital===137000&&s.brickValue===1000,'Unexpected paper-bank denomination');
  check(Number.isSafeInteger(s.revision)&&s.revision>=0,'Invalid bank revision');
  check(Array.isArray(s.bricks)&&s.bricks.length===137&&s.bricks.every((b,i)=>b.id===i&&['bank','desk','carried'].includes(b.place)),'Bank must conserve exactly 137 bricks');
  check(Array.isArray(s.jobs)&&s.jobs.length<=128&&new Set(s.jobs.map(j=>j.id)).size===s.jobs.length,'Invalid simulation history');
  const occupied=new Set();
  for(const j of s.jobs){
    check(/^[a-zA-Z0-9-]{1,80}$/.test(j.id)&&OFFICE_BY_ID[j.profileId],'Invalid simulation identity');
    check(Number.isInteger(j.amount)&&j.amount>=1000&&j.amount<=137000&&j.amount%1000===0,'Use whole $1,000 bricks');
    check(Number.isFinite(j.returnPct)&&j.returnPct>=-100&&j.returnPct<=1000,'Assumed total return must be between -100% and 1000%');
    check(typeof j.idea==='string'&&j.idea.trim().length>0&&j.idea.length<=180,'Name this simulation');
    check(['collecting','carrying','running','complete','returning','carrying-back','closed'].includes(j.stage),'Invalid simulation stage');
    check(j.bricks.length===j.amount/1000&&new Set(j.bricks).size===j.bricks.length&&j.bricks.every(id=>Number.isInteger(id)&&id>=0&&id<137),'Invalid allocation');
    check(Array.isArray(j.delivered)&&Array.isArray(j.returned)&&new Set([...j.delivered,...j.returned,...(j.holding===null?[]:[j.holding])]).size===j.delivered.length+j.returned.length+(j.holding===null?0:1),'Duplicate transported brick');
    check([...j.delivered,...j.returned,...(j.holding===null?[]:[j.holding])].every(id=>j.bricks.includes(id)),'Unallocated transported brick');
    if(j.stage!=='closed'){check(!occupied.has(j.profileId),'One active simulation per desk');occupied.add(j.profileId);}
    for(const id of j.bricks){const b=s.bricks[id];if(j.returned.includes(id)||j.stage==='closed')continue;check(b.owner===j.id,'Allocation ownership mismatch');const place=j.holding===id?'carried':j.delivered.includes(id)?'desk':'bank';check(b.place===place,'Transport location mismatch');}
    if(j.result)check(JSON.stringify(j.result)===JSON.stringify(scenarioResult(j.amount,j.returnPct)),'Scenario arithmetic mismatch');
    check(['carrying','carrying-back'].includes(j.stage)?Number.isInteger(j.holding):j.holding===null,'Carrying state needs exactly one held brick');
    if(j.stage==='complete')check(!!j.result,'Completed simulation needs its scenario result');
    if(['running','complete'].includes(j.stage))check(j.delivered.length===j.bricks.length&&j.holding===null,'Scenario cannot run before delivery');
    if(j.stage==='closed')check(j.returned.length===j.bricks.length,'Bricks must return before closing');
  }
  for(const b of s.bricks){if(b.owner===null)check(b.place==='bank','Unowned brick outside bank');else check(s.jobs.some(j=>j.id===b.owner&&j.stage!=='closed'&&j.bricks.includes(b.id)&&!j.returned.includes(b.id)),'Orphaned brick');}
  return s;
}
export function bankSummary(s){return {capital:s.capital,available:s.bricks.filter(b=>b.owner===null).length*1000,atBank:s.bricks.filter(b=>b.place==='bank').length,carried:s.bricks.filter(b=>b.place==='carried').length,atDesks:s.bricks.filter(b=>b.place==='desk').length,allocated:s.bricks.filter(b=>b.owner!==null).length};}
export function applyBankAction(original,action){
  validatePaperBank(original);const s=structuredClone(original),type=action.type;
  if(type==='start'){
    check(s.jobs.length<128,'Simulation log is full; preserve it before starting another');
    check(!s.jobs.some(j=>j.id===action.id),'Simulation id already exists');
    check(!s.jobs.some(j=>j.profileId===action.profileId&&j.stage!=='closed'),'Return this agent’s previous allocation first');
    check(Number.isInteger(action.amount)&&action.amount>=1000&&action.amount%1000===0,'Minimum $1,000; use whole $1,000 bricks');
    const free=s.bricks.filter(b=>b.owner===null);check(action.amount<=free.length*1000,'Not enough unallocated bricks');
    const j={id:action.id,profileId:action.profileId,amount:action.amount,returnPct:action.returnPct,idea:String(action.idea??'').trim(),source:String(action.source??'').slice(0,240),stage:'collecting',bricks:free.slice(0,action.amount/1000).map(b=>b.id),delivered:[],returned:[],holding:null,result:null};
    for(const id of j.bricks)s.bricks[id].owner=j.id;s.jobs.push(j);
  }else{
    const j=s.jobs.find(j=>j.id===action.id);check(j,'Unknown simulation');
    if(type==='pickup'){check(j.stage==='collecting','Not ready to collect');const id=j.bricks.find(id=>!j.delivered.includes(id));check(id!==undefined,'Nothing to collect');j.holding=id;s.bricks[id].place='carried';j.stage='carrying';}
    else if(type==='deposit'){check(j.stage==='carrying','No carried brick');j.delivered.push(j.holding);s.bricks[j.holding].place='desk';j.holding=null;j.stage=j.delivered.length===j.bricks.length?'running':'collecting';}
    else if(type==='finish'){check(j.stage==='running','Deliver the allocation before calculating');j.result=scenarioResult(j.amount,j.returnPct);j.stage='complete';}
    else if(type==='release'){check(['running','complete'].includes(j.stage),'Wait for delivery before returning');j.stage='returning';}
    else if(type==='pickup-return'){check(j.stage==='returning','Not ready to return');const id=j.delivered.pop();check(id!==undefined,'Nothing at desk');j.holding=id;s.bricks[id].place='carried';j.stage='carrying-back';}
    else if(type==='deposit-bank'){check(j.stage==='carrying-back','No returning brick');const b=s.bricks[j.holding];b.place='bank';b.owner=null;j.returned.push(j.holding);j.holding=null;j.stage=j.returned.length===j.bricks.length?'closed':'returning';}
    else throw Error('Unknown paper-bank action');
  }
  s.revision++;return validatePaperBank(s);
}
