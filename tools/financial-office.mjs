import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),desktop=path.dirname(root),swarmRoot=path.join(desktop,'swarm-protocol');
const spec=JSON.parse(await fs.readFile(path.join(root,'FINANCIAL-OFFICE.json'),'utf8'));
const canon=await fs.readFile(path.join(root,spec.basedOn.file)),preserved=await fs.readFile(path.join(root,spec.basedOn.preservedCopy));
if(createHash('sha256').update(canon).digest('hex')!==spec.basedOn.sha256||!canon.equals(preserved))throw Error('Preserved source canon changed; inspect before launching the office.');
const {requestLauncher}=await import(pathToFileURL(path.join(swarmRoot,'swarm-start.mjs')));
let before=null,endpoint=null;
try{endpoint=JSON.parse(await fs.readFile(path.join(swarmRoot,'runtime/launcher/endpoint.json'),'utf8'));before=await requestLauncher(endpoint.url);}catch{/* A visual office also works without an execution service. */}
const port=57986,url=new URL(`http://127.0.0.1:${port}/`);
for(const [k,v]of Object.entries(spec.right.query))url.searchParams.set(k,v);
url.searchParams.set('swarm','1');url.searchParams.set('magi','1');
async function health(){try{const r=await fetch(new URL('/api/financial-office/health',url),{signal:AbortSignal.timeout(1500)});return r.ok?await r.json():null;}catch{return null;}}
let ready=await health();
if(ready&&ready.application!=='financial-office-viewer')throw Error('Office port belongs to another service.');
await fs.mkdir(path.join(root,'data'),{recursive:true});
if(!ready){
  try{await fetch(url,{signal:AbortSignal.timeout(1200)});throw Error('Office port is occupied by a different application.');}catch(e){if(e.message==='Office port is occupied by a different application.')throw e;}
  const log=openSync(path.join(root,'data/financial-office.log'),'a');
  const env={...process.env,PORT:String(port),BOT_CROSSING_HOST:'127.0.0.1',BOT_CROSSING_OFFICE_ROOT:path.join(desktop,'crypto-research-lab/projects/crypto-swarm-2026-10-15/office')};
  if(before?.layerUrls?.magi)env.BOT_CROSSING_MAGI_URL=new URL('/api/state',before.layerUrls.magi).href;
  const child=spawn(process.execPath,['server/serve.mjs'],{cwd:root,env,windowsHide:true,detached:true,stdio:['ignore',log,log]});child.unref();closeSync(log);
  for(let n=0;n<40;n++){ready=await health();if(ready)break;await new Promise(r=>setTimeout(r,250));}
  if(ready?.application!=='financial-office-viewer')throw Error('Office server did not become ready; inspect data/financial-office.log.');
}
let layout=null;
if(!process.argv.includes('--no-open'))layout=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tools/financial-office-layout.ps1'),'-BotUrl',url.href,'-SwarmRoot',swarmRoot],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const after=endpoint?await requestLauncher(endpoint.url).catch(()=>null):null;
if(before&&after&&(before.runId!==after.runId||before.coordinator.turns!==after.coordinator.turns))throw Error('Execution changed during presentation-only office launch.');
const receipt={observedAt:new Date().toISOString(),variant:'FINANCIAL-OFFICE.json',url:url.href,pid:ready.pid,layout,modelCalls:0,workerDispatch:false,executionUnchanged:before&&after?true:null,canonPreserved:true};
await fs.writeFile(path.join(root,'data/financial-office-last.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
