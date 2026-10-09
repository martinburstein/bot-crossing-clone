// Isolated, explicitly simulated visual fixture. Never changes the live roster.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises')
;(async()=>{
 const base=process.env.BOT_CROSSING_TEST_URL
 if(!base||new URL(base).hostname!=='127.0.0.1')throw Error('Use the existing loopback Vite service')
 await fs.mkdir('.cache/roarm-worksite',{recursive:true})
 const browser=await chromium.launch({headless:true,channel:'chrome'})
 try{
  const page=await browser.newPage({viewport:{width:958,height:475}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(new URL('/tools/visual-check/magi.html',base).href)
  await page.waitForFunction(()=>!!window.magiVisualCheck)
  await page.evaluate(()=>magiVisualCheck.observation({source:'simulator',state:'live',pose:{base:0,shoulder:0,elbow:0,gripper:3.14},observedAt:new Date().toISOString()}))
  await page.click('#active')
  await page.evaluate(()=>{magiVisualCheck.advance(100);magiVisualCheck.pause(true)})
  const state=await page.evaluate(()=>magiVisualCheck.snapshot())
  assert.equal(state.mounted,3);assert.equal(state.idle,12);assert.equal(state.fleet.length,3)
  assert.ok(state.fleet.every(v=>!v.routeBlocked&&v.visitedStops.includes(0)),'All three service points must be reached')
  const idle=state.crew.filter(a=>a.status==='idle')
  for(let i=0;i<idle.length;i++){
   assert.ok(Math.hypot(idle[i].goal[0],idle[i].goal[2]+38)<=14,'Every resting goal belongs to the common camp')
   for(let j=i+1;j<idle.length;j++)assert.ok(Math.hypot(idle[i].goal[0]-idle[j].goal[0],idle[i].goal[2]-idle[j].goal[2])>=1,'Resting personas must not stack')
  }
  const data={stale:false,bounties:[{id:'fixture-open',status:'open',description:'FIXTURE: missing calibration record'},{id:'fixture-solved',status:'solved',description:'FIXTURE: verified cable inspection',solvedByWorkerId:'w02'}],serviceCredits:[{id:'fixture-credit',workerId:'w02',amount:1}]}
  const world=await page.evaluate(data=>magiVisualCheck.worksite(data),data)
  assert.equal(world.buildings,0);assert.equal(world.plots,15);assert.ok(world.armHeight>=20)
  assert.equal(world.projection.bounties.length,1)
  await page.locator('aside').evaluate(el=>{el.style.maxWidth='180px';el.querySelectorAll('button,select,pre,p').forEach(n=>n.style.display='none')})
  await page.screenshot({path:'.cache/roarm-worksite/three-active-fixture.png'})
  await page.evaluate(()=>{document.getElementById('unknown').click();magiVisualCheck.advance(1)})
  assert.equal((await page.evaluate(()=>magiVisualCheck.snapshot())).fleet.length,0)
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,simulated:true,modelCalls:0,activePilots:3,campResidents:12,sharedHexes:15,legacyBuildings:0,servicePointsReached:true,disconnectParks:true,errors}))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
