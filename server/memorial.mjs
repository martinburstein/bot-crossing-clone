import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {validateMemorial} from '../src/office/memorial.js';
import {choosePlacement} from '../src/world/frontera-layout.js';
const viewerRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultRoot=()=>process.env.BOT_CROSSING_OFFICE_ROOT??path.resolve(viewerRoot,'../crypto-research-lab/projects/crypto-swarm-2026-10-15/office');

export async function readMemorials({root=defaultRoot()}={}) {
  let raw;
  try{raw=await fs.readFile(path.join(root,'memorials.json'),'utf8');}catch(e){if(e.code==='ENOENT')return {schemaVersion:1,entries:[],nextIteration:1};throw e;}
  const value=JSON.parse(raw);
  if(value.schemaVersion!==1||!Array.isArray(value.entries))throw Error('Invalid memorial archive');
  const sessions=new Set(),placements=[];let last=0;
  for(const entry of value.entries){validateMemorial(entry);if(!Number.isSafeInteger(entry.iteration)||entry.iteration<=last||sessions.has(entry.sessionId))throw Error('Invalid memorial sequence');last=entry.iteration;sessions.add(entry.sessionId);entry.placement=choosePlacement(entry.iteration,placements,entry.placement);placements.push(entry.placement);}
  if(!Number.isSafeInteger(value.nextIteration)||value.nextIteration<=last)throw Error('Invalid next memorial iteration');
  return value;
}

// Invoked explicitly by a retiring agent/coordinator, never by the viewer or a timer.
// Exclusive lock also protects independent CLI processes. A stale lock fails closed.
export async function appendMemorial(input,{root=defaultRoot()}={}) {
  const entry=validateMemorial(input);
  await fs.access(root);
  const file=path.join(root,'memorials.json'),lock=path.join(root,'memorials.lock');
  let handle;
  try{handle=await fs.open(lock,'wx');}catch(e){if(e.code==='EEXIST')throw Error('Memorial archive is locked; inspect the other writer before retrying');throw e;}
  const tmp=`${file}.${randomUUID()}.tmp`;
  try{
    const archive=await readMemorials({root});
    const existing=archive.entries.find(e=>e.sessionId===entry.sessionId);
    if(existing){if(JSON.stringify(validateMemorial(existing))!==JSON.stringify(entry)||(input.placement&&JSON.stringify(input.placement)!==JSON.stringify(existing.placement)))throw Error('This session already has a different memorial');return existing;}
    if(archive.nextIteration>=Number.MAX_SAFE_INTEGER)throw Error('Memorial sequence exhausted');
    const placement=choosePlacement(archive.nextIteration,archive.entries.map(e=>e.placement),input.placement);
    const saved={iteration:archive.nextIteration,...entry,placement};
    const next={schemaVersion:1,nextIteration:archive.nextIteration+1,entries:[...archive.entries,saved]};
    await fs.writeFile(tmp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});
    await fs.rename(tmp,file);return saved;
  }finally{await fs.rm(tmp,{force:true});await handle.close();await fs.unlink(lock);}
}
