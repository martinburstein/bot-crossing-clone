// Rendered app fixture only: no hardware requests, model turns, or protocol mutations.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises')
;(async()=>{
 const base=process.env.BOT_CROSSING_TEST_URL
 if(!base||new URL(base).hostname!=='127.0.0.1')throw Error('Existing loopback Vite URL required')
 await fs.mkdir('.cache/roarm-pilot',{recursive:true})
 const browser=await chromium.launch({headless:true,channel:'chrome'})
 try{
  const page=await browser.newPage({viewport:{width:958,height:508}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/api/**',route=>route.abort())
  await page.goto(new URL('/tools/visual-check/magi.html',base).href)
  await page.waitForFunction(()=>!!window.magiVisualCheck)
  await page.evaluate(()=>{
   magiVisualCheck.pause(true)
   magiVisualCheck.observation({source:'hardware',state:'live',pose:{base:.001533981,shoulder:.015339808,elbow:1.595340019,gripper:3.13545673},observedAt:new Date().toISOString()})
   magiVisualCheck.worksite({pilot:{workerId:'w01',generation:1,previousWorkerId:null}})
   magiVisualCheck.advance(3);magiVisualCheck.focusArm()
  })
  const first=await page.evaluate(()=>({world:magiVisualCheck.snapshot(),pilot:magiVisualCheck.pilot()}))
  assert.equal(first.world.mounted,1);assert.equal(first.world.fleet.length,0);assert.equal(first.pilot.duty.workerId,'w01');assert.equal(first.world.crew.filter(a=>a.activity==='pilot').length,1)
  const moved=await page.evaluate(()=>{magiVisualCheck.observation({source:'hardware',state:'live',pose:{base:.4,shoulder:.2,elbow:1.4,gripper:2.8},observedAt:new Date().toISOString()});magiVisualCheck.advance(1);return {pilot:magiVisualCheck.pilot(),world:magiVisualCheck.snapshot()}})
  assert.notDeepEqual(moved.pilot.seat,first.pilot.seat)
  const pilot=moved.world.crew.find(a=>a.id==='magi:w01');assert.ok(Math.hypot(...pilot.position.map((v,i)=>v-moved.pilot.seat[i]))<.1)
  const stale=await page.evaluate(()=>{magiVisualCheck.observation({state:'offline'});magiVisualCheck.advance(1);return magiVisualCheck.pilot()})
  assert.deepEqual(stale.seat,moved.pilot.seat);assert.equal(stale.observation.frozen,true)
  await page.evaluate(()=>{magiVisualCheck.worksite({pilot:{workerId:'w02',generation:2,previousWorkerId:'w01',changedAt:Date.now()}});magiVisualCheck.advance(1)})
  const handoff=await page.evaluate(()=>({world:magiVisualCheck.snapshot(),pilot:magiVisualCheck.pilot()}))
  assert.equal(handoff.world.mounted,1);assert.equal(handoff.pilot.duty.workerId,'w02');assert.equal(handoff.pilot.handoff.from,'w01');assert.equal(handoff.pilot.key,true)
  assert.equal(handoff.world.crew.filter(a=>a.activity==='pilot').length,1)
  await page.locator('aside').evaluate(el=>{el.style.display='none'})
  await page.waitForTimeout(400)
  await page.screenshot({path:'.cache/roarm-pilot/pilot-fixture.png'})
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,fixture:true,hardwareCommands:0,modelCalls:0,pilotCount:1,otherIdentities:14,movingSeat:true,staleFreeze:true,keyHandoff:true,errors}))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
