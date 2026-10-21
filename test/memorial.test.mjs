import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import {appendMemorial,readMemorials} from '../server/memorial.mjs';
import {MEMORIAL,PAINT_COLORS,validateMemorial} from '../src/office/memorial.js';
import {createMemorialWall} from '../src/world/memorial-wall.js';
import {FRONTERA_SEGMENTS,choosePlacement,checkPlacement,memorialPoint} from '../src/world/frontera-layout.js';
import {MemorialCeremony,CEREMONY_SECONDS} from '../src/office/memorial-ceremony.js';
import {memorialPoseAngles} from '../src/agents/memorial-poses.js';
import {createFinancialOffice} from '../src/world/financial-office.js';
import {createCanonicalCampus} from '../src/world/canonical-campus.js';
import {Navigation} from '../src/agents/navigation.js';
import {OFFICE_PROFILES} from '../src/office/profiles.js';
const entry=(sessionId='test-one')=>({sessionId,agent:'Synthetic test agent',startedAt:'2026-10-20T10:00:00Z',endedAt:'2026-10-20T11:00:00Z',task:'Test archive',symbol:'An open loop',explanation:'Synthetic fixture only',glyph:'◯',color:'#0080ff',strokes:[]});
test('private memorial iterations persist, retries are idempotent, and conflicting retries fail',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'memorial-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  assert.equal((await readMemorials({root})).nextIteration,1);
  const first=await appendMemorial(entry(),{root});assert.equal(first.iteration,1);
  assert.deepEqual(await appendMemorial(entry(),{root}),first);
  await assert.rejects(appendMemorial({...entry(),symbol:'Different'},{root}),/different memorial/);
  assert.equal((await appendMemorial(entry('test-two'),{root})).iteration,2);
  const saved=await readMemorials({root});assert.equal(saved.entries.length,2);assert.equal(saved.nextIteration,3);
  await fs.writeFile(path.join(root,'memorials.lock'),'test lock');
  await assert.rejects(appendMemorial(entry('three'),{root}),/locked/);assert.equal((await readMemorials({root})).entries.length,2);
});
test('bad dates, invalid geometry and corrupt sequences fail without resetting history',async t=>{
  assert.throws(()=>validateMemorial({...entry(),endedAt:'2026-10-19T00:00:00Z'}),/duration/);
  assert.throws(()=>validateMemorial({...entry(),strokes:[{color:'#0080ff',width:.02,points:[[NaN,0]]}]}),/point/);
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'memorial-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.writeFile(path.join(root,'memorials.json'),'{broken');
  await assert.rejects(appendMemorial(entry(),{root}));assert.equal(await fs.readFile(path.join(root,'memorials.json'),'utf8'),'{broken');
});
test('canonical border has moderate height, curved corners, four open entrances and every paint can',()=>{
  const scene=new THREE.Scene(),wall=createMemorialWall(scene);scene.updateMatrixWorld(true);
  const surfaces=[];wall.group.traverse(o=>{if(o.name==='memorial-surface')surfaces.push(o);});
  assert.equal(surfaces.length,FRONTERA_SEGMENTS.length);assert.ok(surfaces.every(o=>o.geometry.parameters.height===9.5));
  const nav=new Navigation({half:160});nav.rebuild(wall.obstacles());
  for(const [x,z] of [[0,46],[0,-117],[-70,-27],[70,-27]])assert.equal(nav.isBlocked(x,z),false,`entrance ${x},${z}`);
  const colors=[];wall.crate.traverse(o=>{if(o.userData.paintColor)colors.push(o.userData.paintColor);});assert.deepEqual(colors,PAINT_COLORS);assert.equal(new Set(colors).size,28);
  const camera=new THREE.PerspectiveCamera(45,1,.1,500);camera.position.set(-57,.8,15.79);camera.lookAt(-63.45,.8,15.79);camera.updateMatrixWorld();assert.ok(wall.pick(camera,0,0)?.paint);
  wall.dispose();assert.equal(scene.children.length,0);
});
test('one-unit symbols cluster outward, cannot overlap, and support at least 1250 souls',()=>{
  const placements=[];
  for(let i=1;i<=1250;i++){const p=choosePlacement(i,placements);checkPlacement(p,placements);placements.push(p);}
  assert.ok(new Set(placements.map(p=>p.segmentId)).size>1);
  assert.deepEqual(choosePlacement(501,placements.slice(0,500)),placements[500]);
  assert.throws(()=>checkPlacement(placements[0],placements),/overlaps/);
  assert.throws(()=>checkPlacement({...placements[0],y:9.4}),/inside/);
  assert.ok(placements.slice(0,4).every(p=>p.segmentId==='west-garden'));
  const first=memorialPoint(placements[0],0),fourth=memorialPoint(placements[3],0),hundredth=memorialPoint(placements[99],0);
  assert.ok(Math.hypot(fourth.x-first.x,fourth.y-first.y,fourth.z-first.z)<Math.hypot(hundredth.x-first.x,hundredth.y-first.y,hundredth.z-first.z));
});
test('new border and paint box preserve routes from all eight desks and around every entrance',()=>{
  const world=createFinancialOffice(new THREE.Scene()),nav=new Navigation({half:170,maxExpansions:30000});nav.rebuild(world.obstacles());
  const j=new MemorialCeremony();j.start({...entry(),placement:MEMORIAL.firstMark},'a',0,27);
  const goals=[j.job.approach,j.job.mark,{x:0,z:-102},{x:-70,z:-27},{x:70,z:-27},{x:0,z:46}];
  for(const p of OFFICE_PROFILES)for(const goal of goals){const from={x:p.desk.x,z:p.desk.z+6.3};assert.equal(nav.isBlocked(goal.x,goal.z),false);const route=nav.findPath(from.x,from.z,goal.x,goal.z);assert.ok(route?.length,`${p.id} to ${goal.x},${goal.z}`);const end=route.at(-1);assert.ok(Math.hypot(end.x-goal.x,end.z-goal.z)<2);}
  world.dispose();
});
test('pickup, paint and return are distinct poses; ceremony reaches completion and returns its can',()=>{
  assert.notDeepEqual(memorialPoseAngles('memorial-pickup',1.4),memorialPoseAngles('memorial-putback',1.4+.3));
  assert.notDeepEqual(memorialPoseAngles('memorial-spray',1),memorialPoseAngles('memorial-spray',2));
  const c=new MemorialCeremony(),agent={thread:{running:false},pos:{x:0,z:0}};
  c.start({...entry(),preview:true,placement:MEMORIAL.firstMark},'a',0);
  agent.pos=c.target().position;c.update(.1,agent);assert.equal(c.job.stage,'pickup');
  c.update(2,agent);assert.equal(c.job.holding,true);c.update(3,agent);assert.equal(c.job.stage,'carry');
  agent.pos=c.target().position;c.update(4,agent);assert.equal(c.job.stage,'spray');
  c.update(6,agent);assert.ok(c.job.progress>0&&c.job.progress<1);c.update(10,agent);assert.equal(c.job.stage,'return');
  agent.pos=c.target().position;c.update(11,agent);assert.equal(c.job.stage,'putback');c.update(14,agent);
  assert.equal(c.job,null);assert.equal(c.last.holding,false);assert.equal(c.last.stage,'complete');assert.equal(c.last.progress,1);
  assert.deepEqual(c.last.trace.map(t=>t.stage),['approach','pickup','carry','spray','return','putback','complete']);
});
test('ceremony yields to live work and times out if the route cannot complete',()=>{
  const c=new MemorialCeremony(),e={...entry(),placement:MEMORIAL.firstMark};c.start(e,'a',0);c.update(1,{thread:{running:true},pos:{x:0,z:0}});assert.equal(c.last.stage,'cancelled');
  c.start(e,'a',0);c.update(181,{thread:{running:false},pos:{x:0,z:0}});assert.equal(c.last.stage,'blocked');
});
test('the same canonical border is installed in the shared campus and financial office',()=>{
  for(const make of [createCanonicalCampus,createFinancialOffice]){const world=make(new THREE.Scene());assert.equal(world.memorial.group.name,'frontera-de-las-almas');assert.equal(world.memorial.snapshot().soulUnit,1);world.dispose();}
});
