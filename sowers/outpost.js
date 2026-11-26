import * as THREE from 'three'

const C = { white: 0xe8e7df, orange: 0xf5823a, amber: 0xf5b84b, dark: 0x26333a, steel: 0x7e8889, screen: 0x182c48 }
const REQUIRED = ['dispenser', 'computer', 'campfire', 'agents']

/** A self-contained, presentation-only mission outpost. Ground is y=0. */
export function createSowerOutpost({ seed = 'Sowers' } = {}) {
  const root = new THREE.Group(); root.name = `Sower outpost · ${seed}`
  const shared = Object.fromEntries(Object.entries(C).map(([k, color]) => [k, new THREE.MeshStandardMaterial({ color, roughness: k === 'screen' ? .3 : .58, metalness: k === 'steel' ? .65 : .18, emissive: k === 'amber' ? color : 0, emissiveIntensity: k === 'amber' ? .22 : 0 })]))
  const own = []
  const mesh = (geo, mat, pos, parent = root) => { const m = new THREE.Mesh(geo, shared[mat]); m.position.set(...pos); m.castShadow = true; m.receiveShadow = true; parent.add(m); own.push(geo); return m }
  const box = (w,h,d,mat,x,y,z,parent) => mesh(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],parent)
  const cyl = (r,h,mat,x,y,z,n=12,parent) => mesh(new THREE.CylinderGeometry(r,r,h,n),mat,[x,y,z],parent)
  const beam = (a,b,r,mat='steel') => { const A=new THREE.Vector3(...a), B=new THREE.Vector3(...b), d=B.clone().sub(A), m=mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat,A.add(B).multiplyScalar(.5).toArray()); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return m }

  // Seed nest/dispenser: broad deck borne by three stout, splayed legs.
  const deck=5.2, rise=deck-2.38
  cyl(2.25,.22,'dark',0,deck,-1,16); cyl(2.08,.16,'white',0,deck+.18,-1,16); cyl(1.82,.14,'orange',0,deck+.34,-1,16)
  for (let i=0;i<3;i++) { const a=i*Math.PI*2/3-Math.PI/2, x=Math.cos(a), z=-1+Math.sin(a); beam([x*1.65,.12,z],[x*.92,deck-.04,-1+(z+1)*.5],.16,'steel'); cyl(.31,.16,'orange',x*1.68,.1,z,10) }
  cyl(.76,.38,'white',0,deck+.62,-1,16); cyl(.58,.16,'orange',0,deck+.89,-1,16); cyl(.33,.11,'amber',0,deck+1.03,-1,16)
  const sockets=[],releasePositions=[]
  for(let i=0;i<3;i++) { const x=(i-1)*1.15; box(.78,.12,.66,'dark',x,deck+.48,1.3); const chute=box(.58,.82,.16,'white',x,deck-.03,1.43); chute.rotation.x=-.18; box(.64,.1,.2,'orange',x,deck-.46,1.45); const disk=cyl(.37,.09,'orange',x,deck+.69,1.02,20); disk.rotation.x=Math.PI/2; const face=cyl(.32,.1,'white',x,deck+.69,1.09,20); face.rotation.x=Math.PI/2
    // Paired seven-segment digits 01, 02, 03 on vertical, front-facing circles.
    const segs=[[-.04,.075,.09,.022],[.025,.037,.022,.055],[.025,-.037,.022,.055],[-.04,-.075,.09,.022],[-.105,-.037,.022,.055],[-.105,.037,.022,.055],[-.04,0,.09,.022]]
    const sets=[[0,1,2,3,4,5],[1,2],[0,1,6,4,3],[0,1,6,2,3]]
    const glyphs=[[0,1],[0,2],[0,3]][i]
    for(let digit=0;digit<2;digit++)for(const j of sets[glyphs[digit]]) { const [dx,dy,w,h]=segs[j]; box(w,h,.025,'dark',x+dx+(digit===0?-.105:.105),deck+.69+dy,1.152) }
    sockets.push(new THREE.Vector3(x,.1,1.9));releasePositions.push(new THREE.Vector3(x,deck-.28,1.9)); void chute
  }
  // Sol supercomputer: unmistakably original, three broad angled display panels.
  const computer=new THREE.Group(); computer.position.set(-7,0,-4); root.add(computer)
  box(3.1,.42,2.1,'dark',0,.28,0,computer); box(2.85,.16,1.9,'white',0,.55,0,computer)
  for(let i=0;i<3;i++) { const x=(i-1)*.9; const panel=box(.78,1.28,.12,'screen',x,1.48,-.35,computer); panel.rotation.z=(1-i)*.12; box(.66,.055,.04,'amber',x,1.77,-.275,computer); for(let k=0;k<3;k++) box(.46,.035,.035,k===i?'orange':'white',x-.07,1.53-k*.17,-.27,computer); cyl(.07,.07,'amber',x,.71,.42,8,computer) }
  const antenna=beam([-7,.72,-4],[-7,2.25,-4],.045,'orange'); cyl(.12,.12,'amber',-7,2.32,-4,10)
  // Campfire and three physical meeting stools.
  cyl(1.12,.2,'dark',0,.1,7,20); cyl(.85,.12,'steel',0,.25,7,20)
  const logs=[]; for(let i=0;i<3;i++){const log=beam([-0.45,.38,6.7+i*.28],[.45,.38,7.3-i*.28],.095,'orange'); logs.push(log)}
  const flameMat=new THREE.MeshStandardMaterial({color:0xff8a32,emissive:0xff5b15,emissiveIntensity:.85,roughness:.35}); const flameGeo=new THREE.ConeGeometry(.34,.92,8); const flame= new THREE.Mesh(flameGeo,flameMat); flame.position.set(0,.82,7); root.add(flame); own.push(flameGeo)
  const agentSeats=[]
  for(let i=0;i<3;i++){const a=i*2*Math.PI/3-Math.PI/2,x=Math.cos(a),z=7+Math.sin(a); cyl(.28,.3,'white',x*1.85,.2,z,10); cyl(.32,.08,'orange',x*1.85,.38,z,10); agentSeats.push(box(.38,.07,.38,'dark',x*1.85,.44,z))}
  const bounds = new THREE.Box3(new THREE.Vector3(-9.2,0,-6.5),new THREE.Vector3(3.8,deck+1.1,9.2))
  const readiness={dispenser:false,computer:false,campfire:false,agents:false}
  root.userData.socketPositions=sockets;root.userData.releasePositions=releasePositions;root.userData.meetingPositions=[0,1,2].map(i=>new THREE.Vector3(Math.cos(i*2*Math.PI/3-Math.PI/2)*1.85,.55,7+Math.sin(i*2*Math.PI/3-Math.PI/2)))
  root.userData.bounds=bounds; root.userData.sourceStations=[new THREE.Vector3(-10,0,3),new THREE.Vector3(1,0,-10),new THREE.Vector3(12,0,4)]
  root.userData.readiness={...readiness}; root.userData.phase='work'; root.userData.paused=false; root.userData.reducedMotion=false
  const consoleScreens=computer.children.filter(o=>o.isMesh&&o.material===shared.screen)
  const fireReadiness=()=>{shared.orange.emissive.setHex(readiness.dispenser?0xf5823a:0);shared.orange.emissiveIntensity=readiness.dispenser ? .3 : 0;shared.screen.emissive.setHex(readiness.computer?0x285f72:0);shared.screen.emissiveIntensity=readiness.computer ? .42 : 0;flameMat.emissiveIntensity=readiness.campfire ? .95 : .2;for(const seat of agentSeats)seat.material=readiness.agents?shared.amber:shared.white}
  root.userData.setReadiness=(flags={})=>{ if(Array.isArray(flags)){for(const k of REQUIRED)readiness[k]=flags.includes(k)} else for(const k of REQUIRED)if(k in flags)readiness[k]=Boolean(flags[k]); root.userData.readiness={...readiness};fireReadiness();return {...readiness} }
  root.userData.setPhase=phase=>{if(!['work','review','rest'].includes(phase))throw new Error('phase must be work, review, or rest');root.userData.phase=phase;const review=phase==='review',rest=phase==='rest';for(const screen of consoleScreens)screen.material.emissive.setHex(review?0x3e744a:rest?0x283c4a:(readiness.computer?0x285f72:0));flameMat.color.setHex(review?0xffc05a:rest?0xe67d34:0xff8a32);flameMat.emissive.setHex(review?0xffa72c:0xff5b15);flameMat.emissiveIntensity=review?1.2:rest ? .42 : (readiness.campfire ? .95 : .2)}
  root.userData.animate=(time,{paused=root.userData.paused,reducedMotion=root.userData.reducedMotion}={})=>{if(paused||reducedMotion)return; flame.scale.set(1+.08*Math.sin(time*7),1+.1*Math.sin(time*9),1+.08*Math.sin(time*7)); flame.rotation.y=.12*Math.sin(time*3)}
  let disposed=false
  root.userData.dispose=()=>{if(disposed)return;disposed=true;for(const g of own)g.dispose(); for(const m of Object.values(shared))m.dispose();flameMat.dispose()}
  return root
}
