// Read-only browser checks. All source responses below are browser-local fixtures.
const {chromium}=require(process.env.SOWERS_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const base=process.env.SOWERS_URL||'http://127.0.0.1:5286';
const output=process.env.SOWERS_MISSION_OUTPUT||'.cache/sowers-mission-soak-wave6';
const posesOnly=process.argv.includes('--poses');
const deadline=Date.parse(process.env.SOWERS_SOAK_UNTIL||'2026-11-26T07:30:00Z');
fs.mkdirSync(output,{recursive:true});
const root=path.join(__dirname,'..');
const pins=()=>{
 const files=['sowers/candy/mascot.js','sowers/candy/silhouettes.mjs','sowers/main.js','sowers/telemetry.mjs','tools/soak-sowers-mission.cjs'];
 if(fs.existsSync(path.join(root,'dist/assets')))for(const f of fs.readdirSync(path.join(root,'dist/assets')).sort())files.push('dist/assets/'+f);
 return {revision:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),files:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]))};
};
const report={startedAt:new Date().toISOString(),deadline:new Date(deadline).toISOString(),sourceAtStart:pins(),errors:[],navigations:[],observations:[],checks:[],mockedSources:true};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.SOWERS_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>{
  const resources={buffers:0,textures:0,programs:0,created:{buffers:0,textures:0,programs:0},deleted:{buffers:0,textures:0,programs:0},draws:0,contextLosses:0};
  window.sowersSoakGL=resources;
  for(const Type of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(Type){
   for(const [kind,noun] of [['buffers','Buffer'],['textures','Texture'],['programs','Program']]){
    const add=Type.prototype['create'+noun],remove=Type.prototype['delete'+noun],alive=new WeakSet();
    Type.prototype['create'+noun]=function(...args){const item=add.apply(this,args);if(item){alive.add(item);resources[kind]++;resources.created[kind]++;}return item;};
    Type.prototype['delete'+noun]=function(item){if(item&&alive.has(item)){alive.delete(item);resources[kind]--;resources.deleted[kind]++;}return remove.call(this,item);};
   }
   for(const name of ['drawArrays','drawElements']){const original=Type.prototype[name];Type.prototype[name]=function(...args){resources.draws++;return original.apply(this,args);};}
  }
  addEventListener('webglcontextlost',()=>resources.contextLosses++,true);
 });
 const page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())report.navigations.push({at:new Date().toISOString(),url:frame.url()});});
 if(posesOnly){
  await page.goto(base+'/sowers/studio/');
  const data=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/three/build/three.module.js');
   const {createCandySower}=await import('/sowers/candy/mascot.js');
   const statuses=['idle','working','review','waiting','complete','error'],results=[];
   for(const size of [32,64,128]){
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setSize(size,size);renderer.setPixelRatio(1);renderer.setClearColor(0xf5eddd);renderer.outputColorSpace=THREE.SRGBColorSpace;
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.05,1.05,1.05,-1.05,.1,20);camera.position.set(0,.925,8);camera.lookAt(0,.925,0);
    scene.add(new THREE.HemisphereLight(0xffffff,0x756653,2.5));const light=new THREE.DirectionalLight(0xffffff,2.0);light.position.set(-3,5,6);scene.add(light);
    const images=[];
    for(const status of statuses){
     const model=createCandySower({seed:0});model.userData.animate(0,.1,{status});scene.add(model);renderer.render(scene,camera);
     const pixels=new Uint8Array(size*size*4);renderer.getContext().readPixels(0,0,size,size,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixels);
     images.push({status,pixels:Array.from(pixels),png:renderer.domElement.toDataURL()});scene.remove(model);model.traverse(o=>{o.geometry?.dispose();});const materials=new Set();model.traverse(o=>{if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());
    }
    const differences=[];
    for(let i=0;i<images.length;i++)for(let j=i+1;j<images.length;j++){
     let changed=0,total=0;for(let p=0;p<images[i].pixels.length;p+=4){const delta=Math.max(...[0,1,2].map(k=>Math.abs(images[i].pixels[p+k]-images[j].pixels[p+k])));if(delta>=24)changed++;total+=delta;}
     differences.push({a:images[i].status,b:images[j].status,changedPixels:changed,meanChannelDelta:total/(size*size)});
    }
    results.push({size,images:images.map(({status,png})=>({status,png})),differences});renderer.dispose();
   }
   return results;
  });
  for(const entry of data){for(const image of entry.images){fs.writeFileSync(path.join(output,`${entry.size}-${image.status}.png`),Buffer.from(image.png.split(',')[1],'base64'));delete image.png;}for(const pair of entry.differences)assert(pair.changedPixels>=Math.max(8,entry.size*entry.size*.007),`${entry.size}px ${pair.a}/${pair.b} too similar: ${pair.changedPixels}`);}
  report.poseComparisons=data;report.checks.push('All fifteen rendered pose pairs differ at 32, 64 and 128 actual pixels with fixed camera/light/seed; at least eight salient pixels or 0.7% of image');
 }else{
  let poll=0,broadcastRequests=0;
  const statuses=['idle','working','review','waiting','complete','error'];
  const fixture=i=>{const status=statuses[(poll+i)%6];return{id:`soak:${i}`,shellName:`Soak Sower ${i}`,title:`Fixture ${i}`,project:'Isolated mission soak',running:status==='working',assignmentState:status==='review'?'review':status==='complete'?'complete':null,unread:status==='waiting',hasError:status==='error',lastActivityAt:Date.now()-i,suitColor:[0xf48246,0x76b6aa,0xd6b859][i%3],harness:'codex'};};
  await page.route('**/api/threads',route=>{poll++;return route.fulfill({json:{threads:Array.from({length:12},(_,i)=>fixture(i)),warnings:[]}});});
  await page.route('**/api/sowers/broadcast',route=>{broadcastRequests++;return route.fulfill({json:{configured:true,threads:Array.from({length:12},(_,i)=>({id:`soak:${i}`,running:false,broadcastStale:false,broadcastObservedAt:Date.now(),milestones:[{id:'foundation',title:'Foundation accepted',accepted:true,status:'accepted'},{id:'systems',title:'Systems evidence',accepted:true,status:poll%2?'retracted':'accepted',retracted:!!(poll%2)}]})),warnings:[]}});});
  await page.goto(base+'/sowers/');await page.locator('.crew-row').first().waitFor();
  report.soakStartedAt=new Date().toISOString();const start=Date.now();let cycle=0,lastLog=0;
  while(true){
   // Alternate full and partial pages at the real polling cadence. Each
   // observation includes selection; source updates may reorder the roster.
   const wanted=cycle%2?3:9;
   if(wanted===9&&await page.locator('#previous').isEnabled())await page.locator('#previous').click();
   if(wanted===3&&await page.locator('#next').isEnabled())await page.locator('#next').click();
   assert.equal(await page.locator('.crew-row').count(),wanted);
   const row=page.locator('.crew-row').nth(cycle%wanted);await row.click();
   assert.equal(await row.getAttribute('aria-pressed'),'true');
   if(cycle%4===0)await page.locator('#motion').click();
   if(cycle%8===0){await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1440,height:1000});}
   await wait(100);
   const state=await page.evaluate(()=>({resources:JSON.parse(JSON.stringify(window.sowersSoakGL)),checkpointCount:Number(document.querySelector('#checkpoint-count').textContent),statuses:Array.from(document.querySelectorAll('.status-dot')).map(n=>n.className),identities:Array.from(document.querySelectorAll('.crew-row')).map(n=>n.dataset.id).sort(),selected:document.querySelector('.crew-row.selected')?.dataset.id,canvas:document.querySelectorAll('canvas').length,heap:performance.memory?.usedJSHeapSize||null}));
   assert.equal(state.checkpointCount,poll%2?12:24,'accepted/retracted source checkpoints');assert.equal(state.canvas,1);assert.equal(state.resources.contextLosses,0);assert.deepEqual(report.errors,[]);
   for(const kind of ['buffers','textures','programs'])assert(state.resources[kind]>=0&&state.resources[kind]<({buffers:4000,textures:96,programs:64}[kind]),`resource ceiling ${kind}`);
   report.observations.push({at:new Date().toISOString(),elapsedSeconds:(Date.now()-start)/1000,cycle,poll,broadcastRequests,...state});save();
   if(Date.now()-lastLog>=60000){lastLog=Date.now();console.log(JSON.stringify({at:new Date().toISOString(),elapsedSeconds:(Date.now()-start)/1000,observations:report.observations.length,poll,resources:state.resources,errors:report.errors.length}));}
   cycle++;
   if(Date.now()>=deadline)break;
   // Real browser poll every eight wall-clock seconds; no virtual clock.
   const before=poll;await page.waitForFunction(()=>true);const until=Date.now()+11000;
   while(poll===before&&Date.now()<until)await wait(250);
   assert(poll>before,'source poll stopped');
  }
  report.soakFinishedAt=new Date().toISOString();report.elapsedSeconds=(Date.now()-start)/1000;report.cycles=cycle;
  assert(Date.now()>=deadline,'wall-clock deadline not reached');assert.equal(report.navigations.length,1,'unexpected reload/navigation');
  const warm=report.observations.slice(8),kinds=['buffers','textures','programs'];report.resourceRanges={};
  // Compare the same station population and checkpoint evidence. Nine stations
  // with two accepted checkpoints legitimately own more hardware than three
  // stations with a retracted checkpoint; their resource totals are not equal.
  const groups=new Map();
  for(const sample of warm){const key=sample.identities.join(',')+'|'+sample.checkpointCount;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(sample);}
  report.comparableResourcePopulations=groups.size;
  for(const kind of kinds){const values=warm.map(s=>s.resources[kind]);if(values.length){report.resourceRanges[kind]={min:Math.min(...values),max:Math.max(...values),final:values.at(-1)};}}
  for(const samples of groups.values())if(samples.length>=4)for(const kind of kinds){const baseline=Math.max(...samples.slice(0,3).map(s=>s.resources[kind]));for(const sample of samples.slice(3))assert(sample.resources[kind]<=baseline+({buffers:12,textures:2,programs:4}[kind]),`resource growth for repeated population: ${kind}`);}
  assert(report.observations.at(-1).resources.deleted.buffers>0,'no geometry disposal observed');
  const observedStatuses=new Set(report.observations.flatMap(sample=>sample.statuses).map(value=>value.replace('status-dot ','')));
  for(const status of statuses)assert(observedStatuses.has(status),`unobserved explicit source status: ${status}`);
  report.observedStatuses=Array.from(observedStatuses).sort();
  await page.screenshot({path:path.join(output,'final-mission.png')});
  report.checks.push('Actual wall-clock run through deadline; browser-local mocked native and broadcast sources; 12 identities, nine/three pagination, six explicit statuses, selection, pause/resume, mobile viewport and accepted/retracted checkpoints','One navigation, no page errors/context losses, bounded live GL resources after warmup, geometry disposal observed');
 }
 report.sourceAtEnd=pins();assert.deepEqual(report.sourceAtEnd,report.sourceAtStart,'pinned source/build changed during check');report.finishedAt=new Date().toISOString();report.status='passed';save();console.log(JSON.stringify({status:report.status,elapsedSeconds:report.elapsedSeconds,observations:report.observations.length,checks:report.checks}));
})().catch(error=>{report.status='failed';report.failure=error.stack;save();console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
