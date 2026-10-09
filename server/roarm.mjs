import fs from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

const tokenFile=fileURLToPath(new URL('../../waveshare-robotic-arm/runtime/access.json',import.meta.url))
const JOINTS=['base','shoulder','elbow','gripper']
export function projectObservation(status,now=Date.now()) {
  const source=status?.source==='hardware'?'hardware':status?.source==='simulator'?'simulator':null
  const value=source==='hardware'?status.measured:source==='simulator'?status.simulated:null
  const observedAt=typeof value?.observedAt==='string'?Date.parse(value.observedAt):NaN
  const valid=value?.source===source&&JOINTS.every(k=>Number.isFinite(value?.[k])&&Math.abs(value[k])<=Math.PI*4)
  const fresh=valid&&status.connected===true&&status.freshness==='live'&&Number.isFinite(observedAt)&&now-observedAt>=0&&now-observedAt<=5000
  return {source,state:fresh?'live':status?.connected?'stale':'offline',
    pose:fresh?Object.fromEntries(JOINTS.map(k=>[k,value[k]])):null,
    observedAt:fresh?new Date(observedAt).toISOString():null,receivedAt:new Date(now).toISOString(),
    connected:status?.connected===true,armed:status?.armed===true,controllerBusy:status?.execution?.busy===true,
    unresolvedMovementCount:Array.isArray(status?.movement?.unresolved)?status.movement.unresolved.length:null}
}

/** Fixed GET-only controller bridge. Credentials and controller ownership never leave this server. */
export function createObservationReader({fetchImpl=fetch,readToken=async()=>JSON.parse(await fs.readFile(tokenFile,'utf8')).token,now=Date.now}={}) {
  let cached=null,lastGood=null,checkedAt=-Infinity,pending=null
  return async function read() {
    if(cached&&now()-checkedAt<750)return cached
    if(pending)return pending
    pending=(async()=>{
      let next
      try {
        const token=await readToken()
        if(typeof token!=='string'||!token)throw Error('No access')
        const response=await fetchImpl('http://127.0.0.1:8787/api/status',{method:'GET',redirect:'error',cache:'no-store',headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(2000)})
        if(!response.ok)throw Error('Unavailable')
        next=projectObservation(await response.json(),now())
      } catch {next={source:null,state:'offline',pose:null,observedAt:null,receivedAt:new Date(now()).toISOString(),connected:false,armed:null,controllerBusy:null,unresolvedMovementCount:null}}
      if(next.state==='live')lastGood=next
      else if(lastGood)next={...next,source:lastGood.source,pose:lastGood.pose,observedAt:lastGood.observedAt}
      cached=next;checkedAt=now();return next
    })()
    try{return await pending}finally{pending=null}
  }
}
export const readRoArmObservation=createObservationReader()
