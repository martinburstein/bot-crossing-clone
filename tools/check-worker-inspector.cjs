// Exercise actual app selection with browser-only simulated data. All API traffic is
// intercepted, including colony saves; no protocol/service mutation reaches the host.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url')
const {chromium}=require(process.env.BOT_CROSSING_PLAYWRIGHT||'@playwright/test')
;(async()=>{
  const base=process.env.BOT_CROSSING_TEST_URL
  if(!base||new URL(base).hostname!=='127.0.0.1')throw Error('Set BOT_CROSSING_TEST_URL to the existing local Vite server')
  const {standbyMagiThreads}=await import(pathToFileURL(path.resolve('src/game/magi-world.js')).href)
  let threads=standbyMagiThreads().map((t,i)=>({...t,running:i%5===0,assignmentState:i%5===0?'running':'idle',taskTitle:['Deliver supplies to camp','Drill foundation post holes','Report from camp to camp'][Math.floor(i/5)],tokenUsage:{total:75000,completedTurns:3,pendingTurns:1,cached:false},workerBackend:i%5===0?'codex-cli':null}))
  let unavailable=false,interceptedWrites=0
  const out=path.resolve('.cache/worker-inspector-check');await fs.mkdir(out,{recursive:true})
  const browser=await chromium.launch({headless:true,channel:'chrome'})
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.route('**/api/**',async route=>{
      const req=route.request(),pathname=new URL(req.url()).pathname
      if(req.method()!=='GET')interceptedWrites++
      if(pathname==='/api/magi/world')return route.fulfill({status:unavailable?503:200,json:unavailable?{error:'Simulated unavailable feed'}:{mode:'magi',threads}})
      if(pathname==='/api/magi/colony')return route.fulfill({json:req.method()==='GET'?{seen:Object.fromEntries(threads.map(t=>[t.id,1])),plots:{},archived:[],settings:{planet:'mars',dayCycle:false,timeOfDay:.46,showLabels:false,tiltShift:false}}:{updatedAt:Date.now()}})
      return route.fulfill({json:{}})
    })
    await page.goto(base)
    await page.waitForFunction(()=>window.botCrossing?.colony.astronauts.magiLife.fleet.size===3)
    await page.keyboard.press('Escape') // Dismiss the ordinary first-visit help sheet.
    await page.evaluate(()=>{
      const tag=document.createElement('div');tag.textContent='VISUAL TEST · SIMULATED DATA · API intercepted';tag.style.cssText='position:fixed;top:8px;left:35%;z-index:100;color:#fff;background:#142630;padding:6px;font:11px monospace';document.body.append(tag)
      const {colony,rig}=window.botCrossing,item=colony.astronauts.magiLife.fleet.get('magi:w06');rig.focus(item.model.position,{distance:26})
    })
    await page.waitForTimeout(1000)
    const clickPilot=async id=>{
      const point=await page.evaluate(id=>{
        const {colony,engine}=window.botCrossing,a=colony.agentFor(id),v=a.pos.clone();v.y+=colony.astronauts.headHeight||.75;v.project(engine.camera)
        return {x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight,picked:colony.pick(v.x,v.y,innerWidth/innerHeight)?.id,mounted:a.mounted}
      },id)
      await page.mouse.click(point.x,point.y)
      try{await page.waitForFunction(id=>window.botCrossing.hud.selected?.agent.id===id,id,{timeout:3000})}catch(error){
        await page.screenshot({path:path.join(out,'click-failure.png')});console.log(JSON.stringify({point,state:await page.evaluate(()=>({selected:window.botCrossing.hud.selected?.agent.id,errors:document.querySelector('.toasts')?.textContent})),errors}));throw error
      }
    }
    await clickPilot('magi:w06')
    await page.waitForSelector('.worker-speech:not([hidden])')
    const bubble=await page.locator('.worker-speech').innerText();assert.ok(bubble.split(/\s+/).length<=3)
    const panel=page.locator('.thread-pop')
    assert.match(await panel.innerText(),/Drill foundation post holes/)
    assert.match(await panel.innerText(),/75,000/)
    assert.equal(await panel.locator('.pair').isVisible(),false)
    assert.equal(await page.locator('.hud .side').isVisible(),false)
    const bounds=await panel.boundingBox();assert.ok(bounds.x>1000,'Telemetry occupies the right panel')
    await page.screenshot({path:path.join(out,'selected-pilot.png')})
    await page.keyboard.press('F3');await page.waitForSelector('.worker-debug:not([hidden])')
    assert.match(await panel.innerText(),/FPS/);assert.match(await panel.innerText(),/3 completed · 1 pending/)
    await page.screenshot({path:path.join(out,'f3-telemetry.png')})
    // Updates follow the selected worker through a real render frame, not a static card.
    const before=await panel.locator('.worker-inspection').innerText();await page.waitForTimeout(900)
    assert.notEqual(await panel.locator('.worker-inspection').innerText(),before)
    await page.setViewportSize({width:1152,height:480});await page.waitForTimeout(350)
    const compact=await panel.boundingBox();assert.ok(compact.x>=0&&compact.y>=0&&compact.x+compact.width<=1152&&compact.y+compact.height<=480)
    assert.equal(await page.locator('.worker-speech').evaluate(el=>getComputedStyle(el).whiteSpace),'nowrap')
    await page.screenshot({path:path.join(out,'compact-telemetry.png')})
    // Losing the feed parks the vehicle, removes the bubble and retains honest receipts.
    unavailable=true;await page.evaluate(()=>window.botCrossing.poll())
    await page.waitForFunction(()=>window.botCrossing.colony.astronauts.magiLife.fleet.size===0)
    await page.waitForTimeout(350)
    assert.equal(await page.locator('.worker-speech').isVisible(),false)
    assert.match(await panel.innerText(),/Unavailable · crew off shift/)
    assert.match(await panel.innerText(),/75,000 · cached/)
    await page.keyboard.press('Escape');assert.equal(await panel.isVisible(),false)
    assert.deepEqual(errors,[])
    console.log(JSON.stringify({passed:true,clickSelectedMountedPilot:true,maxBubbleWords:3,liveTelemetry:true,f3:true,disconnectClearsBubble:true,interceptedWrites,hostApiCalls:0,output:out}))
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
