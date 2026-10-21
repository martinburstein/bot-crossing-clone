// Canonical campus border. Coordinates are the same world units as the 68 × 52 office.
export const FRONTERA = Object.freeze({
  id:'frontera-de-las-almas',name:'Frontera de las Almas',version:1,
  height:9.5,base:.35,depth:.8,soulUnit:1,margin:.65,spacing:.16,
  bounds:Object.freeze({left:-70,right:70,back:-117,front:46}),
  crate:Object.freeze({x:-64,z:18}),approach:Object.freeze({x:-61.6,z:18}),
  firstMark:Object.freeze({segmentId:'west-garden',u:17,y:5.3}),
});
const lines=[];
function line(id,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);lines.push(Object.freeze({id,ax,az,bx,bz,length,dx:dx/length,dz:dz/length,nx:-dz/length,nz:dx/length}));}
function corner(id,x,z,start,end){for(let i=0;i<8;i++){const a=start+(end-start)*i/8,b=start+(end-start)*(i+1)/8;line(`${id}-${i}`,x+20*Math.cos(a),z+20*Math.sin(a),x+20*Math.cos(b),z+20*Math.sin(b));}}
line('south-west',-17,46,-50,46);corner('south-west-bend',-50,26,Math.PI/2,Math.PI);
line('west-garden',-70,26,-70,-20); // Four generous entrances keep circulation open.
line('west-campus',-70,-34,-70,-97);corner('north-west-bend',-50,-97,Math.PI,Math.PI*1.5);
line('north-west',-50,-117,-8,-117);line('north-east',8,-117,50,-117);
corner('north-east-bend',50,-97,Math.PI*1.5,Math.PI*2);line('east-campus',70,-97,70,-34);
line('east-garden',70,-20,70,26);corner('south-east-bend',50,26,0,Math.PI/2);line('south-east',50,46,17,46);
export const FRONTERA_SEGMENTS=Object.freeze(lines);
export const FRONTERA_LENGTH=lines.reduce((sum,s)=>sum+s.length,0);
export function paintCanPosition(index=0){return {x:FRONTERA.crate.x+(index<14?-.55:.55),y:.8,z:FRONTERA.crate.z-(-2.21+(index%14)*.34)};}
export function memorialPoint(placement,inset=FRONTERA.depth/2+.025){
  const s=lines.find(s=>s.id===placement.segmentId);if(!s)throw Error('Unknown memorial wall section');
  return {x:s.ax+s.dx*placement.u+s.nx*inset,y:FRONTERA.base+placement.y,z:s.az+s.dz*placement.u+s.nz*inset,nx:s.nx,nz:s.nz,angle:Math.atan2(s.nx,s.nz)};
}
export function checkPlacement(p,others=[]){
  const s=lines.find(s=>s.id===p?.segmentId),edge=FRONTERA.margin+FRONTERA.soulUnit/2;
  if(!s||!Number.isFinite(p.u)||!Number.isFinite(p.y)||p.u<edge||p.u>s.length-edge||p.y<edge||p.y>FRONTERA.height-edge)throw Error('Soul unit must fit inside the wall');
  if(others.some(o=>o.segmentId===p.segmentId&&Math.abs(o.u-p.u)<FRONTERA.soulUnit+FRONTERA.spacing&&Math.abs(o.y-p.y)<FRONTERA.soulUnit+FRONTERA.spacing))throw Error('Soul unit overlaps an existing symbol');
  return {segmentId:p.segmentId,u:p.u,y:p.y};
}
let clusteredCandidates;
export function choosePlacement(iteration,others=[],requested){
  if(requested)return checkPlacement(requested,others);
  if(iteration===1&&!others.length)return {...FRONTERA.firstMark};
  const edge=FRONTERA.margin+FRONTERA.soulUnit/2;
  const step=FRONTERA.soulUnit+FRONTERA.spacing,anchor=memorialPoint(FRONTERA.firstMark,0),candidates=[];
  // Fill outward from the first soul instead of scattering marks around the entire border.
  // Rows are staggered and remain a placement detail; the wall still exposes no visible grid.
  if(!clusteredCandidates){
    for(const s of lines){
      let row=0;
      for(let y=edge;y<=FRONTERA.height-edge+1e-9;y+=step,row++){
        const offset=(row%2)*step/2;
        for(let u=edge+offset;u<=s.length-edge+1e-9;u+=step){
          const p={segmentId:s.id,u,y},point=memorialPoint(p,0);
          candidates.push({p,distance:(point.x-anchor.x)**2+(point.y-anchor.y)**2+(point.z-anchor.z)**2});
        }
      }
    }
    clusteredCandidates=candidates.sort((a,b)=>a.distance-b.distance||a.p.segmentId.localeCompare(b.p.segmentId)||a.p.y-b.p.y||a.p.u-b.p.u).map(({p})=>p);
  }
  for(const p of clusteredCandidates)try{return checkPlacement(p,others);}catch{/* Keep expanding from the shared cluster. */}
  throw Error('No free soul unit found; preserve the archive and extend the canonical border');
}
export const fronteraObstacles=()=>lines.map(s=>({x:(s.ax+s.bx)/2,z:(s.az+s.bz)/2,width:s.length+.15,depth:FRONTERA.depth+.2,angle:Math.atan2(-s.dz,s.dx),worksite:'frontera-wall',office:true}));
export const fronteraClearings=()=>lines.map(s=>({x:(s.ax+s.bx)/2,z:(s.az+s.bz)/2,r:s.length/2+3}));
