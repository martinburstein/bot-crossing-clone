import test from 'node:test';
import assert from 'node:assert/strict';
import {newPaperBank,applyBankAction} from '../src/office/paper-bank.js';
import {PaperBankController} from '../src/office/paper-bank-controller.js';
import {commitPaperBankRename} from '../server/paper-bank.mjs';
test('transient Windows rename locks retry the same commit; permanent errors remain visible',async()=>{
  let calls=0,pauses=0;
  await commitPaperBankRename('pending','target',{rename:async(a,b)=>{assert.equal(a,'pending');assert.equal(b,'target');if(++calls<3)throw Object.assign(Error('locked'),{code:'EPERM'});},pause:async()=>{pauses++;}});
  assert.equal(calls,3);assert.equal(pauses,2);
  await assert.rejects(commitPaperBankRename('a','b',{rename:async()=>{throw Object.assign(Error('missing'),{code:'ENOENT'});},pause:async()=>{assert.fail('Not a retryable error');}}),/missing/);
});
test('managed studies preserve principal, display actual losses and never auto-complete pending computation',()=>{
  let s=applyBankAction(newPaperBank(),{type:'start',id:'study-desk',profileId:'steve-eisman',amount:6000,returnPct:0,idea:'Pending computation',managedStudy:'study-300',allowDeficit:true});
  for(let i=0;i<6;i++){s=applyBankAction(s,{type:'pickup',id:'study-desk'});s=applyBankAction(s,{type:'deposit',id:'study-desk'});}
  const c=new PaperBankController();c.accept(s);c.nextPoll=Infinity;c.stages.set('study-desk',{name:'running',at:0});let actions=0;c.action=async()=>{actions++;};c.tick(100,null,[]);assert.equal(actions,0);
  assert.throws(()=>applyBankAction(s,{type:'study-result',id:'study-desk',studyId:'wrong',idea:'bad',returnPct:2}),/Wrong/);
  s=applyBankAction(s,{type:'study-result',id:'study-desk',studyId:'study-300',idea:'Verified gap result',returnPct:-125});
  assert.equal(s.jobs[0].result.endingValue,-1500);assert.equal(s.jobs[0].result.pnl,-7500);assert.equal(s.bricks.filter(b=>b.owner).length,6);
  s=applyBankAction(s,{type:'study-pending',id:'study-desk',studyId:'study-300',idea:'Next computation'});assert.equal(s.jobs[0].result,null);
  assert.throws(()=>applyBankAction(s,{type:'study-progress',id:'study-300',total:300,completed:301,activeWorkers:0,status:'complete',updatedAt:new Date().toISOString()}),/Invalid/);
  assert.throws(()=>applyBankAction(s,{type:'study-progress',id:'study-300',total:300,completed:0,activeWorkers:4,status:'computing',updatedAt:new Date().toISOString()}),/three/);
});
