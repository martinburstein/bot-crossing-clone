import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const desktop=path.dirname(root),swarmRoot=path.join(desktop,'swarm-protocol')
const canon=JSON.parse(await fs.readFile(path.join(root,'CANON-VISUAL.json'),'utf8'))
const settingsFile=path.join(root,'data/dual-view.json')
let previous={}
try{previous=JSON.parse(await fs.readFile(settingsFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const chatId=process.env.CODEX_THREAD_ID||previous.chatId
if(!/^[a-f0-9-]{36}$/i.test(chatId||''))throw Error('Launch Dual View from the caller Codex chat to pin its usage HUD.')
await fs.mkdir(path.dirname(settingsFile),{recursive:true})
await fs.writeFile(settingsFile,JSON.stringify({chatId,counterRoot:path.join(desktop,'Token Counter')},null,2))
const {startSwarm,requestLauncher}=await import(pathToFileURL(path.join(swarmRoot,'swarm-start.mjs')).href)
const endpointFile=path.join(swarmRoot,'runtime/launcher/endpoint.json')
let before=null
try{const ep=JSON.parse(await fs.readFile(endpointFile,'utf8'));before=await requestLauncher(ep.url)}catch(e){if(e.code!=='ENOENT')throw e}
// Presentation-only startup preserves the selected project and creates no model turns.
const result=await startSwarm({open:false,connect:false,cover:'bot-crossing',botCrossingRoot:root})
const url=new URL(result.topLayer.url)
for(const [key,value]of Object.entries(canon.right.query))url.searchParams.set(key,value)
const layout=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tools/dual-view-layout.ps1'),'-BotUrl',url.href,'-SwarmRoot',swarmRoot],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}))
const endpoint=JSON.parse(await fs.readFile(endpointFile,'utf8')),after=await requestLauncher(endpoint.url)
if(before&&((after.coordinator.turns??0)!==(before.coordinator.turns??0)||after.runId!==before.runId))throw Error('Unexpected execution change during presentation-only launch.')
const receipt={observedAt:new Date().toISOString(),canon:'CANON-VISUAL.json',view:'Dual View',url:url.href,layout,modelCalls:0,workerDispatch:false,projectUnchanged:before?after.runId===before.runId:true,capacity:result.workers}
await fs.writeFile(path.join(root,'data/dual-view-last.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify(receipt,null,2))
