const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const {chromium}=require(process.env.BOT_CROSSING_PLAYWRIGHT||'@playwright/test')
;(async()=>{
 const base=process.env.BOT_CROSSING_TEST_URL
 const run=process.env.BOT_CROSSING_TEST_RUN||'Run-1'
 if(!/^Run-[1-9][0-9]{0,3}$/.test(run))throw Error('Valid saved run required')
 if(!base||new URL(base).hostname!=='127.0.0.1')throw Error('Existing loopback cover URL required')
 const browser=await chromium.launch({headless:true,channel:'chrome'})
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],requests=[],writes=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>{localStorage.setItem('botcrossing.seen-help','1');localStorage.setItem('botcrossing.15-3A.lastProjection','live-cache-sentinel');localStorage.setItem('botcrossing.settings.v1',JSON.stringify({planet:'moon',timeOfDay:.32}));localStorage.setItem('botcrossing.15-3A.vehicles','{"w01":"eagle"}')})
  await page.route('**/api/**',route=>{const r=route.request();requests.push(new URL(r.url()).pathname);if(r.method()!=='GET'){writes.push(r.method());return route.abort()}return route.continue()})
  const url=new URL(base);url.searchParams.set('run',run);await page.goto(url.href)
  await page.waitForFunction(run=>document.querySelector('.magi-connection')?.textContent.includes(run+' replay'),run,{timeout:45000})
  await page.waitForTimeout(1800)
  assert.equal(await page.evaluate(()=>window.botCrossing.colony.astronauts.magiLife.fleet.size),0)
  assert.equal(await page.evaluate(()=>localStorage.getItem('botcrossing.15-3A.lastProjection')),'live-cache-sentinel')
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('botcrossing.settings.v1')).planet),'moon')
  assert.equal(await page.evaluate(()=>window.botCrossing.colony.settings.get('planet')),'mars')
  assert.ok(requests.includes('/api/magi/archive/'+run));assert.ok(!requests.includes('/api/magi/world'));assert.ok(!requests.includes('/api/magi/colony'))
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[])
  const output=path.resolve('.cache/run-replay-check');await fs.mkdir(output,{recursive:true});await page.screenshot({path:path.join(output,run.toLowerCase()+'.png')})
  console.log(JSON.stringify({passed:true,run,replayWorkers:0,hostWrites:0,liveCachePreserved:true,liveSettingsPreserved:true,output}))
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
