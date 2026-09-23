import test from 'node:test'
import assert from 'node:assert/strict'
import {constructionFor,allocateSwarmCells} from '../src/game/swarm-construction.js'
import {allocateCells} from '../src/world/plots.js'

const colors=Array.from({length:7},(_,i)=>({id:'station-'+i,shellId:'s0'+(i+1),cells:1}))
const key=c=>`${c.q},${c.r}`
const distance=(a,b={q:0,r:0})=>(Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2
test('minor milestones add and upgrade items; major milestones add exactly one hex; run reset clears it',()=>{
  assert.deepEqual(constructionFor({}).structures,[])
  let milestones=Array.from({length:7},(_,i)=>({id:'minor-'+i,level:'minor',title:'Checkpoint '+i}))
  let plan=constructionFor({milestones,sizeBytes:100000000,running:true})
  assert.equal(plan.cells,1);assert.equal(plan.structures.length,6);assert.equal(plan.structures[0].level,2)
  milestones.push({id:'phase',level:'major',title:'Phase accepted'})
  milestones.push({id:'next',level:'minor',title:'Next checkpoint'})
  plan=constructionFor({milestones})
  assert.equal(plan.cells,2);assert.equal(plan.structures.at(-1).slot,8)
  assert.deepEqual(constructionFor({milestones}),plan) // polling never invents growth
  assert.equal(constructionFor({milestones:milestones.map(m=>m.level==='major'?{...m,retractedAt:1}:m)}).cells,1)
  assert.equal(constructionFor({runId:'next-project',milestones:[]}).cells,1)
})

test('seven perimeter homes grow outward without overlap or relocating existing milestones',()=>{
  let layout=allocateSwarmCells(colors)
  assert.equal(new Set([...layout.values()].flat().map(key)).size,7)
  const homes=new Map([...layout].map(([id,cells])=>[id,cells[0]]))
  for(let wave=2;wave<=25;wave++) {
    const before=layout
    layout=allocateSwarmCells([...colors].reverse().map(p=>({...p,cells:wave})),layout)
    for(const [id,cells] of layout) {
      assert.equal(cells.length,wave);assert.deepEqual(cells[0],homes.get(id))
      assert.deepEqual(cells.slice(0,-1),before.get(id))
      assert.ok(cells.slice(0,-1).some(c=>distance(c,cells.at(-1))===1 && distance(c)<distance(cells.at(-1))))
    }
    assert.equal(new Set([...layout.values()].flat().map(key)).size,7*wave)
  }
  const ordinary=allocateCells([{id:'ordinary',size:20}],new Map(),[...layout.values()].flat())
  const occupied=new Set([...layout.values()].flat().map(key))
  assert.ok(ordinary.get('ordinary').every(c=>!occupied.has(key(c))))
  const reset=allocateSwarmCells(colors)
  assert.ok([...reset.values()].every(c=>c.length===1))
})
