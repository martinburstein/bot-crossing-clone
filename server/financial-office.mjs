import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const viewerRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function readOfficeHistory({root=process.env.BOT_CROSSING_OFFICE_ROOT??path.resolve(viewerRoot,'../crypto-research-lab/projects/crypto-swarm-2026-10-15/office')}={}){
  try{
    const bytes=await fs.readFile(path.join(root,'history.json'),'utf8');
    if(bytes.length>1_000_000)throw Error('History exceeds bounded read');
    const value=JSON.parse(bytes);
    const digest=createHash('sha256').update(JSON.stringify(value.entries)).digest('hex');
    if(value.schemaVersion!==1||digest!==value.digest||!Array.isArray(value.entries)||value.entries.length>2000)throw Error('History integrity mismatch');
    const entries=value.entries.slice(-160).map(e=>{
      if(!/^[a-z0-9-]+$/.test(e.id??'')||typeof e.text!=='string'||e.text.length>700||!Array.isArray(e.sources)||!['source-note','research-question','project-decision','accepted-contribution'].includes(e.kind))throw Error('Invalid history entry');
      return {id:e.id,speaker:String(e.speaker??'office').slice(0,80),kind:e.kind,text:e.text,sources:e.sources.slice(0,8),at:e.at,
        origin:e.origin,acceptedTaskId:e.acceptedTaskId??null,submissionDigest:e.submissionDigest??null};
    });
    return {available:true,digest,entries,totalEntries:value.entries.length,updatedAt:value.updatedAt,planningBrief:value.planningBrief??null,
      interpretation:'Persistent attributed notes and accepted work; ambient playback makes no model calls.'};
  }catch(error){return {available:false,digest:null,entries:[],totalEntries:0,reason:error.code==='ENOENT'?'No saved office history yet':'Office history unavailable or failed integrity check'};}
}
