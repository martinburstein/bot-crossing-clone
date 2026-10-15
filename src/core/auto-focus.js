import * as THREE from 'three'

// Fit the sharp depth interval to visible campus geometry, excluding terrain
// and sky. Sampling is throttled by the caller rather than done every frame.
export function measureAutoFocus(camera,roots,fallbackDistance){
  camera.updateMatrixWorld(true)
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse))
  const box=new THREE.Box3(),viewBox=new THREE.Box3()
  let near=Infinity,far=0,samples=0
  for(const root of roots.filter(Boolean)){
    let visible=true;for(let p=root;p;p=p.parent)if(!p.visible){visible=false;break}
    if(!visible)continue
    root.updateWorldMatrix(true,true)
    root.traverseVisible(object=>{
      if(!object.isMesh||object.material?.opacity<.5)return
      if(object.isInstancedMesh){object.computeBoundingBox();box.copy(object.boundingBox)}
      else{if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();box.copy(object.geometry.boundingBox)}
      box.applyMatrix4(object.matrixWorld)
      if(box.isEmpty()||!frustum.intersectsBox(box))return
      viewBox.copy(box).applyMatrix4(camera.matrixWorldInverse)
      const front=Math.max(camera.near,-viewBox.max.z),back=Math.min(camera.far,-viewBox.min.z)
      if(back<front)return
      near=Math.min(near,front);far=Math.max(far,back);samples++
    })
  }
  if(!samples)return {distance:Math.max(.1,fallbackDistance),sharpRange:Math.max(1,fallbackDistance*.15),samples:0}
  return {distance:(near+far)/2,sharpRange:(far-near)/2+Math.max(.5,(far-near)*.06),samples}
}
