// Authored art-direction endpoints. These are not measured style ownership.
export const endpoints = {
  M: { hoodWidth:2.16, hoodHeight:1.58, faceWindowRatio:.58, cowlThickness:.30, torsoCompactness:.90, legCompactness:.84, orangeSideAccent:.15 },
  W: { hoodWidth:1.88, hoodHeight:1.82, faceWindowRatio:.70, cowlThickness:.17, torsoCompactness:1.10, legCompactness:1.30, orangeSideAccent:.07 },
  B: { hoodWidth:2.02, hoodHeight:1.72, faceWindowRatio:.80, cowlThickness:.24, torsoCompactness:.84, legCompactness:.80, orangeSideAccent:.04 },
};
export function interpolate(weights) {
  for(const key of ['M','W','B']){
    if(!Number.isFinite(weights?.[key])||weights[key]<0||weights[key]>100) throw new Error(`Mixture weight ${key} must be finite and between 0 and 100`);
  }
  const total=weights.M+weights.W+weights.B;
  if(total!==100) throw new Error('Mixture weights must sum to exactly 100');
  return Object.fromEntries(Object.keys(endpoints.M).map(k=>[k,(endpoints.M[k]*weights.M+endpoints.W[k]*weights.W+endpoints.B[k]*weights.B)/100]));
}
export const presets = [
 {id:'m70',name:'Field Scout',weights:{M:70,W:15,B:15}},
 {id:'w70',name:'Hop Helper',weights:{M:15,W:70,B:15}},
 {id:'b70',name:'Pocket Companion',weights:{M:15,W:15,B:70}},
 {id:'mw',name:'Trail Tender',weights:{M:45,W:45,B:10}},
 {id:'mb',name:'Canopy Keeper',weights:{M:45,W:10,B:45}},
 {id:'wb',name:'Pod Pal',weights:{M:10,W:45,B:45}},
 {id:'balanced',name:'Sower Scout',weights:{M:34,W:33,B:33}},
];
