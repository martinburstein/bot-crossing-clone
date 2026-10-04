import * as THREE from 'three'
import {Astronauts} from './astronauts.js'

// The same rig, worn equipment, scale and drive clip as a real colony pilot.
// This preview never joins the world roster or starts a MAGI rental.
export function createPilotPreview(scene,settings,rig) {
  const crew=new Astronauts(scene,settings);crew.setRig(rig)
  const seat=new THREE.Vector3(),thread={id:'pilot-preview',title:'Pilot fit',suitColor:0xf3f1ec,projectAccent:0xe9a45b}
  crew.setRoster([{id:thread.id,thread,status:'idle',site:seat,home:seat,anchor:seat,known:true}],{groundAt:()=>0,shipDoor:()=>seat})
  const agent=crew.agents[0];agent.mounted=true;agent.magiSeat=seat;agent.magiYaw=0
  return {group:crew.group,crew,agent,seat,
    update(time,position){seat.copy(position);crew.update(.016,time);agent.clipTime=time;crew._animate(agent,0,1);crew._writeMatrices(time,1)},
    points(){
      const points=[],matrix=new THREE.Matrix4(),m0=new THREE.Matrix4(),m1=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Vector3(),v=new THREE.Vector3()
      const frame=agent.frame,f0=Math.floor(frame),f1=Math.min(rig.frameCount-1,f0+1),alpha=frame-f0,data=rig.boneTexture.image.data,stride=rig.boneCount*16
      const geometry=crew.crew.geometry,pos=geometry.attributes.position,indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight
      crew.crew.getMatrixAt(0,matrix)
      for(let i=0;i<pos.count;i++){
        p.fromBufferAttribute(pos,i);v.set(0,0,0)
        for(let k=0;k<4;k++){
          const bone=indices.array[i*4+k],weight=weights.array[i*4+k];if(!weight)continue
          m0.fromArray(data,f0*stride+bone*16);m1.fromArray(data,f1*stride+bone*16)
          q.copy(p).applyMatrix4(m0).lerp(p.clone().applyMatrix4(m1),alpha);v.addScaledVector(q,weight)
        }
        points.push(v.clone().applyMatrix4(matrix))
      }
      for(const part of Object.values(crew.parts)){
        if(!part.count)continue;part.getMatrixAt(0,matrix)
        const vertices=part.geometry.attributes.position
        for(let i=0;i<vertices.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(matrix))
      }
      return points
    },
    dispose(){crew.dispose()},
  }
}
