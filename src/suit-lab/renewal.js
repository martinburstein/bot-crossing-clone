import {TEAM} from './team.js'
import {flowerRecipe,flowerFingerprint} from './flowers.js'

// Browser-only preview contract. No model/session, protocol, worker, or research
// completion can be created by these functions. A real adapter belongs to the
// owning Swarm protocol and must consume independently accepted receipts.
export function createRenewal(){return {schema:1,mode:'preview',nextWave:1,phase:'pool',active:[],pending:[],flowers:[],waves:[],bodies:Object.fromEntries(TEAM.map(p=>[p.id,{generation:1,lastWave:null,notes:[]}]))}}
const clone=s=>JSON.parse(JSON.stringify(s))
export function nextTrio(s){const start=((s.nextWave-1)%5)*3;return TEAM.slice(start,start+3).map(p=>p.id)}
export function idleWaves(s,id){const last=s.bodies[id].lastWave;return last===null?0:Math.max(0,s.nextWave-last-1)}
export function beginPreviewWave(state){
 if(state.mode!=='preview'||state.phase!=='pool'||state.active.length)throw Error('Finish the current preview before starting another wave')
 const s=clone(state),ids=nextTrio(s),retiring=TEAM.map(p=>p.id).filter(id=>s.bodies[id].lastWave===s.nextWave-4)
 if(ids.some(id=>s.bodies[id].lastWave!==null))throw Error('A returning body must plant before its next activation')
 if(retiring.length){
  if(retiring.length!==3)throw Error('Exactly three bodies occupy the planting stage')
  const seen=new Set(s.flowers.map(f=>flowerFingerprint(f.recipe)))
  s.pending=retiring.map(id=>{const body=s.bodies[id],key=`preview:${id}:generation-${body.generation}:before-wave-${s.nextWave+1}`;let recipe=flowerRecipe(key),n=0;while(seen.has(flowerFingerprint(recipe))&&n<8)recipe=flowerRecipe(`${key}:${++n}`);if(seen.has(flowerFingerprint(recipe)))throw Error('Flower geometry must be unique');seen.add(flowerFingerprint(recipe));return {id:key,bodyId:id,generation:body.generation,lastWave:body.lastWave,plantedDuringWave:s.nextWave,beforeWave:s.nextWave+1,recipe,notes:clone(body.notes),provenance:'visual-preview'}})
 }
 s.phase='working';s.active=ids;return s
}
export function finishPreviewWave(state,note=''){
 if(state.mode!=='preview'||state.phase!=='working'||state.active.length!==3)throw Error('A complete trio must be on a preview wave')
 if(state.pending.length)throw Error('The planting trio must finish before advancing the wave')
 if(typeof note!=='string'||note.length>4000)throw Error('Keep the handoff note under 4,000 characters')
 const s=clone(state),text=note.trim(),ids=[...s.active]
 for(const id of ids){s.bodies[id].lastWave=s.nextWave;if(text)s.bodies[id].notes.push({wave:s.nextWave,text,source:'user-preview-note'})}
 s.waves.push({wave:s.nextWave,ids,generations:ids.map(id=>s.bodies[id].generation),note:text,provenance:'visual-preview'})
 s.nextWave++;s.phase='pool';s.active=[];return s
}
export function finishPlanting(state,plantedIds){
 if(state.mode!=='preview'||state.phase!=='working'||state.pending.length!==3)throw Error('There is no retiring trio to plant')
 if(new Set(plantedIds).size!==3||state.pending.some(f=>!plantedIds.includes(f.id)))throw Error('All three flowers must be planted before renewal')
 const s=clone(state)
 for(const f of s.pending){if(s.flowers.some(p=>p.id===f.id))throw Error('This signature is already planted');s.flowers.push(f);s.bodies[f.bodyId]={generation:f.generation+1,lastWave:null,notes:[]}}
 s.pending=[];return s
}
export function restoreRenewal(value){
 // Rebuild from completed preview waves rather than trusting stored counters,
 // active membership, generations, flower recipes or duplicated side effects.
 if(value?.schema!==1||value.mode!=='preview'||!Array.isArray(value.waves)||value.waves.length>10000)throw Error('Unrecognized garden preview state')
 let s=createRenewal()
 for(const wave of value.waves){s=beginPreviewWave(s);if(s.pending.length)s=finishPlanting(s,s.pending.map(f=>f.id));if(wave.wave!==s.nextWave||JSON.stringify(wave.ids)!==JSON.stringify(s.active)||wave.provenance!=='visual-preview')throw Error('Garden preview history is inconsistent');s=finishPreviewWave(s,wave.note)}
 if(value.phase==='working'){s=beginPreviewWave(s);if(s.pending.length&&value.pending?.length===0)s=finishPlanting(s,s.pending.map(f=>f.id))}
 if(JSON.stringify(s)!==JSON.stringify(value))throw Error('Garden preview state failed replay verification')
 return s
}
