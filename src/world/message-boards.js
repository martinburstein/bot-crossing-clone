import * as THREE from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {PLOT_CELL,shipPosition} from './plots.js'

// Painted hull panels, brushed supports, beveled toy proportions: same vocabulary
// as the lander and Space Base Bits, modeled here without external model assets.
export function createMessageBoard(color=0xb8bebc){
  const group=new THREE.Group(),bins=new Map()
  const add=(geometry,color,x,y,z)=>{
    if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose()}
    geometry.deleteAttribute('uv');geometry.deleteAttribute('normal')
    geometry.translate(x,y,z)
    if(!bins.has(color))bins.set(color,[])
    bins.get(color).push(geometry)
  }
  const box=(w,h,d,x,y,z,c)=>add(new RoundedBoxGeometry(w,h,d,2,.06),c,x,y,z)
  for(const x of [-.94,.94]){
    box(.55,.18,.85,x,.14,0,0x8f9299)
    box(.19,1.95,.21,x,1.12,0,0x8f9299)
  }
  box(2.8,1.85,.32,0,2.36,0,color)
  box(2.47,1.47,.35,0,2.33,0,0x35444b)
  box(2.55,.18,.38,0,3.26,0,0xf0ece4)
  // Notes on both sides keep the object legible when the camera orbits.
  for(const side of [-1,1]){
    for(const [x,y,angle] of [[-.73,2.49,-.07],[0,2.37,.06],[.73,2.52,-.04]]){
      const paper=new THREE.BoxGeometry(.58,.77,.025)
      paper.rotateZ(angle);add(paper,0xf0ece4,x,y,side*.193)
      add(new THREE.SphereGeometry(.055,6,4),color,x,y+.29,side*.225)
      for(let row=0;row<3;row++)box(.34-row*.045,.032,.018,x,y+.1-row*.14,side*.215,0x91a1a6)
    }
    box(.6,.09,.025,.83,1.62,side*.22,color)
  }
  for(const [c,parts] of bins){
    const geo=mergeGeometries(parts);geo.computeVertexNormals()
    const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:c,roughness:.58,metalness:c===0x8f9299?.35:.05}))
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)
    for(const p of parts)p.dispose()
  }
  group.userData.dispose=()=>group.traverse(o=>{o.geometry?.dispose();o.material?.dispose()})
  return group
}

export function boardPositions(shells,plots){
  const result=[],ship=shipPosition(),centers=plots.flatMap(p=>p.localCenters.map(c=>({x:p.center.x+c.x,z:p.center.z+c.z})))
  for(const shell of [...shells].sort((a,b)=>a.shellId.localeCompare(b.shellId))){
    const plot=plots.find(p=>p.name===shell.project);if(!plot)continue
    const home=plot.center,base=Math.atan2(-home.z,-home.x)
    const candidates=[]
    for(const radius of [9.8,11,12.5])for(let j=0;j<24;j++){
      const angle=base+((j%2?1:-1)*Math.ceil(j/2))*Math.PI/12
      const x=home.x+Math.cos(angle)*radius,z=home.z+Math.sin(angle)*radius
      const clearance=Math.min(...centers.map(c=>Math.hypot(c.x-x,c.z-z)-PLOT_CELL),
        Math.hypot(ship.x-x,ship.z-z)-6,...result.map(c=>Math.hypot(c.x-x,c.z-z)-2))
      candidates.push({x,z,clearance,score:j*.08+(radius-9.8)})
    }
    const valid=candidates.filter(c=>c.clearance>1.65)
    const best=valid.sort((a,b)=>a.score-b.score)[0] || candidates.sort((a,b)=>b.clearance-a.clearance)[0]
    result.push({id:shell.shellId,color:shell.suitColor,x:best.x,z:best.z})
  }
  // Beside the lander, offset across its ramp so arrivals have a clear path.
  const angle=Math.atan2(-ship.z,-ship.x)+Math.PI/2
  result.push({id:'global',color:0xb8bebc,x:ship.x+Math.cos(angle)*6.4,z:ship.z+Math.sin(angle)*6.4})
  return result
}

export class MessageBoards {
  constructor(scene){this.scene=scene;this.boards=new Map();this.ray=new THREE.Raycaster()}
  sync(shells,plots){
    const wanted=shells.length?boardPositions(shells,plots):[]
    for(const [id,g] of this.boards)if(!wanted.some(b=>b.id===id)){this.scene.remove(g);g.userData.dispose();this.boards.delete(id)}
    for(const spec of wanted){
      let g=this.boards.get(spec.id)
      if(!g){g=createMessageBoard(spec.color);g.name='message-board-'+spec.id;g.userData.boardId=spec.id;this.scene.add(g);this.boards.set(spec.id,g)}
      g.position.set(spec.x,.18,spec.z);g.rotation.y=Math.PI/4
    }
  }
  pick(camera,x,y){
    this.ray.setFromCamera(new THREE.Vector2(x,y),camera)
    const hit=this.ray.intersectObjects([...this.boards.values()],true)[0]
    let o=hit?.object
    while(o&&!o.userData.boardId)o=o.parent
    return o?.userData.boardId||null
  }
}
