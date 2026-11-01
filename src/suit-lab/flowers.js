import * as THREE from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'

// No image assets, catalogue of blossoms, model calls, or executable user text.
// Every signature is a continuous parametric construction with its own seed.
function randomFor(key){let s=2166136261;for(const c of key){s^=c.codePointAt(0);s=Math.imul(s,16777619)}return()=>{s+=0x6d2b79f5;let n=Math.imul(s^s>>>15,1|s);n^=n+Math.imul(n^n>>>7,61|n);return((n^n>>>14)>>>0)/4294967296}}
export function flowerRecipe(key){
 const r=randomFor(key)
 return {seed:key,petals:5+Math.floor(r()*4),height:1.9+r()*1.2,radius:.65+r()*.35,width:.28+r()*.24,cup:.10+r()*.35,twist:(r()-.5)*.7,bend:(r()-.5)*.45,hue:r(),saturation:.35+r()*.35,lightness:.65+r()*.15,leafAngle:r()*Math.PI*2,leafHeight:.32+r()*.20}
}
export function flowerFingerprint(recipe){const {seed,...geometry}=recipe;return JSON.stringify(geometry)}
export function flowerPosition(index){
 if(index<45){const column=index%15,rank=Math.ceil(column/2)*(column%2?1:-1);return {x:-4+rank*7.3,z:47+Math.floor(index/15)*5.5,y:-.08}}
 const a=(index-45)*2.3999632297,r=Math.sqrt((((index-45)*.61803398875)+.31)%1)
 return {x:-7+Math.cos(a)*62*r,z:59+Math.sin(a)*13*r,y:-.08}
}
export function createFlower(record,index){
 const p=record.recipe,root=new THREE.Group();root.name=`signature-flower-${record.id}`;root.userData.flowerId=record.id
 const at=flowerPosition(index);root.position.set(at.x,at.y,at.z)
 const green=new THREE.MeshStandardMaterial({color:'#54784e',roughness:.85,side:THREE.DoubleSide})
 const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(),new THREE.Vector3(p.bend,.5*p.height,0),new THREE.Vector3(p.bend,p.height,0))
 const stem=new THREE.Mesh(new THREE.TubeGeometry(curve,12,.045,5,false),green);root.add(stem)
 const parts=[]
 for(let i=0;i<p.petals;i++){
  const a=i/p.petals*Math.PI*2+p.twist,g=new THREE.BufferGeometry(),v=[]
  const point=(u,side)=>{const distance=.10+p.radius*u,w=Math.sin(u*Math.PI)*p.width*side;return [p.bend+Math.cos(a)*distance-Math.sin(a)*w,p.height+p.cup*u*u+Math.sin(u*Math.PI)*.10,Math.sin(a)*distance+Math.cos(a)*w]}
  for(let j=0;j<8;j++){const u=j/8,t=(j+1)/8;for(const q of [point(u,-1),point(t,-1),point(u,1),point(u,1),point(t,-1),point(t,1)])v.push(...q)}
  g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();parts.push(g)
 }
 const petals=mergeGeometries(parts);parts.forEach(g=>g.dispose())
 const bloom=new THREE.Mesh(petals,new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(p.hue,p.saturation,p.lightness),roughness:.8,side:THREE.DoubleSide}));root.add(bloom)
 const center=new THREE.Mesh(new THREE.SphereGeometry(.15,10,6),new THREE.MeshStandardMaterial({color:'#d8b15d',roughness:.8}));center.position.set(p.bend,p.height+.04,0);root.add(center)
 for(const sign of [-1,1]){const g=new THREE.BufferGeometry(),a=p.leafAngle+sign*1.3,h=p.height*p.leafHeight;g.setAttribute('position',new THREE.Float32BufferAttribute([0,h,0,Math.cos(a)*.65,h+.3,Math.sin(a)*.65,Math.cos(a+.5)*.3,h+.12,Math.sin(a+.5)*.3],3));g.computeVertexNormals();root.add(new THREE.Mesh(g,green))}
 root.traverse(o=>{if(o.isMesh)o.castShadow=true})
 return {root,record,position:at,dispose(){root.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose()});root.removeFromParent()}}
}
