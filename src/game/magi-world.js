// Display policy only. No task completion, clock time or inferred usage earns territory.
export const MAGI_COLOR = '#e9a45b'
export const TOKEN_POLICY = Object.freeze({small: 25_000, hex: 250_000})
export const MAGI_CLUSTERS = [
  {id:'melchior', name:'Melchior', q:-4, r:0, opening:3},
  {id:'balthasar', name:'Balthasar', q:4, r:-4, opening:1},
  {id:'casper', name:'Casper', q:0, r:4, opening:5},
]
const directions = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]
const key = c => `${c.q},${c.r}`
export const HANGAR = Object.freeze({x:0,z:0,width:19,depth:11,deck:.45})
export const clusterOpening = c => ({q:c.q+directions[c.opening][0],r:c.r+directions[c.opening][1]})
export function infrastructureCell(c) {
  const x=11.4*c.q,z=7.6*Math.sqrt(3)*(c.r+c.q/2)
  // The reservation includes the departure apron as well as the building itself.
  const dx=Math.max(0,Math.abs(x-HANGAR.x)-HANGAR.width/2),dz=Math.max(0,HANGAR.z-HANGAR.depth/2-z,z-HANGAR.z-HANGAR.depth/2-11)
  return Math.hypot(dx,dz)<7.6 || Math.hypot(x+22.8,z)<15
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
  const sorted=[...projects].sort((a,b)=>a.shellId.localeCompare(b.shellId)), out=new Map(), occupied=new Set(MAGI_CLUSTERS.map(key))
  // Reserve every home first. Historical ROYGBIV layouts cannot change these roots.
  for(const p of sorted) {
    const index=Number(p.shellId.slice(1))-1, cluster=MAGI_CLUSTERS[Math.floor(index/5)], offset=directions.filter((_,i)=>i!==cluster?.opening)[index%5]
    if(!cluster || !offset) throw Error('Invalid 15-3A identity')
    const home={q:cluster.q+offset[0],r:cluster.r+offset[1]}
    out.set(p.id,[home]); occupied.add(key(home))
  }
  for(const p of sorted) {
    const cells=out.get(p.id), old=previous.get(p.id)
    if(old && key(old[0])===key(cells[0])) for(const c of old.slice(1,p.cells)) {
      if(!occupied.has(key(c))&&!infrastructureCell(c)) {cells.push(c);occupied.add(key(c))}
    }
  }
  const rounds=Math.max(...sorted.map(p=>p.cells))
  for(let round=1;round<rounds;round++) for(const p of sorted) {
    const cells=out.get(p.id),home=cells[0]
    if(cells.length<p.cells) {
      const frontier=source=>source.flatMap(c=>directions.map(([q,r])=>({q:c.q+q,r:c.r+r}))).filter(c=>!occupied.has(key(c))&&!infrastructureCell(c))
      const cluster=MAGI_CLUSTERS[Math.floor((Number(p.shellId.slice(1))-1)/5)],opening=clusterOpening(cluster)
      let candidates=frontier(cells)
      // The first earned tile closes the outward-facing gap in the crew's shared ring.
      if(!occupied.has(key(opening))) candidates=[opening]
      // A surrounded persona may add a tile to its cluster's edge. Never erase homes.
      if(!candidates.length) candidates=frontier(sorted.filter(other=>Math.floor((Number(other.shellId.slice(1))-1)/5)===Math.floor((Number(p.shellId.slice(1))-1)/5)).flatMap(other=>out.get(other.id)))
      candidates.sort((a,b)=>{
        const score=c=>Math.hypot(c.q-home.q,c.r-home.r)*10-(c.q*home.q+c.r*home.r)*.1
        return score(a)-score(b)||a.q-b.q||a.r-b.r
      })
      if(!candidates.length) throw Error('No free connected 15-3A territory')
      const next=candidates[0];cells.push(next);occupied.add(key(next))
    }
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

