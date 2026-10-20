import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {readOfficeActivity,readOfficeHistory} from '../server/financial-office.mjs';
import {createHash} from 'node:crypto';
import {withOfficeActivity,financialOfficeResponse} from '../src/office/profiles.js';
const ids=['michael-burry','steve-eisman','ben-hockett'];
const fixture=()=>({schemaVersion:1,kind:'coordinator-observed-collaboration',observedAt:Date.now(),agents:ids.map(profileId=>({profileId,status:'running',task:'Synthetic test only'}))});

test('restored coordinator evidence notes remain readable without admitting unknown kinds',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'office-history-restore-'));
 const entries=[{id:'restored-evidence-note',speaker:'office',kind:'coordinator-reviewed-evidence',text:'Synthetic attributed research note.',sources:['research/report.md']}];
 const put=async()=>fs.writeFile(path.join(root,'history.json'),JSON.stringify({schemaVersion:1,entries,digest:createHash('sha256').update(JSON.stringify(entries)).digest('hex')}));
 await put();assert.equal((await readOfficeHistory({root})).available,true);
 entries[0].kind='unknown-evidence-kind';await put();assert.equal((await readOfficeHistory({root})).available,false);
});
test('collaboration observations project three real-status slots and expire closed',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'office-collab-test-')),root=path.join(dir,'office');
 await fs.mkdir(path.join(dir,'.local'));const file=path.join(dir,'.local/office-activity.json');
 const original={threads:[],scannedAt:Date.now(),worksite:{stale:false}};
 const put=async value=>fs.writeFile(file,JSON.stringify(value));
 assert.equal((await readOfficeActivity({root})).reason,'not-configured');
 let v=fixture();await put(v);let activity=await readOfficeActivity({root});
 assert.equal(financialOfficeResponse(withOfficeActivity(original,activity)).threads.filter(t=>t.running).length,3);
 v.agents[1].status='completed';await put(v);activity=await readOfficeActivity({root});
 assert.equal(financialOfficeResponse(withOfficeActivity(original,activity)).threads.filter(t=>t.running).length,2);
 activity=await readOfficeActivity({root,now:v.observedAt+60001});assert.equal(activity.fresh,false);
 assert.equal(financialOfficeResponse(withOfficeActivity(original,activity)).threads.some(t=>t.running),false);
 assert.equal(withOfficeActivity(original,activity).officeActivity.stale,true);
 v.agents.forEach(a=>a.status='completed');await put(v);activity=await readOfficeActivity({root,now:v.observedAt+600001});assert.equal(activity.terminal,true);assert.equal(activity.fresh,true);
 assert.equal(financialOfficeResponse(withOfficeActivity(original,activity)).threads.some(t=>t.running),false);
 assert.equal(withOfficeActivity({threads:[{running:true}]},activity).officeActivity,undefined);
 for(const corrupt of [{...fixture(),observedAt:Date.now()+10000},{...fixture(),agents:[...fixture().agents,fixture().agents[0]]},{...fixture(),agents:[fixture().agents[0],fixture().agents[0],fixture().agents[2]]},{...fixture(),agents:fixture().agents.map(a=>({...a,status:'probably-running'}))}]){await put(corrupt);assert.equal((await readOfficeActivity({root})).reason,'invalid');}
 assert.equal(withOfficeActivity(original,{available:false,reason:'invalid'}).worksite.stale,true);
 // Keep the small temporary test fixture for inspection; no recursive deletion.
});

test('a completed task becomes one short related desk quip and persists through a later running observation',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'office-completion-quip-')),root=path.join(dir,'office');
 await fs.mkdir(path.join(dir,'.local'));const file=path.join(dir,'.local/office-activity.json');
 const completed=fixture();completed.agents.forEach(a=>a.status='completed');completed.agents[0].task='BTCS wallet address provenance review';
 await fs.writeFile(file,JSON.stringify(completed));
 let projected=financialOfficeResponse(withOfficeActivity({threads:[],scannedAt:Date.now(),worksite:{stale:false}},await readOfficeActivity({root})));
 let burry=projected.threads.find(t=>t.officeProfileId==='michael-burry');
 assert.match(burry.officeThought,/wallet|provenance/i);assert.equal(burry.officeThought.includes('\n'),false);assert.ok(burry.officeThought.length<120);assert.equal(burry.officeThoughtKind,'completion-quip');
 const running=fixture();running.agents[0].lastCompletedTask=completed.agents[0].task;await fs.writeFile(file,JSON.stringify(running));
 projected=financialOfficeResponse(withOfficeActivity({threads:[],scannedAt:Date.now(),worksite:{stale:false}},await readOfficeActivity({root})));
 burry=projected.threads.find(t=>t.officeProfileId==='michael-burry');assert.match(burry.officeThought,/wallet|provenance/i);
 running.agents[0].lastCompletedTask='x'.repeat(251);await fs.writeFile(file,JSON.stringify(running));assert.equal((await readOfficeActivity({root})).reason,'invalid');
});
