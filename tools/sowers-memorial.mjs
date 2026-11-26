#!/usr/bin/env node
import { readFile, writeFile, rename, open, mkdir, stat, unlink } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { validateMemorial, memorialSymbolKey, memorialVisualKey } from '../sowers/paint/core.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const corePath=path.join(root,'sowers/paint/core.mjs')
const cliPath=fileURLToPath(import.meta.url)
const archive=path.resolve(process.env.SOWERS_MEMORIAL_FILE||path.join(root,'data/sowers-memorials.json'))
const PNG_SIG=Buffer.from([137,80,78,71,13,10,26,10]), MAX_PNG=5*1024*1024
const hash=b=>createHash('sha256').update(b).digest('hex')
const shaJson=x=>hash(Buffer.from(JSON.stringify(x)))
const sourceDigest=async()=>hash(Buffer.concat([await readFile(corePath),Buffer.from([0]),await readFile(cliPath)]))
const exists=async p=>{try{return await stat(p)}catch(e){if(e.code==='ENOENT')return null;throw e}}
const error=m=>{throw Error(m)}

function crc32(bytes) {
  let crc=0xffffffff
  for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1}
  return (crc^0xffffffff)>>>0
}
export function validatePng(bytes) {
  const b=Buffer.from(bytes)
  if(b.length<57||b.length>MAX_PNG||!b.subarray(0,8).equals(PNG_SIG)) error('Memorial PNG must be a bounded 512×512 truecolor PNG')
  let offset=8,first=true,hasData=false,ended=false
  while(offset+12<=b.length){
    const length=b.readUInt32BE(offset),end=offset+12+length
    if(length>MAX_PNG||end>b.length) error('Malformed memorial PNG chunk')
    const type=b.toString('ascii',offset+4,offset+8),crc=b.readUInt32BE(offset+8+length)
    if(crc32(b.subarray(offset+4,offset+8+length))!==crc) error('Memorial PNG chunk checksum mismatch')
    if(first){if(type!=='IHDR'||length!==13||b.readUInt32BE(offset+8)!==512||b.readUInt32BE(offset+12)!==512||b[offset+16]!==8||![2,6].includes(b[offset+17])) error('Memorial PNG must be a bounded 512×512 truecolor PNG');first=false}
    if(type==='IDAT')hasData=true
    if(type==='IEND'){if(length!==0||end!==b.length)error('Malformed memorial PNG end chunk');ended=true;break}
    offset=end
  }
  if(!ended||!hasData)error('Incomplete memorial PNG')
  return b
}
function pngFromEntry(image) {
  if(!image||image.mime!=='image/png'||image.width!==512||image.height!==512||typeof image.dataUrl!=='string'||image.dataUrl.length>MAX_PNG*1.4||!image.dataUrl.startsWith('data:image/png;base64,')) error('Invalid memorial image')
  const encoded=image.dataUrl.slice(22)
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) error('Invalid memorial PNG encoding')
  const png=validatePng(Buffer.from(encoded,'base64'))
  if(hash(png)!==image.sha256) error('Memorial PNG digest mismatch')
  return png
}
function validateProof(entry) {
  if(!entry.image) {
    if(entry.proof && (entry.proof.legacy!==true||entry.proof.status!=='legacy-strokes')) error('Invalid legacy memorial provenance')
    return {legacy:true,status:'legacy-strokes',approvalEvidence:'not-embedded'}
  }
  pngFromEntry(entry.image)
  const p=entry.proof
  if(!p||p.legacy!==false||p.inspected!==true||!['inputSha256','normalizedSha256','sourceSha256','pngSha256'].every(k=>/^[a-f0-9]{64}$/.test(p[k]||''))||p.normalizedSha256!==shaJson(validateMemorial(entry))||p.pngSha256!==entry.image.sha256||!Number.isFinite(Date.parse(p.approvedAt))||typeof p.inspectedBy!=='string'||!p.inspectedBy) error('Invalid approved memorial proof')
  return {legacy:false,inputSha256:p.inputSha256,normalizedSha256:p.normalizedSha256,sourceSha256:p.sourceSha256,pngSha256:p.pngSha256,approvedAt:p.approvedAt,inspectedBy:p.inspectedBy,inspected:true}
}
export function validateArchive(value) {
  if(!value||value.version!==1||!Array.isArray(value.entries)||value.nextIteration!==value.entries.length+1) error('Private archive schema/sequence is inconsistent')
  const ids=new Set(),symbols=new Set(),images=new Set(),pngs=new Set()
  for(let i=0;i<value.entries.length;i++) {
    const e=value.entries[i],m=validateMemorial(e)
    if(e.iteration!==i+1||typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt))) error('Private archive ordinal or timestamp is invalid')
    const id=m.sessionId,symbol=memorialSymbolKey(m),visual=memorialVisualKey(m)
    if(ids.has(id)||symbols.has(symbol)||images.has(visual)) error('Private archive contains duplicate identity, symbol or drawing')
    ids.add(id);symbols.add(symbol);images.add(visual);const proof=validateProof(e);if(e.image){if(pngs.has(proof.pngSha256))error('Private archive contains duplicate approved PNG images');pngs.add(proof.pngSha256)}
  }
  return value
}
async function inputFor(p){const raw=await readFile(p);let parsed;try{parsed=JSON.parse(raw)}catch{error('Draft must be valid JSON')}return {raw,entry:validateMemorial(parsed)}}
async function browserRender(entry,out){let playwright;const mod=process.env.SOWERS_PLAYWRIGHT_MODULE||'playwright';try{playwright=await import(pathToFileURL(path.resolve(mod)).href)}catch{try{playwright=await import(mod)}catch{error('Playwright is needed for CLI preview. Set SOWERS_PLAYWRIGHT_MODULE to its installed module path.')}}const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.SOWERS_CHROME||undefined,args:['--no-sandbox']});try{const page=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1});await page.setContent('<canvas id="c" width="512" height="512"></canvas>');await page.evaluate(({entry})=>{const c=document.querySelector('#c'),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,512,512);x.lineCap='round';x.lineJoin='round';for(const s of entry.strokes){x.beginPath();x.strokeStyle=s.color;x.fillStyle=s.color;x.lineWidth=s.width*512;s.points.forEach(([a,b],i)=>i?x.lineTo(a*512,b*512):x.moveTo(a*512,b*512));if(s.points.length===1){x.arc(s.points[0][0]*512,s.points[0][1]*512,s.width*256,0,Math.PI*2);x.fill()}else x.stroke()}},{entry});await page.locator('#c').screenshot({path:out,type:'png'})}finally{await browser.close()}}
function receiptPaths(p){return {png:p.replace(/\.json$/,'')+'.preview.png',receipt:p.replace(/\.json$/,'')+'.preview.json',approval:p.replace(/\.json$/,'')+'.approval.json'}}
async function preview(p){const {raw,entry}=await inputFor(p),o=receiptPaths(path.resolve(p));await browserRender(entry,o.png);const png=validatePng(await readFile(o.png)),source=await sourceDigest();const r={draft:path.basename(p),sessionId:entry.sessionId,inputSha256:hash(raw),normalizedSha256:shaJson(entry),sourceSha256:source,png:o.png,pngSha256:hash(png),createdAt:new Date().toISOString(),approved:false};await writeFile(o.receipt,JSON.stringify(r,null,2)+'\n');await unlink(o.approval).catch(()=>{});console.log(JSON.stringify(r,null,2))}
async function approve(p){const {raw,entry}=await inputFor(p),o=receiptPaths(path.resolve(p)),receipt=JSON.parse(await readFile(o.receipt,'utf8')),png=validatePng(await readFile(o.png)),source=await sourceDigest();if(receipt.draft!==path.basename(p)||receipt.sessionId!==entry.sessionId||receipt.inputSha256!==hash(raw)||receipt.normalizedSha256!==shaJson(entry)||receipt.sourceSha256!==source||receipt.pngSha256!==hash(png))error('Preview receipt is stale; regenerate and inspect the preview image');const approval={sessionId:entry.sessionId,inputSha256:hash(raw),normalizedSha256:shaJson(entry),sourceSha256:source,pngSha256:hash(png),approvedAt:new Date().toISOString(),inspectedBy:process.env.USER||'coordinator',inspected:true};await writeFile(o.approval,JSON.stringify(approval,null,2)+'\n');console.log(`Preview approved after inspection: ${o.png}`)}
async function readReceipt(p,raw,entry){const o=receiptPaths(path.resolve(p)),receipt=JSON.parse(await readFile(o.receipt,'utf8')),approval=JSON.parse(await readFile(o.approval,'utf8')),png=validatePng(await readFile(o.png)),source=await sourceDigest(),inputHash=hash(raw),normalizedHash=shaJson(entry),pngHash=hash(png);if(receipt.draft!==path.basename(p)||receipt.sessionId!==entry.sessionId||receipt.inputSha256!==inputHash||receipt.normalizedSha256!==normalizedHash||receipt.sourceSha256!==source||receipt.pngSha256!==pngHash||approval.inputSha256!==inputHash||approval.normalizedSha256!==normalizedHash||approval.sourceSha256!==source||approval.pngSha256!==pngHash||approval.sessionId!==entry.sessionId||approval.inspected!==true||!Number.isFinite(Date.parse(approval.approvedAt))||typeof approval.inspectedBy!=='string'||!approval.inspectedBy)error('Approval/preview is stale or mismatched; preview and approve the exact current image');return {png,o,source,approval,inputHash,normalizedHash}}
export async function atomicWrite(target,value){const tmp=target+'.tmp-'+randomUUID();let f;try{f=await open(tmp,'wx');await f.writeFile(JSON.stringify(value,null,2)+'\n');await f.sync();await f.close();f=null;await rename(tmp,target);const dir=await open(path.dirname(target),'r');try{await dir.sync()}finally{await dir.close()}}catch(e){await f?.close().catch(()=>{});await unlink(tmp).catch(()=>{});throw e}}
async function commit(p){const {raw,entry}=await inputFor(p),r=await readReceipt(p,raw,entry);await mkdir(path.dirname(archive),{recursive:true});const lock=archive+'.lock';let handle;try{handle=await open(lock,'wx')}catch{error(`Archive lock exists (${lock}); fail closed and inspect it before retrying`)}let ownLock=true;try{await handle.writeFile(JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}));await handle.sync();const old=await exists(archive);let data={version:1,entries:[],nextIteration:1};if(old){if(!old.isFile()||old.size>10*1024*1024)error('Private archive is not a bounded regular file');try{data=JSON.parse(await readFile(archive,'utf8'))}catch{error('Private archive is corrupted; refusing to reset history')}validateArchive(data)}
 const pngData='data:image/png;base64,'+r.png.toString('base64'),image={mime:'image/png',width:512,height:512,dataUrl:pngData,sha256:hash(r.png)},proof={legacy:false,inputSha256:r.inputHash,normalizedSha256:r.normalizedHash,sourceSha256:r.source,pngSha256:hash(r.png),approvedAt:r.approval.approvedAt,inspectedBy:r.approval.inspectedBy,inspected:true}
 for(const oldEntry of data.entries){if(oldEntry.sessionId===entry.sessionId){if(JSON.stringify(validateMemorial(oldEntry))!==JSON.stringify(entry))error('This completion ID already has different memorial content');if(oldEntry.image){validateProof(oldEntry);console.log(`Identical retry: Iteration ${oldEntry.iteration}`);return}const upgraded={...oldEntry,image,proof};data.entries[data.entries.indexOf(oldEntry)]=upgraded;validateArchive(data);await atomicWrite(archive,data);console.log(`Attached approved image to existing Iteration ${oldEntry.iteration}`);return}if(memorialSymbolKey(oldEntry)===memorialSymbolKey(entry))error('Memorial symbol name duplicates an existing entry');if(memorialVisualKey(oldEntry)===memorialVisualKey(entry))error('Memorial image duplicates an existing entry')}
 const stored={...entry,iteration:data.nextIteration,createdAt:new Date().toISOString(),image,proof};data.entries.push(stored);data.nextIteration++;validateArchive(data);await atomicWrite(archive,data);console.log(`Saved Iteration ${stored.iteration} to ${archive}`)
 }finally{await handle.close().catch(()=>{});if(ownLock)await unlink(lock).catch(()=>{})}}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const arg=process.argv[2],file=process.argv[3]
 try{if(!['--preview','--approve-preview','--commit'].includes(arg)||!file)error('Usage: node tools/sowers-memorial.mjs --preview draft.json | --approve-preview draft.json | --commit draft.json');if(arg==='--preview')await preview(file);else if(arg==='--approve-preview')await approve(file);else await commit(file)}catch(e){console.error(e.message);process.exitCode=1}
}
