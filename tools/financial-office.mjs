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
let before=null,endpoint=null,requestLauncher=null;
try{
  // Two sibling repositories are sufficient for the presentation-only office.
  // The protocol launcher is optional read-only telemetry, never a startup dependency.
  ({requestLauncher}=await import(pathToFileURL(path.join(swarmRoot,'swarm-start.mjs')).href));
  endpoint=JSON.parse(await fs.readFile(path.join(swarmRoot,'runtime/launcher/endpoint.json'),'utf8'));
  before=await requestLauncher(endpoint.url);
}catch{/* A visual office also works without an execution service. */}
const port=Number(process.env.BOT_CROSSING_OFFICE_PORT||57986);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid office port.');
const officeRoot=path.resolve(process.env.BOT_CROSSING_OFFICE_ROOT||path.join(desktop,'crypto-research-lab/projects/crypto-swarm-2026-10-15/office'));
await fs.access(path.join(officeRoot,'history.json'));
await fs.access(path.join(root,'dist/index.html')).catch(()=>{throw Error('Build the viewer first: npm ci --ignore-scripts && npm run build');});
const hudSettingsFile=path.join(root,'data/dual-view.json');
let hudSettings={};
try{hudSettings=JSON.parse(await fs.readFile(hudSettingsFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const chatId=process.env.CODEX_THREAD_ID||hudSettings.chatId;
if(/^[a-f0-9-]{36}$/i.test(chatId||'')){
  await fs.mkdir(path.dirname(hudSettingsFile),{recursive:true});
  await fs.writeFile(hudSettingsFile,JSON.stringify({chatId,counterRoot:path.join(desktop,'Token Counter')},null,2)+'\n',{mode:0o600});
}
const url=new URL(`http://127.0.0.1:${port}/`);
for(const [k,v]of Object.entries(spec.right.query))url.searchParams.set(k,v);
url.searchParams.set('swarm','1');url.searchParams.set('magi','1');
async function health(){try{const r=await fetch(new URL('/api/financial-office/health',url),{signal:AbortSignal.timeout(1500)});return r.ok?await r.json():null;}catch{return null;}}
let ready=await health();
if(ready&&ready.application!=='financial-office-viewer')throw Error('Office port belongs to another service.');
if(ready&&ready.version<6){
  if(process.platform!=='win32')throw Error('An older viewer is already on this port. Stop it from its owning terminal or choose BOT_CROSSING_OFFICE_PORT; no unknown process was stopped.');
  const owner=Number(ready.pid);if(!Number.isSafeInteger(owner)||owner<=0)throw Error('Missing office process identity');
  execFileSync('powershell.exe',['-NoProfile','-Command',`$taskProcess=Get-CimInstance Win32_Process -Filter 'ProcessId = ${owner}'; $taskListener=Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction Stop; if($taskProcess.Name -ne 'node.exe' -or $taskProcess.CommandLine -notmatch 'server[\\/]serve[.]mjs' -or @($taskListener | Where-Object OwningProcess -eq ${owner}).Count -eq 0){throw 'Office process identity mismatch'}; Stop-Process -Id ${owner} -ErrorAction Stop`],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  ready=null;
}
await fs.mkdir(path.join(root,'data'),{recursive:true});
if(!ready){
  try{await fetch(url,{signal:AbortSignal.timeout(1200)});throw Error('Office port is occupied by a different application.');}catch(e){if(e.message==='Office port is occupied by a different application.')throw e;}
  const log=openSync(path.join(root,'data/financial-office.log'),'a');
  const env={...process.env,PORT:String(port),BOT_CROSSING_HOST:'127.0.0.1',BOT_CROSSING_OFFICE_ROOT:officeRoot};
  if(before?.layerUrls?.magi)env.BOT_CROSSING_MAGI_URL=new URL('/api/state',before.layerUrls.magi).href;
  const child=spawn(process.execPath,['server/serve.mjs'],{cwd:root,env,windowsHide:true,detached:true,stdio:['ignore',log,log]});child.unref();closeSync(log);
  for(let n=0;n<40;n++){ready=await health();if(ready)break;await new Promise(r=>setTimeout(r,250));}
  if(ready?.application!=='financial-office-viewer')throw Error('Office server did not become ready; inspect data/financial-office.log.');
}
if(path.resolve(ready.viewerRoot||'')!==root||path.resolve(ready.officeRoot||'')!==officeRoot)throw Error('Existing office belongs to a different checkout or research project. Choose another office port.');
let layout=null;
if(!process.argv.includes('--no-open')){
  if(process.platform==='darwin')layout=(await import('./financial-office-macos.mjs')).openMacOffice(url.href);
  else if(process.platform==='win32')layout=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tools/financial-office-layout.ps1'),'-BotUrl',url.href,'-SwarmRoot',swarmRoot,...(process.argv.includes('--refresh')?['-Refresh']:[])],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  else throw Error('Use --no-open on this platform and open the returned office URL.');
}
const after=endpoint&&requestLauncher?await requestLauncher(endpoint.url).catch(()=>null):null;
if(before&&after&&(before.runId!==after.runId||before.coordinator.turns!==after.coordinator.turns))throw Error('Execution changed during presentation-only office launch.');
const receipt={observedAt:new Date().toISOString(),variant:'FINANCIAL-OFFICE.json',url:url.href,pid:ready.pid,layout,modelCalls:0,workerDispatch:false,executionUnchanged:before&&after?true:null,canonPreserved:true};
await fs.writeFile(path.join(root,'data/financial-office-last.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
