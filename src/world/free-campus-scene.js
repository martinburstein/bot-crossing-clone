import * as THREE from 'three'
import {sharpLabelTexture} from './label-texture.js'
import {FREE_CAMPUS as L,FREE_CAMPUS_PODS as PODS,FREE_CAMPUS_SEATS as SEATS,CAMPUS_HEX_RADIUS,campusHexPoint,FREE_CAMPUS_HOMES,freeCampusUpload} from './free-campus-layout.js'

// Scenery only: every light, upload animation and resident pose follows state.
export function createFreeCampusScene(scene,base,{sharpLabels=false}={}){
  const group=new THREE.Group();group.name='free-campus-geometric-garden';group.visible=false;scene.add(group)
  const geometries=new Set(),materials=new Set(),textures=new Set()
  const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.18,...extra});materials.add(m);return m}
  const dark=mat(0x172b32),edge=mat(0xd8b56d,{emissive:0x785329,emissiveIntensity:.25}),stone=mat(0x80908b),deck=mat(0x354c4c),wood=mat(0x8f694a),cream=mat(0xe8d8b8),sage=mat(0x89a68a),glow=mat(0x94eee2,{emissive:0x44bcb3,emissiveIntensity:.8}),fireMat=mat(0xffbd67,{emissive:0xff8026,emissiveIntensity:1.6})
  function mesh(geometry,material,x,y,z,parent=group,name=''){geometries.add(geometry);const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  const box=(x,y,z,w,h,d,m,p=group,n='')=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,p,n)
  const cyl=(x,y,z,r,h,m,p=group,sides=48)=>mesh(new THREE.CylinderGeometry(r,r,h,sides),m,x,y,z,p)
  function ring(x,y,z,r,t,m,p=group){const o=mesh(new THREE.TorusGeometry(r,t,6,72),m,x,y,z,p);o.rotation.x=Math.PI/2;return o}
  function hex(x,z,r,y,h,m,p=group){const g=new THREE.CylinderGeometry(r,r,h,6);g.rotateY(Math.PI/6);return mesh(g,m,x,y,z,p)}
  function canvasLabel(text,sub,w,h,parent,x,y,z,{flat=false,color='#d9f7ed',background='#10272b',font=76}={}){
    if(typeof document==='undefined')return null
    if(sharpLabels){
      const {texture,draw}=sharpLabelTexture(w,h,{background,color,detailColor:'#dabf8a'});textures.add(texture);
      const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});materials.add(material);
      const label=mesh(new THREE.PlaneGeometry(w,h),material,x,y,z,parent);if(flat)label.rotation.x=-Math.PI/2;
      draw(text,sub);label.userData.draw=draw;return label;
    }
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;const ctx=canvas.getContext('2d')
    const draw=(title,detail)=>{ctx.fillStyle=background;ctx.fillRect(0,0,1024,384);ctx.strokeStyle='#d4ac63';ctx.lineWidth=5;ctx.strokeRect(14,14,996,356);ctx.textAlign='center';ctx.fillStyle=color;ctx.font=`600 ${font}px sans-serif`;ctx.fillText(title,512,178);ctx.fillStyle='#dabf8a';ctx.font='29px sans-serif';ctx.fillText(detail,512,274);texture.needsUpdate=true}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture)
    const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});materials.add(material)
    const label=mesh(new THREE.PlaneGeometry(w,h),material,x,y,z,parent);if(flat)label.rotation.x=-Math.PI/2
    draw(text,sub);label.userData.draw=draw;return label
  }
  // Exactly two civic tiles complete the 17 resident petals. No second slab overlaps a plot.
  for(const p of [{x:0,z:0},L.board]){hex(p.x,p.z,CAMPUS_HEX_RADIUS*.992,.025,.85,dark);hex(p.x,p.z,CAMPUS_HEX_RADIUS*.94,.47,.045,edge);hex(p.x,p.z,CAMPUS_HEX_RADIUS*.90,.50,.045,deck)}
  // Matching service pads sit on opposite lattice axes, clear of the resident rosette.
  for(const [id,p]of [['hangar',L.hangar],['lander',L.lander]]){
    const pad=new THREE.Group();pad.name=`campus-${id}-designated-pad`;pad.position.set(p.x,p.y??0,p.z);group.add(pad)
    const radius=p.padRadius??L.servicePadRadius
    // Raise the deck while extending its footing down into the soil.
    hex(0,0,radius,-.13-(p.y??0)/2,.5+(p.y??0),dark,pad);hex(0,0,radius*.97,.13,.04,edge,pad);hex(0,0,radius*.93,.18,.04,deck,pad)
    canvasLabel(id==='hangar'?'HANGAR / 01':'LANDER / 02',id==='hangar'?'VEHICLE SERVICE':'ARRIVAL COURT',11,2.6,pad,0,.225,id==='hangar'?10.8:8.8,{flat:true,font:87})
    for(const x of [-10.8,10.8])for(const z of [-3,0,3])box(x,.27,z,.3,.1,.7,glow,pad)
    const sign=Math.sign(p.x),approachHeight=(p.padHeight??.2)-.03;box(sign*31.4,approachHeight,0,7,.06,3,deck);for(const z of [-1.45,1.45])box(sign*31.4,approachHeight+.05,z,7,.05,.09,edge)
    if(id==='lander'){ring(0,.23,0,6.1,.065,cream,pad);ring(0,.23,0,7.6,.065,edge,pad)}
  }
  const camp=new THREE.Group();camp.name='free-campus-common';camp.position.set(0,0,L.camp.z);group.add(camp)
  cyl(0,.35,0,14,.7,stone,camp);cyl(0,.74,0,13.5,.12,dark,camp);cyl(0,.84,0,12.9,.08,wood,camp)
  ring(0,.9,0,13.1,.09,edge,camp);ring(0,.91,0,8.7,.045,cream,camp)
  for(let i=0;i<34;i++){const a=i*Math.PI/17;const p=box(Math.sin(a)*13.7,.76,Math.cos(a)*13.7,.22,.16,1.1,cream,camp);p.rotation.y=a}
  const seats=[]
  for(const [i,p]of SEATS.entries()){
    const a=i*Math.PI*2/17,s=new THREE.Group();s.position.set(p.x,0,p.z-L.camp.z);s.rotation.y=a+Math.PI;camp.add(s);s.name=`camp-resident-seat-${i+1}`
    box(0,1.07,0,2.15,.35,1.8,wood,s);box(0,1.30,0,2,.16,1.62,i===16?sage:cream,s);box(0,1.62,-.73,2.15,.62,.2,wood,s);seats.push(s)
  }
  cyl(0,1.05,0,2.2,.38,stone,camp,12);cyl(0,1.3,0,1.7,.15,dark,camp,12)
  const flame=mesh(new THREE.IcosahedronGeometry(.86,0),fireMat,0,2.0,0,camp,'campfire');flame.scale.y=1.55
  for(let i=0;i<3;i++){const a=i*Math.PI/3,l=box(0,1.55,0,2.4,.24,.3,wood,camp);l.rotation.y=a}
  // A short civic approach meets the north hex edge, rather than crossing its face.
  box(0,.66,-35.4,5.2,.3,7.2,stone);box(0,.84,-35.4,4.9,.06,7.1,deck)
  for(const x of [-2.42,2.42])box(x,.9,-35.4,.1,.07,7,edge)
  const charger=new THREE.Group();charger.name='campus-independent-memory-archive';charger.position.set(0,0,-35.8);group.add(charger)
  canvasLabel('CAMP / COMMON','17 RESIDENTS     /     3 LUNA UNITS',9,2.7,charger,0,1.08,0,{flat:true,font:77})

  // The three equal-scale computer monuments repeat the clipped panels in the references.
  // Their footprint equals the camp diameter. They communicate without drawn cables.
  const cores={},screens={}
  function octagon(size,depth){const h=size/2,c=size*.18,s=new THREE.Shape();s.moveTo(-h+c,-h);for(const [x,y]of [[h-c,-h],[h,-h+c],[h,h-c],[h-c,h],[-h+c,h],[-h,h-c],[-h,-h+c],[-h+c,-h]])s.lineTo(x,y);const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false});g.rotateX(-Math.PI/2);return g}
  for(const [id,color]of [['balthasar',0x76cfc4],['casper',0x76bad4],['melchior',0xe78d59]]){
    const p=L[id],core=new THREE.Group();core.name=`campus-supercomputer-${id}`;core.position.set(p.x,0,p.z);core.rotation.y=p.angle;group.add(core);cores[id]=core
    mesh(octagon(28,.7),dark,0,.0,0,core);mesh(octagon(27.2,.16),edge,0,.72,0,core);mesh(octagon(26.5,2.8),dark,0,.9,0,core)
    const panel=mat(color,{emissive:color,emissiveIntensity:.13,roughness:.4});mesh(octagon(25.5,.15),panel,0,3.8,0,core)
    mesh(octagon(23.7,.09),dark,0,4.01,0,core)
    for(const x of [-10.8,10.8])for(let i=0;i<9;i++)box(x,4.14,-8.5+i*2,.4,.08,.9,edge,core)
    // Large screen labels read from the same overhead view as the geometric campus.
    screens[id]=canvasLabel(`${id.toUpperCase()}-${p.number}`,'LUNA UNIT   /   IDLE',20,10.5,core,0,4.2,-.5,{flat:true,color:'#dff8ed',font:id==='balthasar'?87:100})
    const digit=canvasLabel(String(p.number),'MAGI',6,3,core,0,4.23,8,{flat:true,color:'#e9c57c',font:140});if(digit)digit.name=`magi-number-${p.number}`
    const lamps=[]
    for(let i=0;i<9;i++)lamps.push(box(-8+i*2,2.1,13.29,1.1,.18,.08,glow,core))
    core.userData.lamps=lamps;core.userData.footprint={width:28,depth:28};core.userData.unitState='idle'
  }
  // Fifteen memory pods sit on their own starter petals. Archived versions stay in the protocol.
  const pods=PODS.map((p,i)=>{
    const g=new THREE.Group();g.name=`campus-memory-pod-${p.roleId}`;g.position.set(p.x,0,p.z);g.userData.roleId=p.roleId;group.add(g)
    hex(0,0,2.65,.70,.35,dark,g);hex(0,0,2.46,.91,.10,edge,g);hex(0,0,2.25,1.0,.08,sage,g)
    box(0,2.55,-1.9,3.7,3.1,.45,dark,g);box(0,4.18,-.25,4,.25,3.7,cream,g)
    for(const x of [-1.86,1.86])box(x,2.7,-.3,.23,3.0,3.3,stone,g)
    box(0,3.1,-1.63,2.6,.9,.06,glow,g);canvasLabel(`RAM ${String(i+1).padStart(2,'0')}`,'STORED / READY',3.5,.95,g,0,4.44,-.27,{flat:true,font:99})
    const scanner=ring(0,1.28,0,1.7,.035,glow,g);scanner.name='wireless-head-upload';scanner.visible=false;g.userData.scanner=scanner
    g.userData.light=box(0,4.45,-1.7,1,.08,.4,glow,g);return g
  })
  const loungePods=[]
  for(const id of ['w00','w16']){const p=campusHexPoint(FREE_CAMPUS_HOMES[id]),g=new THREE.Group();g.name=id==='w00'?'pilot-resident-lounge':'camper-resident-lounge';g.position.set(p.x,0,p.z);group.add(g);hex(0,0,3.4,.62,.28,stone,g);box(0,1.1,0,4,.5,2.6,wood,g);box(0,1.5,0,3.8,.3,2.4,id==='w00'?cream:sage,g);box(0,1.92,-1.12,4,.8,.3,wood,g);loungePods.push(g)}
  let data={},disposed=false,active=false
  const originalChildren=new Map(base.group.children.map(o=>[o,o.visible])),oldBoard=base.board.position.clone()
  const boardDeck=base.board.getObjectByName('bounty-board-deck-surface')
  const originalBoardDeck=boardDeck?.visible
  function update(value){
    data=value??{};active=data.campus?.dispatchMode==='free-15-3A';group.visible=active
    for(const [child,visible]of originalChildren)child.visible=active?child===base.board:visible
    if(active){base.board.position.set(L.board.x,0,L.board.z);if(boardDeck)boardDeck.visible=false}else{base.board.position.copy(oldBoard);if(boardDeck)boardDeck.visible=originalBoardDeck}
    if(!active)return
    const c=data.campus
    for(const [id,core]of Object.entries(cores)){
      const slot=data.executorSlots?.find(s=>s.slotId===id),status=data.stale?'FEED UNAVAILABLE':c.mode==='sleeping'?'RESTING':slot?.status==='running'?'TURN RUNNING':slot?.roleId?`READY / ${slot.roleId.toUpperCase()}`:'IDLE / OPEN'
      if(core.userData.caption!==status){screens[id]?.userData.draw(`${id.toUpperCase()}-${L[id].number}`,`LUNA UNIT   /   ${status}`);core.userData.caption=status}
      core.userData.unitState=slot?.status??'idle';core.userData.roleId=slot?.roleId??null
    }
    for(const pod of pods){pod.userData.occupied=c.mode==='sleeping'||c.free.chargingRoleIds.includes(pod.userData.roleId);pod.userData.light.scale.setScalar(pod.userData.occupied?1.35:.65)}
  }
  function animate(elapsed,agents=[]){
    if(!active)return
    flame.scale.y=1.5+Math.sin(elapsed*2.5)*.13
    for(const [index,core]of Object.values(cores).entries())for(const [i,lamp]of core.userData.lamps.entries())lamp.scale.x=.72+.23*Math.sin(elapsed*(core.userData.unitState==='running'?3.5:.6)+i*.55+index)
    for(const p of pods){const resident=agents.find(a=>a.thread?.roleId===p.userData.roleId),download=resident?.campusDownload,atPod=resident&&Math.hypot(resident.pos.x-p.position.x,resident.pos.z-p.position.z)<1;const loading=!data.stale&&atPod&&download?.arrivedAt!=null&&!download.ready&&resident.thread.running;const upload=!data.stale&&atPod&&freeCampusUpload(data.campus,p.userData.roleId);p.userData.scanner.visible=!!(loading||upload);if(loading||upload)p.userData.scanner.position.y=1.35+(loading?Math.min(1,(elapsed-download.arrivedAt)/2):upload.progress)*2.3}
  }
  const vec=p=>new THREE.Vector3(p.x,0,p.z)
  function target(thread,elapsed=0,agent=null){
    const c=data.campus;if(!c)return null
    const special=['pilot','camper'].includes(thread.roleId),i=special?(thread.roleId==='pilot'?15:16):Number(thread.roleId.slice(1))-1,pod=PODS[i]
    const home=special?campusHexPoint(FREE_CAMPUS_HOMES[thread.roleId==='pilot'?'w00':'w16']):pod
    if(c.mode==='sleeping'||!special&&(c.free.chargingRoleIds.includes(thread.roleId)||freeCampusUpload(c,thread.roleId)||thread.running&&agent?.campusDownload?.ready!==true))return {position:vec(home),look:vec(L.camp),activity:'pilot-rest'}
    // Camper rests longer and only occasionally strolls to another conversation circle.
    const calm=thread.roleId==='camper',phase=Math.floor((elapsed+i*3)/(calm?60:26))%4
    const seat=SEATS[i],other=SEATS[(i+4)%17],p=phase<2?seat:phase===2?{x:seat.x*.52,z:L.camp.z+(seat.z-L.camp.z)*.52}:other
    return {position:vec(p),look:vec(L.camp),activity:calm&&phase<2?'pilot-rest':phase<2?'talk':'stroll'}
  }
  const clearings=[{...L.hangar,r:16},{...L.lander,r:16},{x:0,z:0,r:9},{x:0,z:-49,r:15},{x:0,z:-85,r:21},{x:-34,z:-46,r:22},{x:34,z:-46,r:22},{...L.board,r:9},...PODS.map(p=>({...p,r:4}))]
  const obstacles=()=>[...Object.values(L).filter(p=>p&&Number.isFinite(p.number)).map(p=>({x:p.x,z:p.z,r:15.8,worksite:'magi-monument'})),{x:0,z:-49,r:2.3,worksite:'hearth'},...PODS.flatMap(p=>[-1.9,1.9].map(x=>({x:p.x+x,z:p.z-.4,r:.42,worksite:'pod-post'}))),...[-7.25,7.25].map(x=>({x:L.board.x+x,z:L.board.z,r:.42,worksite:'board-post'}))]
  function surfaceHeight(x,z){for(const p of [L.hangar,L.lander])if(Array.from({length:6},(_,i)=>Math.PI/6+i*Math.PI/3).every(a=>(x-p.x)*Math.cos(a)+(z-p.z)*Math.sin(a)<=(p.padRadius??L.servicePadRadius)*Math.sqrt(3)/2))return p.padHeight??.2;if(SEATS.some(p=>Math.hypot(x-p.x,z-p.z)<1.0))return 1.42;if(Math.hypot(x,z-L.camp.z)<14)return .9;const pod=PODS.find(p=>Math.hypot(x-p.x,z-p.z)<2.4);if(pod)return 1.05;if(Math.abs(x)<2.6&&z>-39.1&&z<-31.7)return .88;for(const p of [{x:0,z:0},L.board])if(Array.from({length:6},(_,i)=>Math.PI/6+i*Math.PI/3).every(a=>(x-p.x)*Math.cos(a)+(z-p.z)*Math.sin(a)<=CAMPUS_HEX_RADIUS*.992*Math.sqrt(3)/2))return .523;return null}
  return {group,cores,pods,seats,camper:loungePods[1],pilotPod:loungePods[0],charger,signals:{},target,update,animate,clearings:()=>clearings,obstacles,surfaceHeight,
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose())}}
}
