import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'

const defaultRoot=fileURLToPath(new URL('../../swarm-protocol/',import.meta.url))
const integer=n=>Number.isSafeInteger(n)&&n>=0
// Codex includes cached input in input_tokens. Construction counts uncached input + output.
export function usageFromEvents(text) {
  let usage=null
  for(const line of text.split(/\r?\n/)) {
    let event;try {event=JSON.parse(line)} catch {continue}
    if(event.type!=='turn.completed') continue
    const u=event.usage
    if(!integer(u?.input_tokens)||!integer(u?.output_tokens)||!integer(u?.cached_input_tokens??0)||(u.cached_input_tokens??0)>u.input_tokens) continue
    const total=u.input_tokens-(u.cached_input_tokens??0)+u.output_tokens
    if(integer(total)) usage={total,input:u.input_tokens,cachedInput:u.cached_input_tokens??0,output:u.output_tokens}
  }
  return usage
}
let queue=Promise.resolve(),sequence=0
export function readMagiTokens(projection,options={}) {
  const run=()=>readTokens(projection,options)
  const result=queue.then(run,run);queue=result.catch(()=>{});return result
}
// The viewer stores only measured usage receipts locally. It never writes protocol state.
async function readTokens(projection,{root=process.env.BOT_CROSSING_PROTOCOL_ROOT||defaultRoot,storeDirectory=process.env.BOT_CROSSING_MAGI_STORE,cacheFile}={}) {
  const result=new Map(),receipts=new Map();let available=false,changed=false
  if(cacheFile) try {
    const saved=JSON.parse(await fs.readFile(cacheFile,'utf8'))
    if(saved.format===1)for(const entry of saved.receipts||[])if(typeof entry.key==='string'&&typeof entry.projectId==='string'&&/^(?:w(?:0[0-9]|1[0-5])|balthasar|casper)$/.test(entry.workerId)&&integer(entry.total))receipts.set(entry.key,entry)
  } catch { /* First observation has no cache. */ }
  for(const worker of projection.workers)result.set(worker.id,{total:0,source:'codex-executor',completedTurns:0,pendingTurns:0,cached:true})
  try {
    let directory=storeDirectory
    if(!directory) {
      const home=path.join(root,'runtime','launcher'),session=JSON.parse(await fs.readFile(path.join(home,'session.json'),'utf8'))
      if(!/^[a-f0-9-]{36}$/.test(session.runId)) throw Error('Invalid run identity')
      directory=path.join(home,'runs',session.runId)
    }
    const envelope=JSON.parse(await fs.readFile(path.join(directory,'state.json'),'utf8')),state=envelope.state
    if(envelope.format!==1||state?.projectId!==projection.projectId||state?.revision!==projection.revision||state?.magi?.mode!=='magi')throw Error('Projection changed')
    available=true
    const seen=new Set()
    for(const lease of Object.values(state.leases||{})) {
      const owner=result.get(lease.workerId),cluster=['roarm-16','roarm-campus'].includes(state.magi.profile)?({w00:'melchior',balthasar:'balthasar',casper:'casper'})[lease.workerId]:['melchior','balthasar','casper'][Math.floor((Number(lease.workerId?.slice(1))-1)/5)]
      if(!owner||typeof lease.id!=='string'||typeof lease.turnToken!=='string'||!lease.turnToken||lease.clusterId!==cluster) continue
      const key=createHash('sha256').update(JSON.stringify([projection.projectId,lease.id,lease.turnToken])).digest('hex')
      if(seen.has(key))continue;seen.add(key)
      const dir=path.join(directory,'executor',Buffer.from(lease.id).toString('base64url'),Buffer.from(lease.turnToken).toString('base64url'))
      try {
        const intent=JSON.parse(await fs.readFile(path.join(dir,'intent.json'),'utf8'))
        if(intent.leaseId!==lease.id||intent.turnToken!==lease.turnToken||intent.workerId!==lease.clusterId)throw Error('Receipt identity mismatch')
        const usage=usageFromEvents(await fs.readFile(path.join(dir,'events.jsonl'),'utf8'))
        if(!usage)throw Error('No completed usage')
        if(!receipts.has(key)){receipts.set(key,{key,projectId:projection.projectId,workerId:lease.workerId,total:usage.total});changed=true}
        owner.cached=false
      } catch {owner.pendingTurns++}
    }
  } catch { /* Keep prior measured receipts, never fabricate new usage. */ }
  for(const entry of receipts.values())if(entry.projectId===projection.projectId) {
    const owner=result.get(entry.workerId)
    if(owner&&integer(owner.total+entry.total)){owner.total+=entry.total;owner.completedTurns++}
  }
  for(const [id,owner]of result) {
    if(!available&&!owner.completedTurns)result.delete(id)
    else if(!owner.completedTurns&&available)owner.cached=false
  }
  if(cacheFile&&changed) {
    const temp=`${cacheFile}.${process.pid}.${++sequence}.tmp`
    try {await fs.mkdir(path.dirname(cacheFile),{recursive:true});await fs.writeFile(temp,JSON.stringify({format:1,receipts:[...receipts.values()]}));await fs.rename(temp,cacheFile)}
    catch {for(const owner of result.values())owner.persistenceWarning=true}
    finally {await fs.rm(temp,{force:true}).catch(()=>{})}
  }
  return result
}
