import * as THREE from 'three';
import {OFFICE_BY_ID} from '../office/profiles.js';

// Tailoring over the existing animated Bot Crossing body. Styles are editorial,
// not claims about the real people's clothing or physical appearance.
export function createOfficeSuit(profileId){
  const p=OFFICE_BY_ID[profileId];if(!p)throw Error('Unknown office profile');
  const group=new THREE.Group();group.name=`office-two-piece-${profileId}`;
  const chest=new THREE.Group(),head=new THREE.Group();chest.matrixAutoUpdate=head.matrixAutoUpdate=false;group.add(chest,head);
  const materials=[],geometries=[];
  const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.91,...extra});materials.push(m);return m;};
  const cloth=mat(p.color),lapel=mat(new THREE.Color(p.color).multiplyScalar(1.24)),shirt=mat(0xf4ead9),tie=mat(p.accent),button=mat(0xc7b389,{metalness:.45,roughness:.35});
  function add(parent,name,geometry,m,x,y,z){geometries.push(geometry);const o=new THREE.Mesh(geometry,m);o.name=name;o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}
  const box=(parent,name,x,y,z,w,h,d,m)=>add(parent,name,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  box(chest,'tailored-jacket',0,-.12,-.02,.93,.83,.53,cloth);
  box(chest,'shirt-front',0,.10,.267,.37,.62,.035,shirt);
  for(const side of [-1,1]){
    const s=new THREE.Shape();s.moveTo(side*.04,.33);s.lineTo(side*.48,.30);s.lineTo(side*.31,-.20);s.lineTo(side*.12,-.02);s.closePath();
    const lap=add(chest,`${p.cut}-lapel-${side}`,new THREE.ExtrudeGeometry(s,{depth:.035,bevelEnabled:false}),lapel,0,0,.29);
    if(p.cut==='peak')lap.scale.y=1.13;
    const collar=box(chest,`shirt-collar-${side}`,side*.14,.33,.32,.19,.16,.035,shirt);collar.rotation.z=side*.38;
    box(chest,`jacket-pocket-${side}`,side*.31,-.34,.29,.22,.035,.025,lapel);
  }
  if(!['jamie-mai','porter-collins'].includes(p.id)){
    const s=new THREE.Shape();s.moveTo(-.055,.24);s.lineTo(.055,.24);s.lineTo(.09,-.18);s.lineTo(0,-.28);s.lineTo(-.09,-.18);s.closePath();
    add(chest,'silk-necktie',new THREE.ExtrudeGeometry(s,{depth:.018,bevelEnabled:false}),tie,0,0,.35);
    box(chest,'tie-knot',0,.26,.35,.11,.1,.06,tie);
  }
  box(chest,'pocket-square',.29,.13,.325,.16,.085,.03,tie);
  for(const x of p.cut==='double'?[-.12,.12]:[.08])for(const y of [-.19,-.36])add(chest,'jacket-button',new THREE.SphereGeometry(.025,6,5),button,x,y,.32);
  if(p.cut==='pinstripe')for(let x=-.4;x<=.4;x+=.12)box(chest,'fine-pinstripe',x,-.08,.305,.009,.7,.012,button);
  if(p.cut==='patch')for(const side of [-1,1])box(chest,'tweed-patch-pocket',side*.32,-.31,.31,.24,.22,.04,lapel);
  // Small collar breaks the oxygen-suit silhouette without replacing the robot face.
  const collar=add(head,'office-shirt-collar',new THREE.TorusGeometry(.30,.055,6,20),shirt,0,.10,0);collar.rotation.x=Math.PI/2;
  let disposed=false;
  group.update=(root,headBone,chestBone)=>{if(disposed)return;head.matrix.multiplyMatrices(root,headBone);chest.matrix.multiplyMatrices(root,chestBone);head.matrixWorldNeedsUpdate=chest.matrixWorldNeedsUpdate=true;head.visible=chest.visible=true;};
  group.hide=()=>{head.visible=chest.visible=false;};
  group.dispose=()=>{if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};
  return group;
}
