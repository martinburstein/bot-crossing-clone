// Fifteen visual identities, independent of their replaceable instruction files.
import {UNIFORM,COAT_BY_ID} from './uniforms.js'
export const TEAM = Object.freeze([
 ['r01','Pip','Thermal systems','sun','Heat pickup, rejection and the complete energy balance.'],
 ['r02','Moss','Pressure integrity','seal','Gas barriers, seams and leakage after motion.'],
 ['r03','Nova','Oxygen systems','tank','Oxygen supply, circulation and carbon-dioxide removal.'],
 ['r04','Clover','Cold protection','snow','Cold flex, insulation and thermal bridges.'],
 ['r05','Sol','Hot-side control','sun','Solar loading, radiative surfaces and heat rejection.'],
 ['r06','Luma','Radiation materials','shield','Transport evidence, shielding mass and exposure limits.'],
 ['r07','Tess','Textile structures','weave','Formed carriers, yarn paths and load sharing.'],
 ['r08','Wren','Joint mobility','joint','Pressure-volume geometry and full-cycle bending effort.'],
 ['r09','Kit','Gloves & dexterity','hand','Finger joints, tool contact and hand mobility.'],
 ['r10','Pebble','Dust & abrasion','dust','Dust ingress, sliding wear and damage retention.'],
 ['r11','Echo','Sensors & controls','sensor','Calibrated measurements, sensing and control logic.'],
 ['r12','Fern','Human comfort','leaf','Contact pressure, moisture, fit and wearer workload.'],
 ['r13','Patch','Repair & service','patch','Inspectable joints, replacement interfaces and repair.'],
 ['r14','Orbit','Mass & packaging','orbit','Complete installed mass, balance and component placement.'],
 ['r15','Ada','Independent review','review','Source checks, uncertainty and independent challenge.'],
].map(([id,name,role,gear,focus])=>Object.freeze({id,name,role,title:`Head of ${role}`,color:UNIFORM.trim,suitColor:UNIFORM.suit,coat:COAT_BY_ID[id],gear,focus,file:`/suit-lab/roles/${id}.md`})))
export const UNITS = Object.freeze(['melchior','balthasar','casper'])

export function assignRole(slots,unit,roleId) {
 if(!UNITS.includes(unit)||!TEAM.some(r=>r.id===roleId))throw Error('Choose a known unit and role')
 if(slots[unit])throw Error('Release this unit before hiring another resident')
 if(Object.values(slots).includes(roleId))throw Error('This resident already has a unit')
 return {...slots,[unit]:roleId}
}
export function releaseRole(slots,unit) {
 if(!UNITS.includes(unit))throw Error('Unknown unit')
 const next={...slots};delete next[unit];return next
}
export function replaceDefinition(definitions,id,text) {
 if(!TEAM.some(r=>r.id===id)||typeof text!=='string'||!text.trim()||text.length>65536)throw Error('Choose a nonempty role file under 64 KiB')
 return {...definitions,[id]:{text,generation:(definitions[id]?.generation??0)+1}}
}
