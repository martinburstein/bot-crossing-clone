// Fifteen visual identities, independent of their replaceable instruction files.
export const TEAM = Object.freeze([
 ['r01','Pip','Thermal systems','#e48d43','sun','Heat pickup, rejection and the complete energy balance.'],
 ['r02','Moss','Pressure integrity','#75a78a','seal','Gas barriers, seams and leakage after motion.'],
 ['r03','Nova','Oxygen systems','#7fa9cc','tank','Oxygen supply, circulation and carbon-dioxide removal.'],
 ['r04','Clover','Cold protection','#a6b7d8','snow','Cold flex, insulation and thermal bridges.'],
 ['r05','Sol','Hot-side control','#dbb457','sun','Solar loading, radiative surfaces and heat rejection.'],
 ['r06','Luma','Radiation materials','#b58fc5','shield','Transport evidence, shielding mass and exposure limits.'],
 ['r07','Tess','Textile structures','#d594ab','weave','Formed carriers, yarn paths and load sharing.'],
 ['r08','Wren','Joint mobility','#67b9ae','joint','Pressure-volume geometry and full-cycle bending effort.'],
 ['r09','Kit','Gloves & dexterity','#ca786c','hand','Finger joints, tool contact and hand mobility.'],
 ['r10','Pebble','Dust & abrasion','#ae9b79','dust','Dust ingress, sliding wear and damage retention.'],
 ['r11','Echo','Sensors & controls','#7298b3','sensor','Calibrated measurements, sensing and control logic.'],
 ['r12','Fern','Human comfort','#9ab768','leaf','Contact pressure, moisture, fit and wearer workload.'],
 ['r13','Patch','Repair & service','#d79d72','patch','Inspectable joints, replacement interfaces and repair.'],
 ['r14','Orbit','Mass & packaging','#9e94bf','orbit','Complete installed mass, balance and component placement.'],
 ['r15','Ada','Independent review','#d2bd9a','review','Source checks, uncertainty and independent challenge.'],
].map(([id,name,role,color,gear,focus])=>Object.freeze({id,name,role,color,gear,focus,file:`/suit-lab/roles/${id}.md`})))
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
