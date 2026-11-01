import * as THREE from 'three'

// Small original procedural crew. No private assets or external image services.
export function createResearcher(profile,index) {
 const root=new THREE.Group();root.name=`researcher-${profile.id}`;root.userData.roleId=profile.id
 const suit=new THREE.MeshStandardMaterial({color:profile.color,roughness:.68})
 const cream=new THREE.MeshStandardMaterial({color:0xf1ebd8,roughness:.8})
 const dark=new THREE.MeshStandardMaterial({color:0x263e40,roughness:.52})
 const visor=new THREE.MeshStandardMaterial({color:0x19383f,roughness:.19,metalness:.32})
 const light=new THREE.MeshStandardMaterial({color:0xbaf6db,emissive:0x89ceb5,emissiveIntensity:.45})
 const metal=new THREE.MeshStandardMaterial({color:0xa9b9af,metalness:.5,roughness:.4})
 const add=(g,m,x,y,z,parent=root)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const box=(w,h,d,m,x,y,z,p)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,p)
 const ball=(r,m,x,y,z,p)=>add(new THREE.SphereGeometry(r,16,12),m,x,y,z,p)
 const pill=(r,l,m,x,y,z,p)=>add(new THREE.CapsuleGeometry(r,l,4,10),m,x,y,z,p)
 pill(.54,.78,suit,0,1.85,0);box(.88,.45,.16,cream,0,2.13,.49)
 const belt=add(new THREE.CylinderGeometry(.56,.57,.17,18),dark,0,1.42,0)
 box(.22,.15,.12,metal,0,1.43,.57)
 const legs=[];const arms=[]
 for(const sign of [-1,1]){
  const leg=new THREE.Group();leg.position.set(sign*.34,1.35,0);root.add(leg);legs.push(leg)
  pill(.24,.64,suit,0,-.55,0,leg);ball(.25,cream,0,-.65,.12,leg);box(.49,.34,.76,dark,0,-1.16,.17,leg)
  const arm=new THREE.Group();arm.position.set(sign*.67,2.22,0);root.add(arm);arms.push(arm)
  ball(.30,suit,0,0,0,arm);pill(.19,.60,suit,sign*.12,-.48,0,arm);ball(.22,dark,sign*.12,-.94,.02,arm)
 }
 const head=new THREE.Group();head.position.y=3.03;root.add(head)
 ball(.85,cream,0,0,0,head);const face=ball(.72,visor,0,-.02,.42,head);face.scale.set(1,.77,.66)
 const ring=add(new THREE.TorusGeometry(.76,.065,7,32),suit,0,-.03,.54,head);ring.scale.y=.84
 for(const x of [-.24,.24]){const eye=ball(.075,light,x,.03,.89,head);eye.scale.y=1.35}
 const mouth=add(new THREE.TorusGeometry(.14,.024,5,14,Math.PI*.70),light,0,-.20,.90,head);mouth.rotation.z=Math.PI*1.15
 add(new THREE.CylinderGeometry(.48,.50,.20,20),dark,0,2.47,0)
 box(.83,.94,.43,suit,0,1.99,-.60);box(.50,.55,.08,cream,0,2.02,-.85)
 for(const x of [-.55,.55])pill(.14,.47,metal,x,1.99,-.62)
 // Role-specific equipment changes silhouette as well as colour.
 const g=new THREE.Group();g.name=`role-gear-${profile.gear}`;root.add(g)
 if(['sun','snow'].includes(profile.gear)){
  box(.64,.30,.10,profile.gear==='sun'?suit:light,0,3.85,0,g)
  for(const x of [-.20,0,.20])box(.035,.26,.05,cream,x,3.85,.08,g)
 }else if(profile.gear==='tank'){
  for(const x of [-.30,.30])pill(.22,.85,cream,x,2.01,-.94,g)
 }else if(profile.gear==='shield'){
  const plate=add(new THREE.CylinderGeometry(.45,.36,.12,6),suit,-.89,1.72,.16,g);plate.rotation.z=Math.PI/2
 }else if(['sensor','orbit'].includes(profile.gear)){
  pill(.035,.47,metal,.59,3.79,-.08,g);ball(.13,profile.gear==='sensor'?light:suit,.59,4.10,-.08,g)
 }else if(['weave','patch','review'].includes(profile.gear)){
  box(.68,.78,.09,cream,-.92,1.52,.32,g);for(let i=0;i<3;i++)box(.44,.035,.02,suit,-.92,1.75-i*.15,.38,g)
 }else if(profile.gear==='hand'){
  for(const sign of [-1,1])box(.29,.33,.30,cream,sign*.79,1.25,.07,g)
 }else if(profile.gear==='dust'){
  box(.90,.17,.65,suit,0,3.52,.71,g)
 }else if(profile.gear==='leaf'){
  const leaf=ball(.22,suit,.58,3.70,0,g);leaf.scale.set(.45,1.5,.45)
 }else if(profile.gear==='joint'){
  for(const sign of [-1,1])ball(.26,metal,sign*.34,.69,.20,g)
 }else{
  box(.56,.56,.18,dark,.84,1.65,.15,g);ball(.14,light,.84,1.65,.27,g)
 }
 const halo=add(new THREE.TorusGeometry(1.05,.035,6,40),new THREE.MeshBasicMaterial({color:profile.color,transparent:true,opacity:.6}),0,.035,0);halo.rotation.x=-Math.PI/2
 root.scale.setScalar(1.55)
 return {root,profile,legs,arms,head,halo,index,position:new THREE.Vector3(),target:new THREE.Vector3(),
  animate(t,moving,assigned){
   const speed=moving?4:1.3;const swing=moving ? .38 : .045
   legs.forEach((l,i)=>l.rotation.x=Math.sin(t*speed+index+i*Math.PI)*swing)
   arms.forEach((a,i)=>a.rotation.x=assigned?-.65+Math.sin(t*2+index+i)*.09:Math.sin(t*speed+index+i*Math.PI)*swing*.6)
   head.rotation.y=Math.sin(t*.65+index)*.11;root.position.y=moving?Math.abs(Math.sin(t*speed+index))*.10:.03*Math.sin(t*1.7+index)
  }}
}
