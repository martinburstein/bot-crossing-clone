import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as THREE from 'three'
import {tokenConstruction,allocateMagiCells,standbyMagiThreads,MAGI_CLUSTERS,magiOnShift,magiShiftLabel,magiCrewStatus} from '../src/game/magi-world.js'
import {usageFromEvents,readMagiTokens} from '../server/magi-tokens.mjs'
import {VEHICLES,createVehicle} from '../src/world/mars-vehicles.js'
import {idlePlan,MagiLife} from '../src/agents/magi-life.js'

test('MAGI task outcomes present off-shift crew without rewriting task state',()=>{
 const base=standbyMagiThreads()[0]
 for(const assignmentState of ['failed','blocked','unknown','reserved','submitted','accepted','idle']) {
  const thread={...base,assignmentState,hasError:assignmentState==='failed',unread:true,shellStatus:'Failed'}
  const before=JSON.stringify(thread),status=magiCrewStatus(thread)
  assert.equal(status,'idle');assert.equal(magiOnShift(thread),false);assert.equal(magiShiftLabel(thread),'Idle')
  assert.equal(JSON.stringify(thread),before)
 }
 for(const assignmentState of ['running','reviewing']) {
  const thread={...base,assignmentState,running:true}
  assert.equal(magiCrewStatus(thread),'working');assert.equal(magiShiftLabel(thread),'On shift')
  assert.equal(magiCrewStatus({...thread,hasError:true}),'idle')
 }
})

test('token awards respect boundaries, ignore tasks, and bound rendering without losing earned counts',()=>{
 const plan=n=>tokenConstruction({tokenUsage:n===null?null:{total:n},milestones:Array(20).fill({level:'major'})})
 assert.equal(plan(null).measured,false);assert.equal(plan(-1).cells,1)
 assert.equal(plan(24999).structures.length,0);assert.equal(plan(25000).structures.length,1)
 assert.equal(plan(249999).cells,1);assert.equal(plan(250000).cells,2)
 assert.equal(plan(250000).structures.length,6);assert.equal(plan(250000).structures.filter(s=>s.level===2).length,4)
 assert.equal(plan(275000).structures.length,7);assert.equal(plan(250000).nextHex,250000)
 const big=plan(20_000_000);assert.equal(big.cells,61);assert.equal(big.major,80);assert.equal(big.deferredHexagons,20)
})
test('15 homes have one color, three disconnected five-cell clusters, and preserve camps through growth',()=>{
 const threads=standbyMagiThreads();assert.equal(new Set(threads.map(t=>t.shellColor)).size,1);assert.equal(threads.some(t=>t.running),false)
 const projects=threads.map(t=>({...t,cells:1})),base=allocateMagiCells(projects)
 const adjacent=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r))===1
 for(let start=0;start<15;start+=5){const cells=projects.slice(start,start+5).map(t=>base.get(t.id)[0]);assert.ok(cells.every(c=>cells.some(d=>adjacent(c,d))));for(const other of projects.filter((_,i)=>i<start||i>=start+5))assert.ok(cells.every(c=>!adjacent(c,base.get(other.id)[0])))}
 const expanded=allocateMagiCells(projects.map((p,i)=>({...p,cells:i===0?61:7})),base)
 const keys=[...expanded.values()].flat().map(c=>`${c.q},${c.r}`);assert.equal(keys.length,new Set(keys).size)
 for(const p of projects)assert.deepEqual(expanded.get(p.id)[0],base.get(p.id)[0])
 for(const c of MAGI_CLUSTERS)assert.ok(!keys.includes(`${c.q},${c.r}`))
 assert.deepEqual(allocateMagiCells(projects.map((p,i)=>({...p,cells:i===0?61:7})),expanded),expanded)
})
test('usage parser excludes cached input, ignores partial/malformed events and does not double count repeated terminal records',()=>{
 const event={type:'turn.completed',usage:{input_tokens:30000,cached_input_tokens:10000,output_tokens:5000}}
 assert.equal(usageFromEvents([JSON.stringify(event),'{bad',JSON.stringify(event)].join('\n')).total,25000)
 assert.equal(usageFromEvents(JSON.stringify({type:'turn.started',usage:event.usage})),null)
 assert.equal(usageFromEvents(JSON.stringify({...event,usage:{input_tokens:1,cached_input_tokens:2,output_tokens:1}})),null)
})
test('receipts are exact-identity scoped, durable, deduplicated across polls, and isolated between projects',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'magi-tokens-'));t.after(()=>fs.rm(root,{recursive:true,force:true}))
 const cacheFile=path.join(root,'viewer','cache.json'),storeDirectory=path.join(root,'protocol'),projection={projectId:'one',revision:4,workers:standbyMagiThreads().map(t=>({id:t.shellId}))}
 const lease={id:'lease/1',turnToken:'turn/1',workerId:'w01',clusterId:'melchior'}
 const state={format:1,state:{projectId:'one',revision:4,magi:{mode:'magi'},leases:{a:lease,b:lease}}}
 const receipt=path.join(storeDirectory,'executor',Buffer.from(lease.id).toString('base64url'),Buffer.from(lease.turnToken).toString('base64url'))
 await fs.mkdir(receipt,{recursive:true});await fs.writeFile(path.join(storeDirectory,'state.json'),JSON.stringify(state))
 await fs.writeFile(path.join(receipt,'intent.json'),JSON.stringify({leaseId:lease.id,turnToken:lease.turnToken,workerId:'melchior'}))
 await fs.writeFile(path.join(receipt,'events.jsonl'),JSON.stringify({type:'turn.completed',usage:{input_tokens:30000,cached_input_tokens:10000,output_tokens:5000}}))
 const options={storeDirectory,cacheFile},read=()=>readMagiTokens(projection,options)
 assert.equal((await read()).get('w01').total,25000);assert.equal((await read()).get('w01').completedTurns,1)
 assert.equal((await read()).get('w02').total,0)
 await fs.rename(path.join(receipt,'events.jsonl'),path.join(receipt,'events-saved.jsonl'))
 const cached=(await read()).get('w01');assert.equal(cached.total,25000);assert.equal(cached.cached,true);assert.equal(cached.pendingTurns,1)
 assert.equal((await readMagiTokens({...projection,projectId:'two'},options)).size,0)
 state.state.revision=5;await fs.writeFile(path.join(storeDirectory,'state.json'),JSON.stringify(state));assert.equal((await read()).get('w01').total,25000)
 state.state.revision=4;state.state.leases={a:{...lease,turnToken:'bad-turn'}};await fs.writeFile(path.join(storeDirectory,'state.json'),JSON.stringify(state));assert.equal((await read()).get('w01').total,25000)
})
test('idle plans pair available bots and rotate through all four activities without pairing with active workers',()=>{
 const ids=new Set(standbyMagiThreads().map(t=>t.shellId))
 for(const id of ids){const activities=new Set();for(let epoch=0;epoch<5;epoch++){const p=idlePlan(id,epoch*64,ids);activities.add(p.activity);if(p.activity==='talk')assert.equal(idlePlan(p.peer,epoch*64,ids).peer,id)}assert.deepEqual([...activities].sort(),['board','snack','talk','tinker'])}
 const p=idlePlan('w01',0,new Set(['w01']));assert.notEqual(p.activity,'talk')
})
test('fleet covers eight sets and every model has finite geometry, a seat, bounded footprint and movable mechanisms',()=>{
 assert.equal(VEHICLES.length,11);assert.equal(new Set(VEHICLES.map(v=>v.set)).size,8)
 const wheelCounts={'drill-unit':6,'cargo-rover':6,'drill-pod':2,trike:3,'mining-truck':4,'claw-tank':2}
 for(const v of VEHICLES){const m=createVehicle(v.id);assert.ok(m.userData.seat.toArray().every(Number.isFinite));assert.ok(m.userData.footprint<=2.36);if(wheelCounts[v.id])assert.equal(m.userData.wheels.length,wheelCounts[v.id]);m.userData.animate(2,true);m.traverse(o=>{if(o.geometry)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite))});m.userData.dispose()}
})
test('compact hangar rents only for confirmed work, returns vehicles, and reuses its three bays',()=>{
 const scene=new THREE.Scene(),life=new MagiLife(scene,{transient:true,get:()=>false}),threads=standbyMagiThreads()
 const agents=threads.map(t=>({id:t.id,thread:t,status:'idle',state:'at-site',home:new THREE.Vector3(40,0,0),pos:new THREE.Vector3(40,0,0)}))
 const world={groundAt:()=>.45};let time=0
 const tick=(n=1)=>{for(let i=0;i<n;i++)life.update(agents,world,time+=.1)}
 life.sync(agents,world);tick();assert.equal(life.fleet.size,0);assert.equal(life.hangar.bays.filter(b=>b.model).length,3)
 const a=agents[0];a.status='working';a.thread.running=true;a.thread.assignmentState='running';tick()
 let item=life.fleet.get(a.id);a.pos.copy(item.dock);tick(60)
 assert.equal(a.mounted,true);assert.equal(item.active,true);assert.equal(item.phase,'working');assert.notDeepEqual(item.model.position,a.home)
 const travelled=item.rolling;tick(200);assert.ok(item.rolling>travelled+1,'working vehicle resumes its route after operating at an outer work stop')
 a.thread.running=false;a.thread.assignmentState='unknown';a.status='idle';tick()
 assert.equal(item.active,false);assert.equal(item.phase,'parked');tick(60)
 assert.equal(a.mounted,false);assert.ok(['talk','tinker','board','snack'].includes(a.magiActivity));assert.equal(life.fleet.size,0);assert.equal(life.hangar.bays.filter(b=>b.model).length,3)
 for(const worker of [agents[1],agents[5],agents[10],agents[2]]){worker.thread.running=true;worker.thread.assignmentState='running';worker.status='working'}tick()
 assert.equal(life.fleet.size,3);assert.equal(life.hangar.bays.filter(b=>b.rented).length,3)
 const next=agents[1];const previous=life.fleet.get(next.id);life.choose(next.thread.shellId,'claw-tank');tick(2)
 item=life.fleet.get(next.id);assert.equal(item.choice,'claw-tank');assert.notEqual(item.model,previous.model)
 life.dispose();assert.equal(scene.children.length,0)
})

test('drilling rover retains its approved heading and seat fit, then parks immediately when work stops',()=>{
 const scene=new THREE.Scene(),life=new MagiLife(scene,{transient:true,get:()=>false}),thread=standbyMagiThreads()[0]
 const agent={id:thread.id,thread,status:'working',state:'at-site',home:new THREE.Vector3(40,0,0),pos:new THREE.Vector3(40,0,0)}
 thread.running=true;thread.assignmentState='running';const world={groundAt:()=>.45},agents=[agent];let time=0
 const tick=()=>life.update(agents,world,time+=.1)
 life.choose(thread.shellId,'cargo-rover');life.sync(agents,world);tick()
 const item=life.fleet.get(agent.id);agent.pos.copy(item.dock);tick()
 const data=item.model.userData,yAxis=new THREE.Vector3(0,1,0)
 assert.ok(Math.abs(data.seatYaw-Math.PI)<1e-9)
 assert.ok(new THREE.Vector3(0,0,-1).applyQuaternion(item.model.quaternion).z>.99,'drill end points out of the bay')
 assert.ok(new THREE.Vector3(0,0,1).applyAxisAngle(yAxis,agent.magiYaw).z>.99,'pilot faces drill end')
 const expected=data.seat.clone().applyQuaternion(item.model.quaternion).add(item.model.position)
 assert.ok(agent.magiSeat.distanceTo(expected)<1e-9)
 let angle=data.wheels[0].rotation.x;tick()
 assert.ok(data.wheels[0].rotation.x<angle,'outbound wheels turn toward the drill')
 angle=data.wheels[0].rotation.x;agent.status='idle';thread.running=false;tick()
 assert.equal(item.phase,'parked');assert.equal(life.fleet.size,0);assert.equal(data.wheels[0].rotation.x,0,'inactive vehicle mechanisms stop')
 life.dispose()
})
