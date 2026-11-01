#!/usr/bin/env node
// Standalone, loopback-only scene launcher. No model or scheduler connection.
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn,execFileSync} from 'node:child_process'
import {setTimeout as delay} from 'node:timers/promises'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const args=process.argv.slice(2),at=args.indexOf('--port'),port=at<0?5286:Number(args[at+1])
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose a port between1024 and65535')
if(args.includes('--dual')&&process.platform!=='win32')throw Error('Use the normal browser launch on this platform; --dual uses the saved Windows layout')
const url=`http://127.0.0.1:${port}/suit-lab/`
async function probe(){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(1800)});const text=await r.text();if(r.ok&&text.includes('name="kestrel-field-lab"'))return true;throw Error('Port belongs to a different page; choose --port N')}
 catch(e){if(e.cause?.code==='ECONNREFUSED'||e.name==='TimeoutError')return false;throw e}
}
let ready=await probe(),created=false
if(!ready){
 const cache=path.join(root,'.cache','kestrel-lab');await fs.mkdir(cache,{recursive:true});const log=await fs.open(path.join(cache,'server.log'),'a')
 try{const child=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,detached:true,windowsHide:true,shell:false,stdio:['ignore',log.fd,log.fd]});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)});child.unref();created=true;await fs.writeFile(path.join(cache,`server-${port}.json`),JSON.stringify({pid:child.pid,url,modelCalls:0,workerDispatch:false},null,2))}finally{await log.close()}
 for(let i=0;i<60&&!ready;i++){await delay(250);ready=await probe()}
 if(!ready)throw Error('Scene server did not become ready; inspect .cache/kestrel-lab/server.log')
}
let layout=null
if(!args.includes('--no-open')){
 if(args.includes('--dual'))layout=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tools/dual-view-layout.ps1'),'-BotUrl',url,'-SwarmRoot',path.join(path.dirname(root),'swarm-protocol')],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}))
 else {const [command,params]=process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];const child=spawn(command,params,{detached:true,windowsHide:true,stdio:'ignore'});child.unref()}
}
console.log(JSON.stringify({url,created,ready,layout,residents:15,previewSlotLimit:3,modelCalls:0,workerDispatch:false},null,2))
