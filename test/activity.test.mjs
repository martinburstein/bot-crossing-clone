import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, appendFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createSeats} from '../server/activity.mjs';
import {makeRoute} from '../src/idle-routes.js';
import {PROFILES} from '../src/profiles.js';
import {createMotion} from '../src/live-motion.js';
test('anonymous stable seats, release, overflow and archived exclusion',()=>{
 const project=createSeats(),thread=i=>({id:`secret-${i}`,title:'private title',running:true,lastActivityAt:i});
 const first=project([thread(1),thread(2)]);assert.equal(first.active,2);assert.equal(first.seats[0].working,true);
 assert.equal(JSON.stringify(first).includes('secret'),false);assert.equal(JSON.stringify(first).includes('private'),false);
 const next=project([thread(1)]);assert.equal(next.seats[0].working,false);assert.equal(next.seats[1].working,true);
 const full=project(Array.from({length:11},(_,i)=>thread(i)));assert.equal(full.overflow,3);assert.equal(full.seats.filter(s=>s.working).length,8);
 assert.equal(project([{...thread(1),archived:true}]).active,0);
});
test('a requested character receives the bound active agent without duplicate seats',()=>{
 const project=createSeats([{index:4,id:'lilac-job'}]);
 const result=project([{id:'lilac-job',running:true,lastActivityAt:1},{id:'other',running:true,lastActivityAt:2}]);
 assert.equal(result.seats[4].working,true);assert.equal(result.seats.filter(s=>s.working).length,2);
 assert.equal(project([{id:'other',running:true,lastActivityAt:2}]).seats[4].working,false);
});
test('every route position reaches its desk then stands and resumes without jumping',()=>{
 for(const p of PROFILES)for(let offset=0;offset<180;offset+=5){
  const motion=createMotion(makeRoute(p),offset);let pose=motion.step(0,false),seated=false;
  for(let i=0;i<3600;i++){const previous=pose;pose=motion.step(1/60,true);
   assert.ok(Math.hypot(pose.x-previous.x,pose.z-previous.z)<.061);
   if(pose.mode==='typing'){seated=true;break;}
  }
  assert.ok(seated,`desk ${p.index}, offset ${offset}`);assert.equal(pose.x,p.desk.x);assert.equal(pose.z,p.desk.z+3.8);
  for(let i=0;i<120;i++)pose=motion.step(1/60,false);
  assert.equal(pose.seated,0);assert.notEqual(pose.mode,'typing');
 }
});
test('canonical scanner follows real lifecycle envelopes, including subagents and interruption',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'office-feed-test-'));
 try{
  const sessions=path.join(dir,'sessions','2026','10','20');await mkdir(sessions,{recursive:true});
  const id='11111111-1111-4111-8111-111111111111',file=path.join(sessions,`rollout-${id}.jsonl`);
  const record=payload=>JSON.stringify({timestamp:new Date().toISOString(),type:'event_msg',payload})+'\n';
  await writeFile(file,JSON.stringify({type:'session_meta',payload:{id,cwd:dir,source:{subagent:{thread_spawn:{parent_thread_id:'22222222-2222-4222-8222-222222222222',agent_path:'/worker'}}}}})+'\n'+record({type:'task_started'}));
  const adapter=new URL('../server/harnesses/codex.mjs',import.meta.url).href;
  const scan=()=>{const result=spawnSync(process.execPath,['--input-type=module','-e',`const {default:a}=await import(${JSON.stringify(adapter)});console.log(JSON.stringify((await a.scanThreads()).map(t=>({running:t.running,isSubagent:t.isSubagent}))));`],{env:{...process.env,CODEX_HOME:dir,BOT_CROSSING_INCLUDE_SUBAGENTS:'1',BOT_CROSSING_PARENT_THREAD_ID:''},encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);};
  assert.deepEqual(scan(),[{running:true,isSubagent:true}]);
  await appendFile(file,record({type:'task_complete'}));assert.equal(scan()[0].running,false);
  await appendFile(file,record({type:'task_started'}));assert.equal(scan()[0].running,true);
  await appendFile(file,record({type:'turn_aborted'}));assert.equal(scan()[0].running,false);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('office-feed-test-'));await rm(dir,{recursive:true,force:true});}
});
