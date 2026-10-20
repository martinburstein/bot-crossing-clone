import * as THREE from 'three';
import {PROFILES} from './profiles.js';
export function createOffice(scene){
const group=new THREE.Group();group.name='office';scene.add(group);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.74,metalness:.06,...extra});materials.add(m);return m;};
  const ink=mat(0x25363c),oak=mat(0xb79468),walnut=mat(0x765740),stone=mat(0xd3cbb9),pale=mat(0xe9e2d3),brass=mat(0xc9a968,{metalness:.5}),green=mat(0x456c54),screen=mat(0x142d32),glass=mat(0x93c2b8,{emissive:0x39776d,emissiveIntensity:.25});
  function mesh(geo,material,x,y,z,parent=group,name=''){geometries.add(geo);const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  const box=(x,y,z,w,h,d,m,p=group,n='')=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,p,n);
  const cyl=(x,y,z,r,h,m,p=group)=>mesh(new THREE.CylinderGeometry(r,r,h,20),m,x,y,z,p);
  box(0,.22,2,69,.7,53,ink,group,'office-foundation');box(0,.60,2,68,.12,52,stone,group,'office-travertine-floor');
  // Quiet limestone grid, walnut work islands and wide continuous aisles.
  for(let x=-33;x<=33;x+=4)box(x,.674,2,.025,.012,51,oak);
  for(let z=-23;z<=27;z+=4)box(0,.674,z,67,.012,.025,oak);
  for(const x of [-34,34])box(x,.7,2,.13,.12,52,brass);
  for(const z of [-24,28])box(0,.7,z,68,.12,.13,brass);

  const desks=[],chairs=[];
  for(const p of PROFILES){
    const g=new THREE.Group();g.name=`office-desk-${p.index}`;g.position.set(p.desk.x,0,p.desk.z);group.add(g);desks.push(g);
    const accent=mat(p.color),trim=mat(p.accent);
    box(0,.73,0,12,.10,10,accent,g,'desk-area-rug');
    box(0,2.55,0,10.1,.38,4.8,walnut,g,'walnut-desk-top');box(0,2.78,0,9.8,.06,4.5,oak,g);
    for(const x of [-4,4]){box(x,1.58,0,1.3,1.7,3.8,ink,g);for(const y of [1.2,1.8,2.3])box(x,y,2,1.0,.07,.07,brass,g);}
    // Three screens with documents, task cards, and text lines.
    for(const [i,x]of [-2.8,0,2.8].entries()){
      box(x,3.15,-.6,.16,.6,.2,ink,g);box(x,3.9,-.8,2.65,1.52,.18,ink,g);box(x,3.94,-.69,2.42,1.29,.02,screen,g);
      for(let j=0;j<5;j++)box(x-.25+(j%2)*.12,4.38-j*.21,-.665,1.65-(j%3)*.25,.055,.035,j===0?trim:glass,g);
      box(x-.97,3.97,-.665,.12,1.03,.035,trim,g);
      box(x,2.86,1.8,2.3,.09,.62,ink,g);
      for(let key=0;key<7;key++)box(x-.84+key*.28,2.913,1.8,.17,.025,.40,pale,g);
    }
    box(-3.9,2.87,.6,.95,.10,1.15,pale,g,'research-papers');box(-3.8,2.94,.55,.9,.05,1.1,trim,g);
    cyl(4,3.02,1.25,.24,.45,pale,g);cyl(4,3.25,1.25,.18,.015,walnut,g);
    // Fit the desktop to the character's seated elbow height.
    for(const part of g.children)if(part.position.y>1){part.position.y=.8+(part.position.y-.8)*.68;part.scale.y*=.68;}
    const chair=new THREE.Group();chair.position.set(p.desk.x,0,p.desk.z+4.2);group.add(chair);chairs.push(chair);
    cyl(0,.87,.28,.32,.1,ink,chair);box(0,.96,0,.15,.18,.15,ink,chair);
    box(0,1.01,.22,1.35,.18,.80,accent,chair);box(0,1.65,.63,1.4,1.2,.2,accent,chair);
  }
  // Low office furniture keeps the room open to the sky and preserves sightlines.
  for(const x of [-31.5,31.5])for(const z of [-21,2,25]){
    cyl(x,1.25,z,.92,1.15,walnut);cyl(x,2,z,.18,1.4,walnut);
    const leaves=mesh(new THREE.IcosahedronGeometry(1.65,1),green,x,3.05,z);leaves.scale.y=1.2;
  }
  const coffee=new THREE.Group();coffee.name='office-coffee-and-library';coffee.position.set(-24,0,-22);group.add(coffee);
  box(0,1.6,0,11,1.8,2.4,walnut,coffee);box(0,2.58,0,11.4,.17,2.6,pale,coffee);box(-2,3.28,0,1.9,1.3,1.4,ink,coffee);
  for(let i=0;i<5;i++)box(1+i*.65,3,-.25,.42,.8,1,mat(PROFILES[i].color),coffee);

return {group,desks,chairs,setChair(index,seated){chairs[index].position.z=PROFILES[index].desk.z+4.85-1.90*seated;}};
}
