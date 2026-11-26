import * as THREE from 'three';
import { createRig as createBaseRig } from './rig-base.mjs';
import { interpolate } from './parameters.mjs';

// The accepted13 articulated construction is retained; recipe geometry is a fresh
// isolated copy whose authored dimensions vary continuously with the weights.
export function createRig(scene, weights) {
  const rig=createBaseRig(scene);
  const p=interpolate(weights), parts=rig.parts;
  const sx=p.hoodWidth/2.05, sy=p.hoodHeight/1.62;
  parts.head.position.y=3.22;
  for(const o of parts.head.children){o.position.y-=3.22;o.position.x*=sx;o.position.y*=sy;o.scale.x*=sx;o.scale.y*=sy;}
  const stripe=parts.head.getObjectByName('crownStripe');
  if(stripe){stripe.position.set(0,0,0);stripe.scale.set(1,1,1);const a=stripe.geometry.attributes.position;for(let i=0;i<a.count;i++){a.setX(i,a.getX(i)*sx);a.setY(i,(a.getY(i)-3.22)*sy);a.setZ(i,a.getZ(i)+.055);}stripe.geometry.computeVertexNormals();stripe.material.side=THREE.DoubleSide;}
  // Scale only the cowl mesh along its height, leaving the face and crown fixed.
  const cowl=parts.head.getObjectByName('lowerCowl');
  if(cowl) cowl.scale.y*=p.cowlThickness/.22;
  // Face aperture relative to the endpoint width: resize surround, cocoa window, eyes.
  const aperture=p.faceWindowRatio/.68;
  for(const name of ['faceRim','faceWindow','eyeLeft','eyeRight']){
    const feature=parts.head.getObjectByName(name);
    if(feature) feature.scale.x*=aperture;
  }
  for(const o of parts.torso.children){o.position.y=1.90+(o.position.y-1.90)*p.torsoCompactness;o.scale.y*=p.torsoCompactness;}
  for(const key of ['leftLeg','rightLeg']) parts[key].scale.y=p.legCompactness;
  // Small orange flank flashes add authored Mars-root support without changing palette.
  const orange=new THREE.MeshStandardMaterial({color:0xf17721,roughness:.7});
  for(const s of [-1,1]){
    const accentWidth=.035+p.orangeSideAccent*.42;
    const g=new THREE.BoxGeometry(accentWidth,.30,.06);
    const m=new THREE.Mesh(g,orange);m.name=`sideAccent${s<0?'Left':'Right'}`;m.position.set(s*.48,1.90+(2.17-1.90)*p.torsoCompactness,.34);parts.torso.add(m);
  }
  const originalSetPose=rig.setPose;
  rig.setPose=(pose='neutral',t=0)=>{originalSetPose(pose,t); parts.leftLeg.position.y=1.55;parts.rightLeg.position.y=1.55;rig.root.position.y=-(1.55-.78*p.legCompactness)+(pose==='hop' ? .62*Math.sin(Math.PI*THREE.MathUtils.clamp(t,0,1)):0);};
  const baseDispose=rig.dispose;
  rig.dispose=()=>{baseDispose();orange.dispose();};
  rig.parameters=p;
  const geometryIds=new Set();rig.root.traverse(o=>{if(o.geometry)geometryIds.add(o.geometry);});rig.geometryCount=geometryIds.size;
  return rig;
}
