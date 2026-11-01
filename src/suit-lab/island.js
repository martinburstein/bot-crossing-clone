import * as THREE from 'three'

export function createFloatingIsland(scene){
 const group=new THREE.Group();group.name='kestrel-floating-island';scene.add(group)
 const center={x:-7,z:-1},rx=103,rz=89,segments=80
 const radius=a=>1+.025*Math.sin(a*7)+.018*Math.cos(a*11)
 const point=(a,r,y)=>[center.x+Math.cos(a)*rx*r*radius(a),y,center.z+Math.sin(a)*rz*r*radius(a)]
 const positions=[],colors=[]
 const green=new THREE.Color('#6f9654'),light=new THREE.Color('#8eab68')
 for(let ring=0;ring<12;ring++)for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,r0=ring/12,r1=(ring+1)/12
  const vertices=[point(a,r0,-.16),point(b,r0,-.16),point(a,r1,-.16),point(b,r0,-.16),point(b,r1,-.16),point(a,r1,-.16)]
  for(const j of [0,1,2,3,4,5]){positions.push(...vertices[j]);const [x,,z]=vertices[j],c=green.clone().lerp(light,.45+.20*Math.sin(x*.12)*Math.cos(z*.09));colors.push(c.r,c.g,c.b)}
 }
 const top=new THREE.BufferGeometry();top.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));top.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));top.computeVertexNormals()
 const turf=new THREE.Mesh(top,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));turf.name='island-meadow';turf.receiveShadow=true;group.add(turf)
 const rockPositions=[],rockColors=[]
 const earth=new THREE.Color('#92795b'),stone=new THREE.Color('#67766b'),dark=new THREE.Color('#455b56')
 const layers=[{r:1,y:-.2},{r:1.005,y:-3},{r:.98,y:-14},{r:.88,y:-33},{r:.56,y:-48},{r:.15,y:-65},{r:.035,y:-74}]
 for(let row=0;row<layers.length-1;row++)for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,u=layers[row],v=layers[row+1]
  const corners=[point(a,u.r,u.y),point(b,u.r,u.y),point(a,v.r,v.y),point(b,v.r,v.y)]
  for(const j of [0,1,2,1,3,2]){rockPositions.push(...corners[j]);const c=(row===0?earth:stone.clone().lerp(dark,row/5)).clone().multiplyScalar(.88+.16*Math.sin(i*2.8+row));rockColors.push(c.r,c.g,c.b)}
 }
 const rock=new THREE.BufferGeometry();rock.setAttribute('position',new THREE.Float32BufferAttribute(rockPositions,3));rock.setAttribute('color',new THREE.Float32BufferAttribute(rockColors,3));rock.computeVertexNormals()
 const cliff=new THREE.Mesh(rock,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,side:THREE.DoubleSide}));cliff.name='floating-earth';cliff.castShadow=true;cliff.receiveShadow=true;group.add(cliff)
 // Small grass tufts grow only on land, away from the lab and flower meadow.
 const blades=new THREE.InstancedMesh(new THREE.ConeGeometry(.09,.55,3),new THREE.MeshStandardMaterial({color:'#71934d'}),1200),dummy=new THREE.Object3D()
 let n=0,seed=918731
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 for(let i=0;n<1200;i++){
  const a=random()*Math.PI*2,r=Math.sqrt(random())*.96,x=center.x+Math.cos(a)*rx*r,z=center.z+Math.sin(a)*rz*r
  if(x>-54&&x<32&&z>-65&&z<36||z>40&&Math.abs(x)<65)continue
  dummy.position.set(x,.05,z);dummy.rotation.y=a;dummy.scale.setScalar(.6+((i*.357)%1));dummy.updateMatrix();blades.setMatrixAt(n++,dummy.matrix)
 }
 group.add(blades)
 // Low, soft cloud banks leave the cutaway earth and meadow readable.
 const cloudMat=new THREE.MeshStandardMaterial({color:'#f4f5e8',roughness:1,transparent:true,opacity:.52,depthWrite:false})
 const cloudGeo=new THREE.SphereGeometry(1,16,10)
 for(let i=0;i<11;i++){const a=i*2.39996,c=new THREE.Mesh(cloudGeo,cloudMat);c.position.set(Math.cos(a)*(115+i%3*15),-26-i%4*7,Math.sin(a)*100);c.scale.set(22+i%3*7,3+i%2*2,12+i%4*4);group.add(c)}
 return {group}
}
