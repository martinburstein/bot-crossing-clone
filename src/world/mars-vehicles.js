import * as THREE from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'

// Human craft from all eight 2007 launch sets; side builds have descriptive names.
export const VEHICLES = Object.freeze([
  {id:'eagle',name:'Eagle command shuttle',set:7690,kind:'air',role:'Survey',cue:'Long amber canopy, swept white wings, twin orange engines'},
  {id:'defender',name:'Mothership-assault defence sled',set:7691,kind:'ground',role:'Support',cue:'Twin runners, open control seats, four orange launch tubes'},
  {id:'dropship',name:'MX-71 Recon Dropship',set:7692,kind:'air',role:'Transport',cue:'Sloping front wings, long spine, three rear engines and amber cargo pods'},
  {id:'cargo-rover',name:'Recon drilling rover',set:7692,kind:'ground',role:'Mining',cue:'Six orange wheels, curved amber cab, rear drill and roll bar'},
  {id:'mining-truck',name:'Alien Strike mining truck',set:7693,kind:'ground',role:'Mining',cue:'Four orange wheels, curved amber cab, articulated vertical drill'},
  {id:'trike',name:'MT-31 Trike',set:7694,kind:'ground',role:'Scout',cue:'Two huge front wheels, single trailing wheel, narrow white fuselage'},
  {id:'astro-fighter',name:'MX-11 Astro Fighter',set:7695,kind:'air',role:'Scout',cue:'Small swept wings, bubble canopy, single over-cockpit instrument'},
  {id:'claw-tank',name:'MT-51 Claw-Tank',set:7697,kind:'ground',role:'Handling',cue:'Twin orange front tracks, rear wheels, raised cab and reaching claw'},
  {id:'drill-unit',name:'MT-101 Armored Drilling Unit',set:7699,kind:'ground',role:'Excavation',cue:'Six oversized wheels, sloped armoured cab, raised drilling boom'},
  {id:'drill-flyer',name:'MT-101 transport scout',set:7699,kind:'air',role:'Survey',cue:'Detachable wedge flyer, twin amber cargo pods and tall split tail'},
  {id:'drill-pod',name:'MT-101 scout bike',set:7699,kind:'ground',role:'Inspection',cue:'Two inline orange wheels beneath a compact amber roll cage'},
])
export const VEHICLE_BY_ID = new Map(VEHICLES.map(v=>[v.id,v]))
export function chooseVehicle(workerId,preferred) {
  return VEHICLE_BY_ID.has(preferred)?preferred:VEHICLES[(Number(workerId.slice(1))-1)%VEHICLES.length].id
}

const colors={hull:0xf2eee5,orange:0xe98b31,dark:0x343f48,metal:0x89969b,glass:0xffae37,blue:0x92d7e3}
function material(key) {
  return new THREE.MeshStandardMaterial({color:colors[key],roughness:key==='glass'?.2:.55,metalness:key==='metal'?.3:.04,
    ...(key==='glass'?{transparent:true,opacity:.58,depthWrite:false}:{}),
    ...(key==='blue'?{emissive:colors.blue,emissiveIntensity:.5}: {})})
}

// Original procedural models: softened blocks, low-poly wheels and painted surfaces
// follow the colony's toy scale. No LEGO meshes or textures are embedded in the game.
export function createVehicle(id,{merge=true}={}) {
  const spec=VEHICLE_BY_ID.get(id)
  if(!spec) throw Error(`Unknown Mars vehicle: ${id}`)
  const root=new THREE.Group();root.name=`mars-${id}`
  const body=new THREE.Group();root.add(body)
  const mats=Object.fromEntries(Object.keys(colors).map(k=>[k,material(k)]))
  const wheels=[],rotors=[],arms=[],thrusters=[],parts=[],canopies=[],tracks=[]
  function mesh(geo,key,x=0,y=0,z=0,parent=body) {
    const m=new THREE.Mesh(geo,mats[key]);m.name=`${key}-${parts.length}`;m.position.set(x,y,z);m.castShadow=key!=='glass';m.receiveShadow=true;parent.add(m);parts.push(m);return m
  }
  function box(x,y,z,w,h,d,key='hull',parent=body,r=.07) {
    const m=mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/4,h/4,d/4)),key,x,y,z,parent)
    m.userData.block={w,h,d,key,r};return m
  }
  function cyl(x,y,z,r,l,key='metal',parent=body,axis='y') {
    const m=mesh(new THREE.CylinderGeometry(r,r,l,12),key,x,y,z,parent)
    if(axis==='x')m.rotation.z=Math.PI/2
    if(axis==='z')m.rotation.x=Math.PI/2
    return m
  }
  function wheel(x,z,r=.52,y=r) {
    const g=new THREE.Group();g.position.set(x,y,z);body.add(g);wheels.push(g)
    g.name='wheel';
    if(x){cyl((x+Math.sign(x)*.36)/2,y,z,.085,Math.abs(x)-.36,'metal',body,'x').userData.jointTo=g;box(Math.sign(x)*.36,y+.2,z,.16,.46,.18,'dark')}
    cyl(0,0,0,r,.42,'orange',g,'x');cyl(Math.sign(x)*.23,0,0,r*.64,.045,'dark',g,'x');cyl(Math.sign(x)*.26,0,0,r*.39,.07,'metal',g,'x')
    for(let k=0;k<12;k++) {const a=k*Math.PI/6;const t=box(0,Math.sin(a)*r,Math.cos(a)*r,.46,.1,.2,'orange',g,.025);t.rotation.x=-a}
    for(let k=0;k<5;k++){const a=k*Math.PI*2/5;const s=box(Math.sign(x)*.3,Math.sin(a)*r*.38,Math.cos(a)*r*.38,.025,r*.55,.06,'hull',g,.01);s.rotation.x=-a}
  }
  function engine(x,y,z,r=.26) {
    cyl(x,y,z,r,.64,'hull',body,'z');cyl(x,y,z-.35,r*.82,.12,'dark',body,'z')
    const light=cyl(x,y,z-.43,r*.56,.07,'blue',body,'z');thrusters.push(light)
    box(x,y+r+.04,z,.18,.1,.3,'orange')
  }
  function wing(side,y,z,span=1.8,length=1.4) {
    const shape=new THREE.Shape();shape.moveTo(.35,0);shape.lineTo(span,-length*.5);shape.lineTo(span,-length);shape.lineTo(.35,-length*.72);shape.closePath()
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.055,bevelThickness:.035})
    geo.rotateX(-Math.PI/2);if(side<0)geo.scale(-1,1,1)
    const m=mesh(geo,'hull',0,y,z)
    m.material.side=THREE.DoubleSide
    box(side*(span-.28),y+.14,z+length*.73,.35,.1,.48,'orange')
  }
  function cockpit(y=1,z=.5,w=.9,l=1.25) {
    w=Math.max(w,.85);l=Math.max(l,1.15)
    box(0,y-.18,z,w+.18,.3,l+.18,'dark')
    const g=mesh(new THREE.SphereGeometry(1,14,8,0,Math.PI*2,0,Math.PI/2),'glass',0,y,z)
    canopies.push(g)
    g.scale.set(w*.7,.88,l*.74)
    for(const x of [-w*.52,w*.52])box(x,y+.02,z,.09,.13,l,'hull')
    box(0,y+.12,z+l*.42,w*.65,.1,.12,'metal')
    box(0,y+.02,z+l*.42,w*.5,.2,.1,'dark')
    return new THREE.Vector3(0,y-.5,z-.15)
  }
  function pod(x,y,z,l=1.15) {
    cyl(x,y,z,.27,l,'glass',body,'z');cyl(x,y,z-l/2,.29,.13,'orange',body,'z');cyl(x,y,z+l/2,.29,.13,'orange',body,'z')
    box(x,y+.26,z,.12,.13,l*.8,'hull')
  }
  function drill(x,y,z,length=.95,parent=body,vertical=false) {
    const g=new THREE.Group();g.position.set(x,y,z);if(vertical)g.rotation.x=Math.PI/2;parent.add(g);rotors.push(g)
    const cone=mesh(new THREE.ConeGeometry(.24,length,10),'metal',0,0,length/2,g);cone.rotation.x=Math.PI/2
    for(let i=0;i<5;i++){const ring=mesh(new THREE.TorusGeometry(.23*(1-i/6),.035,4,10),'dark',0,0,i*length/5,g);ring.rotation.z=i*.6}
  }
  function track(x,z) {
    const belt=new THREE.Group();body.add(belt)
    const links=[],rollers=[],r=.38,half=.55,cy=.48,length=4*half+2*Math.PI*r
    box(x,cy,z,.64,.66,half*2,'dark').userData.jointTo=belt
    for(const dz of [-half,half]){
      cyl(x,cy,z+dz,.33,.64,'dark',body,'x').userData.jointTo=belt
      const roller=cyl(x+Math.sign(x)*.335,cy,z+dz,.27,.035,'metal',body,'x');roller.userData.jointTo=belt;rollers.push(roller)
    }
    cyl(x/2,cy,z,.09,Math.abs(x),'metal',body,'x');box(Math.sign(x)*.4,.65,z,.17,.35,.25,'dark')
    for(let i=0;i<24;i++){const link=box(0,0,0,.72,.1,.15,'orange',belt,.015);link.userData.moving=true;links.push(link)}
    const entry={belt,links,rollers,instance:null,update(time){
      for(let i=0;i<links.length;i++){
        let s=(i*length/links.length+time*.8)%length,y,zz,angle
        if(s<2*half){zz=-half+s;y=r;angle=0}
        else if((s-=2*half)<Math.PI*r){const a=s/r;zz=half+r*Math.sin(a);y=r*Math.cos(a);angle=a}
        else if((s-=Math.PI*r)<2*half){zz=half-s;y=-r;angle=Math.PI}
        else {s-=2*half;const a=s/r;zz=-half-r*Math.sin(a);y=-r*Math.cos(a);angle=Math.PI+a}
        const link=links[i];link.position.set(x,cy+y,z+zz);link.rotation.x=angle;link.updateMatrix();entry.instance?.setMatrixAt(i,link.matrix)
      }
      if(entry.instance)entry.instance.instanceMatrix.needsUpdate=true
      for(const roller of rollers)roller.rotation.x=-time*.8/.27
    }}
    tracks.push(entry);entry.update(0)
  }
  let seat
  if(['eagle','astro-fighter','drill-flyer','dropship'].includes(id)) {
    const large=id==='dropship',eagle=id==='eagle',scout=id==='drill-flyer'
    box(0,.65,0,large?1:scout?1.1:.88,.43,large?4.2:eagle?4.3:2.15)
    box(0,.67,large?2.3:eagle?2.15:1.3,.7,.18,.65).name='rounded-nose-fairing'
    seat=cockpit(.87,large?1.45:eagle?1.3:.64,large?1.15:scout?.95:.85,large?1.8:eagle?1.85:1.35)
    for(const side of [-1,1]) {
      if(large) {
        const front=box(side*1.1,.62,1.1,1.25,.15,1.25);front.rotation.z=-side*.42
        cyl(side*.75,.8,1.5,.28,.08,'hull',body,'x');cyl(side*.75,.8,1.8,.08,.75,'blue',body,'z')
        box(side*1.1,.69,-1.65,2.2,.16,.48);engine(side*1.95,.75,-1.6,.38)
        pod(side*1.2,.64,-.35,1.25);box(side*.83,.64,-.35,.85,.18,.4,'dark')
        for(const z of [.8,1.25]){cyl(side*.82,.22,z,.09,.7,'metal');cyl(side*.82,.05,z,.22,.08,'dark')}
        const fin=box(side*1.95,1.24,-1.72,.1,.65,.62);fin.rotation.x=-.25
      } else if(scout) {
        pod(side*.92,.8,-.45,1.15);box(side*.55,.79,-.3,.12,.3,1.65)
        const fin=box(side*.55,1.35,-.85,.1,1.1,.6,'dark');fin.rotation.z=-side*.1
        engine(side*.3,.57,-1.08,.2)
      } else {
        wing(side,.65,eagle?-1.1:-.55,eagle?2:1.6,eagle?1.7:1.1)
        engine(side*(eagle?.62:1.25),.7,eagle?-1.75:-.88,eagle?.32:.25)
        if(eagle){pod(side*.65,.97,-.9,1.25);const fin=box(side*1.62,1.16,-.08,.1,.72,.6);fin.rotation.x=-.25}
        else box(side*.83,.65,-.88,1,.16,.23,'dark')
      }
    }
    if(large)engine(0,.83,-1.73,.35)
    if(id==='astro-fighter') {box(0,1.12,-.86,.2,.5,.18,'metal');box(0,1.44,-.73,.26,.18,.46,'dark');cyl(0,1.44,-.42,.1,.18,'blue',body,'z')}
    // Flight craft rest on attached landing skids when parked, never on an engine lip.
    for(const x of [-.38,.38])for(const z of [-.7,.7])cyl(x,.29,z,.07,.5,'metal')
    for(const x of [-.38,.38])box(x,.04,0,.15,.08,1.8,'dark')
  } else if(id==='drill-pod') {
    box(0,.42,0,.62,.24,.72,'dark');wheel(0,1.3,.36);wheel(0,-1.3,.36)
    seat=cockpit(.65,0,.72,.9)
    for(const [i,z] of [1.3,-1.3].entries())cyl(0,.36,z,.075,.88,'metal',body,'x').userData.jointTo=wheels[i]
    for(const x of [-.44,.44]){box(x,.42,0,.1,.15,2.7,'dark');box(x,.99,-.62,.1,1.2,.12,'orange');box(x,1.54,-.08,.1,.1,1.2,'orange')}
    box(0,1.54,.39,.98,.1,.12,'orange')
  } else if(id==='trike') {
    box(0,.85,0,.72,.4,1.7);seat=cockpit(1.05,.5,.8,1.1)
    wheel(-1.05,.58,.76);wheel(1.05,.58,.76);wheel(0,-1.65,.58)
    cyl(0,.58,-1.65,.09,.85,'metal',body,'x').userData.jointTo=wheels[2];for(const x of [-.38,.38])box(x,.64,-1.15,.12,.16,1.1,'dark')
    pod(0,1.02,-.57,.4)
    for(const x of [-.55,.55])cyl(x,.8,1.18,.07,.5,'blue',body,'z')
  } else if(id==='claw-tank') {
    box(0,.8,0,1.6,.45,2.3);track(-1.25,.65);track(1.25,.65);box(0,.8,-1.25,.9,.3,.8,'dark');wheel(-1.2,-1.6,.65);wheel(1.2,-1.6,.65)
    cyl(0,1.03,0,.48,.2,'dark');seat=cockpit(1.65,.05,1.25,1.3)
    for(const x of [-1.15,1.15]){box(Math.sign(x)*.95,1,.15,.7,.1,1.4,'metal');pod(x,1.28,.15,1.2)}
    const arm=new THREE.Group();arm.position.set(-1.7,1.82,-.45);body.add(arm);arms.push(arm)
    box(-.5,0,.2,1.1,.23,.35,'hull',arm);box(-1,.02,.5,.24,.25,.75,'metal',arm)
    box(-1,.02,.75,.75,.2,.18,'metal',arm)
    for(const side of [-1,1]){const finger=box(-1+side*.25,.02,1.08,.13,.18,.8,'dark',arm);finger.rotation.y=-side*.32}
    box(-1.23,1.03,-.45,1.15,.12,.2,'metal');cyl(-1.7,1.47,-.45,.13,.78,'metal').userData.jointTo=arm
    cyl(1.2,1.78,-.25,.1,.6,'dark');box(1.25,1.75,.02,.45,.18,.4,'hull')
    for(const x of [1.15,1.4])cyl(x,1.75,.45,.08,.6,'blue',body,'z')
  } else if(id==='drill-unit') {
    box(0,1.12,0,1.7,.65,4.25);for(const x of [-1.3,1.3])for(const z of [-1.7,0,1.7])wheel(x,z,.7)
    for(const x of [-.6,.6]){const cab=box(x,1.5,.88,.25,.58,1.6);cab.rotation.x=.25}
    box(0,1.38,1.62,1.45,.24,.25);seat=cockpit(1.75,.94,1.05,1.65)
    box(0,1.64,-.83,1.6,.5,1.2);for(const x of [-.67,.67])box(x,2.12,-1.05,.12,.75,.68,'dark')
    const boom=new THREE.Group();boom.position.set(0,3.05,-.38);body.add(boom);arms.push(boom)
    box(0,2.28,-.38,.23,1.54,.28,'dark').userData.jointTo=boom;box(0,3.05,-.8,.5,.28,1.15,'dark').userData.jointTo=boom
    box(0,0,.64,.22,.22,1.5,'hull',boom);cyl(0,0,1.42,.23,.42,'dark',boom,'z');drill(0,0,1.65,1.1,boom)
    for(const x of [-.53,.53])cyl(x,1.2,1.66,.17,.16,'blue',body,'z')
  } else if(id==='defender') {
    box(0,.34,0,1.7,.25,1.7)
    for(const x of [-.9,.9]) {box(x,.15,0,.25,.2,2.3,'dark');const tip=box(x,.23,1.1,.26,.18,.55);tip.rotation.x=-.4}
    box(0,.76,-.4,.85,.64,.6,'hull');seat=new THREE.Vector3(0,.48,-.55)
    box(0,.83,.16,.75,.78,.24,'dark');box(0,1.52,.08,.85,.65,.18,'hull')
    for(const x of [-.29,.29])for(const y of [1.35,1.73]){cyl(x,y,.55,.18,1.15,'orange',body,'z');cyl(x,y,1.16,.12,.28,'blue',body,'z');cyl(x,y,1.32,.17,.1,'dark',body,'z')}
    box(0,.4,-1.15,.65,.13,1.0,'dark');cyl(0,.76,-1.3,.24,.6,'hull')
  } else {
    const mining=id==='mining-truck'
    box(0,.55,0,1.2,.3,mining?1.7:2.0);for(const x of [-.9,.9])for(const z of mining?[-.56,.56]:[-.86,0,.86])wheel(x,z,mining?.39:.31)
    seat=cockpit(.77,.44,mining?.86:.7,mining?1:.7)
    if(mining) {
      box(0,.83,-.64,1,.38,.48);const boom=new THREE.Group();boom.position.set(-1.65,1.55,-.45);body.add(boom);arms.push(boom)
      box(-1,1.08,-.55,1.5,.16,.3,'metal');cyl(-1.65,1.325,-.45,.12,.55,'dark').userData.jointTo=boom
      box(0,0,.6,.18,.18,1.6,'dark',boom);box(0,.1,.53,.23,.1,.92,'hull',boom);cyl(0,-.08,1.37,.17,.25,'dark',boom);drill(0,-.18,1.37,.95,boom,true)
    } else {
      for(const x of [-.5,.5])box(x,1.16,-.28,.08,1,.08,'dark');box(0,1.68,-.28,1.08,.08,.08,'dark')
      box(0,.82,-.46,.8,.3,.5,'orange');cyl(0,1.02,-.84,.18,.5,'dark',body,'z');const mount=new THREE.Group();mount.rotation.y=Math.PI;body.add(mount);drill(0,1.02,1.02,.85,mount)
    }
  }
  // Reserve a full-size seated astronaut's footwell through the solid hull blocks.
  // Each slab is closed geometry; the cockpit is a real recess, not a hidden pilot.
  // The widest vehicle is scaled to the rental bay, so reserve space in world units.
  body.updateMatrixWorld(true)
  const initialSize=new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3())
  const fitScale=Math.min(1,4.7/Math.max(initialSize.x,initialSize.z))
  const well=new THREE.Box3(new THREE.Vector3(-.32/fitScale,seat.y,seat.z-.39/fitScale),new THREE.Vector3(.32/fitScale,seat.y+1.22/fitScale,seat.z+.43/fitScale))
  for(const part of [...parts]){
    const b=part.userData.block
    if(!b||part.parent!==body||part.rotation.x||part.rotation.y||part.rotation.z)continue
    const min=part.position.clone().sub(new THREE.Vector3(b.w,b.h,b.d).multiplyScalar(.5)),max=part.position.clone().add(new THREE.Vector3(b.w,b.h,b.d).multiplyScalar(.5))
    if(!new THREE.Box3(min,max).intersectsBox(well))continue
    const remaining={min:min.clone(),max:max.clone()},slabs=[]
    for(const axis of ['x','z','y'])for(const side of ['min','max']){
      const edge=well[side][axis]
      if(side==='min'&&remaining.min[axis]<edge){const slab={min:remaining.min.clone(),max:remaining.max.clone()};slab.max[axis]=Math.min(edge,slab.max[axis]);slabs.push(slab);remaining.min[axis]=edge}
      if(side==='max'&&remaining.max[axis]>edge){const slab={min:remaining.min.clone(),max:remaining.max.clone()};slab.min[axis]=Math.max(edge,slab.min[axis]);slabs.push(slab);remaining.max[axis]=edge}
    }
    body.remove(part);parts.splice(parts.indexOf(part),1);part.geometry.dispose()
    for(const slab of slabs){const s=slab.max.clone().sub(slab.min),p=slab.min.clone().add(slab.max).multiplyScalar(.5);if(Math.min(s.x,s.y,s.z)<.002)continue;box(p.x,p.y,p.z,s.x,s.y,s.z,b.key,body,Math.min(b.r,.02)).name=`${part.name}-well`}
  }
  const wellWidth=well.max.x-well.min.x,wellLength=well.max.z-well.min.z
  box(0,seat.y-.035,seat.z+.02/fitScale,wellWidth+.1,.07,wellLength+.12,'dark').name='pilot-floor'
  box(0,seat.y+.24,well.min.z-.05,wellWidth,.48,.1,'orange').name='pilot-backrest'
  // Collapse all static hull pieces into one mesh per material; moving mechanisms remain separate.
  body.updateMatrixWorld(true)
  const batches=[];body.traverse(o=>{if(o.isGroup)batches.push(o)})
  for(const batch of merge?batches:[]) for(const mat of Object.values(mats)) {
    const parts=batch.children.filter(o=>o.isMesh&&o.material===mat&&!thrusters.includes(o)&&!o.userData.moving&&!tracks.some(t=>t.rollers.includes(o)))
    if(parts.length<2)continue
    const geometries=parts.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);return g})
    const merged=new THREE.Mesh(mergeGeometries(geometries,false),mat);merged.castShadow=true;merged.receiveShadow=true
    for(const p of parts){batch.remove(p);p.geometry.dispose()}for(const g of geometries)g.dispose();batch.add(merged)
  }
  if(merge)for(const track of tracks){
    track.instance=new THREE.InstancedMesh(track.links[0].geometry.clone(),mats.orange,track.links.length);track.instance.castShadow=true;track.instance.receiveShadow=true;track.belt.add(track.instance)
    for(const link of track.links){track.belt.remove(link);link.geometry.dispose()}
    track.update(0)
  }
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3())
  body.position.y=-bounds.min.y;seat.y-=bounds.min.y
  const scale=Math.min(1,4.7/Math.max(size.x,size.z));root.scale.setScalar(scale)
  root.userData={spec,seat:seat.multiplyScalar(scale),wheels,rotors,arms,thrusters,canopies,tracks,parts:merge?null:parts,footprint:Math.max(size.x,size.z)*scale/2,
    animate(time,active,reduced=false){
      const t=reduced?0:time
      for(const wheel of wheels)wheel.rotation.x=active?-t*2:0
      for(const rotor of rotors)rotor.rotation.z=active?t*4:0
      for(const arm of arms)arm.rotation.y=active?Math.sin(t*.65)*.18:0
      for(const track of tracks)track.update(active?t:0)
      for(const light of thrusters)light.scale.setScalar(active?1+Math.sin(t*5)*.07:1)
    },
    dispose(){root.traverse(o=>o.geometry?.dispose());for(const mat of Object.values(mats))mat.dispose()},
  }
  return root
}
