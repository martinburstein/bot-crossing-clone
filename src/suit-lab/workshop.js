import * as THREE from 'three'
import {sharpLabelTexture} from '../world/label-texture.js'
import {FACILITIES} from './facilities.js'

// Roofless dollhouse workshop: the actual Bot Crossing residents stay visible.
// All instruments are original scene geometry and have no hardware/API bindings.
export function createWorkshop(scene){
 const group=new THREE.Group();group.name='kestrel-shared-workshop';scene.add(group)
 const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.65,...extra})
 const cream=mat('#ece9d7'),sage=mat('#78998c'),dark=mat('#314e50'),metal=mat('#b6c4ba',{metalness:.45,roughness:.36}),gold=mat('#dca76a'),blue=mat('#8fcbd6'),rose=mat('#c9969c')
 const glass=mat('#a5d6d2',{transparent:true,opacity:.23,roughness:.15,depthWrite:false})
 const screen=mat('#a0e6c6',{emissive:'#4f9e87',emissiveIntensity:.3})
 const add=(geometry,material,x,y,z,parent=group)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=!material.transparent;m.receiveShadow=true;parent.add(m);return m}
 const box=(w,h,d,m,x,y,z,p)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,p)
 const cyl=(r,h,m,x,y,z,p,sides=24)=>add(new THREE.CylinderGeometry(r,r,h,sides),m,x,y,z,p)
 const sphere=(r,m,x,y,z,p)=>add(new THREE.SphereGeometry(r,20,12),m,x,y,z,p)
 const pipe=(a,b,r,m,p)=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);const o=add(new THREE.CylinderGeometry(r,r,delta.length(),10),m,...from.clone().add(to).multiplyScalar(.5).toArray(),p);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o}
 const tube=(points,r,m,p)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(a=>new THREE.Vector3(...a))),32,r,8,false),m,0,0,0,p)
 const ring=(r,m,x,y,z,p)=>{const o=add(new THREE.TorusGeometry(r,.16,8,40),m,x,y,z,p);return o}
 const label=(title,detail,w,x,y,z,p)=>{const l=sharpLabelTexture(w,w*.25,{background:'#365455',color:'#fff1d2'});l.draw(title,detail);const o=add(new THREE.PlaneGeometry(w,w*.25),new THREE.MeshBasicMaterial({map:l.texture,side:THREE.DoubleSide}),x,y,z,p);o.rotation.x=-Math.PI*.22;return o}
 const table=(x,z,w=9,d=4,p=group)=>{box(w,.45,d,cream,x,3,z,p);for(const a of [-1,1])for(const b of [-1,1])box(.35,2.8,.35,sage,x+a*(w/2-.5),1.5,z+b*(d/2-.5),p)}
 const console=(x,z,p)=>{box(3.8,2.4,2.1,cream,x,1.4,z,p);const s=box(3.1,1.6,.18,dark,x,3.1,z-.3,p);s.rotation.x=-.24;box(2.6,.10,.45,screen,x,3.0,z+.6,p)}
 function suit(parent,x,y,z,scale=1){
  const s=new THREE.Group();s.position.set(x,y,z);s.scale.setScalar(scale);s.userData.legs=[];parent.add(s)
  const shell=mat('#e5d8b8'),joint=mat('#355c5c'),accent=mat('#e59b52')
  const part=(geo,m,px,py,pz)=>add(geo,m,px,py,pz,s)
  part(new THREE.CapsuleGeometry(.85,1.35,5,16),shell,0,4.2,0)
  box(1.35,.7,.22,accent,0,4.65,.79,s)
  const head=sphere(1.03,shell,0,6.5,0,s);head.scale.set(1,1.02,.92)
  const visor=sphere(.91,dark,0,6.55,.43,s);visor.scale.set(1,.7,.68)
  cyl(.62,.23,joint,0,5.45,0,s)
  box(1.4,1.7,.65,joint,0,4.4,-.95,s)
  for(const sign of [-1,1]){
   const leg=part(new THREE.CapsuleGeometry(.38,1.7,4,12),shell,sign*.51,1.72,0);s.userData.legs.push(leg)
   box(.8,.45,1.22,joint,sign*.51,.35,.23,s)
   sphere(.43,joint,sign*.51,1.9,.12,s)
   const arm=part(new THREE.CapsuleGeometry(.30,1.43,4,12),shell,sign*1.21,4.0,0);arm.rotation.z=sign*.16
   sphere(.36,joint,sign*1.38,2.96,.02,s)
   box(.42,.44,.19,accent,sign*.51,1.87,.43,s)
  }
  return s
 }
 // Low deck, open front, slim perimeter structure; no roof hides the bots.
 box(82,.65,69,cream,-11,-.05,0)
 box(79,.12,66,mat('#c9d4c3'),-11,.32,0)
 for(const x of [-50,28]){
  box(.65,2.1,68,sage,x,1.4,0)
  for(const z of [-32,5,32]){box(.55,11,.55,cream,x,5.5,z);box(.8,.25,.8,gold,x,11.1,z)}
  box(.65,.65,65,sage,x,11,0)
 }
 box(79,2.2,.65,sage,-11,1.5,-33)
 box(79,.65,.65,sage,-11,11,-33)
 for(const x of [-11,11])box(.5,11,.5,cream,x,5.5,-33)
 label('KESTREL','SHARED SUIT WORKSHOP',23,-13,8,-32.5)
 // Dashed main aisle links every bay to the same assembly cradle.
 for(let z=-28;z<=25;z+=4)box(.11,.025,1.5,gold,-25,.43,z)
 for(let x=-45;x<=24;x+=4)box(1.5,.025,.11,gold,x,.43,14)
 const stations=new Map(),animations=[]
 for(const f of FACILITIES){
  const bay=new THREE.Group();bay.name=`lab-${f.id}`;bay.position.set(f.at[0],0,f.at[1]);bay.userData.facilityId=f.id;group.add(bay)
  const animationStart=animations.length
  const accent=mat(f.color),lamp=mat(f.color,{emissive:f.color,emissiveIntensity:.12})
  box(f.id==='assembly'?22:17,.14,f.id==='assembly'?17:15,mat(f.id==='assembly'?'#c8d4c3':'#dce0ce'),0,.45,0,bay)
  const halo=ring(f.id==='assembly'?9:7.4,lamp,0,.56,0,bay);halo.rotation.x=-Math.PI/2;halo.visible=false
  stations.set(f.id,{bay,lamp,halo,focus:new THREE.Vector3(f.at[0],2,f.at[1])})
  label(f.short,f.name.toUpperCase(),f.id==='assembly'?14:13,0,1.6,7,bay)
  if(f.id==='assembly'){
   const cradle=cyl(5.7,1,cream,0,1.1,0,bay);ring(5.3,gold,0,1.65,0,bay).rotation.x=-Math.PI/2
   suit(bay,0,1.7,0,1.15)
   for(const x of [-7.5,7.5]){box(.45,11,.45,sage,x,5.8,0,bay);pipe([x,10.6,0],[x/2,9,0],.25,gold,bay);pipe([x/2,9,0],[x/3,7.3,1],.16,metal,bay)}
   table(-8,4,4,3,bay);table(8,4,4,3,bay)
   sphere(1.25,cream,-8,4,4,bay);box(2,1.5,1.7,dark,8,4,4,bay)
   const scan=ring(2.1,screen,0,3,0,bay);scan.rotation.x=-Math.PI/2
   animations.push((t,a)=>{scan.position.y=3+(a?(Math.sin(t*2)+1)*3:0);scan.visible=a})
  }else if(f.id==='pressure'){
   const chamber=add(new THREE.CylinderGeometry(4.6,4.6,8,32,1,true),metal,0,5.3,0,bay);chamber.rotation.x=Math.PI/2
   add(new THREE.CircleGeometry(4.6,36),dark,0,5.3,-4,bay)
   // Horizontal vessel with an open, glazed inspection port and actual interior.
   for(const z of [-4,4.1])ring(4.6,cream,0,5.3,z,bay)
   ring(3.8,gold,0,5.3,4.2,bay)
   const window=add(new THREE.CircleGeometry(3.75,36),glass.clone(),0,5.3,4.3,bay)
   suit(bay,0,1.6,2.5,.65)
   for(const x of [-3,3])box(1.2,1.5,6,dark,x,1.1,0,bay)
   console(6,3,bay);for(const y of [3,5,7])sphere(.42,screen,-5.4,y,1,bay)
   animations.push((t,a)=>{window.material.opacity=a?.34+.12*Math.sin(t*3):.23})
  }else if(f.id==='thermal'){
   for(const sign of [-1,1]){
    const x=sign*3.8,m=sign<0?blue:gold
    const heater=mat(sign<0?'#80c9df':'#efad65',{emissive:sign<0?'#58b2ed':'#f6a249',emissiveIntensity:.1})
    box(6.6,7.8,7.3,cream,x,4.5,0,bay);box(5.7,6.4,.2,dark,x,4.7,3.8,bay)
    for(let i=0;i<4;i++)box(.55,5,.18,heater,x-2+i*1.3,4.7,3.98,bay)
    box(6.1,.5,7.8,m,x,8.5,0,bay);sphere(.35,screen,x,8.6,4,bay)
    animations.push((t,a)=>heater.emissiveIntensity=a?.3+(.5+.5*Math.sin(t*2+sign))*.7:.1)
   }
   console(0,6,bay)
  }else if(f.id==='radiation'){
   box(15,5.8,8,dark,0,3.4,0,bay)
   for(const x of [-6,-3,0,3,6])box(.6,6.5,8.7,accent,x,3.6,0,bay)
   const beam=box(12,.20,.20,screen,0,5.5,4.5,bay)
   box(2.5,3.5,1.4,gold,1,3.6,4.4,bay);console(-5,6,bay)
   animations.push((t,a)=>beam.visible=a)
  }else if(f.id==='materials'){
   table(0,0,14,7,bay)
   // Printer/loom, sample rack and microscope.
   for(const x of [-5,-1])box(.35,5,.35,sage,x,5.4,-1,bay)
   box(4.5,.4,3.5,sage,-3,7.8,-1,bay);const carriage=box(.8,1,1,gold,-3,6.7,-1,bay)
   for(let i=0;i<6;i++)pipe([-5+i*.65,3.3,-2],[-5+i*.65,6.5,-2],.06,rose,bay)
   box(2.5,.3,2,dark,4,3.4,1,bay);pipe([4,3.5,1],[4,5.8,0],.3,metal,bay);pipe([4,5.8,0],[4,6.5,1],.4,dark,bay)
   for(let i=0;i<4;i++)box(1.2,.18,1.6,[gold,blue,rose,sage][i],-5+i*2.1,3.4,2,bay)
   animations.push((t,a)=>carriage.position.x=a?-3+Math.sin(t*2)*1.5:-3)
  }else if(f.id==='life-support'){
   box(12,.5,8,cream,0,.9,0,bay)
   for(const x of [-4,-1,2]){cyl(1.25,6,metal,x,4,0,bay);sphere(1.25,blue,x,7,0,bay);ring(1.3,accent,x,5,0,bay).rotation.x=-Math.PI/2}
   box(2,5,3,dark,5,3.8,0,bay)
   tube([[-4,6,1],[-4,8,2],[2,8,2],[4,5,3],[2,2,4],[-4,2,3],[-4,4,1]],.2,blue,bay)
   const bead=sphere(.38,screen,0,8,2,bay);console(4,5,bay)
   animations.push((t,a)=>{bead.visible=a;bead.position.x=-4+(Math.sin(t*2)*.5+.5)*6})
  }else if(f.id==='mobility'){
   box(12,.7,8,dark,0,1,0,bay)
   for(let i=0;i<8;i++)box(.15,.08,7,metal,-5+i*1.4,1.4,0,bay)
   for(const x of [-6,6])box(.5,11,.6,sage,x,6,-1,bay)
   box(13,.6,.6,cream,0,11.5,-1,bay)
   pipe([0,11,-1],[0,7,0],.09,gold,bay);const mannequin=suit(bay,0,1.5,0,.78)
   for(const x of [-5,5])pipe([x,2,3],[x,6,0],.15,metal,bay)
   console(7,5,bay)
   animations.push((t,a)=>{mannequin.userData.legs.forEach((leg,i)=>leg.rotation.x=a?Math.sin(t*3+i*Math.PI)*.3:0)})
  }else if(f.id==='dust-impact'){
   box(10,.7,8,cream,-1,1,0,bay);box(9,6,7,glass,-1,4.5,0,bay)
   for(const x of [-6,4])for(const z of [-4,4])box(.3,7,.3,metal,x,4.5,z,bay)
   box(10,.5,8,sage,-1,8,0,bay);box(9,.3,7,mat('#b4a383'),-1,1.6,0,bay)
   const dust=new THREE.Group();bay.add(dust)
   for(let i=0;i<28;i++){const p=sphere(.12,gold,Math.sin(i*4)*3,2+(i%6)*.7,Math.cos(i*3)*2.5,dust)}
   pipe([6,3,-4],[6,3,3],.8,metal,bay);box(2,4,1,accent,6,3,4,bay)
   animations.push((t,a)=>{dust.rotation.y=a?t*.8:0;dust.position.y=a?Math.sin(t*2)*.3:0})
  }else{
   table(0,0,14,6,bay)
   const scanbar=box(12,.09,.12,screen,0,4,1,bay)
   for(const x of [-4,0,4]){box(2,.22,2,dark,x,3.5,0,bay);sphere(.65,cream,x,4.2,.2,bay);pipe([x-1,3.5,-1],[x-1,6.5,-1],.12,metal,bay);box(1.5,.4,.8,blue,x-.4,6,-1,bay)}
   for(let i=0;i<6;i++)box(.6,.18,1.1,i%2?gold:sage,-5+i*2,3.5,2,bay)
   animations.push((t,a)=>{scanbar.position.z=a?Math.sin(t*2)*2:1;scanbar.visible=a})
  }
  for(let i=animationStart;i<animations.length;i++)animations[i].facilityId=f.id
 }
 // Shared mobile trays and sample storage complete the workshop without a roof.
 for(const x of [-47,25]){box(2.6,6,5,cream,x,3.5,-10);for(let i=0;i<4;i++)box(2.7,.15,5.1,sage,x,1.2+i*1.6,-10)}
 let selected=null,active=null
 return {group,stations,
  select(id){selected=id;for(const [key,s]of stations)s.halo.visible=key===id},
  setActive(id){active=id},
  update(t,reduced){for(const [id,s]of stations)s.lamp.emissiveIntensity=id===active?(reduced?.5:.5+Math.sin(t*4)*.25):id===selected?.25:.12;for(const fn of animations)fn(reduced?0:t,active===fn.facilityId)},
 }
}
