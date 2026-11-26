import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CANDY_VARIANTS, describeCandyOutline, getCandyRoundedSegments, getCandyFeatures, getCandyFrontBulge } from './silhouettes.mjs';

export { CANDY_VARIANTS } from './silhouettes.mjs';
const HEIGHT = 1.85;

function outlineShape(variant) {
  const segments = getCandyRoundedSegments(variant);
  const shape = new THREE.Shape();
  shape.moveTo(...segments[0].before);
  for (const { before,corner,after } of segments) {
    shape.lineTo(...before);
    shape.quadraticCurveTo(...corner,...after);
  }
  shape.closePath();
  return shape;
}

// Subdivide only the front cap so its continuous, shallow crown has actual
// surface geometry. The connected outline and rear slab stay unchanged.
function crownFront(geometry,variant,depth) {
  const input=geometry.attributes.position.array,output=[];
  const push=(a,b,c,level=0)=>{
    const max=Math.max(Math.hypot(...a.map((v,k)=>v-b[k])),Math.hypot(...b.map((v,k)=>v-c[k])),Math.hypot(...c.map((v,k)=>v-a[k])));
    if(level<5&&a[2]>depth+.0269&&b[2]>depth+.0269&&c[2]>depth+.0269&&max>.085) {
      const mid=(u,v)=>u.map((n,k)=>(n+v[k])/2),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
      push(a,ab,ca,level+1);push(ab,b,bc,level+1);push(ca,bc,c,level+1);push(ab,bc,ca,level+1);
    } else output.push(...a,...b,...c);
  };
  for(let i=0;i<input.length;i+=9)push(Array.from(input.slice(i,i+3)),Array.from(input.slice(i+3,i+6)),Array.from(input.slice(i+6,i+9)));
  const cap=[];
  for(let i=0;i<output.length;i+=3) {
    if(output[i+2]>depth+.0269)cap.push(i/3);
    const influence=THREE.MathUtils.smoothstep(output[i+2],depth-.027,depth+.027);
    output[i+2]+=getCandyFrontBulge(variant,output[i],output[i+1])*influence;
  }
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(output,3));// Analytic front normals suppress seams across the cap triangulation. The
  // shallow crown is a height field; its normal is (-dz/dx,-dz/dy,1).
  result.computeVertexNormals();
  const normals=result.attributes.normal,e=.0001;
  for(const at of cap) {
    const x=output[at*3],y=output[at*3+1];
    const dx=(getCandyFrontBulge(variant,x+e,y)-getCandyFrontBulge(variant,x-e,y))/(2*e);
    const dy=(getCandyFrontBulge(variant,x,y+e)-getCandyFrontBulge(variant,x,y-e))/(2*e);
    const normal=new THREE.Vector3(-dx,-dy,1).normalize();normals.setXYZ(at,normal.x,normal.y,normal.z);
  }
  // Keep cap normals separate from the surrounding intentional bevel facets.
  const smooth=mergeVertices(result,.000001);result.dispose();geometry.dispose();return smooth;
}
function curveFeature(mesh,variant,scale,origin) {
  const input=mesh.geometry.attributes.position.array,output=[];
  const split=(a,b,c,level=0)=>{
    const distance=(p,q)=>Math.hypot(...p.map((n,k)=>n-q[k]));
    if(level<4&&Math.max(distance(a,b),distance(b,c),distance(c,a))>.075*scale) {
      const mid=(p,q)=>p.map((n,k)=>(n+q[k])/2),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
      split(a,ab,ca,level+1);split(ab,b,bc,level+1);split(ca,bc,c,level+1);split(ab,bc,ca,level+1);
    } else output.push(...a,...b,...c);
  };
  for(let i=0;i<input.length;i+=9)split(Array.from(input.slice(i,i+3)),Array.from(input.slice(i+3,i+6)),Array.from(input.slice(i+6,i+9)));
  for(let i=0;i<output.length;i+=3)output[i+2]+=getCandyFrontBulge(variant,output[i]/scale+origin.x,output[i+1]/scale+origin.y)*scale;
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(output,3));
  mesh.geometry.dispose();mesh.geometry=mergeVertices(result,.000001);result.dispose();mesh.geometry.computeVertexNormals();
}

function featureShape(feature,scale,origin) {
  const shape=new THREE.Shape();
  const transform=point=>[(point[0]-origin.x)*scale,(point[1]-origin.y)*scale];
  shape.moveTo(...transform(feature.segments[0].before));
  for(const {before,corner,after} of feature.segments) {
    shape.lineTo(...transform(before));shape.quadraticCurveTo(...transform(corner),...transform(after));
  }
  shape.closePath();return shape;
}
function relief(shape,material,depth,edgeRound) {
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:10,
    bevelEnabled:true,bevelSize:edgeRound,bevelThickness:edgeRound,bevelOffset:-edgeRound,bevelSegments:3});
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;return mesh;
}

/** Original, one-piece candy silhouette. Neutral feet Y=0, height 1.85, front +Z.
 * `matte` is the digital mascot; `gummy` is a material study; `silhouette` hides
 * every face detail. Neither material mode constitutes a production candy spec.
 */
export function createCandySower({ color = 0xf5823a,seed = 0,variant = 'scout',materialMode = 'matte' } = {}) {
  const chosen = Object.hasOwn(CANDY_VARIANTS,variant) ? variant : 'scout';
  const spec = describeCandyOutline(chosen);
  const root = new THREE.Group();
  root.name = `Candy Sower — ${spec.name}`;
  const pose = new THREE.Group();
  pose.name = 'candy-pose';
  root.add(pose);
  const tint = new THREE.Color(color);
  const candy = materialMode === 'gummy'
    ? new THREE.MeshPhysicalMaterial({ color:tint,roughness:.39,metalness:0,transmission:.13,thickness:.35,ior:1.42,clearcoat:.22,clearcoatRoughness:.32 })
    : new THREE.MeshStandardMaterial({ color:materialMode === 'silhouette' ? 0x28362d : tint,roughness:.76,metalness:0 });

  // BevelOffset keeps the maximum perimeter inside the canonical 2D contour.
  // Flat front and back are compatible with a shallow relief/one-piece study.
  let geometry = new THREE.ExtrudeGeometry(outlineShape(chosen),{
    depth:spec.depth,steps:1,curveSegments:3,
    bevelEnabled:true,bevelSize:.027,bevelThickness:.027,bevelOffset:-.027,bevelSegments:2,
  });
  geometry=crownFront(geometry,chosen,spec.depth);
  geometry.computeBoundingBox();
  const originalBox = geometry.boundingBox.clone();
  const scale = HEIGHT / (originalBox.max.y-originalBox.min.y);
  geometry.translate(0,-originalBox.min.y,-spec.depth / 2);
  geometry.scale(scale,scale,scale);
  geometry.computeBoundingBox();
  const body = new THREE.Mesh(geometry,candy);
  body.name = 'one-piece-candy-body';
  body.castShadow = body.receiveShadow = true;
  pose.add(body);

  // Real front surface hierarchy: a rounded helmet rim around a shallow mask
  // recess, eyes in that recess and one leaf stamp. All four use canonical XY.
  // Gummy is deliberately monochrome: no dark inserts are implied by that view.
  const features=getCandyFeatures(chosen);
  const face = new THREE.Group();
  face.name = 'canonical-front-relief';
  face.position.set(spec.face.x*scale,(spec.face.y-originalBox.min.y)*scale,(spec.depth/2+.027)*scale);
  face.visible=materialMode!=='silhouette';pose.add(face);
  const dark=new THREE.MeshStandardMaterial({color:0x33433c,roughness:.82});
  const cream=new THREE.MeshStandardMaterial({color:0xfff1cf,roughness:.78});
  const monochrome=materialMode==='gummy';
  const helmetMaterial=monochrome?candy:cream;
  const maskMaterial=monochrome?candy:dark;
  const eyeMaterial=monochrome?candy:cream;
  // Physical relief uses the final 1.85 height, independently of the small
  // normalization of the source contour after crown rounding.
  const mm=HEIGHT/30;
  const origin={x:spec.face.x,y:spec.face.y};
  const helmetShape=featureShape(features.helmet,scale,origin);
  // The hole makes the visor a physical depression in the raised helmet rim.
  helmetShape.holes.push(new THREE.Path(featureShape(features.face,scale,origin).getPoints(10)));
  const round=features.helmet.surface.edgeRoundMm*mm;
  const helmet=relief(helmetShape,helmetMaterial,features.helmet.surface.heightMm*mm-2*round,round);
  helmet.position.z=round;helmet.name='domed-helmet-boundary';curveFeature(helmet,chosen,scale,origin);face.add(helmet);
  const maskHeight=(features.helmet.surface.heightMm-features.face.surface.depthMm)*mm;
  const maskRound=features.face.surface.edgeRoundMm*mm;
  const visor=relief(featureShape(features.face,scale,origin),maskMaterial,maskHeight-2*maskRound,maskRound);
  visor.position.z=maskRound;visor.name='recessed-mask';curveFeature(visor,chosen,scale,origin);face.add(visor);
  for(const feature of features.eyes) {
    const edge=feature.surface.edgeRoundMm*mm;
    const eye=relief(featureShape(feature,scale,origin),eyeMaterial,feature.surface.heightMm*mm-2*edge,edge);
    eye.name=feature.id+'-relief';eye.position.z=maskHeight+edge;curveFeature(eye,chosen,scale,origin);face.add(eye);
  }
  const chestRound=features.chest.surface.edgeRoundMm*mm;
  const chest=relief(featureShape(features.chest,scale,origin),candy,features.chest.surface.heightMm*mm-2*chestRound,chestRound);
  chest.position.z=chestRound;chest.name='chest-leaf-stamp';curveFeature(chest,chosen,scale,origin);face.add(chest);

  // Connected mitten tabs flex at their broad base. Boots stay integral; only
  // their outer tips lift during locomotion. No hidden separate limb spheres.
  const positions = geometry.attributes.position;
  const rest = positions.array.slice();
  const flex = [];
  for (let i=0;i<positions.count;i++) {
    const at=i*3,x=rest[at],y=rest[at+1];
    const armBand=THREE.MathUtils.smoothstep(y,.49,.65)*(1-THREE.MathUtils.smoothstep(y,.95,1.10));
    const armWeight=THREE.MathUtils.smoothstep(Math.abs(x),.46,.71)*armBand;
    const footWeight=(1-THREE.MathUtils.smoothstep(y,.06,.34))*THREE.MathUtils.smoothstep(Math.abs(x),.09,.26);
    if (armWeight || footWeight) flex.push({ at,side:Math.sign(x),armWeight,footWeight });
  }
  const numericSeed = Number.isFinite(Number(seed)) ? Number(seed) : 0;
  const phase = ((Math.sin(numericSeed*127.1+19.7)*43758.5453)%1+1)%1*Math.PI*2;
  let movement = 0,selection = 0,currentStatus = 'idle';
  const smooth = (value,target,speed,dt) => THREE.MathUtils.damp(value,target,speed,dt);
  root.userData.animate = (elapsed,delta,{ status = 'idle',moving = false,selected = false } = {}) => {
    const dt = Number.isFinite(delta) ? THREE.MathUtils.clamp(delta,0,.1) : 1/60;
    const time = (Number.isFinite(elapsed) ? elapsed : 0)+phase;
    currentStatus = status;
    movement = smooth(movement,moving ? 1 : 0,8,dt);
    selection = smooth(selection,selected ? 1 : 0,6,dt);
    const step = Math.sin(time*7.2);
    const celebration = status === 'complete' && !moving ? Math.max(0,Math.sin(time*4)) : 0;
    const work = status === 'working' ? 1 : 0;
    const waiting = status === 'waiting' ? 1 : 0;
    const greeting = waiting*Math.sin(time*4)*.035;
    pose.position.y = Math.abs(step)*.026*movement+celebration*.038;
    pose.rotation.y = Math.sin(time*.9)*.045*(1-movement)+step*.035*movement;
    face.rotation.z = status === 'review' ? .045 : status === 'error' ? -.045 : 0;
    for (const { at,side,armWeight,footWeight } of flex) {
      positions.array[at+1]=rest[at+1]+armWeight*(celebration*.05+(side>0 ? greeting : 0))+footWeight*Math.max(0,step*side)*.035*movement;
      positions.array[at+2]=rest[at+2]+armWeight*(Math.sin(time*7.2+side*Math.PI/2)*.055*movement+work*(.035+Math.sin(time*6+side)*.016));
    }
    positions.needsUpdate=true;
    // Tiny connected deformations preserve the calm, solid candy read.
    candy.emissive?.setHex(0x000000);
    if (selection && materialMode !== 'silhouette') {
      candy.emissive.copy(tint);
      candy.emissiveIntensity=selection*.045;
    }
  };
  root.userData.kind = 'candy-sower';
  root.userData.variant = chosen;
  root.userData.materialMode = materialMode;
  root.userData.body = body;
  root.userData.face = face;
  root.userData.neutralHeight = HEIGHT;
  root.userData.contour = spec;
  root.userData.features = features;
  root.userData.getStatus = () => currentStatus;
  root.userData.resetPose = () => {
    positions.array.set(rest); positions.needsUpdate=true;
    pose.position.set(0,0,0); pose.rotation.set(0,0,0);face.rotation.set(0,0,0);
    candy.emissive?.setHex(0x000000);candy.emissiveIntensity=0;
    movement=0;selection=0;currentStatus='idle';
  };
  return root;
}
