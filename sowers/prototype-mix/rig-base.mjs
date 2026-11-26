import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const C = { cream: 0xf3e4c8, orange: 0xf17721, cocoa: 0x4b3026, pale: 0xfff3dd };
const mat = (color, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
const M = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, mat(v)]));
function rounded(w,h,d,r=0.12,material=M.cream,segments=4){ return new THREE.Mesh(new RoundedBoxGeometry(w,h,d,segments,r),material); }
function archMesh(width,height,depth,material) {
  const s=new THREE.Shape();
  s.moveTo(-width/2,0); s.bezierCurveTo(-width*.38,height*.72,-width*.2,height,width*.0,height*.96); s.bezierCurveTo(width*.24,height*.92,width*.38,height*.45,width/2,0);
  s.bezierCurveTo(width*.45,-height*.17,width*.36,-height*.16,width*.30,-height*.03); s.bezierCurveTo(width*.18,height*.48,width*.09,height*.62,0,height*.62); s.bezierCurveTo(-width*.10,height*.62,-width*.24,height*.40,-width*.32,-height*.03); s.bezierCurveTo(-width*.39,-height*.18,-width*.48,-height*.14,-width/2,0);
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.018}); g.computeVertexNormals(); return new THREE.Mesh(g,material);
}
function torsoMesh(material) {
  const s=new THREE.Shape();
  s.moveTo(-.39,.37); s.lineTo(.39,.37); s.quadraticCurveTo(.48,.35,.47,.27); s.lineTo(.43,-.27); s.quadraticCurveTo(.42,-.37,.30,-.38); s.lineTo(-.30,-.38); s.quadraticCurveTo(-.42,-.37,-.43,-.27); s.lineTo(-.47,.27); s.quadraticCurveTo(-.48,.35,-.39,.37); s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.50,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.055,bevelThickness:.06}); g.computeVertexNormals(); const mesh=new THREE.Mesh(g,material); mesh.position.z=-.28; return mesh;
}
function crownStripeMesh(material) {
  // Conform a narrow orange panel to the rounded hood's upper front curve.
  const columns=6, rows=24, xHalf=.205, yBottom=3.63, yTop=4.025;
  const positions=[], indices=[];
  for(let j=0;j<=rows;j++){
    const y=yBottom+(yTop-yBottom)*j/rows, dy=Math.max(0,y-3.63);
    const z=.11+Math.sqrt(Math.max(0,.40*.40-dy*dy))+.008;
    for(let i=0;i<=columns;i++){const x=-xHalf+2*xHalf*i/columns;positions.push(x,y,z);}
  }
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const a=j*(columns+1)+i,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return new THREE.Mesh(g,material);
}
function leafMesh(material) {
  const s=new THREE.Shape(); s.moveTo(-.24,-.08); s.quadraticCurveTo(-.12,.20,.28,.24); s.quadraticCurveTo(.25,-.10,-.24,-.08);
  const g=new THREE.ExtrudeGeometry(s,{depth:.04,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.02}); g.computeVertexNormals(); return new THREE.Mesh(g,material);
}
export function createRig(scene) {
  const root=new THREE.Group(); scene.add(root);
  const parts={root, head:new THREE.Group(), torso:new THREE.Group(), leftArm:new THREE.Group(),rightArm:new THREE.Group(),leftLeg:new THREE.Group(),rightLeg:new THREE.Group()};
  root.add(parts.torso,parts.head,parts.leftArm,parts.rightArm,parts.leftLeg,parts.rightLeg);
  // Distinct, softly beveled body mass with a gentle shoulder taper.
  const body=torsoMesh(M.cream); body.position.set(0,1.90,-.28); parts.torso.add(body);
  // Narrow orange side shoulders are part of the silhouette, not equipment panels.
  for (const side of [-1,1]) { const shoulder=rounded(.15,.42,.43,.075,M.cream); shoulder.position.set(side*.50,2.19,-.01); shoulder.rotation.z=side*.10; parts.torso.add(shoulder); }
  // Single seed mark, built as shallow raised geometry on chest.
  const seed=leafMesh(M.orange); seed.position.set(-.02,1.90,.40); seed.rotation.z=.24; seed.scale.setScalar(.78); parts.torso.add(seed);
  // Broad hood and shallow cowl-to-shoulder undercut; unified masses.
  const hood=rounded(2.05,1.62,1.02,.40,M.cream,6); hood.name='hood'; hood.position.set(0,3.22,0); parts.head.add(hood);
  const lowerCowl=rounded(1.62,.22,.86,.11,M.cream); lowerCowl.name='lowerCowl'; lowerCowl.position.set(0,2.41,.04); parts.head.add(lowerCowl);
  // Face is set into the front plane with an understated cream surround.
  const rim=rounded(1.54,.72,.10,.21,M.pale,6); rim.name='faceRim'; rim.position.set(0,3.22,.54); parts.head.add(rim);
  const visor=rounded(1.39,.58,.07,.17,M.cocoa,6); visor.name='faceWindow'; visor.position.set(0,3.22,.602); parts.head.add(visor);
  for(const [side,name] of [[-1,'eyeLeft'],[1,'eyeRight']]) { const eye=archMesh(.39,.19,.055,M.pale); eye.name=name; eye.position.set(side*.32,3.17,.644); parts.head.add(eye); }
  // Wide crown stripe, placed as a curved-looking broad crown panel.
  const stripe=crownStripeMesh(M.orange); stripe.name='crownStripe'; parts.head.add(stripe);
  // Arms attach high, use tapered-looking overlapping rounded volumes, hands kept compact.
  for (const [side,key] of [[-1,'leftArm'],[1,'rightArm']]) {
    const pivot=parts[key]; pivot.position.set(side*.69,2.18,0);
    const upper=rounded(.32,.56,.38,.145,M.cream); upper.position.set(side*.09,-.10,.0); upper.rotation.z=side*.24; pivot.add(upper);
    const mitten=rounded(.34,.34,.34,.135,M.cream); mitten.position.set(side*.17,-.42,.02); pivot.add(mitten);
  }
  // Legs pivot at hips. Boots are chunky, grounded, and orange at the sole.
  for (const [side,key] of [[-1,'leftLeg'],[1,'rightLeg']]) {
    const pivot=parts[key]; pivot.position.set(side*.29,1.55,0);
    const leg=rounded(.38,.70,.42,.15,M.cream); leg.position.set(0,-.35,0); pivot.add(leg);
    const boot=rounded(.53,.32,.58,.145,M.orange); boot.position.set(0,-.62,.035); pivot.add(boot);
  }
  const poseState={pose:'neutral',t:0};
  function setPose(pose='neutral', progress=0) {
    poseState.pose=pose; poseState.t=THREE.MathUtils.clamp(progress,0,1);
    const t=poseState.t;
    // Rigid-body hop translates the complete assembly; no torso/head scale or squash.
    root.position.y=-.77 + (pose==='hop' ? .62*Math.sin(Math.PI*t) : 0);
    parts.leftArm.rotation.z=pose==='reach' ? -.12-.92*t : pose==='hop' ? -.15-.22*Math.sin(Math.PI*t) : -.06;
    parts.rightArm.rotation.z=pose==='reach' ? .20+.10*t : pose==='hop' ? .14+.24*Math.sin(Math.PI*t) : .06;
    parts.leftLeg.rotation.z=pose==='hop' ? .16*Math.sin(Math.PI*t) : 0;
    parts.rightLeg.rotation.z=pose==='hop' ? -.16*Math.sin(Math.PI*t) : 0;
    // Keep reach pose readable without altering any dimensions.
    parts.torso.rotation.z=pose==='reach' ? -.035*t : 0;
    parts.head.rotation.z=pose==='reach' ? -.025*t : 0;
  }
  const geometryIds=[...new Set(root.children.flatMap(x=>x.children).map(x=>x.geometry).filter(Boolean))];
  return {root,parts,setPose,geometryCount:geometryIds.length, dispose(){ scene.remove(root); root.traverse(o=>{if(o.geometry)o.geometry.dispose();}); }};
}
