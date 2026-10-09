// Synthetic campus test. Every API call is intercepted; no hardware or camera.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright')
;(async()=>{
 const base=process.env.BOT_CROSSING_TEST_URL;if(!base||new URL(base).hostname!=='127.0.0.1')throw Error('Existing loopback viewer required')
 const {projectMagiState}=await import(pathToFileURL(path.resolve('server/magi.mjs')).href)
 const roles=JSON.parse(await fs.readFile('../swarm-protocol/personas/campus/catalog.json','utf8')).roles,ids=['w00','balthasar','casper'],slots=['melchior','balthasar','casper']
 const c={schemaVersion:1,cycleNumber:0,activeRoleId:'r13',chargingRoleId:'r01',campRoleIds:roles.map(r=>r.id).filter(id=>!['r13','r01'].includes(id)),mode:'awake',phase:'awaiting-instructions',pilot:{instructionGeneration:1,instructionState:'station'},campMemory:[]}
 const state={schemaVersion:1,mode:'live',revision:1,projectId:'campus-synthetic-test',observedAt:Date.now(),capacity:{total:3,limit:3,running:0,reserved:0,occupied:0},tasks:[],notes:[],milestones:[],workers:ids.map((id,i)=>({id,name:slots[i],status:'idle',bound:false})),magi:{mode:'magi',profile:'roarm-campus',personaCount:17,pilot:{workerId:'w00',duty:'on'},roleCatalog:roles,executorSlots:ids.map((workerId,i)=>({workerId,slotId:slots[i],roleId:['pilot','camper','r13'][i],status:'idle',bound:false,occupied:false})),campus:c,earnedRewards:[],contracts:[]}}
 const browser=await chromium.launch({headless:true,channel:'chrome'}),out='.cache/campus';await fs.mkdir(out,{recursive:true})
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname
   if(p==='/api/magi/world'){state.observedAt=Date.now();return route.fulfill({json:{mode:'magi',...projectMagiState(state)}})}
   if(p==='/api/roarm/observation')return route.fulfill({json:{source:'simulator',state:'live',pose:{base:0,shoulder:.015,elbow:1.595,gripper:3.135},observedAt:new Date().toISOString()}})
   if(p==='/api/magi/colony')return route.fulfill({json:{plots:{},archived:[],seen:Object.fromEntries(Array.from({length:17},(_,i)=>[`magi:w${String(i).padStart(2,'0')}`,1])),settings:{planet:'mars',dayCycle:false,timeOfDay:.46,showLabels:false,tiltShift:false}}})
   return route.fulfill({json:{}})
  })
  await page.goto(base);await page.waitForFunction(()=>window.botCrossing?.colony.worksite?.profile==='roarm-campus');await page.waitForFunction(()=>document.querySelector('.boot')?.hidden!==false)
  await page.waitForFunction(()=>botCrossing.colony.astronauts.agents.filter(a=>a.state!=='leaving'&&a.state!=='gone').length===17)
  await page.keyboard.press('Escape')
  // Fast-forward only the scene's movement to inspect completed visual routes.
  await page.evaluate(()=>{const {colony,rig}=botCrossing;for(let i=0;i<2400;i++)colony.astronauts.update(1/30,performance.now()/1000+i/30);rig.focus({x:5,y:2,z:-38},{distance:76,elevated:true});rig.desiredAzimuth=Math.PI*.08;rig.azimuth=rig.desiredAzimuth;for(let i=0;i<90;i++)rig.update(1/30)})
  const snapshot=await page.evaluate(()=>{const {colony}=botCrossing;return {pods:colony.worksite.pods.length,seats:colony.worksite.seats.length,roots:colony.worksite.roots.length,agents:colony.astronauts.agents.filter(a=>!['leaving','gone'].includes(a.state)).map(a=>({id:a.thread.shellId,role:a.thread.roleId,position:a.pos.toArray(),goal:a.magiGoal?.toArray(),mounted:a.mounted,activity:a.magiActivity,settled:a.magiSettled}))}})
  assert.ok(snapshot.agents.filter(a=>/^r/.test(a.role)).every(a=>a.settled),'All executor bodies reach their assigned campus location');assert.equal(snapshot.pods,15);assert.equal(snapshot.seats,13);assert.equal(snapshot.agents.length,17);assert.equal(snapshot.agents.find(a=>a.role==='pilot').mounted,true)
  await page.screenshot({path:out+'/campus-awake-fixture.png'})
  await page.evaluate(()=>{const {rig,colony}=botCrossing;const a=colony.astronauts.agents.find(a=>a.thread.roleId==='pilot');rig.focus({x:a.pos.x,y:a.pos.y+.5,z:a.pos.z},{distance:13,elevated:true});rig.desiredAzimuth=Math.PI*1.25;rig.azimuth=rig.desiredAzimuth;for(let i=0;i<90;i++)rig.update(1/30)})
  await page.screenshot({path:out+'/campus-pilot-fixture.png'})
  await page.evaluate(()=>{const {rig}=botCrossing;rig.focus({x:12,y:2,z:-38},{distance:78,elevated:true});rig.desiredAzimuth=Math.PI*.08;rig.azimuth=rig.desiredAzimuth;for(let i=0;i<90;i++)rig.update(1/30)})
  c.mode='sleeping';c.phase='sleeping';c.pilot.instructionState='sleep';state.revision++
  await page.waitForFunction(()=>botCrossing.colony.worksiteProjection?.campus?.mode==='sleeping')
  await page.evaluate(()=>{const {colony}=botCrossing;for(let i=0;i<2400;i++)colony.astronauts.update(1/30,performance.now()/1000+i/30)})
  const sleeping=await page.evaluate(()=>{const {colony}=botCrossing;return {occupied:colony.worksite.pods.filter(p=>p.userData.occupied).length,goals:colony.astronauts.agents.filter(a=>/^r/.test(a.thread.roleId)).map(a=>({role:a.thread.roleId,goal:a.magiGoal.toArray()})),fleet:colony.astronauts.magiLife.fleet.size}})
  assert.equal(sleeping.occupied,15);assert.equal(new Set(sleeping.goals.map(a=>a.goal.join(','))).size,15);assert.equal(sleeping.fleet,0)
  await page.screenshot({path:out+'/campus-sleep-fixture.png'});assert.deepEqual(errors,[])
  await fs.writeFile(out+'/fixture-verification.json',JSON.stringify({synthetic:true,hardwareRequests:0,snapshot,sleeping,errors},null,2));console.log(JSON.stringify({passed:true,synthetic:true,bodies:17,pods:15,seats:13,sleepingPods:15,hardwareRequests:0,pageErrors:errors}))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
