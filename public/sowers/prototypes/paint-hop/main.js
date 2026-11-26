const W=360,H=360, canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const C={paper:'#fff8e8',cream:'#f5ead0',rim:'#fff1d2',orange:'#f58232',cocoa:'#70402a',ink:'#392317',rust:'#b75a32'};
const names=['Crouch','Push','Ascent','Apex','Landing','Settle'];
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
function drawSower(ctx,pose){
 const c=ctx;
 c.strokeStyle=C.rust;c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(102,280);c.lineTo(120,278);c.moveTo(240,278);c.lineTo(258,280);c.stroke();
 c.save();c.translate(180+pose.x,200+pose.y);c.rotate(pose.tilt);
 // Fixed limbs: attach at shoulder/hip and rotate only around those joints.
 for(const [side,angle] of [[-1,pose.armL],[1,pose.armR]]){c.save();c.translate(side*40,-1);c.rotate(angle);path(c,'M -8 -5 Q -15 4 -14 19 L -12 29 Q -3 38 8 28 L 12 18 Q 11 5 7 -5 Z',C.cream);path(c,'M -16 24 Q -16 15 -7 14 Q 4 14 6 24 Q 7 34 -2 37 Q -13 37 -16 29 Z',C.cream);c.restore()}
 for(const [side,hip,knee] of [[-1,pose.hipL,pose.kneeL],[1,pose.hipR,pose.kneeR]]){c.save();c.translate(side*17,32);c.rotate(hip);path(c,'M -10 -7 Q 0 -12 10 -7 L 9 15 Q 7 21 0 22 Q -8 21 -10 15 Z',C.cream);c.translate(0,16);c.rotate(knee);path(c,'M -8 -4 Q 0 -7 8 -4 L 8 14 L -8 14 Z',C.cream);path(c,'M -13 10 Q 0 6 14 11 L 17 23 Q 16 31 3 32 L -13 30 Q -18 26 -13 10 Z',C.orange);line(c,[[-11,24],[12,24]],C.ink,3);c.restore()}
 // Fixed compact broad torso and original seed mark.
 path(c,'M -39 -36 Q -37 -43 -27 -43 L 27 -43 Q 37 -41 39 -34 L 33 23 Q 29 33 0 34 Q -29 33 -33 23 Z',C.cream);
 path(c,'M 0 -14 Q 10 -7 1 2 Q -5 7 -10 1 Q -8 -7 0 -14 Z',C.orange,'#fff8e8',1);
 // Fixed broad rounded-square hood, high cocoa window and pale arches.
 path(c,'M -70 -96 Q -70 -120 -52 -124 Q -34 -130 0 -130 Q 34 -130 52 -124 Q 70 -120 70 -96 L 67 -47 Q 65 -33 52 -31 L -52 -31 Q -66 -33 -68 -47 Z',C.cream);
 // Crown stripe follows the constant broad hood crown.
 path(c,'M -13 -127 Q 0 -131 13 -127 L 14 -93 L -14 -93 Z',C.orange,'#fff8e8',1);
 path(c,'M -55 -94 Q 0 -100 55 -94 L 52 -54 Q 0 -49 -52 -54 Z',C.cocoa,'#fff8e8',1);
 // Two broad arch eyes.
 c.strokeStyle=C.rim;c.lineWidth=8;c.lineCap='round';c.beginPath();c.moveTo(-31,-68);c.quadraticCurveTo(-20,-90,-8,-68);c.moveTo(8,-68);c.quadraticCurveTo(20,-90,31,-68);c.stroke();
 // Broad cream arch lip protects the face window without a circular helmet ring.
 path(c,'M -66 -53 Q 0 -42 66 -53 L 59 -40 Q 0 -32 -59 -40 Z',C.rim);
 if(pose.y<-10){c.fillStyle=C.rust;c.fillRect(-57,57,3,3);c.fillRect(54,59,3,3)}
 c.restore();
}
function drawFrame(c,index,x=0,y=0){const low=document.createElement('canvas');low.width=W/2;low.height=H/2;const lx=low.getContext('2d');lx.imageSmoothingEnabled=false;lx.scale(.5,.5);lx.fillStyle=C.paper;lx.fillRect(0,0,W,H);drawSower(lx,poses[index]);c.save();c.imageSmoothingEnabled=false;c.drawImage(low,x,y,W,H);c.restore();return c}
let index=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,timer=0,last=performance.now();
function paint(){drawFrame(ctx,index);document.querySelector('#pose-name').textContent=names[index];document.querySelector('#pose-count').textContent=`${index+1} / 6`;document.querySelector('#scrub').value=String(index);const b=document.querySelector('#play');b.textContent=playing?'Pause':'Play';b.setAttribute('aria-pressed',String(playing))}
// Discrete proposed timing: hold each key pose; no continuous repaint while paused.
function tick(now){if(!playing)return;const dt=now-last;last=now;timer+=dt;if(timer>=320){timer=0;index=(index+1)%poses.length;paint()}requestAnimationFrame(tick)}
document.querySelector('#play').addEventListener('click',()=>{playing=!playing;last=performance.now();paint();if(playing)requestAnimationFrame(tick)});
document.querySelector('#scrub').addEventListener('input',e=>{index=+e.target.value;playing=false;timer=0;paint()});
function download(c,name){const a=document.createElement('a');a.download=name;a.href=c.toDataURL('image/png');a.click()}
document.querySelector('#download-neutral').addEventListener('click',()=>{const out=document.createElement('canvas');out.width=W;out.height=H;drawFrame(out.getContext('2d'),5);download(out,'sowers-paint-hop-neutral.png')});
document.querySelector('#download-sheet').addEventListener('click',()=>{const out=document.createElement('canvas');out.width=1080;out.height=720;const o=out.getContext('2d');o.imageSmoothingEnabled=false;o.fillStyle=C.paper;o.fillRect(0,0,out.width,out.height);for(let i=0;i<6;i++){const x=(i%3)*360,y=Math.floor(i/3)*360;drawFrame(o,i,x,y);o.fillStyle=C.ink;o.font='bold 12px sans-serif';o.fillText(`${i+1}  ${names[i].toUpperCase()}`,x+14,y+22);if(i%3)o.fillRect(x,y,2,360);if(i>2)o.fillRect(x,y,360,2)}download(out,'sowers-paint-hop-six-poses.png')});
paint();if(playing)requestAnimationFrame(tick);
