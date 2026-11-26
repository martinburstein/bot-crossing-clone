import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateMemorial, memorialSymbolKey, memorialVisualKey } from '../sowers/paint/core.mjs'
import { validatePng, validateArchive } from '../tools/sowers-memorial.mjs'

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
    validateArchive(value)
    const entries=value.entries.map(entry=>{
      const next=validateMemorial(entry)
      const legacy=!entry.image
      let image=null
      if(entry.image){
        const encoded=entry.image.dataUrl.slice('data:image/png;base64,'.length)
        const png=validatePng(Buffer.from(encoded,'base64'))
        image={mime:'image/png',width:512,height:512,dataUrl:'data:image/png;base64,'+png.toString('base64'),sha256:entry.image.sha256}
      }
      const proof=legacy?{legacy:true,status:'legacy-strokes',approvalEvidence:'not-embedded'}:{legacy:false,inputSha256:entry.proof.inputSha256,normalizedSha256:entry.proof.normalizedSha256,sourceSha256:entry.proof.sourceSha256,pngSha256:entry.proof.pngSha256,approvedAt:entry.proof.approvedAt,inspectedBy:entry.proof.inspectedBy,inspected:true}
      return {...next,id:next.sessionId,iteration:entry.iteration,createdAt:entry.createdAt,image,proof}
    })
    result.entries=entries;result.nextIteration=entries.length+1
  } catch(error) {
    if(error.code!=='ENOENT')result.warnings.push(error instanceof SyntaxError?'Memorial archive is not valid JSON.':'Memorial archive unavailable; existing images remain historical.')
  } finally {await handle?.close().catch(()=>{})}
  return result
}
