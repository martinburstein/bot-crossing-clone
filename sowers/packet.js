import * as THREE from 'three'
import { createCandySower } from './candy/mascot.js'

const clamp = (v,a,b) => Math.max(a,Math.min(b,v))
const finite = (v,d) => Number.isFinite(v) ? v : d

/** Numbered, disposable nest packet. Opening is opt-in: use setProgress(0..1)
 * or startOpening()/update(dt). No dispatch, spawning, or task semantics. */
export function createSowerPacket({ number = 1, color = 0x57c9bd, seed = 1, includeCandy = true } = {}) {
  const id = clamp(Math.trunc(finite(number,1)),1,99)
  const root = new THREE.Group(); root.name = `Sower packet ${String(id).padStart(2,'0')}`
  const foil = new THREE.MeshStandardMaterial({ color, roughness:.38, metalness:.28 })
  const seamMat = new THREE.MeshStandardMaterial({ color:0xf2d77c, roughness:.5, metalness:.2 })
  const labelMat = new THREE.MeshStandardMaterial({ color:0xfff5dc, roughness:.6 })
  const inkMat = new THREE.MeshStandardMaterial({ color:0x24363b, roughness:.7 })
  const candy = includeCandy ? createCandySower({ color, seed, variant:'scout' }) : null
  if(candy) { candy.scale.setScalar(.34); candy.position.set(0,.14,.12); root.add(candy) }
  const body = new THREE.Group(); root.add(body)
  const wrapper = new THREE.Mesh(new THREE.BoxGeometry(.48,.66,.18),foil); wrapper.position.y=.37; wrapper.castShadow=true; body.add(wrapper)
  const fold = new THREE.Mesh(new THREE.BoxGeometry(.52,.09,.2),seamMat); fold.position.set(0,.75,0); fold.castShadow=true; root.add(fold)
  // Folded side crimps give the wrapper a recognizable sealed foil silhouette.
  for (const side of [-1,1]) { const crimp=new THREE.Mesh(new THREE.BoxGeometry(.07,.72,.19),seamMat); crimp.position.set(side*.25,.37,0); crimp.castShadow=true; body.add(crimp) }
  const disk = new THREE.Mesh(new THREE.CircleGeometry(.145,24),labelMat); disk.position.set(0,.39,.215); body.add(disk)
  // Seven-segment numerals are geometry, so labels work in browser and Node.
  const digitSegments = [[0,1,2,3,4,5],[1,2],[0,1,6,4,3],[0,1,6,2,3],[5,6,1,2],[0,5,6,2,3],[0,5,6,4,2,3],[0,1,2],[0,1,2,3,4,5,6],[0,1,2,3,5,6]]
  const bars = []
  for (let place=0; place<2; place++) {
    const digit = Math.floor(id / (place===0 ? 10 : 1)) % 10, cx=(place===0 ? -.038 : .038)
    const coords=[[0,.042],[.022,.022],[.022,-.022],[0,-.042],[-.022,-.022],[-.022,.022],[0,0]]
    for (const segment of digitSegments[digit]) { const [x,y]=coords[segment], horizontal=segment===0||segment===3||segment===6; const bar=new THREE.Mesh(new THREE.BoxGeometry(horizontal?.032:.009,horizontal?.009:.032,.004),inkMat);bar.position.set(cx+x,.39+y,.22);bars.push({mesh:bar,offsetY:y});body.add(bar) }
  }
  let progress=0, playing=false, disposed=false
  function render() {
    fold.rotation.x = -Math.PI*.48*progress
    // The wrapper peels down and its side crimps part, exposing a rising
    // canonical Scout. At group scale 3, the candy is ~1.85 units tall.
    wrapper.position.y=.37-.28*progress;wrapper.scale.set(1-.12*progress,Math.max(.12,1-.8*progress),1)
    disk.position.y=.39-.14*progress;for(const {mesh,offsetY} of bars)mesh.position.y=disk.position.y+offsetY
    foil.transparent=progress>.2;foil.opacity=1-.55*progress;foil.depthWrite=progress<.2
    for(const [index,side] of [-1,1].entries()) { const crimp=body.children[index+1]; if(crimp) { crimp.position.set(side*(.25+.025*progress),.37-.3*progress,0);crimp.scale.y=Math.max(.03,1-1.35*progress);crimp.rotation.z=side*.08*progress } }
    if(candy) { candy.position.y=.14+.58*progress;candy.visible=progress>.12 }
    body.visible = progress < 1
    root.userData.openingProgress = progress
    root.userData.openingState = progress >= 1 ? 'empty' : progress >= .62 ? 'open' : progress > 0 ? 'peeling' : 'sealed'
  }
  const api = {
    group:root,
    get state() { return root.userData.openingState },
    get progress() { return progress },
    setProgress(value) { if(disposed)return this; progress=clamp(finite(value,progress),0,1);render();return this },
    startOpening() { playing=true;return this },
    pauseOpening() { playing=false;return this },
    update(dt,{paused=false,reducedMotion=false}={}) { if(playing&&!paused&&!reducedMotion) progress=clamp(progress+clamp(finite(dt,0),0,.05)*.9,0,1);render();return this },
    dispose() { if(disposed)return;disposed=true;const materials=new Set();root.traverse(o=>{if(o.geometry)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m)});for(const m of materials)m.dispose();root.clear();playing=false },
  }
  render()
  root.userData.seed = seed
  root.userData.includesCandy = Boolean(candy)
  // Capture honest local bounds for the sealed wrapper and the union of that
  // wrapper with the fully raised 1.85-unit Scout. Values are computed once.
  root.updateMatrixWorld(true)
  const sealedBox=new THREE.Box3().setFromObject(root)
  const boxRecord=box=>Object.freeze({min:Object.freeze(box.min.toArray()),max:Object.freeze(box.max.toArray()),width:box.max.x-box.min.x,height:box.max.y-box.min.y,depth:box.max.z-box.min.z})
  const sealedBounds=boxRecord(sealedBox)
  if(candy) { candy.visible=true;candy.position.y=.72;root.updateMatrixWorld(true) }
  const fullBox=new THREE.Box3().setFromObject(root).union(sealedBox)
  root.userData.bounds=Object.freeze({sealed:sealedBounds,full:boxRecord(fullBox)})
  render()
  return api
}
