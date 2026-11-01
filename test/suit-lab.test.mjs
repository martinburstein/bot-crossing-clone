import test from 'node:test'
import assert from 'node:assert/strict'
import {TEAM,UNITS,assignRole,releaseRole,replaceDefinition} from '../src/suit-lab/team.js'
import {readFile} from 'node:fs/promises'

test('15 distinct visual roles have complete portable definition files',async()=>{
 assert.equal(TEAM.length,15)
 for(const key of ['id','name','role','color'])assert.equal(new Set(TEAM.map(p=>p[key])).size,15)
 for(const p of TEAM){const file=await readFile(new URL(`../public${p.file}`,import.meta.url),'utf8');assert.ok(file.includes(p.role));assert.ok(file.includes(p.focus))}
})
test('three units support any three distinct residents and reject a fourth or duplicate',()=>{
 let slots={};for(let i=0;i<3;i++)slots=assignRole(slots,UNITS[i],TEAM[i+8].id)
 assert.equal(Object.keys(slots).length,3)
 assert.throws(()=>assignRole(slots,'fourth-unit','r01'))
 assert.throws(()=>assignRole(slots,'melchior','r15'))
 const open=releaseRole(slots,'balthasar')
 assert.throws(()=>assignRole(open,'balthasar',slots.melchior))
 const next=assignRole(open,'balthasar','r15');assert.equal(next.balthasar,'r15');assert.equal(slots.balthasar,'r10')
})
test('instruction replacement increments version without changing visual identities',()=>{
 const one=replaceDefinition({},'r01','First bounded brief')
 const two=replaceDefinition(one,'r01','Completely different assignment')
 assert.equal(one.r01.text,'First bounded brief');assert.equal(two.r01.generation,2)
 assert.equal(TEAM[0].name,'Pip')
 assert.throws(()=>replaceDefinition(two,'r01',' '));assert.throws(()=>replaceDefinition(two,'r01','x'.repeat(65537)))
})
