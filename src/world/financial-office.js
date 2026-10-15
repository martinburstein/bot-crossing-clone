import * as THREE from 'three';
import {createRoArmWorksite} from './roarm-worksite.js';
import {createFreeCampusScene} from './free-campus-scene.js';
import {FREE_CAMPUS as L,FREE_CAMPUS_SEATS} from './free-campus-layout.js';
import {OFFICE_PROFILES,OFFICE_BY_ID} from '../office/profiles.js';
import {createPaperBank,BANK_POSITION} from './paper-bank.js';

// Editable sibling of the canon: reuse exact civic geometry, never mutate its definitions.
export function createFinancialOffice(scene){
  const base=createRoArmWorksite(scene),civic=createFreeCampusScene(scene,base),group=new THREE.Group();
  group.name='financial-office-open-air-floor';scene.add(group);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.74,metalness:.06,...extra});materials.add(m);return m;};
  const ink=mat(0x25363c),oak=mat(0xb79468),walnut=mat(0x765740),stone=mat(0xd3cbb9),pale=mat(0xe9e2d3),brass=mat(0xc9a968,{metalness:.5}),green=mat(0x456c54),screen=mat(0x142d32),glass=mat(0x93c2b8,{emissive:0x39776d,emissiveIntensity:.25});
  function mesh(geo,material,x,y,z,parent=group,name=''){geometries.add(geo);const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  const box=(x,y,z,w,h,d,m,p=group,n='')=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,p,n);
  const cyl=(x,y,z,r,h,m,p=group)=>mesh(new THREE.CylinderGeometry(r,r,h,20),m,x,y,z,p);
  function label(title,detail,w,h,parent,x,y,z,{flat=false,size=60}={}){
    if(typeof document==='undefined')return null;
    const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);
    const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});materials.add(material);
    const o=mesh(new THREE.PlaneGeometry(w,h),material,x,y,z,parent);if(flat)o.rotation.x=-Math.PI/2;
    const draw=(a,b)=>{ctx.fillStyle='#243b3d';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#c6a570';ctx.lineWidth=5;ctx.strokeRect(9,9,1006,238);ctx.textAlign='center';ctx.fillStyle='#f4e9d3';ctx.font=`600 ${size}px Georgia`;ctx.fillText(a,512,110,960);ctx.font='25px sans-serif';ctx.fillStyle='#b6c7bd';ctx.fillText(b,512,191,960);texture.needsUpdate=true;};
    draw(title,detail);o.userData.draw=draw;return o;
  }
  box(0,.22,2,69,.7,53,ink,group,'office-foundation');box(0,.60,2,68,.12,52,stone,group,'office-travertine-floor');
  // Quiet limestone grid, walnut trading islands and wide continuous aisles.
  for(let x=-33;x<=33;x+=4)box(x,.674,2,.025,.012,51,oak);
  for(let z=-23;z<=27;z+=4)box(0,.674,z,67,.012,.025,oak);
  for(const x of [-34,34])box(x,.7,2,.13,.12,52,brass);
  for(const z of [-24,28])box(0,.7,z,68,.12,.13,brass);
  box(0,.7,-29,7,.2,10,stone);box(0,.82,-29,6.5,.04,10,oak);
  const desks=[];
  for(const p of OFFICE_PROFILES){
    const g=new THREE.Group();g.name=`office-desk-${p.id}`;g.position.set(p.desk.x,0,p.desk.z);group.add(g);desks.push(g);
    const accent=mat(p.color),trim=mat(p.accent);
    box(0,.73,0,12,.10,10,accent,g,'desk-area-rug');
    box(0,2.55,0,10.1,.38,4.8,walnut,g,'walnut-desk-top');box(0,2.78,0,9.8,.06,4.5,oak,g);
    for(const x of [-4,4]){box(x,1.58,0,1.3,1.7,3.8,ink,g);for(const y of [1.2,1.8,2.3])box(x,y,2,1.0,.07,.07,brass,g);}
    // Triple research screens, each with a restrained vector market chart.
    for(const [i,x]of [-2.8,0,2.8].entries()){
      box(x,3.15,-.6,.16,.6,.2,ink,g);box(x,3.9,-.8,2.65,1.52,.18,ink,g);box(x,3.94,-.69,2.42,1.29,.02,screen,g);
      for(let j=0;j<8;j++)box(x-1+j*.28,3.65+((j*(i+2)+p.index)%5)*.1,-.665,.13,.25+((j+p.index)%3)*.18,.035,j%3===0?trim:glass,g);
      box(x,2.86,.7,2.3,.09,.62,ink,g);
    }
    box(0,2.86,1.58,7,.04,.11,brass,g);label(p.name,p.role,7.8,1.6,g,0,2.99,1.15,{flat:true,size:62});
    box(-3.9,2.87,.6,.95,.10,1.15,pale,g,'research-papers');box(-3.8,2.94,.55,.9,.05,1.1,trim,g);
    cyl(4,3.02,1.25,.24,.45,pale,g);cyl(4,3.25,1.25,.18,.015,walnut,g);
    // Unoccupied leather chair is scenery; active identity comes from real task telemetry.
    cyl(0,.97,3.8,.8,.12,ink,g);box(0,1.6,3.8,.18,1.2,.18,ink,g);box(0,2.08,3.8,1.8,.35,1.7,accent,g);box(0,2.9,4.5,1.9,1.6,.25,accent,g);
    label(p.short,p.style,9,1.65,g,0,.82,5.2,{flat:true,size:76});
    g.userData.profileId=p.id;g.userData.suit=p.style;
  }
  // Low office furniture keeps the room open to the sky and preserves sightlines.
  for(const x of [-31.5,31.5])for(const z of [-21,2,25]){
    cyl(x,1.25,z,.92,1.15,walnut);cyl(x,2,z,.18,1.4,walnut);
    const leaves=mesh(new THREE.IcosahedronGeometry(1.65,1),green,x,3.05,z);leaves.scale.y=1.2;
  }
  const coffee=new THREE.Group();coffee.name='office-coffee-and-library';coffee.position.set(-24,0,-22);group.add(coffee);
  box(0,1.6,0,11,1.8,2.4,walnut,coffee);box(0,2.58,0,11.4,.17,2.6,pale,coffee);box(-2,3.28,0,1.9,1.3,1.4,ink,coffee);
  for(let i=0;i<5;i++)box(1+i*.65,3,-.25,.42,.8,1,mat(OFFICE_PROFILES[i].color),coffee);
  label('RESEARCH / COMMON','COFFEE  ·  FILINGS  ·  CONVERSATION',10.5,1.8,coffee,0,3.75,-.85,{size:66});
  label('THE BIG SHORT','CRYPTO RESEARCH LAB   /   OPEN-AIR OFFICE',27,5.8,group,0,.83,24.4,{flat:true,size:100});
  label('ORAL HISTORY','EVIDENCE  →  QUESTIONS  →  NEXT MOVES',11,2.2,group,0,1,-32,{flat:true,size:67});
  const paperBank=createPaperBank(group,{label});
  const unitSlots=Object.fromEntries(['melchior','balthasar','casper'].map(id=>[id,new THREE.Vector3(L[id].x,0,L[id].z+17.5)]));
  const campGroup=civic.group.getObjectByName('free-campus-common');
  let data={};
  function update(value={}){
    data=value;const slots=value.executorSlots??[];
    civic.update({...value,campus:{mode:'awake',dispatchMode:'free-15-3A',free:{chargingRoleIds:[],history:[]}},executorSlots:slots});
    // Hide original petals, service pads and RAM pods only in this copied scene.
    for(const child of civic.group.children)child.visible=child===campGroup||child.name.startsWith('campus-supercomputer-');
    base.armModel.group.visible=false;
    for(const desk of desks){const active=slots.some(s=>s.status==='running'&&s.roleId===desk.userData.profileId);desk.userData.active=active;}
  }
  function target(thread,elapsed=0){
    const p=OFFICE_BY_ID[thread.officeProfileId];if(!p)return null;
    const vec=v=>new THREE.Vector3(v.x,0,v.z);
    const cashTarget=paperBank.target(thread);if(cashTarget)return cashTarget;
    const seat=FREE_CAMPUS_SEATS[[0,2,4,6,9,11,13,15][p.index]];
    if(data.office?.council)return {position:vec({x:seat.x*.84,z:L.camp.z+(seat.z-L.camp.z)*.84}),look:vec(L.camp),activity:'talk'};
    if(thread.running&&unitSlots[thread.clusterId])return {position:unitSlots[thread.clusterId].clone(),look:vec(L[thread.clusterId]),activity:'office-work'};
    // All eight always retain a body. Social movement costs no model turns.
    const phase=Math.floor((elapsed+p.index*9)/22)%6;
    const other=OFFICE_PROFILES[(p.index+1)%8].desk;
    const options=[{position:{x:p.desk.x,z:p.desk.z+6.3},look:p.desk,activity:'board'},
      {position:seat,look:L.camp,activity:'talk'},
      {position:{x:other.x+5.5,z:other.z+5.5},look:other,activity:'talk'},
      {position:{x:-22+p.index*.8,z:-18},look:{x:-24,z:-22},activity:'snack'},
      {position:seat,look:L.camp,activity:'talk'},
      {position:{x:p.desk.x+5.4,z:p.desk.z-4},look:p.desk,activity:'stroll'}];
    const o=options[phase];return {...o,position:vec(o.position),look:vec(o.look)};
  }
  const obstacles=()=>[
    ...['melchior','balthasar','casper'].map(id=>({x:L[id].x,z:L[id].z,r:15.8,worksite:'magi-monument'})),
    {x:0,z:L.camp.z,r:2.3,worksite:'hearth'},
    {...BANK_POSITION,r:5.3,worksite:'paper-bank'},
    ...OFFICE_PROFILES.flatMap(p=>[-3,0,3].map(dx=>({x:p.desk.x+dx,z:p.desk.z,r:2.3,worksite:'office-desk'}))),
    ...[-7.25,7.25].map(x=>({x:L.board.x+x,z:L.board.z,r:.42,worksite:'board-post'})),
  ];
  const surfaceHeight=(x,z)=>Math.hypot(x,z-L.camp.z)<14?.9:Math.abs(x)<=34.5&&z>=-24.5&&z<=28.5?.67:Math.abs(x)<3.5&&z>-34&&z<-24?.85:null;
  update({});
  return {...base,profile:'financial-office',officeGroup:group,campusGroup:civic.group,cores:civic.cores,desks,
    camp:{...base.camp,group:campGroup},target,update,surfaceHeight,paperBank,
    clearings:()=>[{x:0,z:2,r:49},{x:0,z:-49,r:16},{...BANK_POSITION,r:10},...['melchior','balthasar','casper'].map(id=>({...L[id],r:22}))],
    obstacles,animate:(elapsed,agents)=>{civic.animate(elapsed,agents);paperBank.animate(elapsed,agents);},
    updateObservation:()=>({state:'disabled',reason:'Financial office has no hardware feed.'}),
    snapshot:()=>({scene:'financial-office',desks:desks.length,profiles:OFFICE_PROFILES.map(p=>({id:p.id,name:p.name,style:p.style,desk:p.desk})),camp:{...L.camp},units:['melchior','balthasar','casper'].map(id=>({id,x:L[id].x,z:L[id].z})),active:data.office?.active??0,hangar:false,crane:false}),
    dispose(){paperBank.dispose();base.dispose();civic.dispose();group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},
  };
}
