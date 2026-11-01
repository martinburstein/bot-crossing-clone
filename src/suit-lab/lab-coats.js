import * as THREE from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {decorateSkinned} from '../agents/crew.js'
import {UNIFORM,COAT_BY_ID} from './uniforms.js'

// Coat sleeves use the original bot's skin weights. The split coat tails and
// pockets are authored in that same bind pose, then share its animation texture.
// This is local wardrobe geometry; the canonical bot renderer stays unchanged.
export function makeLabCoatGeometry(rig,style){
 const pieces=[],chest=rig.boneIndex.get('chest'),hips=rig.boneIndex.get('hips')
 const white=new THREE.Color(UNIFORM.coat),trim=new THREE.Color(UNIFORM.trim),brass=new THREE.Color(UNIFORM.brass),seam=new THREE.Color(UNIFORM.seam)
 function skin(geometry,bone,color){
  const g=geometry.index?geometry.toNonIndexed():geometry
  const n=g.attributes.position.count,indices=new Float32Array(n*4),weights=new Float32Array(n*4),colors=new Float32Array(n*3)
  for(let i=0;i<n;i++){indices[i*4]=bone;weights[i*4]=1;colors.set([color.r,color.g,color.b],i*3)}
  g.setAttribute('skinIndex',new THREE.Float32BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.deleteAttribute('uv');pieces.push(g);return g
 }
 function box(w,h,d,x,y,z,color=white,bone=chest,rz=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateZ(rz);g.translate(x,y,z);skin(g,bone,color)}
 function panel(points,color,bone=chest){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.computeVertexNormals();skin(g,bone,color)}
 const source=rig.geometry.index?rig.geometry.toNonIndexed():rig.geometry.clone()
 const p=source.attributes.position,n=source.attributes.normal,si=source.attributes.skinIndex,sw=source.attributes.skinWeight
 const attrs={position:[],normal:[],skinIndex:[],skinWeight:[],color:[]}
 for(let i=0;i<p.count;i+=3){
  const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3
  const upper=y>.78&&y<1.255&&(Math.abs(x)<.34||Math.abs(x)<.79&&y>.96)
  const opening=z>.11&&Math.abs(x)<Math.max(.025,(y-.87)*.42)&&y>.88
  if(!upper||opening)continue
  for(let j=i;j<i+3;j++){
   attrs.position.push(p.getX(j)+n.getX(j)*.018,p.getY(j)+n.getY(j)*.018,p.getZ(j)+n.getZ(j)*.018)
   attrs.normal.push(n.getX(j),n.getY(j),n.getZ(j))
   for(let k=0;k<4;k++){attrs.skinIndex.push(si.getComponent(j,k));attrs.skinWeight.push(sw.getComponent(j,k))}
   const cuff=Math.abs(p.getX(j))>.71-style.cuff*.5
   const c=cuff?seam:white;attrs.color.push(c.r,c.g,c.b)
  }
 }
 const upper=new THREE.BufferGeometry();for(const [key,array]of Object.entries(attrs))upper.setAttribute(key,new THREE.Float32BufferAttribute(array,key.startsWith('skin')?4:3));pieces.push(upper);source.dispose()
 // Split, slightly flared tails. A varying hem and front opening distinguish
 // long laboratory coats, shorter engineering coats and the reviewer's wrap.
 const vertices=[],segments=20,rows=[.86,.69,style.hem]
 const point=(row,i)=>{const angle=.24+(Math.PI*2-.48)*i/segments,y=rows[row],flare=(.86-y)*.20;return [Math.sin(angle)*(.285+flare),y,Math.cos(angle)*(.18+flare*.6)]}
 for(let row=0;row<2;row++)for(let i=0;i<segments;i++){const a=point(row,i),b=point(row,i+1),c=point(row+1,i),d=point(row+1,i+1);vertices.push(...a,...c,...b,...b,...c,...d)}
 const tails=new THREE.BufferGeometry();tails.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));tails.computeVertexNormals();skin(tails,hips,white)
 // Actual collars and lapels sit above the original torso rather than a boxy
 // replacement body. The visor and original head remain completely untouched.
 if(style.collar==='stand'){
  const collar=new THREE.CylinderGeometry(.16,.19,.10,14,1,true);collar.translate(0,1.24,0);skin(collar,chest,white)
  box(.045,.10,.025,0,1.23,.174,brass)
 }else{
  const wide=style.collar==='shawl'?.13:.10
  for(const sign of [-1,1])panel([[sign*.08,1.25,.17],[sign*(.15+wide),1.17,.17],[sign*.09,1.04,.205],[sign*.08,1.25,.17],[sign*.09,1.04,.205],[sign*.025,1.16,.19]],white)
 }
 if(style.collar==='double')for(const x of [-.10,.10])for(const y of [.91,1.02,1.13])box(.018,.018,.025,x,y,.198,brass)
 else for(const y of [.87,.98,1.09])box(.016,.016,.023,.025,y,.205,brass)
 // Every department head wears the same three brass rank bars and ID plaque.
 box(.105,.085,.018,-.18,1.125,.17,trim)
 for(let i=0;i<3;i++)box(.073,.009,.022,-.18,1.10+i*.024,.184,brass)
 // Pocket layouts carry profession at miniature scale, with actual depth.
 const pocket=(x,y,w=.14,h=.13,bone=chest)=>{box(w,h,.035,x,y,.204,white,bone);box(w,.015,.041,x,y+h/2,.208,trim,bone)}
 switch(style.pockets){
  case 'single':pocket(.18,.98);break
  case 'double':pocket(-.19,.92);pocket(.19,.92);break
  case 'sealed':for(const x of [-.19,.19]){pocket(x,.88,.16,.14);box(.17,.045,.052,x,.955,.214,seam)}break
  case 'cartridge':for(const x of [-.19,.19]){pocket(x,.91,.16,.17);for(let j=0;j<2;j++)box(.035,.13,.035,x-.035+j*.07,.95,.23,brass)}break
  case 'insulated':for(const x of [-.19,.19]){pocket(x,.90,.18,.18);for(let j=0;j<3;j++)box(.15,.009,.039,x,.85+j*.05,.23,seam)}break
  case 'shield':pocket(.17,.96,.18,.20);box(.10,.09,.025,.17,1,.234,brass);break
  case 'swatch':pocket(-.18,.90,.18,.19);for(let j=0;j<3;j++)box(.045,.14,.04,.13+j*.05,.98-j*.025,.215,j%2?seam:trim);break
  case 'angled':for(const x of [-.18,.18])box(.17,.04,.04,x,.90,.21,trim,chest,x>0?.25:-.25);break
  case 'instrument':for(const x of [-.19,.19]){pocket(x,.94,.17,.14);for(let j=0;j<3;j++)box(.018,.17,.025,x-.05+j*.05,1.02,.235,j%2?brass:trim)}break
  case 'utility':for(const x of [-.19,0,.19])pocket(x,.83,.15,.16);box(.60,.06,.03,0,.89,.20,trim);break
  case 'cargo':for(const x of [-.21,.21]){pocket(x,.68,.20,.18,hips);box(.20,.04,.05,x,.79,.22,seam,hips)}break
  case 'document':pocket(-.16,.94,.21,.22);pocket(.19,.84,.15,.12);break
 }
 // Role-specific shoulder/back detailing remains in the shared uniform palette.
 const detail=style.index
 if([0,4].includes(detail))for(let i=0;i<(detail===0?3:5);i++)box(.018,.20,.025,-.09+i*.045,1.02,-.185,brass)
 if(detail===1)for(const x of [-.20,.20]){const g=new THREE.TorusGeometry(.044,.012,5,12);g.translate(x,.99,.23);skin(g,chest,brass)}
 if(detail===3)for(let y=.55;y<.82;y+=.07)box(.54,.012,.025,0,y,-.23,seam,hips)
 if(detail===5)box(.18,.18,.04,0,1.05,-.20,brass)
 if(detail===6)for(let i=0;i<5;i++)box(.012,.08,.02,-.15+i*.075,style.hem+.05,-.22,trim,hips)
 if(detail===7)for(const x of [-.28,.28])box(.045,.18,.18,x,.70,0,seam,hips)
 if(detail===8)box(.19,.055,.03,.17,1.13,.19,brass)
 if(detail===9)box(.49,.28,.025,0,.70,.215,seam,hips)
 if(detail===10)for(let i=0;i<3;i++)box(.065,.035,.025,-.10+i*.10,1.12,-.20,brass)
 if(detail===11)box(.54,.06,.025,0,.85,.204,white)
 if(detail===12)for(const x of [-.17,.17])box(.035,.18,.05,x,.82,.245,brass)
 if(detail===13)for(const x of [-.22,.22])box(.15,.06,.035,x,1.02,-.18,trim)
 if(detail===14)box(.31,.065,.03,0,1.10,-.19,brass)
 const geometry=mergeGeometries(pieces);for(const g of pieces)g.dispose();return geometry
}

export function createLabCoats(bots,profiles){
 const uniforms=bots.crewUniforms
 const material=decorateSkinned(new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.86,metalness:0,side:THREE.DoubleSide}),uniforms)
 const depth=decorateSkinned(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide}),uniforms,{normals:false})
 const coats=profiles.map(p=>{
  const g=makeLabCoatGeometry(bots.rig,COAT_BY_ID[p.id]);g.setAttribute('aFrame',new THREE.InstancedBufferAttribute(new Float32Array(1),1))
  const mesh=new THREE.InstancedMesh(g,material,1);mesh.name=`department-coat-${p.id}`;mesh.customDepthMaterial=depth;mesh.castShadow=true;mesh.frustumCulled=false;bots.group.add(mesh);return mesh
 })
 const matrix=new THREE.Matrix4(),helmet=new THREE.Color(UNIFORM.helmet)
 return {update(){for(let i=0;i<coats.length;i++){const a=bots.agents[i],m=coats[i];bots.crew.getMatrixAt(a.index,matrix);m.setMatrixAt(0,matrix);m.instanceMatrix.needsUpdate=true;m.geometry.attributes.aFrame.setX(0,a.frame);m.geometry.attributes.aFrame.needsUpdate=true;bots.parts.helmet.setColorAt(a.index,helmet)}bots.parts.helmet.instanceColor.needsUpdate=true}}
}
