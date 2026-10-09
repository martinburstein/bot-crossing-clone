// Display policy only. No task completion, clock time or inferred usage earns territory.
import {ROARM_WORKSITE, ROARM_SERVICE_POINTS} from '../world/roarm-worksite.js'
export const MAGI_COLOR = '#e9a45b'
// Crew presentation is a shift cycle. Task failures stay in the protocol;
// off-duty personas rest at camp instead of becoming stalled/error characters.
export function magiOnShift(thread) {
  return thread.running===true && !thread.hasError && ['running','reviewing'].includes(thread.assignmentState)
}
export function magiCrewStatus(thread) { return magiOnShift(thread) ? 'working' : 'idle' }
export function magiShiftLabel(thread) { return magiOnShift(thread) ? 'On shift' : 'Idle' }
export const TOKEN_POLICY = Object.freeze({small: 25_000, hex: 250_000})
// The cluster names remain executor identities; all fifteen home cells now
// share one contiguous worksite around the central arm.
export const MAGI_CLUSTERS = [
  {id:'melchior', name:'Melchior', q:-4, r:0, opening:3},
  {id:'balthasar', name:'Balthasar', q:4, r:-4, opening:1},
  {id:'casper', name:'Casper', q:0, r:4, opening:5},
]
const directions = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]
const key = c => `${c.q},${c.r}`
export const HANGAR = Object.freeze({...ROARM_WORKSITE.hangar,width:19,depth:11,deck:.45})
// Fifteen stable identity homes, grouped by executor cluster but connected as
// one ring-shaped colony around the arm. The center cell stays clear for it.
export const MAGI_HOME_CELLS = Object.freeze([
  {q:2,r:0},{q:2,r:-1},{q:2,r:-2},{q:1,r:-2},{q:1,r:-1},
  {q:0,r:-1},{q:-1,r:-1},{q:-2,r:0},{q:-2,r:1},{q:-1,r:0},
  {q:-1,r:1},{q:0,r:2},{q:1,r:1},{q:0,r:1},{q:1,r:0},
].map(Object.freeze))
export const clusterOpening = c => ({q:c.q+directions[c.opening][0],r:c.r+directions[c.opening][1]})
export const clusterWorkFront = clusterId => {
  const point=ROARM_SERVICE_POINTS.find(site=>site.clusterId===clusterId)
  return point?[point]:[]
}
export function infrastructureCell(c) {
  const x=11.4*c.q,z=7.6*Math.sqrt(3)*(c.r+c.q/2)
  return [ROARM_WORKSITE.arm,ROARM_WORKSITE.camp,ROARM_WORKSITE.board,ROARM_WORKSITE.hangar,ROARM_WORKSITE.ship]
    .some((site,i)=>Math.hypot(x-site.x,z-site.z)<[10,16,12,17,17][i])
}
export function tokenConstruction(shell) {
  const measured = Number.isSafeInteger(shell.tokenUsage?.total) && shell.tokenUsage.total >= 0
  const tokens = measured ? shell.tokenUsage.total : 0
  const minor = Math.floor(tokens / TOKEN_POLICY.small), major = Math.floor(tokens / TOKEN_POLICY.hex)
  // Ten awards per cell: six additions, then four visible upgrades. Growth never spends tokens.
  const structures = []
  // Bound render cost without losing the measured total or the next award.
  const cells = Math.min(61, 1 + major)
  for(let cell=0; cell<cells; cell++) {
    const count = Math.min(10, Math.max(0, minor-cell*10))
    for(let slot=1;slot<=Math.min(6,count);slot++) structures.push({key:`${cell}:${slot}`,slot:cell*7+slot,level:count>=6+slot?2:1,title:`Token addition ${cell*10+slot}`,major:false})
  }
  return {cells, minor, major, structures, latest:null, capacityExpansions:0, growthAwards:[], tokens, measured,
    nextSmall:TOKEN_POLICY.small-tokens%TOKEN_POLICY.small, nextHex:TOKEN_POLICY.hex-tokens%TOKEN_POLICY.hex,
    deferredHexagons:Math.max(0,major+1-cells)}
}
export function allocateMagiCells(projects, previous=new Map()) {
  const out=new Map()
  for(const p of projects) {
    if(p.worldProfile==='roarm-campus'&&p.shellId==='w16'){out.set(p.id,[{q:0,r:-4}]);continue}
    if(['roarm-16','roarm-campus'].includes(p.worldProfile)&&p.shellId==='w00'){out.set(p.id,[{q:0,r:0}]);continue}
    const index=Number(p.shellId?.slice(1))-1
    if(!Number.isInteger(index)||index<0||index>=MAGI_HOME_CELLS.length) throw Error('Invalid 15-3A identity')
    out.set(p.id,[{...MAGI_HOME_CELLS[index]}])
  }
  return out
}
export function standbyMagiThreads() {
  return Array.from({length:15},(_,index)=>{
    const id=`w${String(index+1).padStart(2,'0')}`,cluster=MAGI_CLUSTERS[Math.floor(index/5)]
    return {id:`magi:${id}`,shellId:id,shellName:`${cluster.name} ${index%5+1}`,title:`${cluster.name} ${index%5+1}`,isShell:true,
      worldProfile:'15-3A',clusterId:cluster.id,shellColor:MAGI_COLOR,projectAccent:0xe9a45b,suitColor:0xf3f1ec,
      project:`MAGI ${id}`,projectLabel:`${cluster.name} ${index%5+1}`,constructionRunId:'magi:standby',
      running:false,hasError:false,archived:false,unread:false,canOpen:false,createdAt:index+1,lastActivityAt:Date.now(),sizeBytes:0,
      assignmentRole:'idle',assignmentState:'idle',shellStatus:'Standby',dependencies:[],milestones:[],tokenUsage:null,workflow:'15-3A'}
  })
}

