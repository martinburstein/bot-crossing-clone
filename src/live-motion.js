const smooth=t=>t*t*(3-2*t);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const key=p=>`${p.x},${p.z}`;
export function routePose(route,time,live=false){
 const t=time%route.total,s=route.segments.find(s=>t>=s.start&&t<s.start+s.duration)||route.segments[0];
 const age=t-s.start,p=Math.min(1,age/s.duration);
 const mode=live&&['typing','sit-down','stand-up'].includes(s.mode)?'idle-think':s.mode;
 const seated=mode==='typing'?1:mode==='sit-down'?smooth(p):mode==='stand-up'?1-smooth(p):0;
 return {x:s.a.x+(s.b.x-s.a.x)*p,z:s.a.z+(s.b.z-s.a.z)*p,mode,seated,age,yaw:mode==='walk'?Math.atan2(s.b.x-s.a.x,s.b.z-s.a.z):s.yaw??Math.PI,segment:s};
}
// Follow the existing walkable aisle graph; never cut diagonally across desks.
export function pathHome(route,pose){
 const nodes=new Map(),edges=new Map();
 function node(p){const k=key(p);nodes.set(k,p);if(!edges.has(k))edges.set(k,[]);return k;}
 function link(a,b){const ka=node(a),kb=node(b),d=distance(a,b);edges.get(ka).push([kb,d]);edges.get(kb).push([ka,d]);}
 for(const s of route.segments)link(s.a,s.b);
 link(pose,pose.segment.a);link(pose,pose.segment.b);
 const source=key(pose),target=key(route.segments[0].a),cost=new Map([[source,0]]),previous=new Map(),open=new Set(nodes.keys());
 while(open.size){let best=null;for(const k of open)if(best===null||(cost.get(k)??Infinity)<(cost.get(best)??Infinity))best=k;
  if(!Number.isFinite(cost.get(best)))break;open.delete(best);if(best===target)break;
  for(const [next,d]of edges.get(best))if((cost.get(best)+d)<(cost.get(next)??Infinity)){cost.set(next,cost.get(best)+d);previous.set(next,best);}
 }
 const result=[];let k=target;while(k!==source){result.unshift(nodes.get(k));k=previous.get(k);if(k===undefined)throw Error('Disconnected office route');}
 return result;
}
export function createMotion(route,offset=0){
 let clock=offset,phase='idle',age=0,waypoints=[],pose=routePose(route,clock,true);
 const home=route.segments[0].a;
 return {step(dt,working){
  if(phase==='idle'){
   if(working){waypoints=pathHome(route,pose);phase='return';age=0;}
   else{clock+=dt;pose=routePose(route,clock,true);return pose;}
  }
  if(phase==='return'){
   let remaining=dt*3.6;
   while(waypoints.length){const next=waypoints[0],d=distance(pose,next);pose.yaw=Math.atan2(next.x-pose.x,next.z-pose.z);
    if(d>remaining){pose.x+=(next.x-pose.x)*remaining/d;pose.z+=(next.z-pose.z)*remaining/d;break;}
    pose.x=next.x;pose.z=next.z;remaining-=d;waypoints.shift();
   }
   pose={...pose,mode:'walk',seated:0,age:age+=dt};
   if(!waypoints.length){phase=working?'sit':'idle';age=0;clock=30.4;}
   return pose;
  }
  age+=dt;
  if(phase==='typing'&&!working){phase='stand';age=0;}
  const seated=phase==='typing'?1:phase==='sit'?smooth(Math.min(1,age/1.2)):1-smooth(Math.min(1,age/1.2));
  pose={...home,mode:{sit:'sit-down',typing:'typing',stand:'stand-up'}[phase],seated,age,yaw:Math.PI};
  if(phase==='sit'&&age>=1.2){phase=working?'typing':'stand';age=0;}
  else if(phase==='stand'&&age>=1.2){phase='idle';clock=30.4;pose=routePose(route,clock,true);}
  return pose;
 }};
}
