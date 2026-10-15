import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Navigation} from '../src/agents/navigation.js';
import {createFinancialOffice} from '../src/world/financial-office.js';
import {labelPixels} from '../src/world/label-texture.js';
import {workerInspection} from '../src/ui/worker-data.mjs';
import {financialOfficeResponse} from '../src/office/profiles.js';
import {readOfficeHistory} from '../server/financial-office.mjs';
import {execFileSync} from 'node:child_process';

test('office label pixels match the physical aspect ratio without stretching',()=>{
  for(const [w,h] of [[20,10.5],[7.8,1.6],[27,5.8],[9,1.55]]){const p=labelPixels(w,h);assert.ok(Math.abs(p.width/p.height-w/h)<.012);assert.equal(p.width,2048);}
});
test('office collision prevents tunneling through a thin rotated object and repairs covered spawns',()=>{
  const nav=new Navigation();nav.rebuild([{x:0,z:0,width:8,depth:1,angle:.3,office:true}]);
  const p={x:0,z:-8};nav.slide(p,0,16);assert.ok(p.z<0);assert.equal(nav.isBlocked(p.x,p.z),false);
  const covered={x:0,z:0};nav.slide(covered,0,0);assert.equal(nav.isBlocked(covered.x,covered.z),false);
});
test('office furniture routes cover chairs, plants, benches, coffee and board',()=>{
  const world=createFinancialOffice(new THREE.Scene()),nav=new Navigation({half:150,maxExpansions:60000});nav.rebuild(world.obstacles());
  for(const kind of ['office-desk','office-chair','history-board','coffee-library','office-plant','camp-bench','paper-bank','magi-monument']){
    const o=world.obstacles().find(o=>o.worksite===kind);assert.ok(o,kind);assert.equal(nav.isBlocked(o.x,o.z),true,kind);
  }
  const path=nav.findPath(-23,-18,-23,-3);assert.ok(path?.length>1);
  let last={x:-23,z:-18};for(const p of path){assert.ok(nav.lineOfSight(last.x,last.z,p.x,p.z));last=p;}
  world.dispose();
});
test('office popup has XYZ beneath Activity and saved Thoughts instead of Vehicle/Tokens',()=>{
 const result=financialOfficeResponse({}, {thoughts:{profiles:{'steve-eisman':'Start with incentives.'}}});
 const agent={thread:result.threads[0],pos:{x:1,y:0,z:2}};
 const keys=workerInspection(agent,null).rows.map(r=>r[0]);assert.deepEqual(keys.slice(1),['Activity','XYZ','Thoughts']);assert.equal(agent.thread.officeThought,'Start with incentives.');
});
test('both named phrases resolve to separate saved versions without launching',()=>{
 for(const [name,spec]of [['big-crypto-short','FINANCIAL-OFFICE.json'],['waveshare-arm','CANON-VISUAL.json']]){
 const v=JSON.parse(execFileSync(process.execPath,['tools/named-dual-view.mjs',name,'--describe'],{encoding:'utf8'}));assert.equal(v.spec,spec);assert.equal(v.modelCalls,0);assert.equal(v.hardwareStartup,false);}
});

test('history accepts attributed coordinator qualifications and rejects unrecognized entry kinds',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),{createHash}=await import('node:crypto');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'office-qualification-'));
 try{
  const kinds=['coordinator-source-correction','coordinator-source-freshness-check','supplemental-reviewed-report-summary','coordinator-data-qualification','coordinator-source-follow-up','coordinator-source-qualification','coordinator-qualification','coordinator-source-check','coordinator-session-closeout'];
  const entries=kinds.map((kind,i)=>({id:`note-${i}`,kind,text:'An attributed qualification.',sources:['source.md']}));
  const save=()=>fs.writeFile(path.join(root,'history.json'),JSON.stringify({schemaVersion:1,entries,digest:createHash('sha256').update(JSON.stringify(entries)).digest('hex')}));
  await save();assert.equal((await readOfficeHistory({root})).available,true);
  entries[0].kind='unrecognized';await save();assert.equal((await readOfficeHistory({root})).available,false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
