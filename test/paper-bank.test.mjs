import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as THREE from 'three';
import {newPaperBank,applyBankAction,validatePaperBank,bankSummary,scenarioResult} from '../src/office/paper-bank.js';
import {readPaperBank,operatePaperBank} from '../server/paper-bank.mjs';
import {createFinancialOffice} from '../src/world/financial-office.js';
import {Navigation} from '../src/agents/navigation.js';
const request=(overrides={})=>({type:'start',id:'sim-test',profileId:'michael-burry',amount:1000,returnPct:10,idea:'Scenario test',...overrides});
test('the shared bank conserves 137 bricks through collection, scenario loss, return and reuse',()=>{
  let s=newPaperBank();s=applyBankAction(s,request({amount:2000,returnPct:-100}));
  assert.equal(bankSummary(s).available,135000);
  assert.throws(()=>applyBankAction(s,{type:'finish',id:'sim-test'}),/Deliver/);
  for(let i=0;i<2;i++){s=applyBankAction(s,{type:'pickup',id:'sim-test'});assert.equal(bankSummary(s).carried,1);s=applyBankAction(s,{type:'deposit',id:'sim-test'});}
  s=applyBankAction(s,{type:'finish',id:'sim-test'});assert.equal(s.jobs[0].result.endingValue,0);assert.equal(s.bricks.length,137);
  s=applyBankAction(s,{type:'release',id:'sim-test'});
  for(let i=0;i<2;i++){s=applyBankAction(s,{type:'pickup-return',id:'sim-test'});s=applyBankAction(s,{type:'deposit-bank',id:'sim-test'});}
  assert.equal(s.jobs[0].stage,'closed');assert.equal(bankSummary(s).available,137000);assert.equal(s.jobs[0].result.pnl,-2000);
  s=applyBankAction(s,request({id:'sim-second',amount:137000}));assert.equal(bankSummary(s).available,0);assert.equal(new Set(s.jobs.at(-1).bricks).size,137);
});
test('invalid denominations, overdrafts, duplicate reservations and corrupt restores fail without changing principal',()=>{
  const s=newPaperBank(),before=JSON.stringify(s);
  for(const changes of [{amount:0},{amount:999},{amount:1500},{amount:138000},{returnPct:NaN},{returnPct:-101},{profileId:'unknown'},{idea:''}])assert.throws(()=>applyBankAction(s,request(changes)));
  assert.equal(JSON.stringify(s),before);
  const allocated=applyBankAction(s,request({amount:137000}));
  assert.throws(()=>applyBankAction(allocated,request({id:'duplicate'})),/previous allocation/);
  assert.throws(()=>applyBankAction(allocated,request({id:'other',profileId:'steve-eisman'})),/Not enough/);
  const corrupt=structuredClone(allocated);corrupt.bricks[0].owner=null;assert.throws(()=>validatePaperBank(corrupt),/ownership/);
  assert.deepEqual(scenarioResult(3000,12.5),{principal:3000,assumedTotalReturnPct:12.5,pnl:375,endingValue:3375,interpretation:'Hypothetical total-return scenario; no price forecast or executed trade.'});
});
test('durable bank rejects stale revisions and tampering; an agent request survives reload',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'office-paper-bank-'));
  try{await operatePaperBank(request({baseRevision:0}),{root});assert.equal((await readPaperBank({root})).jobs[0].amount,1000);
    await assert.rejects(operatePaperBank({type:'pickup',id:'sim-test',baseRevision:0},{root}),/changed/);
    const s=await readPaperBank({root});s.bricks.pop();await fs.writeFile(path.join(root,'paper-bank.json'),JSON.stringify(s));await assert.rejects(readPaperBank({root}),/137/);
    assert.equal((await fs.readdir(root)).includes('paper-bank.lock'),false);
  }finally{const resolved=path.resolve(root);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('office-paper-bank-'));await fs.rm(resolved,{recursive:true,force:true});}
});
test('bank pickup and every desk destination have navigable paths and one visible mesh slot per brick',()=>{
  const world=createFinancialOffice(new THREE.Scene()),nav=new Navigation({half:144,maxExpansions:24000});nav.rebuild(world.obstacles());
  for(const profileId of ['steve-eisman','michael-burry','charlie-ledley','jamie-mai','vincent-daniel','danny-moses','porter-collins','ben-hockett']){
    let s=applyBankAction(newPaperBank(),request({profileId}));world.paperBank.update(s);const bank=world.target({officeProfileId:profileId},0).position;assert.equal(nav.isBlocked(bank.x,bank.z),false);
    s=applyBankAction(s,{type:'pickup',id:'sim-test'});world.paperBank.update(s);const desk=world.target({officeProfileId:profileId},0).position;
    assert.equal(nav.isBlocked(desk.x,desk.z),false);assert.ok(nav.findPath(bank.x,bank.z,desk.x,desk.z),profileId);
  }
  assert.equal(world.paperBank.bricks.count,137);world.paperBank.animate(0,[]);const m=new THREE.Matrix4();for(let i=0;i<137;i++){world.paperBank.bricks.getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite));}world.dispose();
});
