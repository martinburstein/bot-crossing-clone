// Additive bone gestures baked once by crew.js. Angles are radians.
// The same clock drives the reaching hand and the can transfer.
export function memorialPoseAngles(pose,time){
  const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  if(pose==='memorial-pickup'||pose==='memorial-putback'){
    const t=pose==='memorial-pickup'?time/2.8:1-time/2.8;
    const reach=Math.sin(Math.PI*ease(Math.min(1,t/.80)));
    const hold=ease((t-.45)/.35);
    return [['chest',.25*reach,0,0],['head',.12*reach,0,0],['upperarmr',-.58*reach-.34*hold,0,.15],['lowerarmr',-.12*reach-.54*hold,0,.10],['upperarml',-.08*reach,0,-.06],['handr',0,0,.16*hold]];
  }
  if(pose==='memorial-spray'){
    const sweep=Math.sin(time*2.8),shake=Math.sin(time*18)*.025;
    return [['chest',.02,Math.sin(time*1.4)*.025,0],['head',.04,-.025*sweep,0],['upperarmr',-.82+shake,.11*sweep,.18],['lowerarmr',-.24-.04*Math.cos(time*2.8),0,.08],['handr',.05*sweep,0,.12],['upperarml',-.10,0,-.10]];
  }
  if(pose==='memorial-carry')return [['upperarmr',-.30,0,.18],['lowerarmr',-.62,0,.10],['handr',0,0,.14]];
  return [];
}
