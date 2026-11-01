// One professional uniform palette for the entire team. Department identity is
// carried by tailoring and equipment details, not fifteen different suit colors.
export const UNIFORM=Object.freeze({suit:'#46565e',helmet:'#e7e7dc',coat:'#f4f1e6',trim:'#677b79',brass:'#b99a64',seam:'#aebbb2'})
export const DIRECTOR_COATS=Object.freeze([
 ['r01','Thermal director',.47,'notch','double','heat fins',.07],
 ['r02','Pressure director',.53,'stand','sealed','seal loops',.09],
 ['r03','Life-support director',.51,'shawl','cartridge','gas manifold',.06],
 ['r04','Cryogenics director',.42,'stand','insulated','quilt panels',.11],
 ['r05','Solar systems director',.61,'notch','single','radiator strips',.04],
 ['r06','Radiation director',.45,'stand','shield','detector badge',.08],
 ['r07','Textiles director',.49,'shawl','swatch','woven hem',.05],
 ['r08','Mobility director',.63,'notch','angled','articulated panels',.04],
 ['r09','Dexterity director',.65,'stand','instrument','precision tools',.03],
 ['r10','Surface durability director',.56,'stand','sealed','reinforced apron',.10],
 ['r11','Avionics director',.59,'notch','instrument','sensor rail',.06],
 ['r12','Human factors director',.46,'shawl','single','soft wrap',.07],
 ['r13','Service director',.57,'notch','utility','service belt',.09],
 ['r14','Systems integration director',.50,'shawl','cargo','module pockets',.08],
 ['r15','Independent review director',.44,'double','document','double breast',.05],
].map(([id,name,hem,collar,pockets,detail,cuff],index)=>Object.freeze({id,name,hem,collar,pockets,detail,cuff,index})))
export const COAT_BY_ID=Object.freeze(Object.fromEntries(DIRECTOR_COATS.map(c=>[c.id,c])))
