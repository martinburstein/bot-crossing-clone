import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { loadSowersBroadcast } from './sowers-broadcast.mjs'

const execute=promisify(execFile)
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const count=v=>Number.isSafeInteger(v)&&v>=0?v:null
const timestamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:null
export function measuredChat(snapshot,id) {
  const chat=snapshot?.chat
  if(chat?.id!==id)return {status:'unavailable',reportedAt:null,totalTokens:null,inputTokens:null,cachedInputTokens:null,outputTokens:null}
  return {status:typeof chat.status==='string'?chat.status:'unavailable',reportedAt:timestamp(chat.reportedAt),
    totalTokens:count(chat.totalTokens),inputTokens:count(chat.usage?.input_tokens),
    cachedInputTokens:count(chat.usage?.cached_input_tokens),outputTokens:count(chat.usage?.output_tokens)}
}
function retainVerified(previous,current) {
  if(previous?.totalTokens!==null&&previous?.totalTokens!==undefined&&
    (current.totalTokens===null||current.totalTokens<previous.totalTokens)) {
    return {...previous,status:'error',stale:true}
  }
  return current
}
async function monitor(file,id,account) {
  const args=[file,'--thread',id,'--json',...account?[]:['--tokens-only','--include-agents']]
  const {stdout}=await execute(process.execPath,args,{timeout:15000,maxBuffer:256*1024,windowsHide:true})
  return JSON.parse(stdout)
}
/** Runs the single maintained monitor. Fixed local configuration, no request
 * command/path arguments, no model turns, one account read per cached minute. */
export function createSowersUsageReader({run=monitor,now=Date.now,
  file=process.env.SOWERS_USAGE_MONITOR||path.join(os.homedir(),'.codex/skill-repos/ai-tools/token-monitor.cjs'),
  threadId=process.env.SOWERS_THREAD_ID,
  observation=async()=> (await loadSowersBroadcast()).magi,
  ttl=60000}={}) {
  let currentKey='',cached=null,cachedAt=-Infinity,pending=null
  return async function read() {
    const magi=await observation().catch(()=>null)
    const selected=threadId||magi?.coordinator?.threadId||process.env.CODEX_THREAD_ID
    const participants=(magi?.agents||[]).filter(a=>a.nativeId?.startsWith('codex:')&&UUID.test(a.nativeId.slice(6))).slice(0,3)
    const key=JSON.stringify([selected,...participants.map(a=>a.nativeId)])
    if(key!==currentKey){currentKey=key;cached=null;cachedAt=-Infinity;pending=null}
    if(cached&&now()-cachedAt<ttl)return cached
    if(pending)return pending
    const work=async()=>{
      const previous=cached
      const at=now(),empty={status:'unavailable',reportedAt:null,totalTokens:null,inputTokens:null,cachedInputTokens:null,outputTokens:null}
      const result={observedAt:at,source:'Maintained AI Tools token monitor',scope:'Lifetime processed tokens per local chat; cached input is already included. Account allowance is shared by the sign-in.',
        chat:{...empty},workers:participants.map(a=>({id:a.id,nativeId:a.nativeId,...empty})),
        waveTokens:null,workersMeasured:0,account:{status:'unavailable',reportedAt:null,remainingPercent:null,windowMinutes:null,resetsAt:null},warnings:[]}
      if(!UUID.test(selected||'')||!path.isAbsolute(file)) {
        result.warnings.push('Usage observer is not configured for a local chat.');return result
      }
      const values=await Promise.allSettled([run(file,selected,true),...participants.map(a=>run(file,a.nativeId.slice(6),false))])
      if(values[0].status==='fulfilled') {
        const source=values[0].value;result.chat=measuredChat(source,selected)
        const a=source.account
        const remaining=typeof a?.remainingPercent==='number'&&Number.isFinite(a.remainingPercent)&&a.remainingPercent>=0&&a.remainingPercent<=100?a.remainingPercent:null
        result.account={status:typeof a?.status==='string'?a.status:'unavailable',reportedAt:timestamp(a?.reportedAt),remainingPercent:remaining,windowMinutes:count(a?.windowMinutes),resetsAt:count(a?.resetsAt)}
      } else result.warnings.push('The local usage monitor could not be read.')
      result.chat=retainVerified(previous?.chat,result.chat)
      result.workers=result.workers.map((worker,index)=>{
        const next=values[index+1].status==='fulfilled'?{...worker,...measuredChat(values[index+1].value,worker.nativeId.slice(6))}:worker
        return retainVerified(previous?.workers.find(old=>old.nativeId===worker.nativeId),next)
      })
      result.workersMeasured=result.workers.filter(w=>w.totalTokens!==null).length
      result.workersFresh=result.workers.filter(w=>w.totalTokens!==null&&!w.stale&&w.status==='connected').length
      result.waveStale=result.workers.some(w=>w.stale||w.status!=='connected')
      if(participants.length===3&&result.workersMeasured===3)result.waveTokens=result.workers.reduce((sum,w)=>sum+w.totalTokens,0)
      if(result.workersMeasured<participants.length)result.warnings.push('Some worker token reports are not yet available.')
      if(result.chat.stale||result.workers.some(w=>w.stale))result.warnings.push('A token source is unavailable or lower than its verified cumulative total; retained readings are historical.')
      if(previous&&result.account.remainingPercent===null&&previous.account.remainingPercent!==null)result.account={...previous.account,status:'error'}
      if(values.every(v=>v.status==='rejected')){result.stale=true;result.attemptedAt=at}
      return result
    }
    const request=work().then(result=>{
      if(currentKey===key){cached=result;cachedAt=now()}
      return result
    }).finally(()=>{if(pending===request)pending=null})
    pending=request
    return request
  }
}
export const loadSowersUsage=createSowersUsageReader()
