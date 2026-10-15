import * as THREE from 'three';
import {OFFICE_BY_ID} from '../office/profiles.js';

// Paint the original skinned body. No second torso, shoulder blocks or rigid jacket.
export function tailorOfficeMaterial(material){
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous?.(shader);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute vec4 aOfficeStyle; varying vec4 vOfficeStyle; varying vec3 vClothPosition; varying vec3 vClothNormal;`)
      .replace('#include <begin_vertex>',`vOfficeStyle=aOfficeStyle; vClothPosition=position; vClothNormal=normal;
        #include <begin_vertex>`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec4 vOfficeStyle; varying vec3 vClothPosition; varying vec3 vClothNormal;`)
      .replace('#include <color_fragment>',`#include <color_fragment>
      if(vOfficeStyle.w>.5){
        vec3 p=vClothPosition; float style=vOfficeStyle.w;
        float front=smoothstep(.25,.65,vClothNormal.z);
        float torso=front*step(abs(p.x),.31)*step(.66,p.y)*step(p.y,1.245);
        float opening=max(0.,(p.y-.76)*.40);
        float shirt=(1.-smoothstep(opening-.008,opening+.008,abs(p.x)))*torso;
        vec3 cloth=diffuseColor.rgb;
        if(abs(style-5.)<.1)cloth*=.88+.12*smoothstep(.86,.98,cos(p.x*175.));
        diffuseColor.rgb=mix(cloth,vec3(.89,.86,.78),shirt);
        float lapel=(1.-smoothstep(.015,.035,abs(abs(p.x)-opening-.034)))*torso*step(.82,p.y);
        diffuseColor.rgb=mix(diffuseColor.rgb,cloth*1.32,lapel);
        bool openCollar=abs(style-4.)<.1||abs(style-7.)<.1;
        float tie=(1.-smoothstep(.025,.038,abs(p.x)))*step(.86,p.y)*step(p.y,1.18)*shirt;
        if(!openCollar)diffuseColor.rgb=mix(diffuseColor.rgb,vOfficeStyle.rgb,tie);
        float pocket=step(.16,p.x)*step(p.x,.25)*step(1.035,p.y)*step(p.y,1.062)*torso;
        diffuseColor.rgb=mix(diffuseColor.rgb,vOfficeStyle.rgb,pocket);
        float seam=(1.-smoothstep(.002,.007,abs(p.x)))*step(.66,p.y)*step(p.y,.83)*torso;
        diffuseColor.rgb*=1.-seam*.35;
      }`);
  };
  material.customProgramCacheKey=()=> 'office-original-body-cloth-v1';
  return material;
}

export function createOfficeSuit(profileId){
  const p=OFFICE_BY_ID[profileId];if(!p)throw Error('Unknown office profile');
  const group=new THREE.Group();group.name=`office-two-piece-${profileId}`;
  group.userData.textureMask=true;
  // Marker preserves the existing face and disables the space backpack/antenna.
  group.carryMatrix=new THREE.Matrix4();const hold=new THREE.Matrix4().makeTranslation(0,.02,.53);
  group.update=(root,headBone,chestBone)=>group.carryMatrix.multiplyMatrices(root,chestBone).multiply(hold);group.hide=()=>{};group.dispose=()=>group.removeFromParent();
  return group;
}
