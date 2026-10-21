// Additive bone gestures baked once by crew.js. Angles are radians.
// The same clock drives the reaching hand and the can transfer.
export function memorialPoseAngles(pose,time){
  const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  if(pose==='memorial-pickup'||pose==='memorial-putback'){
    const t=pose==='memorial-pickup'?time/2.8:1-time/2.8;
    const reach=Math.sin(Math.PI*ease(Math.min(1,t/.80)));
    const hold=ease((t-.45)/.35);
    return [['chest',.38*reach,0,0],['head',.28*reach,0,0],['upperarmr',-.70*reach-.45*hold,0,.08],['lowerarmr',-.18*reach-.70*hold,0,0],['upperarml',-.12*reach,0,-.06],['handr',0,0,.12*hold]];
  }
  if(pose==='memorial-spray'){
    const sweep=Math.sin(time*2.8),shake=Math.sin(time*18)*.025;
    return [['chest',.04,Math.sin(time*1.4)*.04,0],['head',.08,-.04*sweep,0],['upperarmr',-1.05+shake,.16*sweep,.08],['lowerarmr',-.35-.06*Math.cos(time*2.8),0,0],['handr',.07*sweep,0,.07],['upperarml',-.15,0,-.08]];
  }
  if(pose==='memorial-carry')return [['upperarmr',-.35,0,.10],['lowerarmr',-.85,0,0],['handr',0,0,.1]];
  return [];
}
