const W=360,H=360, canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const C={paper:'#fff8e8',cream:'#f5ead0',rim:'#fff1d2',orange:'#f58232',cocoa:'#70402a',ink:'#392317',rust:'#b75a32'};
const names=['Crouch','Push','Ascent','Apex','Landing','Settle'];
const variants=['Broad canopy control','Foreground mittens','Reduced cowl sweep'];
let variant=0;
// Joint angles and root movement vary; every authored path below stays fixed.
const poses=[
 {x:0,y:0,tilt:0,armL:.48,armR:-.48,hipL:.26,hipR:-.26,kneeL:-.48,kneeR:.48},
 {x:0,y:-3,tilt:-.025,armL:.16,armR:-.16,hipL:-.24,hipR:.24,kneeL:.12,kneeR:-.12},
 {x:0,y:-22,tilt:-.035,armL:-.34,armR:.28,hipL:.24,hipR:-.14,kneeL:.26,kneeR:-.18},
 {x:0,y:-36,tilt:0,armL:-.58,armR:.22,hipL:.28,hipR:-.28,kneeL:-.12,kneeR:.12},
 {x:0,y:-4,tilt:.028,armL:-.30,armR:.30,hipL:.22,hipR:-.22,kneeL:.38,kneeR:-.38},
 {x:0,y:0,tilt:0,armL:.28,armR:-.28,hipL:0,hipR:0,kneeL:0,kneeR:0}
];
const path=(c,d,fill,stroke=C.ink,line=5)=>{c.beginPath();const p=new Path2D(d);c.fillStyle=fill;c.strokeStyle=stroke;c.lineWidth=line;c.lineJoin='round';c.lineCap='round';c.fill(p);c.stroke(p)};
const line=(c,pts,color,width)=>{c.beginPath();c.moveTo(...pts[0]);for(const p of pts.slice(1))c.lineTo(...p);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke()};
function drawSower(ctx,pose,variantIndex=0){
 const c=ctx;
 c.strokeStyle=C.rust;c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(102,280);c.lineTo(120,278);c.moveTo(240,278);c.lineTo(258,280);c.stroke();
 c.save();c.translate(180+pose.x,200+pose.y);c.rotate(pose.tilt);
 // Fixed limbs: attach at shoulder/hip and rotate only around those joints.
 for(const [side,angle] of [[-1,pose.armL],[1,pose.armR]]){c.save();c.translate(side*40,-1);c.rotate(angle);path(c,'M -8 -5 Q -15 4 -14 19 L -12 29 Q -3 38 8 28 L 12 18 Q 11 5 7 -5 Z',C.cream);path(c,'M -16 24 Q -16 15 -7 14 Q 4 14 6 24 Q 7 34 -2 37 Q -13 37 -16 29 Z',C.cream);c.restore()}
 for(const [side,hip,knee] of [[-1,pose.hipL,pose.kneeL],[1,pose.hipR,pose.kneeR]]){c.save();c.translate(side*17,32);c.rotate(hip);path(c,'M -10 -7 Q 0 -12 10 -7 L 9 15 Q 7 21 0 22 Q -8 21 -10 15 Z',C.cream);c.translate(0,16);c.rotate(knee);path(c,'M -8 -4 Q 0 -7 8 -4 L 8 14 L -8 14 Z',C.cream);path(c,'M -13 10 Q 0 6 14 11 L 17 23 Q 16 31 3 32 L -13 30 Q -18 26 -13 10 Z',C.orange);line(c,[[-11,24],[12,24]],C.ink,3);c.restore()}
 // Variant-specific fixed head-to-shoulder contours; pose data never changes anatomy.
 if(variantIndex!==2){
  // Shared broad shell for control and foreground mitten comparison.
  path(c,'M -65 -128 Q -37 -138 0 -138 Q 37 -138 65 -128 Q 77 -121 77 -100 L 73 -58 Q 70 -39 61 -31 Q 79 -29 89 -17 Q 96 -7 87 4 L 66 24 Q 54 32 38 30 L 33 23 Q 29 34 0 34 Q -29 34 -33 23 L -38 30 Q -54 32 -66 24 L -87 4 Q -96 -7 -89 -17 Q -79 -29 -61 -31 Q -70 -39 -73 -58 L -77 -100 Q -77 -121 -65 -128 Z',C.cream);
 } else {
  // Reduced fixed cowl sweep; the edge stays narrow and smooth in every pose.
  path(c,'M -65 -128 Q -37 -138 0 -138 Q 37 -138 65 -128 Q 77 -121 77 -100 L 73 -58 Q 70 -39 61 -31 Q 61 -22 60 -12 L 53 12 Q 49 27 34 30 L 33 23 Q 29 34 0 34 Q -29 34 -33 23 L -34 30 Q -49 27 -53 12 L -60 -12 Q -61 -22 -61 -31 Q -70 -39 -73 -58 L -77 -100 Q -77 -121 -65 -128 Z',C.cream);
 }
 // Face-window placement, crown stripe, arch eyes, and the original seed stay fixed.
 path(c,'M -13 -135 Q 0 -139 13 -135 L 14 -99 L -14 -99 Z',C.orange,'#fff8e8',1);
 path(c,'M -55 -100 Q 0 -106 55 -100 L 52 -60 Q 0 -55 -52 -60 Z',C.cocoa,'#fff8e8',1);
 c.strokeStyle=C.rim;c.lineWidth=8;c.lineCap='round';c.beginPath();c.moveTo(-31,-74);c.quadraticCurveTo(-20,-96,-8,-74);c.moveTo(8,-74);c.quadraticCurveTo(20,-96,31,-74);c.stroke();
 // One small seed mark sits on the cream chest in every fixed template.
 path(c,'M 0 -14 Q 10 -7 1 2 Q -5 7 -10 1 Q -8 -7 0 -14 Z',C.orange,'#fff8e8',1);
 if(variantIndex===1){
  // Redraw each mitten at the end of its attached rotating arm, over the shell.
  for(const [side,angle] of [[-1,pose.armL],[1,pose.armR]]){c.save();c.translate(side*40,-1);c.rotate(angle);path(c,'M -16 24 Q -16 15 -7 14 Q 4 14 6 24 Q 7 34 -2 37 Q -13 37 -16 29 Z',C.cream);c.restore()}
 }
 if(pose.y<-10){c.fillStyle=C.rust;c.fillRect(-57,57,3,3);c.fillRect(54,59,3,3)}
 c.restore();
}
function drawFrame(c,index,x=0,y=0){const low=document.createElement('canvas');low.width=W/2;low.height=H/2;const lx=low.getContext('2d');lx.imageSmoothingEnabled=false;lx.scale(.5,.5);lx.fillStyle=C.paper;lx.fillRect(0,0,W,H);drawSower(lx,poses[index],variant);c.save();c.imageSmoothingEnabled=false;c.drawImage(low,x,y,W,H);c.restore();return c}
let index=5,playing=false,timer=0,last=performance.now(),raf=0;
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function paint(){drawFrame(ctx,index);document.querySelector('#pose-name').textContent=names[index];document.querySelector('#variant-name').textContent=variants[variant];document.querySelector('#pose-count').textContent=`${index+1} / 6`;document.querySelector('#scrub').value=String(index);const b=document.querySelector('#play');b.textContent=playing?'Pause':'Play';b.setAttribute('aria-pressed',String(playing));b.disabled=reduceMotion.matches&&!playing}
reduceMotion.addEventListener?.('change',paint);
// Discrete proposed timing: hold each key pose; no continuous repaint while paused.
function tick(now){if(!playing)return;const dt=now-last;last=now;timer+=dt;if(timer>=320){timer=0;index=(index+1)%poses.length;paint()}raf=requestAnimationFrame(tick)}
document.querySelector('#play').addEventListener('click',()=>{if(reduceMotion.matches)return;playing=!playing;last=performance.now();paint();if(playing)raf=requestAnimationFrame(tick);else{cancelAnimationFrame(raf);raf=0}});
document.querySelector('#variant').addEventListener('change',e=>{variant=+e.target.value;paint()});
document.querySelector('#scrub').addEventListener('input',e=>{index=+e.target.value;playing=false;timer=0;paint()});
function download(c,name){const a=document.createElement('a');a.download=name;a.href=c.toDataURL('image/png');a.click()}
document.querySelector('#download-neutral').addEventListener('click',()=>{
 const out=document.createElement('canvas');out.width=1080;out.height=420;const o=out.getContext('2d');o.fillStyle=C.paper;o.fillRect(0,0,out.width,out.height);
 for(let v=0;v<3;v++){variant=v;o.fillStyle=C.ink;o.font='bold 16px sans-serif';o.fillText(variants[v],v*360+12,28);drawFrame(o,5,v*360,48)}
 download(out,'iteration-16-canopy-hands-neutral-comparison.png');paint();
});
document.querySelector('#download-sheet').addEventListener('click',()=>{
 const out=document.createElement('canvas');out.width=2160;out.height=1188;const o=out.getContext('2d');o.imageSmoothingEnabled=false;o.fillStyle=C.paper;o.fillRect(0,0,out.width,out.height);
 for(let v=0;v<3;v++){o.fillStyle=C.ink;o.font='bold 18px sans-serif';o.fillText(variants[v],8,v*396+24);variant=v;for(let i=0;i<6;i++){const x=i*360,y=v*396+36;drawFrame(o,i,x,y);o.fillStyle=C.ink;o.font='bold 13px sans-serif';o.fillText(`${i+1}  ${names[i]}`,x+10,y+20);if(i)o.fillRect(x,y,2,360)}}
 download(out,'iteration-16-canopy-hands-18-pose-sheet.png');paint();
});
paint();if(playing)requestAnimationFrame(tick);
