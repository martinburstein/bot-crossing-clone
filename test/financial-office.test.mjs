import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {OFFICE_PROFILES,financialOfficeResponse} from '../src/office/profiles.js';
import {createFinancialOffice} from '../src/world/financial-office.js';
import {createOfficeSuit} from '../src/world/office-suit.js';
import {FREE_CAMPUS} from '../src/world/free-campus-layout.js';
import {Navigation} from '../src/agents/navigation.js';
import {MagiLife} from '../src/agents/magi-life.js';
import {readOfficeHistory} from '../server/financial-office.mjs';

test('office meshes are renderable; eight desks replace the hexes and civic positions remain canonical',()=>{
  const scene=new THREE.Scene(),world=createFinancialOffice(scene);
  const bad=[];scene.traverse(o=>{if(!o.isMesh)return;
    if(![o.material].flat().every(m=>m?.isMaterial))bad.push(o.name+' material');
    for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v)){bad.push(o.name+' geometry');break;}
  });assert.deepEqual(bad,[]);
  assert.equal(world.desks.length,8);assert.equal(new Set(world.desks.map(d=>d.userData.profileId)).size,8);
  assert.deepEqual(world.camp.group.position.toArray(),[0,0,-49]);
  for(const id of ['melchior','balthasar','casper']){
    const core=world.cores[id];assert.deepEqual(core.position.toArray(),[FREE_CAMPUS[id].x,0,FREE_CAMPUS[id].z]);
    assert.equal(core.rotation.y,FREE_CAMPUS[id].angle);assert.equal(core.visible,true);
  }
  assert.equal(world.board.parent,null);assert.equal(world.board.getObjectByName('bounty-board-readable-face'),undefined);
  for(const c of world.campusGroup.children)if(c.visible)assert.ok(c.name==='free-campus-common'||c.name.startsWith('campus-supercomputer-'),c.name);
  assert.equal(world.snapshot().hangar,false);assert.equal(world.snapshot().crane,false);world.dispose();
});

test('eight persistent characters project at most three evidenced, fresh worker bindings',()=>{
  const slots=['melchior','balthasar','casper'];
  const threads=OFFICE_PROFILES.map((p,i)=>({taskTitle:`${p.name} [simulation] — research`,runId:'crypto-swarm-2026-10-15',shellId:'w'+i,running:true,assignmentState:'running',clusterId:slots[i%3],workerBackend:'codex-session'}));
  const response={scannedAt:Date.now(),threads,worksite:{stale:false}};
  const p=financialOfficeResponse(response);assert.equal(p.threads.length,8);assert.equal(p.threads.filter(t=>t.running).length,3);
  assert.equal(new Set(p.threads.map(t=>t.suitColor)).size,8);
  for(const s of p.worksite.executorSlots)assert.equal(p.threads.filter(t=>t.running&&t.clusterId===s.slotId).length,1);
  for(const invalid of [{...response,scannedAt:Date.now()-21000},{...response,worksite:{stale:true}},
    {...response,threads:threads.map(t=>({...t,workerBackend:null}))},
    {...response,threads:threads.map(t=>({...t,taskTitle:'unrelated'}))},
    {...response,threads:threads.map(t=>({...t,runId:'another-project'}))}]){
    const q=financialOfficeResponse(invalid);assert.equal(q.threads.length,8);assert.equal(q.threads.some(t=>t.running),false);
  }
});

test('all desk, campfire and MAGI approaches remain reachable without a hangar fleet',()=>{
  const scene=new THREE.Scene(),world=createFinancialOffice(scene),nav=new Navigation({half:144,maxExpansions:16000});
  nav.rebuild(world.obstacles());
  const agents=financialOfficeResponse().threads.map(thread=>({thread,state:'idle',pos:new THREE.Vector3(),id:thread.id}));
  const life=new MagiLife(scene,{get:()=>false}),colony={worksite:world,worksiteProjection:{sceneLayout:'financial-office'}};
  life.sync(agents,colony);life.update(agents,colony,1);
  assert.ok(!life.hangar);assert.equal(life.fleet.size,0);assert.equal(life.pilotKey.visible,false);
  for(const a of agents){
    const stops=Array.from({length:6},(_,i)=>world.target(a.thread,i*22));
    for(const stop of stops){assert.equal(nav.isBlocked(stop.position.x,stop.position.z),false,`${a.id} ${stop.activity}`);
      assert.ok(nav.findPath(0,26,stop.position.x,stop.position.z),`${a.id} ${stop.activity} route`);}
    for(const clusterId of ['melchior','balthasar','casper']){
      const stop=world.target({...a.thread,running:true,clusterId},0);assert.equal(stop.activity,'office-work');
      assert.equal(nav.isBlocked(stop.position.x,stop.position.z),false);assert.ok(nav.findPath(0,26,stop.position.x,stop.position.z));
    }
  }life.dispose();world.dispose();
});

test('eight cloth masks retain the original body without a rigid second jacket',()=>{
  for(const p of OFFICE_PROFILES){
    const suit=createOfficeSuit(p.id);assert.equal(suit.userData.textureMask,true);assert.equal(suit.children.length,0);
    suit.update(new THREE.Matrix4().makeScale(1.85,1.85,1.85),new THREE.Matrix4().makeTranslation(0,2,0),new THREE.Matrix4().makeTranslation(0,1,0));
    suit.updateMatrixWorld(true);suit.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.isMesh)assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));});
    suit.dispose();suit.dispose();
  }
});

test('a real campfire task gathers eight distinct seats while three MAGI units keep their real activity',()=>{
  const response={scannedAt:Date.now(),threads:OFFICE_PROFILES.slice(0,3).map((p,i)=>({runId:'crypto-swarm-2026-10-15',taskTitle:`${p.name} [simulation] — Campfire discussion`,running:true,assignmentState:'running',workerBackend:'codex-cli',clusterId:['melchior','balthasar','casper'][i]}))};
  const value=financialOfficeResponse(response),world=createFinancialOffice(new THREE.Scene());world.update(value.worksite);
  assert.equal(value.worksite.office.council,true);assert.equal(value.worksite.office.active,3);
  const seats=value.threads.map(t=>world.target(t,0));assert.ok(seats.every(s=>s.activity==='talk'));
  assert.equal(new Set(seats.map(s=>`${s.position.x},${s.position.z}`)).size,8);
  for(const s of seats)assert.ok(Math.hypot(s.position.x,s.position.z+49)<11);
  for(const core of Object.values(world.cores))assert.equal(core.userData.unitState,'running');
  world.dispose();
});

test('office history fails closed on checksum tampering and the original canon bytes remain preserved',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'office-history-test-'));
  try{
    const entries=[{id:'source-note-one',speaker:'office',kind:'source-note',text:'A sourced observation.',sources:['research/source.md']}];
    const digest=createHash('sha256').update(JSON.stringify(entries)).digest('hex');
    await fs.writeFile(path.join(root,'history.json'),JSON.stringify({schemaVersion:1,entries,digest}));
    assert.equal((await readOfficeHistory({root})).available,true);
    entries[0].text='Tampered';await fs.writeFile(path.join(root,'history.json'),JSON.stringify({schemaVersion:1,entries,digest}));
    assert.equal((await readOfficeHistory({root})).available,false);
    const canon=await fs.readFile(new URL('../CANON-VISUAL.json',import.meta.url)),copy=await fs.readFile(new URL('../visuals/financial-office/canon-source.json',import.meta.url));
    const spec=JSON.parse(await fs.readFile(new URL('../FINANCIAL-OFFICE.json',import.meta.url),'utf8'));
    assert.deepEqual(copy,canon);assert.equal(createHash('sha256').update(canon).digest('hex'),spec.basedOn.sha256);
    const prior=await fs.readFile(new URL('../visuals/canon-archive/CANON-VISUAL-2026-10-15.json',import.meta.url));
    assert.equal(createHash('sha256').update(prior).digest('hex'),'074f339b3fa810119a838b64785fda1ebfbd8ca237fa2be965abc1afaffb0c0b');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
