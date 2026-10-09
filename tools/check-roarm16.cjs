// Isolated renderer exercise: every API request is intercepted. No robot or camera access.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright')
;(async()=>{
 const base=process.env.BOT_CROSSING_TEST_URL
 if(!base||new URL(base).hostname!=='127.0.0.1')throw Error('Existing loopback viewer URL required')
 const {projectMagiState}=await import(pathToFileURL(path.resolve('server/magi.mjs')).href)
 const catalog=JSON.parse(await fs.readFile('../swarm-protocol/personas/roarm16/catalog.json','utf8'))
 const slots=['melchior','balthasar','casper'],ids=['w00','balthasar','casper'],at=Date.now()
 const pilot={workerId:'w00',slotId:'melchior',roleId:'pilot',duty:'on',generation:1,changedAt:at,evidence:'Synthetic visual fixture',history:[{operationId:'fixture-pilot',kind:'enable',generation:1,toWorkerId:'w00',toDuty:'on',at,evidence:'Synthetic visual fixture'}]}
 const state={schemaVersion:1,mode:'live',revision:1,projectId:'roarm16-visual-fixture',observedAt:at,capacity:{total:3,limit:3,running:0,reserved:0,occupied:0},tasks:[],notes:[],milestones:[],workers:ids.map((id,i)=>({id,name:slots[i],status:'idle',bound:false})),magi:{mode:'magi',profile:'roarm-16',personaCount:16,pilot,roleCatalog:catalog.roles,executorSlots:ids.map((workerId,i)=>({workerId,slotId:slots[i],roleId:i?'r05':'pilot',status:'idle',bound:false,occupied:false})),earnedRewards:[],contracts:[]}}
 const browser=await chromium.launch({headless:true,channel:'chrome'}),out='.cache/roarm16';await fs.mkdir(out,{recursive:true})
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/api/**',async route=>{
   const p=new URL(route.request().url()).pathname
   if(p==='/api/magi/world'){state.observedAt=Date.now();return route.fulfill({json:{mode:'magi',...projectMagiState(state)}})}
   if(p==='/api/roarm/observation')return route.fulfill({json:{source:'simulator',state:'live',pose:{base:0,shoulder:.015,elbow:1.595,gripper:3.135},observedAt:new Date().toISOString()}})
   if(p==='/api/magi/colony')return route.fulfill({json:{plots:{},archived:[],seen:Object.fromEntries(Array.from({length:16},(_,i)=>[`magi:w${String(i).padStart(2,'0')}`,1])),settings:{planet:'mars',dayCycle:false,timeOfDay:.46,showLabels:false,tiltShift:false}}})
   return route.fulfill({json:{}})
  })
  await page.goto(base)
  await page.waitForFunction(()=>window.botCrossing?.colony.astronauts.agents.some(a=>a.thread.shellId==='w00'&&a.magiActivity==='pilot'&&a.mounted))
  await page.keyboard.press('Escape')
  const live=await page.evaluate(()=>botCrossing.colony.astronauts.agents.filter(a=>a.state!=='leaving').map(a=>({id:a.thread.shellId,slot:a.thread.executorSlot,role:a.thread.roleId,activity:a.magiActivity,mounted:a.mounted})))
  assert.equal(live.length,16);assert.equal(live.filter(a=>a.activity==='pilot').length,1)
  assert.equal(live.find(a=>a.slot==='balthasar').role,live.find(a=>a.slot==='casper').role)
  await page.evaluate(()=>{
   const {colony,rig}=botCrossing;const a=colony.astronauts.agents.find(a=>a.thread.shellId==='w00')
   rig.focus({x:a.pos.x,y:a.pos.y+.5,z:a.pos.z},{distance:13,elevated:true});rig.desiredAzimuth=Math.PI*1.25;rig.azimuth=rig.desiredAzimuth
   for(let i=0;i<90;i++)rig.update(1/30)
  })
  await page.screenshot({path:out+'/captain-fixture.png'})
  pilot.duty='off';pilot.generation=2;pilot.changedAt=Date.now();pilot.history.push({operationId:'fixture-rest',kind:'duty-change',generation:2,fromDuty:'on',toDuty:'off',at:pilot.changedAt,evidence:'Synthetic software-only break'})
  await page.waitForFunction(()=>botCrossing.colony.astronauts.agents.find(a=>a.thread.shellId==='w00')?.magiActivity==='pilot-rest')
  const rest=await page.evaluate(()=>{const a=botCrossing.colony.astronauts.agents.find(a=>a.thread.shellId==='w00');return {mounted:a.mounted,goal:a.magiGoal.toArray(),camp:botCrossing.colony.worksite.camp.group.position.toArray()}})
  assert.ok(Math.hypot(rest.goal[0]-rest.camp[0],rest.goal[2]-rest.camp[2])<14,'released captain heads to camp')
  pilot.duty='on';pilot.generation=3;pilot.changedAt=Date.now();pilot.history.push({operationId:'fixture-return',kind:'duty-change',generation:3,fromDuty:'off',toDuty:'on',at:pilot.changedAt,evidence:'Synthetic return'})
  await page.waitForFunction(()=>botCrossing.colony.astronauts.agents.find(a=>a.thread.shellId==='w00')?.magiActivity==='pilot')
  await page.evaluate(()=>{
   const {colony,rig,engine}=botCrossing;engine.stop()
   document.querySelector('.worksite-board').hidden=true
   for(const a of colony.astronauts.agents){
    if(['w00','w01'].includes(a.thread.shellId)){a.pos.set(a.thread.shellId==='w00'?-1.3:1.3,0,25);a.yaw=Math.PI/4;a.scale=1;a.state='at-site';a.mounted=false;a.magiSeat=null;a.clipKey='idle'}else a.scale=0
   }
   colony.astronauts._writeMatrices(0,true);rig.focus({x:0,y:1,z:25},{distance:8,elevated:true});rig.desiredAzimuth=Math.PI/4;rig.azimuth=Math.PI/4
   for(let i=0;i<90;i++)rig.update(1/30)
   engine.renderFrame()
  })
  await page.screenshot({path:out+'/captain-suit-fixture.png'})
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,fixture:true,hardwareRequests:0,personas:16,sameRoleSeparateSlots:true,pilotCab:true,restAndReturn:true,pageErrors:errors}))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
