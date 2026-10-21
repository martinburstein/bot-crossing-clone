// Classic Paint palette, in its original two-row order.
// Reference: https://github.com/1j01/jspaint/blob/master/src/color-data.js
export const PAINT_COLORS = Object.freeze([
  '#000000','#808080','#800000','#808000','#008000','#008080','#000080','#800080',
  '#808040','#004040','#0080ff','#004080','#4000ff','#804000',
  '#ffffff','#c0c0c0','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff',
  '#ffff80','#00ff80','#80ffff','#8080ff','#ff0080','#ff8040',
]);
export {FRONTERA as MEMORIAL} from '../world/frontera-layout.js';

export function memorialVisualKey(input) {
  return JSON.stringify((input.strokes??[]).map(s=>({
    color:s.color,
    width:Number(s.width.toFixed(5)),
    points:s.points.map(([x,y])=>[Number(x.toFixed(5)),Number(y.toFixed(5))]),
  })));
}

export function memorialSymbolKey(input) {
  return String(input.symbol??'').normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g,' ');
}

export function assessMemorialLegibility(input,{size=96}={}) {
  const coverage=new Uint16Array(size*size);let samples=0;
  const paint=(x,y,r)=>{
    const minX=Math.max(0,Math.floor(x-r)),maxX=Math.min(size-1,Math.ceil(x+r));
    const minY=Math.max(0,Math.floor(y-r)),maxY=Math.min(size-1,Math.ceil(y+r));
    for(let py=minY;py<=maxY;py++)for(let px=minX;px<=maxX;px++)if((px-x)**2+(py-y)**2<=r*r)coverage[py*size+px]++;
  };
  for(const stroke of input.strokes??[]){
    const r=Math.max(.75,stroke.width*size/2),points=stroke.points;
    for(let i=0;i<points.length;i++){
      const [x,y]=points[i],previous=points[Math.max(0,i-1)];
      const dx=(x-previous[0])*size,dy=(y-previous[1])*size,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)*1.5));
      for(let step=0;step<=steps;step++){const t=step/steps;paint((previous[0]+(x-previous[0])*t)*size,(previous[1]+(y-previous[1])*t)*size,r);samples++;}
    }
  }
  let painted=0,stacked=0;for(const n of coverage){if(n){painted++;if(n>1)stacked++;}}
  const occupiedRatio=painted/(size*size),stackedRatio=painted?stacked/painted:0;
  const warnings=[];
  if(occupiedRatio<.008)warnings.push('The image is very sparse at wall scale.');
  if(occupiedRatio>.55)warnings.push('The image is very dense at wall scale.');
  if(stackedRatio>.42)warnings.push('Many painted pixels stack; preview carefully for illegible sub-symbols.');
  return {occupiedRatio,stackedRatio,samples,warnings};
}

export function validateMemorial(input,{allowLegacyGlyph=false}={}) {
  const text=(key,max)=>{const v=input?.[key];if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`Invalid ${key}`);return v.trim();};
  const sessionId=text('sessionId',160),agent=text('agent',120),task=text('task',2000),symbol=text('symbol',160),explanation=text('explanation',4000);
  const startedAt=text('startedAt',40),endedAt=text('endedAt',40);
  if(!Number.isFinite(Date.parse(startedAt))||!Number.isFinite(Date.parse(endedAt))||Date.parse(endedAt)<Date.parse(startedAt))throw Error('Invalid duration');
  const color=input.color??PAINT_COLORS[0];if(!PAINT_COLORS.includes(color))throw Error('Choose a classic Paint color');
  const glyph=typeof input.glyph==='string'?input.glyph:'';if(glyph.length>40)throw Error('Glyph is too long; use drawing strokes for complex symbols');
  if(glyph.trim()&&!allowLegacyGlyph)throw Error('New memorials are image-only; use drawing strokes, not glyphs or words');
  if(!Array.isArray(input.strokes??[])||(input.strokes??[]).length>256)throw Error('Too many strokes');
  let count=0;
  const strokes=(input.strokes??[]).map(s=>{
    if(!PAINT_COLORS.includes(s.color)||!Number.isFinite(s.width)||s.width<.002||s.width>.12||!Array.isArray(s.points)||!s.points.length)throw Error('Invalid drawing stroke');
    const points=s.points.map(p=>{if(++count>20000||!Array.isArray(p)||p.length!==2||!p.every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('Invalid drawing point');return [...p];});
    return {color:s.color,width:s.width,points};
  });
  if(!glyph.trim()&&!strokes.length)throw Error('Draw an image first');
  return {sessionId,agent,startedAt:new Date(startedAt).toISOString(),endedAt:new Date(endedAt).toISOString(),task,symbol,explanation,color,glyph,strokes};
}

export function drawMemorial(ctx,entry,size) {
  ctx.clearRect(0,0,size,size);ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  if(entry.glyph){
    ctx.fillStyle=entry.color;ctx.shadowColor=entry.color;ctx.shadowBlur=size*.008;
    ctx.font=`bold ${size*.60}px "Segoe UI Symbol", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(entry.glyph,size/2,size/2,size*.82);
  }
  for(const s of entry.strokes??[]){
    ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=s.width*size;ctx.shadowColor=s.color;ctx.shadowBlur=size*.006;
    ctx.beginPath();s.points.forEach(([x,y],i)=>i?ctx.lineTo(x*size,y*size):ctx.moveTo(x*size,y*size));
    if(s.points.length===1){ctx.arc(s.points[0][0]*size,s.points[0][1]*size,s.width*size/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();
  }
  ctx.restore();
}
