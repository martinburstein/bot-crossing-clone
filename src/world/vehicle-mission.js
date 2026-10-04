import * as THREE from 'three'

// Temporary visual work sites. They do not become earned buildings or world saves.
export function createVehicleMission(job, workerId) {
  const group=new THREE.Group();group.name=`mission-${workerId}`
  const mats={soil:new THREE.MeshStandardMaterial({color:0x503c30}),orange:new THREE.MeshStandardMaterial({color:0xe99a46}),
    white:new THREE.MeshStandardMaterial({color:0xeae4da}),light:new THREE.MeshBasicMaterial({color:0x80e9f1,transparent:true,opacity:.7}),
    meteor:new THREE.MeshStandardMaterial({color:0x9e5b32,emissive:0xe75818,emissiveIntensity:.55})}
  const add=(geo,key,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,mats[key]);m.position.set(x,y,z);group.add(m);return m}
  const ring=(r,key,x,z)=>{const m=add(new THREE.RingGeometry(r*.78,r,32),key,x,.035,z);m.rotation.x=-Math.PI/2;return m}
  const beacon=ring(2.8,'light',0,0);beacon.name='active-vehicle-beacon'
  const effects=[]
  const targets=[]
  if(job.operation==='drill') {
    if(job.id==='posts')for(const x of [-1.3,1.3]){ring(.62,'soil',x,3.1);const post=add(new THREE.CylinderGeometry(.12,.12,1.5,8),'white',x,.75,3.1);targets.push(post)}
    else if(job.id==='excavate')targets.push(add(new THREE.BoxGeometry(1.1,.09,3.4),'soil',0,.025,3))
    else for(const x of [-.6,.6])targets.push(add(new THREE.OctahedronGeometry(.32),'orange',x,.32,3))
    for(let i=0;i<6;i++)effects.push(add(new THREE.IcosahedronGeometry(.1),'orange',0,.2,3))
  } else if(['cargo','claw','report'].includes(job.operation)) {
    const crate=add(new THREE.BoxGeometry(job.operation==='report'?.45:1.1,.7,.8),'orange',0,.45,3.1);effects.push(crate)
    ring(1.3,'light',0,3.1)
  } else if(job.operation==='scan') {
    const scan=ring(4.2,'light',0,0);effects.push(scan)
    add(new THREE.CylinderGeometry(.07,.07,1.3,8),'white',0,.65,3)
  } else if(job.operation==='intercept') {
    const meteor=add(new THREE.IcosahedronGeometry(1.05,1),'meteor',0,18,9);meteor.name='incoming-large-meteor';effects.push(meteor)
    const beam=add(new THREE.CylinderGeometry(.045,.045,1,6),'light');beam.name='meteor-intercept-beam';effects.push(beam)
  }
  return {group,job,operating:false,threat:false,
    update(position,time,operating,reduced=false,height=0) {
      group.position.copy(position);group.position.y=position.y
      this.operating=operating
      beacon.scale.setScalar(reduced?1:1+Math.sin(time*2)*.06)
      // Use a local operation clock, so alerts do not fire during transit.
      if(job.operation==='intercept') {
        const phase=reduced?0:time%12, incoming=operating&&job.meteorAlert&&phase<8
        this.threat=incoming;effects[0].visible=incoming;effects[1].visible=incoming&&phase>6
        effects[0].position.set(6-phase*.45,16-phase*1.35,7-phase*.35)
        effects[0].scale.setScalar(phase>6?Math.max(.05,1-(phase-6)/2):1)
        const end=effects[0].position,start=new THREE.Vector3(0,1.1,0),delta=end.clone().sub(start)
        effects[1].position.copy(start).addScaledVector(delta,.5);effects[1].scale.y=delta.length();effects[1].quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())
      } else if(job.operation==='drill') {
        targets.forEach((m,i)=>{m.visible=operating;if(job.id==='posts')m.scale.y=reduced?1:.5+.5*Math.sin(time*.45+i)**2})
        effects.forEach((m,i)=>{m.visible=operating;m.position.x=Math.sin(time*3+i)*.9;m.position.y=reduced?.15:.12+(time*.8+i*.16)%1;m.position.z=3+Math.cos(time*2+i)*.5})
      } else if(job.operation==='scan') {
        effects[0].scale.setScalar(reduced?1:.65+(time*.2)%1*.6)
      } else if(effects[0]) {
        effects[0].position.z=operating?3.1:-1.2
        effects[0].position.y=operating?(reduced?.5:.5+Math.sin(time)*.18):height+.65
      }
    },
    dispose(){group.traverse(o=>o.geometry?.dispose());Object.values(mats).forEach(m=>m.dispose())},
  }
}
