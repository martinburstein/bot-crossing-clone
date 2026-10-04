import * as THREE from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {HANGAR} from '../game/magi-world.js'

// Compact three-bay service shed. The sliding roof is retracted above the rear
// workshop so the parked fleet remains visible from the colony camera.
export function createHangar() {
 const group=new THREE.Group();group.name='mars-hangar';group.position.set(HANGAR.x,0,HANGAR.z)
 const mats={hull:new THREE.MeshStandardMaterial({color:0xe8e2d6,roughness:.65}),dark:new THREE.MeshStandardMaterial({color:0x384751,roughness:.75}),orange:new THREE.MeshStandardMaterial({color:0xe99a46,roughness:.55}),floor:new THREE.MeshStandardMaterial({color:0x5b6569,roughness:.9}),light:new THREE.MeshStandardMaterial({color:0xace5ef,emissive:0x79bdc7,emissiveIntensity:.5})}
 function box(x,y,z,w,h,d,key){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats[key]);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m}
 box(0,-.1,0,19,1.1,11,'floor')
 const ramp=box(0,-.13,6.5,19,1,2,'floor')
 const rampPositions=ramp.geometry.attributes.position
 for(let i=0;i<rampPositions.count;i++)if(rampPositions.getY(i)>0)rampPositions.setY(i,.38-.2*rampPositions.getZ(i))
 ramp.geometry.computeVertexNormals()
 // Low side panels, a braced back wall and continuous load-bearing roof rails.
 box(0,2.45,-5.2,19,4,.28,'hull')
 for(const x of [-9.2,9.2]) {box(x,1.1,0,.28,1.3,10.6,'hull');box(x,4.7,0,.35,.35,10.6,'dark')}
 for(const x of [-9,-3,3,9])for(const z of [-5,4.6]) {box(x,2.6,z,.3,4.3,.3,'dark');box(x,.8,z,.42,.7,.42,'orange')}
 box(0,4.7,4.6,18.3,.4,.4,'hull');box(0,4.7,-5,18.3,.4,.4,'dark')
 for(const x of [-3,3])box(x,4.7,-.2,.2,.23,9.6,'dark')
 // Three folded roof panels, with solid supports at both ends.
 for(let i=0;i<3;i++)box(0,4.96+i*.13,-3.8-i*.12,18.6,.1,2.7,'hull')
 box(0,5.02,4.6,6,.52,.16,'orange')
 if(typeof document!=='undefined') {
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=96
   const ctx=canvas.getContext('2d');ctx.fillStyle='#21333f';ctx.fillRect(0,0,768,96);ctx.fillStyle='#f6eee1';ctx.font='bold 47px sans-serif';ctx.textAlign='center';ctx.fillText('MARS MOTOR POOL',384,65)
   const map=new THREE.CanvasTexture(canvas),label=new THREE.Mesh(new THREE.PlaneGeometry(5.5,.63),new THREE.MeshBasicMaterial({map}));label.position.set(0,5.03,4.7);group.add(label)
 }
 const bays=[-6,0,6].map((x,i)=>({index:i,position:new THREE.Vector3(x+HANGAR.x,HANGAR.deck,HANGAR.z),dock:new THREE.Vector3(x+HANGAR.x+2.85,HANGAR.deck,HANGAR.z+1),work:new THREE.Vector3(x+HANGAR.x,0,HANGAR.z+12),model:null,parkedAt:i}))
 for(const bay of bays){const x=bay.position.x-HANGAR.x
   for(const dx of [-2.6,2.6])box(x+dx,.462,0,.07,.024,5.5,'orange')
   box(x,.462,-2.72,5.2,.024,.07,'orange');box(x,4.45,4.5,1,.12,.14,'light')
 }
 // Keep the building cheap to render alongside the fleet.
 group.updateMatrixWorld(true)
 for(const mat of Object.values(mats)){
   const meshes=group.children.filter(m=>m.isMesh&&m.material===mat);if(!meshes.length)continue
   const geos=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix))
   const merged=new THREE.Mesh(mergeGeometries(geos),mat);merged.castShadow=true;merged.receiveShadow=true
   for(const m of meshes){group.remove(m);m.geometry.dispose()}geos.forEach(g=>g.dispose());group.add(merged)
 }
 const raycaster=new THREE.Raycaster()
 return {group,bays,
   contains(x,z){return Math.abs(x-HANGAR.x)<=9.5&&Math.abs(z-HANGAR.z)<=5.5},
   rampHeight(x,z){const localZ=z-HANGAR.z;return Math.abs(x-HANGAR.x)<=9.5&&localZ>5.5&&localZ<7.5?.45-(localZ-5.5)*.2:null},
   pick(camera,x,y){raycaster.setFromCamera(new THREE.Vector2(x,y),camera);return raycaster.intersectObject(group,true).length>0},
   clearings:[{x:HANGAR.x,z:HANGAR.z,r:13},{x:HANGAR.x,z:HANGAR.z+10,r:12}],
   obstacles:[...[-9,-3,3,9].flatMap(x=>[-5,4.6].map(z=>({x:x+HANGAR.x,z:z+HANGAR.z,r:.5}))),...Array.from({length:19},(_,i)=>({x:i-9+HANGAR.x,z:-5.2+HANGAR.z,r:.65})),...[-9.2,9.2].flatMap(x=>Array.from({length:11},(_,i)=>({x:x+HANGAR.x,z:i-5+HANGAR.z,r:.5}))),...bays.flatMap(b=>[{x:b.position.x,z:b.position.z,r:2.65},{x:b.work.x,z:b.work.z,r:2.65}])],
   dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.material?.map){o.material.map.dispose();o.material.dispose()}});Object.values(mats).forEach(m=>m.dispose())},
 }
}
