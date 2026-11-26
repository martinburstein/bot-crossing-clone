#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('/Users/martinburstein/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

const base = process.env.SOWERS_URL || 'http://127.0.0.1:5301/sowers/'
const out = path.resolve('.cache/sowers-protocol-browser')
fs.mkdirSync(out, { recursive: true })

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
  const errors = []
  const report = { url: base, checks: [], errors, consoleWarnings: [], httpFailures: [] }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') report.consoleWarnings.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) report.httpFailures.push({ status: response.status(), url: response.url() }) })
  try {
    await page.goto(`${base}?magi=1`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForFunction(() => window.sowersMissionReview?.magi !== undefined, null, { timeout: 15000 })
    await page.waitForTimeout(1200)
    const first = await page.evaluate(() => ({
      wave: window.sowersMissionReview.magi?.number ?? null,
      stale: window.sowersMissionReview.magi?.stale ?? null,
      packets: window.sowersMissionReview.packets.length,
      members: document.querySelectorAll('.crew-row').length,
      ready: window.sowersMissionReview.magi?.readiness ?? null,
    }))
    assert.equal(first.packets, 0, 'existing observation must establish history without replay')
    assert.equal(first.members, 3, 'the actual protocol panel should show its three observed slots')
    report.checks.push({ name: 'historical baseline does not replay', first })

    await page.locator('#memorial-archive summary').click()
    const archiveCount=await page.locator('#memorial-list button').count()
    if(archiveCount) {
      await page.locator('#memorial-list button').first().click()
      assert.equal(await page.locator('#memorial-story').isVisible(),true)
      assert.ok(await page.locator('#memorial-story canvas, #memorial-story img').count())
      await page.locator('#memorial-story .story-close').click()
      assert.equal(await page.locator('#memorial-story').isVisible(),false)
      await page.locator('#memorial-list button').first().click()
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('#memorial-story').isVisible(),false)
      const picked=await page.evaluate(()=>{
        const review=window.sowersMissionReview,c=review.camera,view=c.matrixWorldInverse.elements,p=c.projectionMatrix.elements
        const item=review.garden.userData.entries.values().next().value,world=item.group.position.clone().add(review.garden.position).add({x:0,y:1,z:0})
        const x=world.x,y=world.y,z=world.z,vx=view[0]*x+view[4]*y+view[8]*z+view[12],vy=view[1]*x+view[5]*y+view[9]*z+view[13],vz=view[2]*x+view[6]*y+view[10]*z+view[14],vw=view[3]*x+view[7]*y+view[11]*z+view[15],cx=p[0]*vx+p[4]*vy+p[8]*vz+p[12]*vw,cy=p[1]*vx+p[5]*vy+p[9]*vz+p[13]*vw,cw=p[3]*vx+p[7]*vy+p[11]*vz+p[15]*vw,r=review.renderer.domElement.getBoundingClientRect()
        const clientX=r.left+(cx/cw*.5+.5)*r.width,clientY=r.top+(-cy/cw*.5+.5)*r.height
        return {visible:!document.querySelector('#memorial-story').hidden,x:clientX,y:clientY,ndc:[cx/cw,cy/cw]}
      })
      await page.mouse.click(picked.x,picked.y)
      picked.visible=await page.locator('#memorial-story').isVisible()
      assert.equal(picked.visible,true,`tablet pick should open the saved story: ${JSON.stringify(picked)}`)
      report.checks.push({name:'archive buttons, tablet picking, close button and Escape',archiveCount,picked})
      await page.locator('#memorial-story .story-close').click()
    }

    await page.locator('#arrival').click()
    await page.waitForFunction(() => window.sowersMissionReview.packets.length === 3)
    await page.waitForTimeout(360)
    const during = await page.evaluate(() => window.sowersMissionReview.packets.map(packet => packet.progress))
    assert.equal(during.length, 3, 'one new packet set per presentation')
    assert.ok(during[0] > 0 && during[0] < 1, `packet opening should be underway: ${during}`)
    await page.locator('#motion').click()
    const paused = await page.evaluate(() => window.sowersMissionReview.packets.map(packet => packet.progress))
    await page.waitForTimeout(600)
    const held = await page.evaluate(() => window.sowersMissionReview.packets.map(packet => packet.progress))
    assert.deepEqual(held, paused, 'paused packet presentation must hold its exact pose')
    await page.locator('#motion').click()
    await page.waitForTimeout(500)
    const resumed = await page.evaluate(() => window.sowersMissionReview.packets.map(packet => packet.progress))
    assert.ok(resumed[0] > held[0], 'packet presentation should resume from its current pose')
    await page.waitForTimeout(1800)
    report.checks.push({ name: 'exactly three packets; pause/resume preserves pose', during, paused, resumed })

    await page.locator('#arrival').click()
    const count = await page.evaluate(() => ({ packets: window.sowersMissionReview.packets.length, scenePackets: window.sowersMissionReview.scene.children.filter(o => o.name.startsWith('Sower packet')).length }))
    assert.deepEqual(count, { packets: 3, scenePackets: 3 }, 'replay must replace and dispose the prior three packets')
    report.checks.push({ name: 'repeat replay keeps packet count at three', count })

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await page.waitForTimeout(300)
      const fit = await page.evaluate(() => {
        const c=window.sowersMissionReview.camera,view=c.matrixWorldInverse.elements,projection=c.projectionMatrix.elements
        const project=(x,y,z)=>{const vx=view[0]*x+view[4]*y+view[8]*z+view[12],vy=view[1]*x+view[5]*y+view[9]*z+view[13],vz=view[2]*x+view[6]*y+view[10]*z+view[14],vw=view[3]*x+view[7]*y+view[11]*z+view[15];const a=projection[0]*vx+projection[4]*vy+projection[8]*vz+projection[12]*vw,b=projection[1]*vx+projection[5]*vy+projection[9]*vz+projection[13]*vw,d=projection[3]*vx+projection[7]*vy+projection[11]*vz+projection[15]*vw;return [a/d,b/d]}
        const stations=[...window.sowersMissionReview.entries.values()].map(e=>project(e.group.position.x,1,e.group.position.z))
        const nest=project(0,5.5,0)
        return { width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scene:document.querySelector('#scene').getBoundingClientRect().width,rows:document.querySelectorAll('.crew-row').length,stations,nest }
      })
      assert.equal(fit.scrollWidth, width, `no horizontal page overflow at ${width}px: ${JSON.stringify(fit)}`)
      assert.equal(fit.rows, 3)
      assert.ok(fit.stations.length===3&&fit.stations.every(([x,y])=>Math.abs(x)<.96&&Math.abs(y)<.96),`all three agents must be in the compact overview: ${JSON.stringify(fit.stations)}`)
      assert.ok(Math.abs(fit.nest[0])<.96&&Math.abs(fit.nest[1])<.96,`nest must be in the compact overview: ${JSON.stringify(fit.nest)}`)
      await page.screenshot({ path: path.join(out, `magi-${width}.png`) })
      report.checks.push({ name: `mobile ${width}px roster and scene`, fit })
    }

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForFunction(() => window.sowersMissionReview?.magi !== undefined)
    assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), 'true')
    await page.locator('#motion').click()
    await page.locator('#arrival').click()
    const reduced = await page.evaluate(() => ({ progress: window.sowersMissionReview.packets.map(p => p.progress), visible: window.sowersMissionReview.packets.map(p => p.group.visible), count: window.sowersMissionReview.packets.length }))
    assert.deepEqual(reduced, { progress: [1, 1, 1], visible: [false, false, false], count: 3 })
    report.checks.push({ name: 'reduced motion settles three arrivals immediately', reduced })

    // Local-only valid source fixtures exercise automatic admissions and phase
    // ordering without writing or mutating the real broadcast/archive records.
    const fixtureContext=await browser.newContext({viewport:{width:1280,height:900}})
    await fixtureContext.addInitScript(()=>{const original=window.setInterval.bind(window);window.setInterval=(fn,delay,...args)=>original(fn,delay===8000?250:delay,...args)})
    const fixturePage=await fixtureContext.newPage()
    fixturePage.on('pageerror',error=>errors.push(`fixture: ${error.message}`))
    let fixtureStage='empty',archiveStage='empty'
    const coordinator='00000000-0000-4000-8000-000000000099'
    const uuids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000006']
    const fixtureObservations={}
    const sourceObservation=()=>{
      if(fixtureStage==='empty')return null
      const later=fixtureStage==='B',wave=later?902:901,key=later?'B':'A'
      if(!fixtureObservations[key]){
        const start=Date.now()-3000
        const agents=[0,1,2].map(i=>({id:`/fixture/wave-${wave}/agent-${i+1}`,nativeId:`codex:${uuids[(later?3:0)+i]}`,name:`Fixture ${i+1}`,role:`Inspect component ${i+1}`,model:'gpt-6-luna',effort:'medium',state:'working',accepted:false,startedAt:start}))
        fixtureObservations[key]={id:`fixture-wave-${wave}`,number:wave,sequence:1,phase:'working',admittedAt:start,coordinator:{model:'gpt-6-sol',effort:'high',threadId:coordinator},agents,readiness:{agents:true,dispenser:true,computer:true,campfire:true}}
      }
      if(fixtureStage==='AReview')return {...fixtureObservations.A,sequence:2,phase:'campfire',agents:fixtureObservations.A.agents.map(agent=>({...agent,state:'complete',endedAt:agent.startedAt+1000}))}
      return fixtureObservations[key]
    }
    const fixtureJson=(route,value)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)})
    await fixturePage.route('**/api/sowers/broadcast',route=>{const magi=sourceObservation();return fixtureJson(route,{threads:[],configured:true,observedAt:Date.now(),warnings:[],magi})})
    await fixturePage.route('**/api/threads',route=>{const magi=sourceObservation(),threads=magi?magi.agents.map(agent=>({id:agent.nativeId,agentPath:agent.id,parentThreadId:`codex:${coordinator}`,running:agent.state==='working'&&magi.phase==='working',status:agent.state==='working'?'working':'complete',name:agent.name,project:'Protocol browser fixture',startedAt:agent.startedAt,lastActivityAt:agent.startedAt,checkpoints:[]})):[];return fixtureJson(route,{threads,warnings:[]})})
    await fixturePage.route('**/api/sowers/memorials',route=>fixtureJson(route,{entries:archiveStage==='empty'?[]:[{id:'fixture-iteration-99',iteration:99,symbol:'Fixture capsule',explanation:'Local browser-only tablet fixture.',color:'#ff8040',task:'Exercise garden motion.',agent:'fixture',startedAt:new Date(Date.now()-5000).toISOString(),endedAt:new Date().toISOString(),strokes:[{color:'#ff8040',width:.04,points:[[.25,.7],[.5,.3],[.75,.7]]}]}],warnings:[]}))
    await fixturePage.route('**/api/sowers/usage',route=>fixtureJson(route,{chat:{status:'unavailable',totalTokens:null},workers:[],waveTokens:null,account:{status:'unavailable',remainingPercent:null},warnings:[]}))
    const firstBroadcast=fixturePage.waitForResponse(response=>response.url().includes('/api/sowers/broadcast'))
    const firstArchive=fixturePage.waitForResponse(response=>response.url().includes('/api/sowers/memorials'))
    await fixturePage.goto(`${base}?magi=1`,{waitUntil:'domcontentloaded'})
    await Promise.all([firstBroadcast,firstArchive])
    await fixturePage.waitForFunction(()=>window.sowersMissionReview?.magi===null)
    fixtureStage='A'
    await fixturePage.waitForFunction(()=>window.sowersMissionReview?.packetMetrics.created===3&&window.sowersMissionReview.packets.length===3,{},{timeout:5000})
    const firstFresh=await fixturePage.evaluate(()=>({wave:window.sowersMissionReview.magi.number,metrics:window.sowersMissionReview.packetMetrics,bindings:document.querySelectorAll('.status-pill').length}))
    assert.equal(firstFresh.wave,901)
    assert.deepEqual(firstFresh.metrics,{created:3,disposed:0},'first fresh admission must create exactly one three-packet set')
    await fixturePage.waitForTimeout(650)
    assert.deepEqual(await fixturePage.evaluate(()=>window.sowersMissionReview.packetMetrics),{created:3,disposed:0},'same-sequence repolls must not create another packet set')
    fixtureStage='AReview'
    await fixturePage.waitForFunction(()=>window.sowersMissionReview.magi?.phase==='campfire')
    await fixturePage.waitForTimeout(350)
    const reviewInFlight=await fixturePage.evaluate(()=>({arrival:Boolean(window.sowersMissionReview.arrival),routes:[...window.sowersMissionReview.entries.values()].map(e=>e.routeMode),progress:window.sowersMissionReview.packets.map(p=>p.progress)}))
    assert.equal(reviewInFlight.arrival,true)
    assert.ok(reviewInFlight.routes.includes('arrival')&&reviewInFlight.routes.every(route=>route!=='campfire'),`campfire route must wait while any packet is unboxing: ${JSON.stringify(reviewInFlight)}`)
    assert.ok(reviewInFlight.progress.some(progress=>progress<1),'at least one foil packet should still be opening during the review transition')
    await fixturePage.waitForFunction(()=>window.sowersMissionReview.arrival===null,{},{timeout:5000})
    await fixturePage.waitForFunction(()=>[...window.sowersMissionReview.entries.values()].every(e=>e.routeMode==='campfire'),{},{timeout:3000})
    const reviewComplete=await fixturePage.evaluate(()=>({arrival:window.sowersMissionReview.arrival,routes:[...window.sowersMissionReview.entries.values()].map(e=>e.routeMode)}))
    assert.deepEqual(reviewComplete,{arrival:null,routes:['campfire','campfire','campfire']})
    report.checks.push({name:'first fresh admission auto-opens exactly three; repolls do not duplicate; campfire waits for arrival',firstFresh,reviewInFlight,reviewComplete})

    fixtureStage='B'
    await fixturePage.waitForFunction(()=>window.sowersMissionReview.magi?.number===902&&window.sowersMissionReview.packetMetrics.created===6,{},{timeout:5000})
    const secondFresh=await fixturePage.evaluate(()=>({wave:window.sowersMissionReview.magi.number,metrics:window.sowersMissionReview.packetMetrics,packets:window.sowersMissionReview.packets.length,scenePackets:window.sowersMissionReview.scene.children.filter(o=>o.name.startsWith('Sower packet')).length}))
    assert.deepEqual(secondFresh,{wave:902,metrics:{created:6,disposed:3},packets:3,scenePackets:3},'later fresh wave replaces three packets without a discarded extra set')
    report.checks.push({name:'later fresh wave creates exactly three and disposes the prior three',secondFresh})
    await fixturePage.locator('#motion').click()
    archiveStage='entry'
    await fixturePage.waitForFunction(()=>window.sowersMissionReview.garden.userData.entries.has('fixture-iteration-99'),{},{timeout:5000})
    const queuedMark=await fixturePage.evaluate(()=>{const g=window.sowersMissionReview.garden.userData.entries.get('fixture-iteration-99').group;return {paused:window.sowersMissionReview.paused,y:g.position.y,rising:g.userData.rising}})
    assert.deepEqual(queuedMark,{paused:true,y:-2,rising:true},'new archive tablet should queue underground while paused')
    await fixturePage.waitForTimeout(450)
    assert.equal(await fixturePage.evaluate(()=>window.sowersMissionReview.garden.userData.entries.get('fixture-iteration-99').group.position.y),-2)
    await fixturePage.locator('#motion').click()
    await fixturePage.waitForFunction(()=>window.sowersMissionReview.garden.userData.entries.get('fixture-iteration-99').group.position.y>-2,{},{timeout:3000})
    report.checks.push({name:'new memorial waits underground while paused, then rises on resume',queuedMark})

    await fixturePage.emulateMedia({reducedMotion:'reduce'})
    archiveStage='empty';fixtureStage='empty'
    const reducedArchive=fixturePage.waitForResponse(response=>response.url().includes('/api/sowers/memorials'))
    await fixturePage.reload({waitUntil:'domcontentloaded'});await reducedArchive
    await fixturePage.waitForFunction(()=>window.sowersMissionReview?.garden.userData.count===0)
    archiveStage='entry'
    await fixturePage.waitForFunction(()=>window.sowersMissionReview.garden.userData.entries.has('fixture-iteration-99'),{},{timeout:5000})
    const reducedMark=await fixturePage.evaluate(()=>{const g=window.sowersMissionReview.garden.userData.entries.get('fixture-iteration-99').group;return {paused:window.sowersMissionReview.paused,reduced:g.userData.riseComplete,y:g.position.y}})
    assert.deepEqual(reducedMark,{paused:true,reduced:true,y:0},'reduced-motion archive additions should settle above ground immediately')
    report.checks.push({name:'new memorial settles immediately with reduced motion',reducedMark})
    await fixtureContext.close()

    assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`)
    assert.deepEqual(report.httpFailures, [], `HTTP failures: ${JSON.stringify(report.httpFailures)}`)
    report.passed = true
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
