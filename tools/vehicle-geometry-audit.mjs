// Triangle-surface contact graph, before render batching. This is a visual assembly
// audit, not a watertight CAD/manufacturing certification. Embedded joints count as
// connected; a bounding-box near miss alone never counts as contact.
import * as THREE from 'three'
import {fileURLToPath} from 'node:url'
import {createVehicle,VEHICLES} from '../src/world/mars-vehicles.js'
const v=()=>new THREE.Vector3(), closest=v(),ray=new THREE.Ray(),hit=v()
function tree(tris) {
 const box=new THREE.Box3();for(const t of tris)box.expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c)
 if(tris.length<=8)return {box,tris}
 const size=box.getSize(v()),axis=size.x>size.y?(size.x>size.z?'x':'z'):(size.y>size.z?'y':'z')
 tris.sort((a,b)=>a.a[axis]+a.b[axis]+a.c[axis]-b.a[axis]-b.b[axis]-b.c[axis])
 const mid=tris.length>>1;return {box,left:tree(tris.slice(0,mid)),right:tree(tris.slice(mid))}
}
function boxDistance(a,b) {return Math.hypot(Math.max(0,a.min.x-b.max.x,b.min.x-a.max.x),Math.max(0,a.min.y-b.max.y,b.min.y-a.max.y),Math.max(0,a.min.z-b.max.z,b.min.z-a.max.z))}
function edgeHits(a,b,t,tolerance) {
 const dir=b.clone().sub(a),length=dir.length();if(length<1e-9)return false
 ray.set(a,dir.divideScalar(length));const p=ray.intersectTriangle(t.a,t.b,t.c,false,hit)
 return p&&a.distanceTo(p)<=length+tolerance
}
function touches(a,b,e) {
 for(const p of [a.a,a.b,a.c])if(b.closestPointToPoint(p,closest).distanceTo(p)<=e)return true
 for(const p of [b.a,b.b,b.c])if(a.closestPointToPoint(p,closest).distanceTo(p)<=e)return true
 for(const t of [[a,b],[b,a]])for(const [p,q] of [[t[0].a,t[0].b],[t[0].b,t[0].c],[t[0].c,t[0].a]])if(edgeHits(p,q,t[1],e))return true
 return false
}
function contact(a,b,e) {
 if(boxDistance(a.box,b.box)>e)return false
 if(a.tris&&b.tris)return a.tris.some(x=>b.tris.some(y=>touches(x,y,e)))
 if(!a.tris)return contact(a.left,b,e)||contact(a.right,b,e)
 return contact(a,b.left,e)||contact(a,b.right,e)
}
function inside(p,triangles) {
 ray.set(p,new THREE.Vector3(.873,.331,.358).normalize());const distances=[]
 for(const t of triangles){const q=ray.intersectTriangle(t.a,t.b,t.c,false,hit);if(q){const d=p.distanceTo(q);if(!distances.some(x=>Math.abs(x-d)<1e-5))distances.push(d)}}
 return distances.length%2===1
}
export function auditVehicle(id,time=0) {
 const model=createVehicle(id,{merge:false});model.userData.animate(time,true);model.updateMatrixWorld(true)
 const parts=model.userData.parts.map(m=>{
   const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry,p=g.attributes.position,tris=[]
   for(let i=0;i<p.count;i+=3){const t=new THREE.Triangle(...[i,i+1,i+2].map(j=>v().fromBufferAttribute(p,j).applyMatrix4(m.matrixWorld)));if(t.getArea()>1e-9)tris.push(t)}
   if(g!==m.geometry)g.dispose()
   const closed=!(m.geometry.type==='SphereGeometry'&&m.geometry.parameters.thetaLength<Math.PI)
   return {name:m.name,tris,tree:tree([...tris]),mesh:m,closed}
 })
 const sets=parts.map((_,i)=>i),find=i=>sets[i]===i?i:(sets[i]=find(sets[i])),contacts=[],clearanceFailures=[]
 const mechanism=m=>{for(let p=m.parent;p;p=p.parent)if([...model.userData.wheels,...model.userData.arms].includes(p))return p;return null}
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
   const a=parts[i],b=parts[j];if(boxDistance(a.tree.box,b.tree.box)>.025)continue
   if(contact(a.tree,b.tree,.025)||(b.closed&&inside(a.tris[0].a,b.tris))||(a.closed&&inside(b.tris[0].a,a.tris))){
     sets[find(j)]=find(i);contacts.push([a.name,b.name])
     const ma=mechanism(a.mesh),mb=mechanism(b.mesh)
     // Separate wheel/arm mechanisms and glazing must never strike each other.
     if((ma&&mb&&ma!==mb)||(ma&&!mb&&b.mesh.userData.jointTo!==ma)||(mb&&!ma&&a.mesh.userData.jointTo!==mb))clearanceFailures.push([a.name,b.name])
   }
 }
 const groups=new Map();parts.forEach((p,i)=>{const k=find(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push({name:p.name,center:p.tree.box.getCenter(v()).toArray().map(n=>+n.toFixed(3))})})
 const components=[...groups.values()].sort((a,b)=>b.length-a.length)
 const report={id,time,parts:parts.length,components:components.length,floating:components.slice(1),clearanceFailures,contacts:contacts.length}
 model.userData.dispose();return report
}
if(process.argv[1]===fileURLToPath(import.meta.url))for(const vehicle of VEHICLES.filter(v=>!process.argv[2]||v.id===process.argv[2]))console.log(JSON.stringify(auditVehicle(vehicle.id,Number(process.argv[3]||0))))
