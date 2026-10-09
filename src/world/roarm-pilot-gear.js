import * as THREE from 'three'

/** Procedural captain fittings for the dedicated RoArm-16 Melchior pilot. */
export function createRoArmPilotGear(parent) {
  if(!parent?.add)throw new TypeError('RoArm pilot gear requires a Three.js parent')
  const helmetFrame=new THREE.Group(),suitFrame=new THREE.Group()
  helmetFrame.name='roarm-pilot-helmet-gear';suitFrame.name='roarm-pilot-suit-gear'
  helmetFrame.matrixAutoUpdate=false;suitFrame.matrixAutoUpdate=false
  parent.add(helmetFrame,suitFrame)
  const geometries=new Set(),materials=new Set()
  const cyan=new THREE.MeshStandardMaterial({color:0x58c7e3,emissive:0x176d88,emissiveIntensity:.45,metalness:.35,roughness:.28})
  const amber=new THREE.MeshStandardMaterial({color:0xe99a46,metalness:.28,roughness:.42})
  const navy=new THREE.MeshStandardMaterial({color:0x173d54,metalness:.12,roughness:.46})
  materials.add(cyan);materials.add(amber);materials.add(navy)
  function mesh(target,name,geometry,material,position) {
    geometries.add(geometry)
    const item=new THREE.Mesh(geometry,material);item.name=name;item.position.set(...position);item.castShadow=true;item.receiveShadow=true;target.add(item);return item
  }
  const helmet=new THREE.Group();helmet.name='captain-helmet-details';helmet.position.y=.46;helmetFrame.add(helmet)
  const halo=mesh(helmet,'captain-helmet-halo',new THREE.TorusGeometry(.505,.028,6,24),cyan,[0,0,0]);halo.rotation.x=Math.PI/2
  mesh(helmet,'captain-helmet-beacon',new THREE.SphereGeometry(.075,8,6),amber,[0,.49,0])
  for(const x of [-.13,.13])mesh(helmet,`captain-helmet-fin-${x<0?'left':'right'}`,new THREE.BoxGeometry(.045,.11,.12),navy,[x,.43,-.03])

  // These small armor plates sit on the suit front; the astronaut's own shell,
  // visor, and face remain visible beneath and around them.
  const plate=mesh(suitFrame,'captain-chest-plate',new THREE.BoxGeometry(.48,.25,.055),navy,[0,.19,.345])
  plate.material=navy
  mesh(suitFrame,'captain-chest-rank',new THREE.BoxGeometry(.055,.18,.035),cyan,[0,.19,.38])
  for(const x of [-.43,.43])mesh(suitFrame,`captain-shoulder-light-${x<0?'left':'right'}`,new THREE.SphereGeometry(.12,8,6),cyan,[x,.16,.02])

  let disposed=false
  return {
    helmetFrame,suitFrame,
    update(root,headBone,chestBone) {
      if(disposed)return
      helmetFrame.matrix.multiplyMatrices(root,headBone);helmetFrame.matrixWorldNeedsUpdate=true;helmetFrame.visible=true
      suitFrame.matrix.multiplyMatrices(root,chestBone);suitFrame.matrixWorldNeedsUpdate=true;suitFrame.visible=true
    },
    hide(){helmetFrame.visible=false;suitFrame.visible=false},
    dispose(){
      if(disposed)return;disposed=true;parent.remove(helmetFrame,suitFrame)
      for(const geometry of geometries)geometry.dispose()
      for(const material of materials)material.dispose()
    },
  }
}
