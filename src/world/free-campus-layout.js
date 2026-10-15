// One flat-top lattice shared by the starter plots and scenic foundations.
// The full radius-two rosette is 19 cells: 17 resident homes, arm and bounty board.
export const CAMPUS_HEX_RADIUS=7.6
export const campusHexPoint=({q,r})=>({x:CAMPUS_HEX_RADIUS*1.5*q,z:CAMPUS_HEX_RADIUS*Math.sqrt(3)*(r+q/2)})
export const STARTER_ROSETTE=Object.freeze(Array.from({length:5},(_,i)=>i-2).flatMap(q=>Array.from({length:5},(_,i)=>i-2).filter(r=>Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=2).map(r=>Object.freeze({q,r}))))
const pilot={q:-2,r:2},camper={q:2,r:0},board={q:0,r:-2}
const ordinary=STARTER_ROSETTE.filter(c=>![pilot,camper,board,{q:0,r:0}].some(p=>p.q===c.q&&p.r===c.r)).sort((a,b)=>Math.atan2(campusHexPoint(a).z,campusHexPoint(a).x)-Math.atan2(campusHexPoint(b).z,campusHexPoint(b).x))
export const FREE_CAMPUS_HOMES=Object.freeze(Object.fromEntries([['w00',pilot],...ordinary.map((c,i)=>[`w${String(i+1).padStart(2,'0')}`,c]),['w16',camper]].map(([id,c])=>[id,Object.freeze(c)])))
export const FREE_CAMPUS=Object.freeze({
  camp:Object.freeze({x:0,z:-49,radius:14}),
  board:Object.freeze({...campusHexPoint(board),q:board.q,r:board.r}),
  balthasar:Object.freeze({x:0,z:-85,number:2,angle:0}),
  casper:Object.freeze({x:-34,z:-46,number:3,angle:Math.PI/12}),
  melchior:Object.freeze({x:34,z:-46,number:1,angle:-Math.PI/12}),
  computerSize:28,
  hangar:Object.freeze({...campusHexPoint({q:-4,r:2}),y:.65,deck:1.1,padHeight:.85,padRadius:16}),
  lander:Object.freeze({...campusHexPoint({q:4,r:-2}),deck:.2}),
  servicePadRadius:13,
})
export const FREE_CAMPUS_PODS=Object.freeze(ordinary.map((cell,i)=>Object.freeze({roleId:`r${String(i+1).padStart(2,'0')}`,...campusHexPoint(cell)})))
export const FREE_CAMPUS_SEATS=Object.freeze(Array.from({length:17},(_,i)=>Object.freeze({x:Math.sin(i*Math.PI*2/17)*10.6,z:FREE_CAMPUS.camp.z+Math.cos(i*Math.PI*2/17)*10.6})))
export function freeCampusUpload(campus,roleId,now=Date.now()){
  const history=campus?.free?.history??[]
  const latest=[...history].reverse().find(h=>h.roleId===roleId&&['replace','assign'].includes(h.kind))
  if(!latest||!Number.isFinite(latest.at)||now<latest.at||now-latest.at>10000)return null
  return {kind:latest.kind,slotId:latest.slotId??null,progress:(now-latest.at)/10000,generation:latest.definition?.generation??null}
}
