import * as THREE from 'three'

const HELMET_Y=.46

/** True only for the fixed RoArm-campus pilot identity. */
export function isCampusPilot(thread) {
  return thread?.worldProfile==='roarm-campus'&&thread.roleId==='pilot'&&
    thread.workerId==='w00'&&thread.slotId==='melchior'
}

/**
 * Procedural blue/cyan fittings for the permanent campus pilot.
 * Add this group beside the astronaut instances and call update with that
 * frame's root, head-bone, and chest-bone matrices. The underlying approved
 * astronaut artwork stays visible; these are small, owned overlay details.
 */
export function createCampusPilotGear() {
  const gear=new THREE.Group()
  gear.name='campus-pilot-gear'
  const helmetFrame=new THREE.Group(),suitFrame=new THREE.Group()
  helmetFrame.name='campus-pilot-helmet-frame';suitFrame.name='campus-pilot-suit-frame'
  helmetFrame.matrixAutoUpdate=false;suitFrame.matrixAutoUpdate=false
  helmetFrame.visible=false;suitFrame.visible=false
  gear.add(helmetFrame,suitFrame)

  const geometries=new Set(),materials=new Set()
  const blue=new THREE.MeshStandardMaterial({color:0x28728e,metalness:.28,roughness:.32})
  const cyan=new THREE.MeshStandardMaterial({color:0x63e4f3,emissive:0x168ca3,emissiveIntensity:.72,metalness:.18,roughness:.25})
  const navy=new THREE.MeshStandardMaterial({color:0x183d58,metalness:.16,roughness:.4})
  materials.add(blue);materials.add(cyan);materials.add(navy)

  function mesh(parent,name,geometry,material,position) {
    geometries.add(geometry)
    const object=new THREE.Mesh(geometry,material)
    object.name=name;object.position.set(...position);object.castShadow=true;object.receiveShadow=true
    parent.add(object)
    return object
  }

  // The cyan equator sits just outside the ordinary 0.48-unit helmet shell,
  // making the pilot's silhouette a little larger without covering its face.
  mesh(helmetFrame,'campus-pilot-helmet-ring',new THREE.TorusGeometry(.515,.025,6,24),cyan,[0,HELMET_Y,0])
  for(const x of [-1,1]) {
    mesh(helmetFrame,`campus-pilot-helmet-ear-${x<0?'left':'right'}`,new THREE.BoxGeometry(.09,.19,.19),blue,[x*.47,HELMET_Y,.015])
    mesh(helmetFrame,`campus-pilot-eye-light-${x<0?'left':'right'}`,new THREE.SphereGeometry(.035,8,5),cyan,[x*.255,HELMET_Y+.015,.462])
  }
  mesh(helmetFrame,'campus-pilot-helmet-crown-stripe',new THREE.BoxGeometry(.08,.035,.26),blue,[0,.88,-.025])

  // Chest and shoulder accents follow the chest bone while leaving the suit,
  // pack, visor, and face artwork visible around them.
  mesh(suitFrame,'campus-pilot-chest-plate',new THREE.BoxGeometry(.43,.22,.045),navy,[0,.17,.345])
  mesh(suitFrame,'campus-pilot-chest-rank',new THREE.BoxGeometry(.055,.17,.025),cyan,[0,.17,.372])
  for(const x of [-1,1])mesh(suitFrame,`campus-pilot-shoulder-light-${x<0?'left':'right'}`,
    new THREE.SphereGeometry(.07,8,5),cyan,[x*.44,.16,.04])

  let disposed=false
  gear.update=(root,headBone,chestBone)=>{
    if(disposed)return
    if(!root?.isMatrix4||!headBone?.isMatrix4||!chestBone?.isMatrix4)
      throw new TypeError('Campus pilot gear requires root, head-bone, and chest-bone matrices')
    helmetFrame.matrix.multiplyMatrices(root,headBone);helmetFrame.matrixWorldNeedsUpdate=true;helmetFrame.visible=true
    suitFrame.matrix.multiplyMatrices(root,chestBone);suitFrame.matrixWorldNeedsUpdate=true;suitFrame.visible=true
  }
  gear.hide=()=>{helmetFrame.visible=false;suitFrame.visible=false}
  gear.dispose=()=>{
    if(disposed)return
    disposed=true;gear.visible=false;gear.removeFromParent()
    for(const geometry of geometries)geometry.dispose()
    for(const material of materials)material.dispose()
  }
  // Apply this to the pilot's root matrix before passing it to update; scaling
  // this attachment itself would also scale its bone-relative translations.
  gear.userData.characterScale=1.14
  return gear
}
