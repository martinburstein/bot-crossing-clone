// The facility catalogue describes scenery and visual sequences, not a physical
// laboratory, installed hardware, numerical simulation or verified test result.
export const FACILITIES=Object.freeze([
 {id:'assembly',name:'Shared suit studio',short:'BUILD',color:'#e3a063',at:[-10,2],
  description:'One suit, fifteen specialties. The central cradle brings the garment, helmet and life-support pack together.',
  equipment:['Full-body assembly cradle','Interchangeable helmet and backpack','Joint and glove fixtures','Shared design and inspection table'],cycle:'Assembly alignment'},
 {id:'pressure',name:'Pressure & vacuum',short:'VACUUM',color:'#86b9b5',at:[-37,-22],
  description:'A sealed chamber and leak bench for barriers, seams, closures and a complete suit.',
  equipment:['Full-suit vacuum chamber','Leak and seam inspection bench','Pressure cycling manifold','Feedthrough and seal fixtures'],cycle:'Chamber checkout'},
 {id:'thermal',name:'Hot / cold chamber',short:'THERMAL',color:'#e1ae67',at:[-15,-25],
  description:'A paired thermal bay for solar heating, deep cold, insulation and the cooling loop.',
  equipment:['Thermal-vacuum enclosure','Solar simulator lamps','Cold shroud and radiative panel','Liquid cooling and heat-flow bench'],cycle:'Hot / cold sweep'},
 {id:'radiation',name:'Radiation & shielding',short:'SHIELD',color:'#b49cca',at:[10,-23],
  description:'An enclosed beamline model, shielding cassette and detector bench for studying radiation materials.',
  equipment:['Shielded beamline enclosure','Interchangeable material cassettes','Particle and neutron detector bench','Transport-analysis workstation'],cycle:'Shielding cassette scan'},
 {id:'materials',name:'Materials foundry',short:'MAKE',color:'#d29aaa',at:[-37,1],
  description:'Make the layers, inspect the structure and understand how it fails before it goes on the suit.',
  equipment:['Fiber, weave and laminate tools','Polymer and metal fabrication','Microscopy and chemical analysis','Tensile, tear and fatigue fixtures'],cycle:'Material coupon inspection'},
 {id:'life-support',name:'Life-support loop',short:'BREATHE',color:'#81b7cc',at:[13,-1],
  description:'A closed-loop test rack for breathing gas, carbon-dioxide removal, water and cooling connections.',
  equipment:['Oxygen and ventilation test rack','CO₂ removal cartridge fixtures','Water and humidity loop','Instrumented breathing simulator'],cycle:'Loop circulation'},
 {id:'mobility',name:'Moon / Mars mobility',short:'MOVE',color:'#8fbba0',at:[-34,21],
  description:'An overhead support rig and walking deck for joints, balance, reach and tool work.',
  equipment:['Adjustable body-weight support','Walking and obstacle deck','Joint torque and range fixtures','Motion capture and tool tasks'],cycle:'Assisted walking demonstration'},
 {id:'dust-impact',name:'Dust & impact range',short:'ENDURE',color:'#c6ad7e',at:[11,20],
  description:'An enclosed dirty-test bay for abrasive dust, seals, punctures and impact specimens.',
  equipment:['Sealed dust and abrasion cabinet','Seal and bearing wear carousel','Enclosed impact tube model','Puncture and damage inspection'],cycle:'Dust cabinet circulation'},
 {id:'fit-repair',name:'Fit, service & avionics',short:'REFINE',color:'#9eb77f',at:[-10,23],
  description:'Measure the wearer, check the sensors and make every damaged or uncomfortable part serviceable.',
  equipment:['Body fit and contact-pressure tools','Glove and boot dexterity bench','Electronics and sensor calibration','Repair, cleaning and spare modules'],cycle:'Fit and instrument sweep'},
].map(f=>Object.freeze({...f,at:Object.freeze(f.at),equipment:Object.freeze(f.equipment)})))

// Clear operator positions face each bay. Shared visits use the front aisle.
export const WORKPLACES=Object.freeze([
 ['thermal',-21,-15],['pressure',-33,-12],['life-support',9,8],
 ['thermal',-14,-15],['thermal',-7,-15],['radiation',8,-12],
 ['materials',-40,10],['mobility',-30,30],['fit-repair',-18,29],
 ['dust-impact',15,29],['assembly',0,5],['fit-repair',-9,30],
 ['assembly',-21,6],['assembly',-17,13],['assembly',-5,13],
].map(([facility,x,z])=>Object.freeze({facility,x,z})))

export function previewPhase(start,now,duration=8){
 if(start===null)return {active:false,progress:0}
 const progress=Math.max(0,Math.min(1,(now-start)/duration))
 return {active:progress<1,progress}
}
