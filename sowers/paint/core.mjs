export const PAINT_COLORS=Object.freeze(['#000000','#808080','#800000','#808000','#008000','#008080','#000080','#800080','#808040','#004040','#0080ff','#004080','#4000ff','#804000','#ffffff','#c0c0c0','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ffff80','#00ff80','#80ffff','#8080ff','#ff0080','#ff8040']);
export const memorialSymbolKey=x=>String(x?.symbol??'').normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g,' ');
export const memorialVisualKey=x=>JSON.stringify((x?.strokes??[]).map(s=>({color:s.color,width:+s.width.toFixed(5),points:s.points.map(([a,b])=>[+a.toFixed(5),+b.toFixed(5)])})));
export function validateMemorial(x){
 const str=(k,n)=>{if(typeof x?.[k]!=='string'||!x[k].trim()||x[k].length>n)throw Error('Invalid '+k);return x[k].trim()};
 const sessionId=str('sessionId',160),agent=str('agent',120),startedAt=str('startedAt',40),endedAt=str('endedAt',40),task=str('task',2000),symbol=str('symbol',160),explanation=str('explanation',4000),color=x.color;
 if(!Number.isFinite(Date.parse(startedAt))||!Number.isFinite(Date.parse(endedAt))||Date.parse(endedAt)<Date.parse(startedAt))throw Error('Invalid duration');
 if(!PAINT_COLORS.includes(color))throw Error('Choose a classic Paint color');if(x.glyph!=='')throw Error('New memorials are image-only; glyph must be empty');
 if(!Array.isArray(x.strokes)||x.strokes.length<1||x.strokes.length>256)throw Error('Invalid stroke count');let count=0;
 const strokes=x.strokes.map(s=>{if(!PAINT_COLORS.includes(s.color)||!Number.isFinite(s.width)||s.width<.002||s.width>.12||!Array.isArray(s.points)||!s.points.length)throw Error('Invalid drawing stroke');return {color:s.color,width:s.width,points:s.points.map(p=>{if(++count>20000||!Array.isArray(p)||p.length!==2||!p.every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid drawing point');return [...p]})}});
 return {sessionId,agent,startedAt:new Date(startedAt).toISOString(),endedAt:new Date(endedAt).toISOString(),task,symbol,explanation,color,glyph:'',strokes};
}
export function drawMemorial(ctx,e,size){ctx.clearRect(0,0,size,size);ctx.save();ctx.lineCap='round';ctx.lineJoin='round';for(const s of e.strokes){ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=s.width*size;ctx.beginPath();s.points.forEach(([x,y],i)=>i?ctx.lineTo(x*size,y*size):ctx.moveTo(x*size,y*size));if(s.points.length===1){ctx.arc(s.points[0][0]*size,s.points[0][1]*size,s.width*size/2,0,Math.PI*2);ctx.fill()}else ctx.stroke()}ctx.restore()}
export const symbolKey=memorialSymbolKey,visualKey=memorialVisualKey;

export const LIMIT=2048, HISTORY_LIMIT=20, HISTORY_BYTES=48*1024*1024;
export class PixelHistory{
 capture(){const c=this.canvas;return {width:c.width,height:c.height,data:c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height)}}
 cost(x){return x.width*x.height*4}
 restore(x){const c=this.canvas;c.width=x.width;c.height=x.height;c.getContext('2d',{willReadFrequently:true}).putImageData(x.data,0,0)}
 constructor(canvas,{limit=HISTORY_LIMIT,bytes=HISTORY_BYTES}={}){this.canvas=canvas;this.limit=limit;this.bytes=bytes;this.undoStack=[];this.redoStack=[];this.used=0;this.mark()}
 mark(){const snap=this.capture();this.undoStack.push(snap);this.used+=this.cost(snap);this.redoStack.forEach(x=>this.used-=this.cost(x));this.redoStack=[];while(this.undoStack.length>1&&(this.undoStack.length>this.limit||this.used>this.bytes)){const x=this.undoStack.shift();this.used-=this.cost(x)}}
 undo(){if(this.undoStack.length<2)return false;const current=this.capture();this.redoStack.push(current);this.used+=this.cost(current);const x=this.undoStack.pop();this.used-=this.cost(x);this.restore(this.undoStack.at(-1));return true}
 redo(){if(!this.redoStack.length)return false;const x=this.redoStack.pop();this.undoStack.push(x);this.restore(x);return true}
 reset(){this.undoStack=[];this.redoStack=[];this.used=0;this.mark()}
}
export function boundedSize(w,h){if(!Number.isFinite(w)||!Number.isFinite(h))throw Error('Dimensions must be finite');w=Math.round(w);h=Math.round(h);if(w<1||h<1)throw Error('Dimensions must be positive');const f=Math.min(1,LIMIT/Math.max(w,h),Math.sqrt(4_194_304/(w*h)));return [Math.max(1,Math.round(w*f)),Math.max(1,Math.round(h*f))]}
export function floodFill(ctx,x,y,color,tolerance=0){const {width:w,height:h}=ctx.canvas;if(x<0||y<0||x>=w||y>=h)return 0;const im=ctx.getImageData(0,0,w,h),d=im.data,start=(y*w+x)*4,src=[d[start],d[start+1],d[start+2],d[start+3]],target=hexRgb(color);if(src[0]===target[0]&&src[1]===target[1]&&src[2]===target[2]&&src[3]===255)return 0;const seen=new Uint8Array(w*h),stack=[y*w+x];seen[y*w+x]=1;let n=0;while(stack.length){const p=stack.pop(),i=p*4;if(Math.abs(d[i]-src[0])>tolerance||Math.abs(d[i+1]-src[1])>tolerance||Math.abs(d[i+2]-src[2])>tolerance||Math.abs(d[i+3]-src[3])>tolerance)continue;d[i]=target[0];d[i+1]=target[1];d[i+2]=target[2];d[i+3]=255;n++;const add=q=>{if(!seen[q]){seen[q]=1;stack.push(q)}};if(p%w)add(p-1);if(p%w<w-1)add(p+1);if(p>=w)add(p-w);if(p+w<w*h)add(p+w)}ctx.putImageData(im,0,0);return n}
function hexRgb(c){return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]}
export function transformPixels(canvas,kind){const c=document.createElement('canvas'),ctx=c.getContext('2d');if(kind==='rotate-left'||kind==='rotate-right'){c.width=canvas.height;c.height=canvas.width;ctx.translate(c.width/2,c.height/2);ctx.rotate(kind==='rotate-left'?-Math.PI/2:Math.PI/2);ctx.drawImage(canvas,-canvas.width/2,-canvas.height/2)}else{c.width=canvas.width;c.height=canvas.height;ctx.translate(kind==='flip-h'?c.width:0,kind==='flip-v'?c.height:0);ctx.scale(kind==='flip-h'?-1:1,kind==='flip-v'?-1:1);ctx.drawImage(canvas,0,0)}return c}
