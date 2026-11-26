// Optional original-geometry rendering. Supply a local Playwright package.
const {chromium}=require(process.env.SOWERS_PLAYWRIGHT_MODULE||'playwright')
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto')
const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,value,index,all)=>value.startsWith('--')?[...pairs,[value.slice(2),all[index+1]]]:pairs,[]))
const base=args.url||'http://127.0.0.1:5288'
const output=args.out||`.cache/candy/relief-${new Date().toISOString().replace(/[:.]/g,'-')}`
let browser
;(async()=>{
 for(const suffix of ['.png','.json'])try{await fs.access(output+suffix);throw Error(`Refusing to overwrite ${output+suffix}`)}catch(error){if(error.code!=='ENOENT')throw error}
 await fs.mkdir(path.dirname(output),{recursive:true})
 browser=await chromium.launch({headless:true,...(process.env.SOWERS_CHROME?{executablePath:process.env.SOWERS_CHROME}:{}),args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']})
 const page=await browser.newPage({viewport:{width:1080,height:1140},deviceScaleFactor:1})
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 const url=new URL('/tools/sowers-relief-study.html',base)
 if(args.file)url.searchParams.set('file',args.file)
 if(args.sha)url.searchParams.set('sha',args.sha)
 await page.goto(url.href)
 await page.waitForFunction(()=>window.studyReady||window.studyError)
 const evidence=await page.evaluate(()=>({ready:window.studyReady,error:window.studyError,study:window.studyEvidence,userAgent:navigator.userAgent}))
 if(evidence.error||errors.length)throw Error(evidence.error||errors.join('; '))
 await page.screenshot({path:output+'.png',fullPage:true})
 const renderSource=await fs.readFile('tools/sowers-relief-study.html')
 const manifest={capturedAt:new Date().toISOString(),url:url.href,...evidence,rendererSourceSha256:crypto.createHash('sha256').update(renderSource).digest('hex'),screenshotSha256:crypto.createHash('sha256').update(await fs.readFile(output+'.png')).digest('hex'),pageErrors:errors}
 if(args.metadata){const raw=await fs.readFile(args.metadata);if(!raw.toString().includes(manifest.study.stlSha256))throw Error('Metadata does not pin the rendered STL');manifest.studyMetadata={path:args.metadata,sha256:crypto.createHash('sha256').update(raw).digest('hex')}}
 await fs.writeFile(output+'.json',JSON.stringify(manifest,null,2)+'\n')
 console.log(JSON.stringify({image:output+'.png',manifest:output+'.json',stl:manifest.study.stlSha256,errors}))
 await browser.close()
})().catch(async error=>{console.error(error);await browser?.close();process.exitCode=1})
