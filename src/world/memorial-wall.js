import * as THREE from 'three';
import {PAINT_COLORS,drawMemorial} from '../office/memorial.js';
import {FRONTERA as L,FRONTERA_SEGMENTS,FRONTERA_LENGTH,choosePlacement,memorialPoint,fronteraObstacles,fronteraClearings} from './frontera-layout.js';
import {MemorialCeremony,CEREMONY_SECONDS,MEMORIAL_CLEARANCE} from '../office/memorial-ceremony.js';
import {sharpLabelTexture} from './label-texture.js';

export function createMemorialWall(parent) {
  const group=new THREE.Group();group.name=L.id;parent.add(group);
  const geometries=new Set(),materials=new Set(),textures=new Set(),marks=new THREE.Group();group.add(marks);
  const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.92,...extra});materials.add(m);return m;};
  const concrete=material(0xd0c5aa,{emissive:0x655d42,emissiveIntensity:.16}),edge=material(0x8c8576),wood=material(0x78583d),dark=material(0x252a2d),metal=material(0xb7bfc4,{metalness:.65,roughness:.3});
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#e4ddca';ctx.fillRect(0,0,512,512);
    let seed=731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<13000;i++){ctx.fillStyle=`rgba(100,88,67,${.025+random()*.08})`;ctx.fillRect(random()*512,random()*512,.5+random()*2,.5+random()*2);}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);concrete.map=texture;
  }
  function mesh(geo,m,x,y,z,name='',p=group){geometries.add(geo);const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.name=name;o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
  const box=(x,y,z,w,h,d,m,name,p)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,name,p);
  for(const s of FRONTERA_SEGMENTS){
    const section=new THREE.Group();section.name=`frontera-${s.id}`;section.position.set((s.ax+s.bx)/2,0,(s.az+s.bz)/2);section.rotation.y=Math.atan2(s.nx,s.nz);group.add(section);
    box(0,.18,0,s.length+.15,.36,1.35,edge,'wall-footing',section);
    box(0,L.base+L.height/2,0,s.length+.06,L.height,L.depth,concrete,'memorial-surface',section);
    box(0,L.base+L.height+.12,0,s.length+.13,.24,1.02,edge,'wall-coping',section);
  }
  function label(title,detail,w,h,x,y,z,rotation=0){
    if(typeof document==='undefined')return;
    const {texture,draw}=sharpLabelTexture(w,h,{background:'#485549',color:'#f8efd6',family:'Georgia'});draw(title,detail);textures.add(texture);
    const m=new THREE.MeshBasicMaterial({map:texture});materials.add(m);const o=mesh(new THREE.PlaneGeometry(w,h),m,x,y,z,'frontera-name');o.rotation.y=rotation;return o;
  }
  // Welcome plaque stands low, below the usable painting surface.
  label(L.name,'A PLACE FOR EVERY ITERATION',15,1.45,-34,1.3,44.9,Math.PI);
  const crate=new THREE.Group();crate.name='memorial-paint-box';crate.position.set(L.crate.x,.1,L.crate.z);crate.rotation.y=Math.PI/2;group.add(crate);
  box(0,.12,0,5.2,.24,2.15,wood,'paint-box-bottom',crate);
  for(const z of [-1.05,1.05])for(const y of [.25,.48])box(0,y,z,5.4,.15,.09,wood,'paint-box-slat',crate);
  for(const x of [-2.65,2.65])box(x,.34,0,.12,.65,2.2,wood,'paint-box-end',crate);
  const canGeo=new THREE.CylinderGeometry(.105,.12,.55,14),capGeo=new THREE.CylinderGeometry(.10,.10,.065,14),nozzleGeo=new THREE.CylinderGeometry(.035,.035,.055,8);
  const cans=[];
  function makeCan(color,parent,name){const can=new THREE.Group();can.name=name;parent.add(can);mesh(canGeo,material(color,{roughness:.38}),0,0,0,'spray-can-body',can);mesh(capGeo,metal,0,.30,0,'spray-can-shoulder',can);mesh(nozzleGeo,dark,0,.36,0,'spray-nozzle',can);box(0,0,.12,.13,.20,.008,metal,'can-label',can);return can;}
  PAINT_COLORS.forEach((color,i)=>{const can=makeCan(color,crate,`spray-can-${color.slice(1)}`);can.position.set(-2.21+(i%14)*.34,.70,i<14?-.55:.55);can.userData.paintColor=color;cans.push(can);});
  const prop=makeCan('#ffffff',group,'held-memorial-spray-can');prop.visible=false;
  const propPaint=prop.getObjectByName('spray-can-body').material;
  const mistGeo=new THREE.BufferGeometry(),mistPositions=new Float32Array(64*3);mistGeo.setAttribute('position',new THREE.BufferAttribute(mistPositions,3));geometries.add(mistGeo);
  const mistMat=new THREE.PointsMaterial({color:0xffffff,size:.065,transparent:true,opacity:.55,depthWrite:false});materials.add(mistMat);
  const mist=new THREE.Points(mistGeo,mistMat);mist.name='spray-paint-mist';mist.frustumCulled=false;mist.visible=false;group.add(mist);
  const ray=new THREE.Raycaster(),ceremony=new MemorialCeremony(),handOffset=new THREE.Matrix4().makeTranslation(.05,-.19,.16).multiply(new THREE.Matrix4().makeRotationZ(Math.PI));
  const propMatrix=new THREE.Matrix4(),handPoint=new THREE.Vector3(),cratePoint=new THREE.Vector3(),nozzlePoint=new THREE.Vector3(),direction=new THREE.Vector3(),side=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),particle=new THREE.Vector3();
  let entries=[],preview=null,previewMesh=null,agents=[],elapsed=0,initialized=false,pending=[];
  const markMeshes=new Map();
  function clearMarks(){for(const o of [...marks.children]){o.material.map?.dispose();o.material.dispose();o.geometry.dispose();marks.remove(o);}markMeshes.clear();previewMesh=null;}
  function addMark(entry){
    if(typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;drawMemorial(canvas.getContext('2d'),entry,128);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    const m=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});
    const o=new THREE.Mesh(new THREE.PlaneGeometry(L.soulUnit,L.soulUnit),m),p=memorialPoint(entry.placement);o.position.set(p.x,p.y,p.z);o.rotation.y=p.angle;o.name=`soul-unit-${entry.iteration??'test'}`;o.userData.entry=entry;marks.add(o);return o;
  }
  function rebuild(){
    clearMarks();for(const e of entries)markMeshes.set(e.iteration,addMark(e));
    if(preview)previewMesh=addMark(preview);
    const j=ceremony.job;if(j){const m=j.entry.preview?previewMesh:markMeshes.get(j.entry.iteration);if(m)m.material.opacity=j.progress;}
    for(const e of pending){const m=markMeshes.get(e.iteration);if(m)m.material.opacity=0;}
  }
  function begin(entry,agentId){
    const agent=agents.find(a=>a.id===agentId)??agents.filter(a=>!a.thread.running&&!['leaving','gone','spawning'].includes(a.state)).sort((a,b)=>Math.hypot(a.pos.x-L.crate.x,a.pos.z-L.crate.z)-Math.hypot(b.pos.x-L.crate.x,b.pos.z-L.crate.z))[0];
    if(!agent||agent.thread.running||['leaving','gone','spawning'].includes(agent.state))throw Error('No idle resident available to paint');
    ceremony.start(entry,agent.id,elapsed,PAINT_COLORS.indexOf(entry.color));return ceremony.snapshot();
  }
  function update(value){
    const ids=new Set(entries.map(e=>e.iteration));entries=value.map(e=>({...e}));const occupied=[];
    for(const e of entries){e.placement=choosePlacement(e.iteration,occupied,e.placement);occupied.push(e.placement);}
    if(initialized)pending.push(...entries.filter(e=>!ids.has(e.iteration)));initialized=true;rebuild();
  }
  function setPreview(value,agentId){
    if(!value){if(ceremony.job?.entry.preview)ceremony.stop('cancelled',elapsed);if(ceremony.last?.entry.preview)ceremony.last=null;preview=null;rebuild();return;}
    if(ceremony.job)throw Error('Finish or stop the current painting first');
    const p=choosePlacement(entries.length?entries[entries.length-1].iteration+1:1,entries.map(e=>e.placement));
    const draft={...value,preview:true,placement:p};begin(draft,agentId);preview=draft;rebuild();return ceremony.snapshot();
  }
  function target(thread){const j=ceremony.job;if(!j)return null;const a=agents.find(a=>a.id===j.agentId);if(a?.thread!==thread&&a?.thread.id!==thread.id)return null;const t=ceremony.target();return {...t,position:new THREE.Vector3(t.position.x,0,t.position.z),look:new THREE.Vector3(t.look.x,0,t.look.z)};}
  function animate(now,residents=[]){
    elapsed=now;agents=residents;
    if(!ceremony.job&&pending.length){try{begin(pending[0]);pending.shift();}catch{/* Wait for an idle resident; never hijack a real running assignment. */}}
    const before=ceremony.job,agent=before&&agents.find(a=>a.id===before.agentId);
    if(before)ceremony.update(now,agent);
    const j=ceremony.job;
    for(const a of agents)a.memorialPose=j&&a.id===j.agentId?{stage:j.stage,time:j.elapsed,holding:j.holding}:null;
    cans.forEach(c=>{c.visible=true;});prop.visible=mist.visible=false;
    if(j){
      const mark=j.entry.preview?previewMesh:markMeshes.get(j.entry.iteration);if(mark)mark.material.opacity=j.progress;
      const attachment=agent?.memorialHandMatrix;
      if(attachment&&(j.holding||j.stage==='pickup'||j.stage==='putback')){
        propMatrix.copy(attachment).multiply(handOffset);propMatrix.decompose(prop.position,prop.quaternion,prop.scale);prop.scale.setScalar(1);handPoint.copy(prop.position);cratePoint.copy(cans[j.canIndex]?.getWorldPosition(new THREE.Vector3())??new THREE.Vector3());
        let blend=1;
        if(j.stage==='pickup')blend=THREE.MathUtils.smoothstep(j.elapsed/CEREMONY_SECONDS.pickup,.40,.68);
        if(j.stage==='putback')blend=1-THREE.MathUtils.smoothstep(j.elapsed/CEREMONY_SECONDS.putback,.40,.68);
        if(blend>0){prop.position.lerpVectors(cratePoint,handPoint,blend);prop.visible=true;cans[j.canIndex].visible=false;}
        propPaint.color.set(j.entry.color);mistMat.color.set(j.entry.color);
        if(j.stage==='spray'){
          mist.visible=true;prop.updateMatrix();nozzlePoint.set(0,.40,0).applyMatrix4(prop.matrix);const aim=memorialPoint(j.entry.placement,0);direction.set(aim.x-nozzlePoint.x,aim.y-nozzlePoint.y,aim.z-nozzlePoint.z).normalize();side.crossVectors(direction,up).normalize();
          const travelLimit=MEMORIAL_CLEARANCE.wallStandOff+.25;
          for(let i=0;i<64;i++){const travel=((now*1.6+i*.137)%1)*travelLimit,spread=travel*.075,phase=i*2.39996;particle.copy(nozzlePoint).addScaledVector(direction,travel).addScaledVector(side,Math.sin(phase)*spread).addScaledVector(up,Math.cos(phase)*spread);particle.toArray(mistPositions,i*3);}
          mistGeo.attributes.position.needsUpdate=true;
        }
      }
    }else if(before){
      const mark=before.entry.preview?previewMesh:markMeshes.get(before.entry.iteration);if(mark)mark.material.opacity=before.entry.preview?(before.revealed?1:0):1;
    }
  }
  return {group,crate,ceremony,update,preview:setPreview,target,animate,
    stop(){ceremony.stop('cancelled',elapsed);rebuild();},
    setPage(){}, // Ledger pagination never removes physical marks from the border.
    pick(camera,x,y){ray.setFromCamera(new THREE.Vector2(x,y),camera);group.updateMatrixWorld(true);const hit=ray.intersectObjects(marks.children).find(h=>h.object.material.opacity>.1);if(hit)return {entry:hit.object.userData.entry};if(ray.intersectObject(crate,true).length)return {paint:true};return null;},
    point:entry=>memorialPoint(entry.placement),
    obstacles:()=>[...fronteraObstacles(),{x:L.crate.x,z:L.crate.z,width:2.2,depth:5.4,angle:0,worksite:'paint-box',office:true}],
    clearings:fronteraClearings,
    snapshot:()=>({name:L.name,height:L.height,length:FRONTERA_LENGTH,soulUnit:L.soulUnit,sections:FRONTERA_SEGMENTS.length,cans:28,colors:[...PAINT_COLORS],entries:entries.length,preview:preview?{symbol:preview.symbol,placement:preview.placement}:null,ceremony:ceremony.snapshot()}),
    dispose(){ceremony.stop('cancelled',elapsed);for(const a of agents)a.memorialPose=null;clearMarks();group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},
  };
}
