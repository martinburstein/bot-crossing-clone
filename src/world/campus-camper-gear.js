import * as THREE from 'three'

export const isCampusCamper=thread=>thread?.worldProfile==='roarm-campus'&&thread.dispatchMode==='free-15-3A'&&thread.roleId==='camper'
// A soft sage shawl, cream collar and amber clasp distinguish the calm resident.
export function createCampusCamperGear(){
  const group=new THREE.Group();group.name='campus-camper-calm-fit'
  const head=new THREE.Group(),chest=new THREE.Group();head.matrixAutoUpdate=chest.matrixAutoUpdate=false;group.add(head,chest)
  const sage=new THREE.MeshStandardMaterial({color:0x718c79,roughness:.95}),cream=new THREE.MeshStandardMaterial({color:0xe6d9bb,roughness:.9}),gold=new THREE.MeshStandardMaterial({color:0xe0ae65,roughness:.5,metalness:.25})
  const geometries=[]
  function add(parent,name,geometry,material,x,y,z){geometries.push(geometry);const o=new THREE.Mesh(geometry,material);o.name=name;o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o}
  const shawl=add(chest,'camper-wool-shawl',new THREE.SphereGeometry(.59,16,10,0,Math.PI*2,Math.PI*.23,Math.PI*.49),sage,0,.18,-.005);shawl.scale.set(1.13,.64,.74)
  const collar=add(head,'camper-soft-collar',new THREE.TorusGeometry(.40,.075,8,24),cream,0,.17,0);collar.rotation.x=Math.PI/2
  add(chest,'camper-amber-clasp',new THREE.SphereGeometry(.075,10,6),gold,0,.16,.405)
  for(const x of [-1,1])add(chest,`camper-scarf-tail-${x}`,new THREE.BoxGeometry(.16,.40,.07),cream,x*.21,-.04,.36)
  let disposed=false
  group.update=(root,headBone,chestBone)=>{if(disposed)return;head.matrix.multiplyMatrices(root,headBone);chest.matrix.multiplyMatrices(root,chestBone);head.matrixWorldNeedsUpdate=chest.matrixWorldNeedsUpdate=true;head.visible=chest.visible=true}
  group.hide=()=>{head.visible=chest.visible=false}
  group.dispose=()=>{if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());[sage,cream,gold].forEach(m=>m.dispose())}
  group.userData.characterScale=1.65;return group
}
