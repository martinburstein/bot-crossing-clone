import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const viewerRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function readOfficeActivity({root=process.env.BOT_CROSSING_OFFICE_ROOT??path.resolve(viewerRoot,'../crypto-research-lab/projects/crypto-swarm-2026-10-15/office'),now=Date.now()}={}){
  try{
    const raw=await fs.readFile(path.resolve(root,'../.local/office-activity.json'),'utf8');
    if(raw.length>16000)throw Error('Activity snapshot too large');
    const v=JSON.parse(raw),ids=['michael-burry','steve-eisman','ben-hockett'];
    if(v.schemaVersion!==1||v.kind!=='coordinator-observed-collaboration'||!Number.isFinite(v.observedAt)||v.observedAt>now+5000||!Array.isArray(v.agents)||v.agents.length!==3||new Set(v.agents.map(a=>a.profileId)).size!==3||v.agents.some(a=>!ids.includes(a.profileId)||!['running','completed','interrupted'].includes(a.status)||typeof a.task!=='string'||a.task.length>250||(a.lastCompletedTask!==undefined&&(typeof a.lastCompletedTask!=='string'||!a.lastCompletedTask.trim()||a.lastCompletedTask.length>250))))throw Error('Invalid activity snapshot');
    const terminal=v.agents.every(a=>a.status!=='running'),fresh=terminal||now-v.observedAt<=60000;
    return {available:true,fresh,kind:v.kind,observedAt:v.observedAt,agents:v.agents,terminal,interpretation:'Coordinator observation of actual collaboration-agent status; not native MAGI telemetry.'};
  }catch(e){return {available:false,reason:e.code==='ENOENT'?'not-configured':'invalid'};}
}
export async function readOfficeHistory({root=process.env.BOT_CROSSING_OFFICE_ROOT??path.resolve(viewerRoot,'../crypto-research-lab/projects/crypto-swarm-2026-10-15/office')}={}){
  let thoughts=null;
  try{
    const raw=await fs.readFile(path.join(root,'thoughts.json'),'utf8');if(raw.length>12000)throw Error('Thought snapshot too large');
    const value=JSON.parse(raw);
    if(value.schemaVersion===1&&value.kind==='saved-character-flavor'&&value.profiles&&Object.entries(value.profiles).length===8&&Object.entries(value.profiles).every(([k,v])=>/^[a-z-]+$/.test(k)&&typeof v==='string'&&v.length<=500))thoughts={profiles:value.profiles,updatedAt:value.updatedAt,sessionId:value.sessionId};
  }catch{/* Flavor is optional; never generate live model text. */}
  try{
    const bytes=await fs.readFile(path.join(root,'history.json'),'utf8');
    if(bytes.length>1_000_000)throw Error('History exceeds bounded read');
    const value=JSON.parse(bytes);
    const digest=createHash('sha256').update(JSON.stringify(value.entries)).digest('hex');
    if(value.schemaVersion!==1||digest!==value.digest||!Array.isArray(value.entries)||value.entries.length>2000)throw Error('History integrity mismatch');
    const entries=value.entries.slice(-160).map(e=>{
      if(!/^[a-z0-9-]+$/.test(e.id??'')||typeof e.text!=='string'||e.text.length>700||!Array.isArray(e.sources)||!['source-note','research-question','project-decision','accepted-contribution','coordinator-qualification','coordinator-source-check','coordinator-session-closeout','supplemental-reviewed-report-summary','coordinator-source-qualification','coordinator-source-correction','coordinator-source-follow-up','coordinator-data-qualification','coordinator-source-freshness-check','coordinator-reviewed-evidence'].includes(e.kind))throw Error('Invalid history entry');
      return {id:e.id,speaker:String(e.speaker??'office').slice(0,80),kind:e.kind,text:e.text,sources:e.sources.slice(0,8),at:e.at,
        origin:e.origin,acceptedTaskId:e.acceptedTaskId??null,submissionDigest:e.submissionDigest??null};
    });
    return {available:true,digest,entries,thoughts,totalEntries:value.entries.length,updatedAt:value.updatedAt,planningBrief:value.planningBrief??null,
      interpretation:'Persistent attributed notes and accepted work; ambient playback makes no model calls.'};
  }catch(error){return {available:false,digest:null,entries:[],thoughts,totalEntries:0,reason:error.code==='ENOENT'?'No saved office history yet':'Office history unavailable or failed integrity check'};}
}
