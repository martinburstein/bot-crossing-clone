import * as THREE from 'three'

const NEED = ['dispenser', 'computer', 'campfire', 'agents']
const CAPACITY = 30

/** Upright image memorials. Injected textures remain owned by the caller. */
export function createMemorialGarden({ memorials = [], readiness = {}, capacity = CAPACITY, seed = 'garden' } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('capacity must be a positive integer')
  const root = new THREE.Group(); root.name = 'Iteration memorial garden'
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe8e7df, roughness: .67, metalness: .08 })
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf5823a, roughness: .48, metalness: .16 })
  const footGeo = new THREE.CylinderGeometry(.48,.56,.22,12)
  const tabletShape = new THREE.Shape()
  tabletShape.moveTo(-.66,0); tabletShape.lineTo(.66,0); tabletShape.lineTo(.66,1.42); tabletShape.quadraticCurveTo(.66,1.82,0,1.82); tabletShape.quadraticCurveTo(-.66,1.82,-.66,1.42); tabletShape.closePath()
  const outerGeo = new THREE.ExtrudeGeometry(tabletShape,{depth:.13,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.055,bevelThickness:.055,curveSegments:10})
  const innerShape = new THREE.Shape()
  innerShape.moveTo(-.59,.07); innerShape.lineTo(.59,.07); innerShape.lineTo(.59,1.4); innerShape.quadraticCurveTo(.59,1.69,0,1.69); innerShape.quadraticCurveTo(-.59,1.69,-.59,1.4); innerShape.closePath()
  const innerGeo = new THREE.ExtrudeGeometry(innerShape,{depth:.06,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:10})
  const imageGeo = new THREE.PlaneGeometry(1.03,1.06)
  const entries = new Map(), overflowIds = new Set()
  let gates = Object.fromEntries(NEED.map(k=>[k,Boolean(readiness[k])])), disposed=false
  const positionFor = index => { const angle=index*2.399963229728653, radius=2.15+Math.sqrt(index)*1.38; return new THREE.Vector3(Math.cos(angle)*radius,0,Math.sin(angle)*radius) }
  const ready=()=>NEED.every(k=>gates[k])
  function addEntry(entry,{initial=false}={}) {
    if(!entry||typeof entry.id!=='string'||!entry.id||!Number.isInteger(entry.iteration)||entry.iteration<1) throw new Error('Memorial requires a stable id and positive integer iteration')
    if(entries.has(entry.id)) return false
    if(entries.size>=capacity) {overflowIds.add(entry.id);return false}
    const index=entries.size, group=new THREE.Group(); group.name=`Iteration ${entry.iteration} memorial`; group.userData={id:entry.id,iteration:entry.iteration,rising:!initial,riseProgress:initial?1:0}
    const foot=new THREE.Mesh(footGeo,stoneMat);foot.position.set(0,.12,0);foot.castShadow=true;foot.receiveShadow=true;group.add(foot)
    const outer=new THREE.Mesh(outerGeo,trimMat);outer.position.set(0,.22,0);outer.castShadow=true;outer.receiveShadow=true;group.add(outer)
    const inner=new THREE.Mesh(innerGeo,stoneMat);inner.position.set(0,.245,.14);inner.castShadow=true;inner.receiveShadow=true;group.add(inner)
    if(entry.texture?.isTexture){const art=new THREE.Mesh(imageGeo,new THREE.MeshBasicMaterial({map:entry.texture,side:THREE.DoubleSide,toneMapped:false}));art.position.set(0,1.14,.38);art.userData.textureCallerOwned=true;group.add(art)}
    const p=positionFor(index);group.position.set(p.x,initial?0:-2,p.z);group.rotation.y=(index%5)*.09;group.visible=ready()
    root.add(group);entries.set(entry.id,{entry,group});return true
  }
  // Synchronously supplied archive entries are historical and appear settled.
  for(const entry of memorials)addEntry(entry,{initial:true})
  const refreshVisibility=()=>{for(const {group} of entries.values()){group.visible=ready();if(!ready()&&group.userData.rising&&!group.userData.riseComplete)group.position.y=-2+2*group.userData.riseProgress}}
  root.userData.setReadiness=flags=>{for(const k of NEED)if(k in (flags??{}))gates[k]=Boolean(flags[k]);root.userData.readiness={...gates};refreshVisibility();return ready()}
  root.userData.setMemorials=(list,{initial=false}={})=>{
    if(!Array.isArray(list))throw new Error('memorials must be an ordered array')
    overflowIds.clear()
    for(const entry of list)addEntry(entry,{initial})
    root.userData.count=entries.size;root.userData.overflow=overflowIds.size;return root.userData.count
  }
  root.userData.update=dt=>{
    if(disposed||root.userData.paused||root.userData.reducedMotion||!ready()||!Number.isFinite(dt)||dt<=0)return
    const step=Math.min(dt,.05)
    for(const {group} of entries.values())if(group.userData.rising&&!group.userData.riseComplete){const t=Math.min(1,group.userData.riseProgress+step/1.05);group.userData.riseProgress=t;group.position.y=-2*(1-t);if(t===1){group.userData.riseComplete=true;group.position.y=0}}
  }
  root.userData.setPaused=value=>{root.userData.paused=Boolean(value)}
  root.userData.setReducedMotion=value=>{root.userData.reducedMotion=Boolean(value);if(value)for(const {group} of entries.values())if(group.userData.rising){group.position.y=0;group.userData.riseProgress=1;group.userData.riseComplete=true}}
  root.userData.readiness={...gates};root.userData.capacity=capacity;root.userData.count=entries.size;root.userData.overflow=overflowIds.size;root.userData.entries=entries
  root.userData.dispose=()=>{if(disposed)return;disposed=true;root.traverse(o=>{if(o.isMesh&&o.material!==stoneMat&&o.material!==trimMat)o.material?.dispose?.()});footGeo.dispose();outerGeo.dispose();innerGeo.dispose();imageGeo.dispose();stoneMat.dispose();trimMat.dispose();entries.clear()}
  void seed
  return root
}
