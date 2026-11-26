import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { loadSowersMemorials } from '../server/sowers-memorials.mjs'
import { validateMemorial } from '../sowers/paint/core.mjs'
import { atomicWrite, validateArchive, validatePng } from '../tools/sowers-memorial.mjs'

const entry=(n=1)=>({sessionId:`reader-${n}`,agent:'Reader test',startedAt:'2026-11-26T00:00:00Z',endedAt:'2026-11-26T00:01:00Z',task:'Read archive fixture',symbol:`Reader symbol ${n}`,explanation:'Fixture only.',color:'#0080ff',glyph:'',strokes:[{color:'#0080ff',width:.03,points:[[.1,.1],[.8+n*.01,.9]]}],iteration:n,createdAt:'2026-11-26T00:01:00Z'})
const archive=(...entries)=>({version:1,entries,nextIteration:entries.length+1})
function chunk(type,data){const head=Buffer.alloc(8);head.writeUInt32BE(data.length);head.write(type,4,'ascii');const body=Buffer.concat([head,data]);const tail=Buffer.alloc(4);tail.writeUInt32BE(crc32(body.subarray(4)));return Buffer.concat([body,tail])}
function crc32(bytes){let c=0xffffffff;for(const x of bytes){c^=x;for(let i=0;i<8;i++)c=c&1?(c>>>1)^0xedb88320:c>>>1}return (c^0xffffffff)>>>0}

function approved(e,png){const sha=createHash('sha256').update(png).digest('hex');return {...e,image:{mime:'image/png',width:512,height:512,dataUrl:'data:image/png;base64,'+png.toString('base64'),sha256:sha},proof:{legacy:false,inputSha256:'a'.repeat(64),normalizedSha256:createHash('sha256').update(JSON.stringify(validateMemorial(e))).digest('hex'),sourceSha256:'c'.repeat(64),pngSha256:sha,approvedAt:'2026-11-26T00:01:00Z',inspectedBy:'reviewer',inspected:true}}}
function ihdr(){const sig=Buffer.from([137,80,78,71,13,10,26,10]),h=Buffer.alloc(13);h.writeUInt32BE(512);h.writeUInt32BE(512,4);h[8]=8;h[9]=6;const raw=Buffer.alloc(512*512*4+512);return Buffer.concat([sig,chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])}
test('archive validation rejects ordinal gaps, duplicates and malformed prior records',()=>{
 assert.throws(()=>validateArchive({...archive(entry(1),entry(2)),entries:[entry(2),entry(1)]}),/ordinal/)
 const a=entry(1),b={...entry(2),sessionId:a.sessionId};assert.throws(()=>validateArchive(archive(a,b)),/duplicate/)
 const c=entry(2);c.strokes=[];assert.throws(()=>validateArchive(archive(entry(1),c)),/stroke/)
})
test('approved proof binds canonical metadata and stroke content',()=>{
 const png=ihdr(),base=approved(entry(1),png)
 const changedTask={...base,task:'Altered after approval'}
 assert.throws(()=>validateArchive(archive(changedTask)),/proof/)
 const changedStrokes={...base,strokes:[{...base.strokes[0],points:[[.11,.1],[.81,.9]]}]}
 assert.throws(()=>validateArchive(archive(changedStrokes)),/proof/)
})
test('different vectors cannot reuse identical persisted PNG bytes',()=>{
 const png=ihdr(),a=approved(entry(1),png),b=approved(entry(2),png)
 assert.notEqual(JSON.stringify(validateMemorial(a)),JSON.stringify(validateMemorial(b)))
 assert.throws(()=>validateArchive(archive(a,b)),/duplicate approved PNG/)
})
test('PNG validation requires the bounded 512px PNG envelope',()=>{assert.ok(validatePng(ihdr()).length>57);const b=ihdr();b.writeUInt32BE(513,16);assert.throws(()=>validatePng(b));assert.throws(()=>validatePng(Buffer.from('<svg/>')),/PNG/)})
test('reader sanitizes approved images and labels legacy entries',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'sowers-reader-')),file=path.join(dir,'archive.json')
 try{
  const old=entry(1),png=ihdr(),dataUrl='data:image/png;base64,'+png.toString('base64'),sha=createHash('sha256').update(png).digest('hex')
  const current={...entry(2),image:{mime:'image/png',width:512,height:512,dataUrl,sha256:sha},proof:{legacy:false,inputSha256:'a'.repeat(64),normalizedSha256:createHash('sha256').update(JSON.stringify(validateMemorial(entry(2)))).digest('hex'),sourceSha256:'c'.repeat(64),pngSha256:sha,approvedAt:'2026-11-26T00:01:00Z',inspectedBy:'reviewer',inspected:true},extra:'discard'}
  await writeFile(file,JSON.stringify(archive(old,current)))
  const loaded=await loadSowersMemorials({file});assert.equal(loaded.entries.length,2);assert.deepEqual(loaded.entries[0].proof,{legacy:true,status:'legacy-strokes',approvalEvidence:'not-embedded'});assert.equal(loaded.entries[1].image.dataUrl,dataUrl);assert.equal('extra' in loaded.entries[1],false)
  current.image.sha256='0'.repeat(64);await writeFile(file,JSON.stringify(archive(old,current)));const broken=await loadSowersMemorials({file});assert.equal(broken.entries.length,0);assert.ok(broken.warnings.length)
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('missing archive is empty; malformed archive warns instead of claiming a history',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'sowers-reader-')),file=path.join(dir,'archive.json')
 try{const missing=await loadSowersMemorials({file});assert.equal(missing.entries.length,0);assert.equal(missing.warnings.length,0);await writeFile(file,'{');const malformed=await loadSowersMemorials({file});assert.equal(malformed.entries.length,0);assert.ok(malformed.warnings.length)}finally{await rm(dir,{recursive:true,force:true})}
})

test('failed atomic replacement preserves the previous target',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'sowers-atomic-')),target=path.join(dir,'archive.json');try{await writeFile(target,'previous');await rm(target);await import('node:fs/promises').then(fs=>fs.mkdir(target));await writeFile(path.join(target,'sentinel'),'keep');await assert.rejects(atomicWrite(target,{version:1}));assert.equal(await (await import('node:fs/promises')).readFile(path.join(target,'sentinel'),'utf8'),'keep');const files=await (await import('node:fs/promises')).readdir(dir);assert.deepEqual(files,['archive.json'])}finally{await rm(dir,{recursive:true,force:true})}})
