// Isolated visual fixture: all API calls intercepted, never contacts the robot.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright')
;(async()=>{
 const base=process.env.BOT_CROSSING_TEST_URL
 if(!base||new URL(base).hostname!=='127.0.0.1')throw Error('Existing loopback Vite URL required')
 const {standbyMagiThreads}=await import(pathToFileURL(path.resolve('src/game/magi-world.js')).href)
 const meta=JSON.parse(await fs.readFile('test/fixtures/roarm-reward-designs.json','utf8'))
 const ids=['w02','w07','w14'],rewards=Object.values(meta).map((m,i)=>({taskId:'fixture-'+i,submissionId:'fixture-submission-'+i,leaseId:'fixture-lease-'+i,workerId:ids[i],rewardDesign:m.rewardDesign,fingerprint:String(i+1).repeat(64),sequence:i+1,awardedAt:100+i}))
 const threads=standbyMagiThreads().map(t=>({...t,earnedRewards:rewards.filter(r=>r.workerId===t.shellId)}))
 const pose={base:.001533981,shoulder:.015339808,elbow:1.595340019,gripper:3.13545673}
 const out='.cache/roarm-contracts';await fs.mkdir(out,{recursive:true})
 const browser=await chromium.launch({headless:true,channel:'chrome'})
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];let armCalls=0,stale=false
  page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/api/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname
   if(p==='/api/roarm/observation'){armCalls++;return route.fulfill({json:{source:'hardware',state:stale?'stale':'live',pose,observedAt:new Date(stale?Date.now()-20000:Date.now()).toISOString()}})}
   if(p==='/api/magi/world')return route.fulfill({json:{mode:'magi',threads,worksite:{pilot:{workerId:'w01',previousWorkerId:null,generation:1},earnedRewards:rewards,contracts:Object.values(meta).map((m,i)=>({...m.successorContract,predecessorWorkerId:ids[i],successorWorkerId:'w03'}))}}})
   if(p==='/api/magi/colony')return route.fulfill({json:{plots:{},archived:[],seen:Object.fromEntries(threads.map(t=>[t.id,1])),settings:{planet:'mars',dayCycle:false,timeOfDay:.46,showLabels:false,tiltShift:false}}})
   return route.fulfill({json:{}})
  })
  await page.goto(base);await page.waitForFunction(()=>window.botCrossing?.colony.astronauts.agents.filter(a=>a.rewardWearable).length===3)
  await page.keyboard.press('Escape')
  await page.locator('.worksite-board summary').click()
  await page.getByRole('button',{name:'Simulate joints',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('.roarm-preview-start')?.disabled===false)
  assert.equal(await page.evaluate(()=>botCrossing.rig.desiredTarget.y),8,'arm focus preserves height')
  const before=await page.evaluate(()=>botCrossing.colony.worksite.armModel.observation.pose)
  const simulated=await page.evaluate(()=>roarmSimulation.preview([{base:.08,shoulder:.015339808,elbow:1.595340019,gripper:3.13545673}]))
  assert.equal(simulated.simulationOnly,true)
  await page.waitForFunction(()=>roarmSimulation.snapshot().status==='complete')
  assert.deepEqual(await page.evaluate(()=>botCrossing.colony.worksite.armModel.observation.pose),before)
  assert.equal(await page.evaluate(()=>roarmSimulation.snapshot().pose.base),.08)
  await page.screenshot({path:out+'/simulation-fixture.png'})
  stale=true;await page.waitForFunction(()=>document.querySelector('.roarm-preview-start').disabled)
  assert.match(await page.evaluate(()=>{try{roarmSimulation.preview([{base:0,shoulder:0,elbow:1,gripper:3}]);return 'bad'}catch(e){return e.message}}),/fresh live/)
  await page.getByRole('button',{name:'Reset preview',exact:true}).click();assert.equal(await page.evaluate(()=>roarmSimulation.snapshot().status),'idle')
  await page.evaluate(()=>{
   const {engine,colony,rig}=botCrossing;engine.stop()
   document.querySelector('.roarm-preview-panel').hidden=true;document.querySelector('.worksite-board').hidden=true
   const ids=['w02','w07','w14'];let slot=0
   for(const a of colony.astronauts.agents){if(ids.includes(a.thread.shellId)){a.pos.set((slot++-1)*2.3,0,25);a.yaw=Math.PI/4;a.scale=1;a.state='at-site';a.mounted=false;a.magiSeat=null;a.clipKey='idle';}else a.scale=0}
   colony.astronauts._writeMatrices(0,true)
   rig.focus({x:0,y:1,z:25},{distance:10,elevated:true})
   for(let i=0;i<90;i++)rig.update(1/30)
   engine.renderFrame()
  })
  // Re-render accessories using their actual parent bone transforms after the fixture lineup.
  await page.evaluate(()=>{const {colony,engine}=botCrossing;colony.astronauts._writeMatrices(0,true);engine.renderFrame()})
  await page.screenshot({path:out+'/earned-hats-fixture.png'})
  const result=await page.evaluate(()=>botCrossing.colony.astronauts.agents.filter(a=>a.rewardWearable).map(a=>({id:a.thread.shellId,name:a.wornReward.design.name,inventory:a.earnedWearables.length,visible:a.rewardWearable.group.visible})))
  assert.equal(result.length,3);assert.ok(result.every(r=>r.inventory===1));assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,fixture:true,hardwareRequests:0,observationsIntercepted:armCalls,rewards:result,ghostSeparate:true,staleStartRejected:true,errors}))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
