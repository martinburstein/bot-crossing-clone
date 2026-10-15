import * as THREE from 'three';
// Physical and pixel aspect ratios match; fit fonts by size, never horizontal scaling.
export function labelPixels(w,h,width=2048){return {width,height:Math.max(64,Math.round(width*h/w))};}
export function sharpLabelTexture(w,h,{background='#243b3d',color='#f4e9d3',detailColor='#b6c7bd',family='sans-serif'}={}){
  const canvas=document.createElement('canvas');Object.assign(canvas,labelPixels(w,h));
  const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  function line(text,y,size,weight,fill){ctx.font=`${weight} ${size}px ${family}`;while(size>12&&ctx.measureText(String(text)).width>canvas.width*.92){size-=2;ctx.font=`${weight} ${size}px ${family}`;}ctx.fillStyle=fill;ctx.fillText(text,canvas.width/2,y);}
  function draw(title,detail){const {width:W,height:H}=canvas;ctx.fillStyle=background;ctx.fillRect(0,0,W,H);ctx.strokeStyle='#c6a570';ctx.lineWidth=4;ctx.strokeRect(12,12,W-24,H-24);ctx.textAlign='center';ctx.textBaseline='middle';line(title,H*.40,Math.min(H*.31,W*.12),600,color);line(detail,H*.76,Math.min(H*.16,W*.034),400,detailColor);texture.needsUpdate=true;}
  return {canvas,texture,draw};
}
