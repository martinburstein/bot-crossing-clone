import {tokenConstruction,allocateMagiCells} from './magi-world.js'
// Pure projection: no timers, transcript sizes, model calls or protocol mutations.
export function constructionFor(shell) {
  if(shell.worldProfile==='15-3A') return tokenConstruction(shell)
  const milestones=(shell.milestones || []).filter(m=>!m.retractedAt)
  const structures=new Map()
  let cell=0,minor=0,major=0,migrated=false
  const perCell=new Map()
  const growthAwards=[]
  const policy=shell.growthPolicy,capacity=policy?.version===2
  const expandIfFull=milestone=>{
    if(!capacity || (perCell.get(cell)||0)<6)return
    const fromCell=cell++
    growthAwards.push({id:`capacity:${fromCell}:${milestone?.sourceRunId||''}:${milestone?.id||'legacy'}`,
      fromCell,toCell:cell,reason:'Six verified item slots filled',sourceMilestoneId:milestone?.id||null})
  }
  for(const milestone of milestones) {
    const legacy=capacity && (!Number.isFinite(milestone.at)||milestone.at<=policy.legacyThrough)
    if(capacity&&!legacy&&!migrated){expandIfFull(milestones[milestones.indexOf(milestone)-1]);migrated=true}
    if(milestone.level==='major') {
      cell++;major++
      structures.set(`${cell}:0`,{key:`${cell}:0`,slot:cell*7,level:1,title:milestone.title,major:true})
    } else if(milestone.level==='minor') {
      minor++
      const count=(perCell.get(cell) || 0)+1;perCell.set(cell,count)
      const slot=1+(count-1)%6,key=`${cell}:${slot}`
      structures.set(key,{key,slot:cell*7+slot,level:1+Math.floor((count-1)/6),title:milestone.title,major:false})
      if(capacity&&!legacy)expandIfFull(milestone)
    }
  }
  if(capacity&&!migrated)expandIfFull(milestones.at(-1))
  return {cells:1+cell,minor,major,capacityExpansions:growthAwards.length,growthAwards,
    structures:[...structures.values()],latest:milestones.at(-1) || null}
}

const directions=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]
const key=c=>`${c.q},${c.r}`
const distance=c=>(Math.abs(c.q)+Math.abs(c.r)+Math.abs(c.q+c.r))/2
function ring(radius) {
  const out=[];let q=-radius,r=radius
  for(const [dq,dr] of directions) for(let i=0;i<radius;i++) {out.push({q,r});q+=dq;r+=dr}
  return out
}

// Perimeter homes leave every color an outward route; roots never occupy the center.
export function allocateSwarmCells(projects,previous=new Map()) {
  if(!projects.length) return new Map()
  if(projects.every(p=>p.worldProfile==='15-3A')) return allocateMagiCells(projects,previous)
  projects=[...projects].sort((a,b)=>a.shellId.localeCompare(b.shellId))
  let radius=Math.max(2,Math.ceil(projects.length/6))
  let homes=ring(radius).filter(c=>key(c)!=='-2,1')
  if(homes.length<projects.length) homes=ring(++radius)
  const occupied=new Set(['-2,1']),out=new Map()
  projects.forEach((p,i)=>{
    const home=homes[Math.floor(i*homes.length/projects.length)]
    const old=previous.get(p.id)
    const cells=old?.length && key(old[0])===key(home) ? old.slice(0,p.cells) : [home]
    out.set(p.id,cells)
    for(const c of cells) {
      if(occupied.has(key(c))) throw Error('Overlapping Swarm territory')
      occupied.add(key(c))
    }
  })
  for(const p of projects) {
    const cells=out.get(p.id),home=cells[0]
    while(cells.length<p.cells) {
      const candidates=new Map()
      for(const c of cells) for(const [dq,dr] of directions) {
        const n={q:c.q+dq,r:c.r+dr}
        if(occupied.has(key(n)) || distance(n)<=distance(c)) continue
        // Prefer growth along this home's radial direction, with short extensions first.
        const cross=home.q*n.r-home.r*n.q
        const score=Math.abs(cross)*10+distance(n)
        candidates.set(key(n),{...n,score})
      }
      const n=[...candidates.values()].sort((a,b)=>a.score-b.score || a.q-b.q || a.r-b.r)[0]
      if(!n) throw Error('Swarm territory has no free outward neighbor')
      const cell={q:n.q,r:n.r};cells.push(cell);occupied.add(key(cell))
    }
  }
  return out
}
