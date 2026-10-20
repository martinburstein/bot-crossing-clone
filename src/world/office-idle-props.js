import * as THREE from 'three';

export function createIdleProps(scene,count){
 const ceramic=new THREE.MeshStandardMaterial({color:0xe9e2d3,roughness:.45});
 const coffeeMaterial=new THREE.MeshStandardMaterial({color:0x543a27,roughness:.8});
 const paper=new THREE.MeshStandardMaterial({color:0xffefbc});
 const paperBack=new THREE.MeshStandardMaterial({color:0xe5d7af});
 const ink=new THREE.MeshStandardMaterial({color:0x52665b});
 const props=Array.from({length:count},()=>{
  const cup=new THREE.Group(),note=new THREE.Group();
  // The grip is at the outer side of the handle, not at the mug's center.
  cup.add(new THREE.Mesh(new THREE.CylinderGeometry(.12,.10,.24,24),ceramic));
  const top=new THREE.Mesh(new THREE.CylinderGeometry(.104,.104,.01,24),coffeeMaterial);top.position.y=.125;cup.add(top);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.115,.026,10,24),ceramic);handle.position.x=-.175;cup.add(handle);
  note.add(new THREE.Mesh(new THREE.PlaneGeometry(.36,.27),paper));
  const back=new THREE.Mesh(new THREE.PlaneGeometry(.36,.27),paperBack);back.rotation.y=Math.PI;back.position.z=-.002;note.add(back);
  for(let i=0;i<3;i++){const line=new THREE.Mesh(new THREE.PlaneGeometry(.24-i*.025,.014),ink);line.position.set(0,.065-i*.065,.003);note.add(line);}
  for(const prop of [cup,note]){prop.visible=false;prop.matrixAutoUpdate=false;scene.add(prop);}
  return {cup,note};
 });
 const matrix=new THREE.Matrix4();
 const cupGrip=new THREE.Matrix4().makeTranslation(.31,.09,.04);
 // Printed face points back toward the reader; the other side is plain paper.
 const noteGrip=new THREE.Matrix4().makeTranslation(.18,.19,.04).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(new THREE.Matrix4().makeRotationX(.18));
 return {hide(){for(const {cup,note} of props){cup.visible=false;note.visible=false;}},
 dispose(){const geometries=new Set();for(const {cup,note}of props)for(const prop of [cup,note]){prop.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});prop.removeFromParent();}geometries.forEach(g=>g.dispose());for(const m of [ceramic,coffeeMaterial,paper,paperBack,ink])m.dispose();},
 update(index,root,handBone,mode,time,yaw){
  const {cup,note}=props[index];cup.visible=mode==='idle-coffee';note.visible=mode==='idle-note';
  if(!cup.visible&&!note.visible)return;
  matrix.multiplyMatrices(root,handBone);
  if(cup.visible){cup.matrix.multiplyMatrices(matrix,cupGrip);cup.matrixWorldNeedsUpdate=true;}
  if(note.visible){note.matrix.multiplyMatrices(matrix,noteGrip);note.matrixWorldNeedsUpdate=true;}
 }};
}
