const COLORS={paper:'#fff8e8',cream:'#f5ead0',rim:'#fff1d2',orange:'#f58232',cocoa:'#70402a',ink:'#392317'};
const STATES={
  default:{label:'DEFAULT · content',eyes:'arches'},
  inspect:{label:'INSPECT · directional gaze',eyes:'open',pupilX:0.30},
  input:{label:'NEEDS INPUT · friendly open eyes',eyes:'open',pupilX:0}
};
// One fixed, front-facing head-and-bib template; only the eye treatment varies.
function drawFace(ctx,size,state){
  const s=size/256;ctx.save();ctx.scale(s,s);ctx.imageSmoothingEnabled=false;ctx.fillStyle=COLORS.paper;ctx.fillRect(0,0,256,256);
  const path=(d,fill,stroke=COLORS.ink,w=4)=>{ctx.beginPath();ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=w;ctx.lineJoin='round';ctx.lineCap='round';ctx.fill(new Path2D(d));ctx.stroke(new Path2D(d))};
  // Compact fixed torso crop and seed.
  path('M 63 222 Q 68 197 88 192 L 168 192 Q 188 197 193 222 L 193 256 L 63 256 Z',COLORS.cream);
  path('M 128 214 Q 142 224 130 237 Q 119 242 113 232 Q 116 222 128 214 Z',COLORS.orange,COLORS.paper,2);
  // Broad rounded-square hood with rounded rim, crown and cocoa window.
  path('M 27 95 Q 27 47 58 33 Q 82 20 128 20 Q 174 20 198 33 Q 229 47 229 95 L 225 162 Q 223 182 202 187 L 54 187 Q 33 182 31 162 Z',COLORS.cream);
  path('M 113 22 Q 128 17 143 22 L 146 59 L 110 59 Z',COLORS.orange,COLORS.paper,2);
  path('M 48 91 Q 128 81 208 91 L 204 150 Q 128 160 52 150 Z',COLORS.cocoa,COLORS.paper,2);
  if(state.eyes==='arches'){
    ctx.strokeStyle=COLORS.rim;ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(77,126);ctx.quadraticCurveTo(96,91,115,126);ctx.moveTo(141,126);ctx.quadraticCurveTo(160,91,179,126);ctx.stroke();
  }else{
    for(const cx of [96,160]){
      ctx.beginPath();ctx.ellipse(cx,119,17,24,0,0,Math.PI*2);ctx.fillStyle=COLORS.rim;ctx.fill();
      ctx.beginPath();ctx.ellipse(cx+state.pupilX*18,119,7,10,0,0,Math.PI*2);ctx.fillStyle=COLORS.cocoa;ctx.fill();
    }
  }
  // Broad arch lip is identical for all three treatments.
  path('M 33 157 Q 128 174 223 157 L 213 176 Q 128 188 43 176 Z',COLORS.rim);
  ctx.restore();return ctx;
}
const large=document.querySelector('#large'),largeCtx=large.getContext('2d');
function paint(name){const state=STATES[name];drawFace(largeCtx,256,state);document.querySelector('#selected-name').textContent=state.label;
  for(const canvas of document.querySelectorAll('[data-size]'))drawFace(canvas.getContext('2d'),Number(canvas.dataset.size),state);
}
document.querySelector('#choices').addEventListener('change',e=>{if(e.target.name==='state')paint(e.target.value)});
document.querySelector('#export').addEventListener('click',()=>exportComparison());
function exportComparison(){
  const out=document.createElement('canvas');out.width=960;out.height=480;const c=out.getContext('2d');c.fillStyle=COLORS.paper;c.fillRect(0,0,out.width,out.height);c.fillStyle=COLORS.ink;c.font='800 18px system-ui';c.fillText('ITERATION 16 · PROPOSED GAZE CUES',24,30);
  const names=['default','inspect','input'];
  names.forEach((name,i)=>{const x=24+i*312;c.fillStyle=COLORS.ink;c.font='800 13px system-ui';c.fillText(STATES[name].label.toUpperCase(),x,58);const tile=document.createElement('canvas');tile.width=256;tile.height=256;drawFace(tile.getContext('2d'),256,STATES[name]);c.drawImage(tile,x,70,256,220);let sx=x;[16,32,64,128].forEach(size=>{c.font='700 10px system-ui';c.fillText(`${size}px`,sx,327);const sample=document.createElement('canvas');sample.width=size;sample.height=size;drawFace(sample.getContext('2d'),size,STATES[name]);c.drawImage(sample,sx,340,size,size);sx+=size+8});});
  const a=document.createElement('a');a.download='iteration-16-gaze-cues.png';a.href=out.toDataURL('image/png');a.click();
}
// Dedicated export page uses the exact same drawFace function as the interactive workbench.
if(new URLSearchParams(location.search).has('export')){
  const out=document.createElement('canvas');out.width=960;out.height=480;const c=out.getContext('2d');c.fillStyle=COLORS.paper;c.fillRect(0,0,out.width,out.height);c.fillStyle=COLORS.ink;c.font='800 18px system-ui';c.fillText('ITERATION 16 · PROPOSED GAZE CUES',24,30);
  ['default','inspect','input'].forEach((name,i)=>{const x=24+i*312;c.fillStyle=COLORS.ink;c.font='800 13px system-ui';c.fillText(STATES[name].label.toUpperCase(),x,58);const tile=document.createElement('canvas');tile.width=256;tile.height=256;drawFace(tile.getContext('2d'),256,STATES[name]);c.drawImage(tile,x,70,256,220);let sx=x;[16,32,64,128].forEach(size=>{c.font='700 10px system-ui';c.fillText(`${size}px`,sx,327);const sample=document.createElement('canvas');sample.width=size;sample.height=size;drawFace(sample.getContext('2d'),size,STATES[name]);c.drawImage(sample,sx,340,size,size);sx+=size+8});});
  document.body.innerHTML='';document.body.style.margin='0';const image=document.createElement('img');image.src=out.toDataURL('image/png');image.style.width='960px';image.style.height='390px';document.body.append(image);
}
paint('default');
