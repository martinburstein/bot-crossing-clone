// Canonical read-only adapter; include child agents as well as regular chats.
process.env.BOT_CROSSING_INCLUDE_SUBAGENTS = '1';
const {default: codex} = await import('./harnesses/codex.mjs');
export function createSeats(bindings=[]){
 const seats=Array(8).fill(null);
 return function project(threads){
  const active=threads.filter(t=>t.running&&!t.archived).sort((a,b)=>b.lastActivityAt-a.lastActivityAt||a.id.localeCompare(b.id));
  const ids=new Set(active.map(t=>t.id));
  for(let i=0;i<8;i++)if(!ids.has(seats[i]))seats[i]=null;
  for(const binding of bindings){
   if(!Number.isInteger(binding.index)||binding.index<0||binding.index>=8)continue;
   const match=active.find(t=>t.id===binding.id);
   if(match){const previous=seats.indexOf(match.id);if(previous>=0)seats[previous]=null;seats[binding.index]=match.id;}
  }
  for(const t of active)if(!seats.includes(t.id)){const i=seats.indexOf(null);if(i>=0)seats[i]=t.id;}
  // Names, prompts, paths, and real session IDs never cross HTTP.
  return {active:active.length,overflow:Math.max(0,active.length-8),seats:seats.map((id,index)=>({index,working:id!==null}))};
 };
}
let bindings=[];
try{const value=JSON.parse(process.env.OFFICE_DEMO_SEAT_BINDINGS||'[]');if(Array.isArray(value))bindings=value;}catch{}
const project=createSeats(bindings);
let cached=null,pending=null;
export async function activity(){
 if(cached&&Date.now()-cached.observedAt<1500)return cached;
 if(pending)return pending;
 pending=(async()=>{
  const available=await codex.detect();
  const result=project(available?await codex.scanThreads():[]);
  return cached={available,observedAt:Date.now(),...result};
 })();
 try{return await pending;}finally{pending=null;}
}
