import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateMemorial, memorialSymbolKey, memorialVisualKey } from '../sowers/paint/core.mjs'

const defaultFile=fileURLToPath(new URL('../data/sowers-memorials.json',import.meta.url))
/** Artifact history only. Reading it cannot mark tasks complete or dispatch work. */
export async function loadSowersMemorials({file=process.env.SOWERS_MEMORIAL_FILE||defaultFile}={}) {
  const result={version:1,entries:[],nextIteration:1,observedAt:Date.now(),warnings:[]}
  if(typeof file!=='string'||!path.isAbsolute(file)){result.warnings.push('Memorial archive must be a configured absolute local path.');return result}
  let handle
  try {
    handle=await fs.open(file,constants.O_RDONLY|(constants.O_NONBLOCK||0));const before=await handle.stat()
    if(!before.isFile()||before.size>10*1024*1024)throw Error('Memorial archive is not a bounded regular file.')
    const bytes=Buffer.alloc(before.size+1);let length=0
    while(length<bytes.length){const {bytesRead}=await handle.read(bytes,length,bytes.length-length,length);if(!bytesRead)break;length+=bytesRead}
    const after=await handle.stat()
    if(length!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs)throw Error('Memorial archive changed during read.')
    const value=JSON.parse(bytes.subarray(0,length).toString('utf8'))
    if(value.version!==1||!Array.isArray(value.entries))throw Error('Unsupported memorial archive.')
    const ids=new Set(),symbols=new Set(),images=new Set()
    const entries=value.entries.map((entry,index)=>{
      const next=validateMemorial(entry)
      if(entry.iteration!==index+1||ids.has(next.sessionId)||symbols.has(memorialSymbolKey(next))||images.has(memorialVisualKey(next)))throw Error('Memorial archive identity/Iteration sequence is invalid.')
      ids.add(next.sessionId);symbols.add(memorialSymbolKey(next));images.add(memorialVisualKey(next))
      return {...next,id:next.sessionId,iteration:entry.iteration}
    })
    if(value.nextIteration!==undefined&&value.nextIteration!==entries.length+1)throw Error('Memorial archive sequence is invalid.')
    result.entries=entries;result.nextIteration=entries.length+1
  } catch(error) {
    if(error.code!=='ENOENT')result.warnings.push(error instanceof SyntaxError?'Memorial archive is not valid JSON.':'Memorial archive unavailable; existing images remain historical.')
  } finally {await handle?.close().catch(()=>{})}
  return result
}
