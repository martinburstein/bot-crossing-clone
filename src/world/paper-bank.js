import * as THREE from 'three';
import {OFFICE_BY_ID} from '../office/profiles.js';
import {bankSummary} from '../office/paper-bank.js';
export const BANK_POSITION=Object.freeze({x:49,z:2}),BANK_APPROACH=Object.freeze({x:49,z:9.3});
export const BRICK_SIZE=Object.freeze({x:.76,y:.26,z:.46});
export function createPaperBank(parent,{label}){
  const group=new THREE.Group();group.name='paper-capital-bank';parent.add(group);
  const resources=[],add=(geometry,material,x,y,z,name)=>{const o=new THREE.Mesh(geometry,material);o.name=name;o.position.set(x,y,z);group.add(o);resources.push(geometry,material);return o;};
  const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.12,...extra});
  const {x,z}=BANK_POSITION;
  add(new THREE.CylinderGeometry(6.2,6.2,.28,64),material(0xc5c7b9),x,.15,z,'ground-bank-pad');
  add(new THREE.CylinderGeometry(5.05,5.05,.4,64),material(0x284d3d,{metalness:.4}),x,.48,z,'bank-plinth');
  const glass=add(new THREE.CylinderGeometry(4.8,4.8,4.1,64,1,true),new THREE.MeshPhysicalMaterial({color:0xc6f3e6,transparent:true,opacity:.13,roughness:.12,metalness:0,side:THREE.DoubleSide,depthWrite:false}),x,2.7,z,'clear-ground-container');glass.renderOrder=4;
  for(const y of [.71,4.75]){const ring=add(new THREE.TorusGeometry(4.8,.075,8,64),material(0xd5dcd3,{metalness:.65}),x,y,z,'bank-glass-rim');ring.rotation.x=Math.PI/2;}
  for(const dx of [-3.4,3.4])add(new THREE.BoxGeometry(.06,4.1,.06),material(0xb5d5c9),x+dx,2.7,z+3.38,'glass-edge-highlight');
  const plate=label('$137,000','$1,000 PER BRICK · PAPER CAPITAL',10,2.25,group,x,1.3,z+5.1,{size:100});
  const counter=label('137 BRICKS','AVAILABLE FOR SIMULATION',9,1.55,group,x,5.8,z,{size:80});
  const cashMaterial=material(0x4e9b5e,{roughness:.83,metalness:0});
  const cashGeo=new THREE.BoxGeometry(BRICK_SIZE.x,BRICK_SIZE.y,BRICK_SIZE.z),bandGeo=new THREE.BoxGeometry(.115,BRICK_SIZE.y+.006,BRICK_SIZE.z+.006),bandMaterial=material(0xc9d5ac,{roughness:.9,metalness:0});
  const bricks=new THREE.InstancedMesh(cashGeo,cashMaterial,137),bands=new THREE.InstancedMesh(bandGeo,bandMaterial,137);bricks.name='137-money-green-principal-bricks';bands.name='paper-cash-bands';bricks.castShadow=true;bricks.frustumCulled=bands.frustumCulled=false;parent.add(bricks,bands);resources.push(cashGeo,cashMaterial,bandGeo,bandMaterial);
  let state=null,lastRevision=-1;const m=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),one=new THREE.Vector3(1,1,1),e=new THREE.Euler();
  function target(thread){const job=state?.jobs.find(j=>j.profileId===thread.officeProfileId&&j.stage!=='closed');if(!job)return null;const p=OFFICE_BY_ID[job.profileId],bank=['collecting','carrying-back'].includes(job.stage);return {position:new THREE.Vector3(bank?BANK_APPROACH.x:p.desk.x,0,bank?BANK_APPROACH.z:p.desk.z+6.3),look:new THREE.Vector3(bank?x:p.desk.x,0,bank?z:p.desk.z),activity:['carrying','carrying-back'].includes(job.stage)?'cash-carry':job.stage==='running'?'cash-simulate':job.stage==='complete'?'board':'cash-collect'};}
  function update(next){state=next;if(state?.revision!==lastRevision){lastRevision=state?.revision;const s=state&&bankSummary(state);if(s)counter?.userData.draw(`${s.available.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})} AVAILABLE`,`${s.atBank} IN BANK · ${s.carried} CARRIED · ${s.atDesks} ON DESKS`);}}
  function animate(elapsed,agents){
    if(!state)return;
    for(const b of state.bricks){
      const job=b.owner?state.jobs.find(j=>j.id===b.owner):null,agent=job&&agents.find(a=>a.thread.officeProfileId===job.profileId);let yaw=0;
      if(b.place==='carried'&&agent?.officeSuit?.carryMatrix){m.copy(agent.officeSuit.carryMatrix);bricks.setMatrixAt(b.id,m);bands.setMatrixAt(b.id,m);continue;}
      if(b.place==='carried'&&agent){yaw=agent.yaw;v.set(agent.pos.x+Math.sin(yaw)*.53,agent.pos.y+1.02,agent.pos.z+Math.cos(yaw)*.53);}
      else if(b.place==='desk'&&job){const p=OFFICE_BY_ID[job.profileId],i=job.bricks.indexOf(b.id);v.set(p.desk.x-.95+(i%4)*.83,2.98+Math.floor(i/16)*.28,p.desk.z+.1+(Math.floor(i/4)%4)*.52);}
      else{const i=b.id;v.set(x-2.64+(i%7)*.88,.88+Math.floor(i/35)*.29,z-1.16+(Math.floor(i/7)%5)*.58);yaw=((i*17)%7-3)*.045;}
      e.set(0,yaw,0);q.setFromEuler(e);m.compose(v,q,one);bricks.setMatrixAt(b.id,m);bands.setMatrixAt(b.id,m);
    }
    bricks.instanceMatrix.needsUpdate=bands.instanceMatrix.needsUpdate=true;
  }
  return {group,bricks,target,update,animate,approach:BANK_APPROACH,snapshot:()=>state?{...bankSummary(state),revision:state.revision,jobs:state.jobs}:null,dispose(){group.removeFromParent();bricks.removeFromParent();bands.removeFromParent();new Set(resources).forEach(r=>r.dispose());}};
}
