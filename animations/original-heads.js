import * as THREE from 'three';
import {buildFaceAtlas, FACE, FACE_LOOPS, FRAME_COLS, FRAME_ROWS} from '../src/agents/faces.js';

// Original Bot Crossing visor/face shaders and sphere-cap geometry, copied verbatim.
class FaceMaterials {
  constructor(){this.faceTexture=buildFaceAtlas(512);}
  _visorMaterial() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x08090e, roughness: 0.3, metalness: 0.16 })
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n varying vec2 vVisorUv;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n vVisorUv = uv;`)

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n varying vec2 vVisorUv;`)
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
           // Rounded-box SDF: |max(q,0)| + min(max(q.x,q.y),0) - r, the standard 2D form.
           vec2 p = ( vVisorUv - 0.5 ) * 2.0;
           // "half" is a reserved word in GLSL ES; a variable named that will not compile.
           vec2 halfSize = vec2( 0.86, 0.80 );
           float radius = 0.52;
           vec2 q = abs( p ) - halfSize + radius;
           float sd = length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - radius;
           if ( sd > 0.0 ) discard;
           float bezel = smoothstep( -0.14, -0.01, sd );`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           // A cool rim right at the cut, so the screen reads as set into a bezel.
           totalEmissiveRadiance += vec3( 0.16, 0.22, 0.34 ) * bezel;`
        )
    }
    return mat
  }
  _faceMaterial() {
    const mat = new THREE.MeshBasicMaterial({
      map: this.faceTexture,
      toneMapped: true,
      transparent: true,
      depthWrite: false,
    })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFrameScale = { value: new THREE.Vector2(1 / FRAME_COLS, 1 / FRAME_ROWS) }
      shader.uniforms.uGlow = { value: 1.85 }
      this._faceUniforms = shader.uniforms

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute vec2 aFrame;
           uniform vec2 uFrameScale;`
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
           vMapUv = uv * uFrameScale + aFrame;`
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uGlow;`
        )
        .replace(
          '#include <map_fragment>',
          `float mask = texture2D( map, vMapUv ).r;
           // The mask is drawn from paths, so its edges are already antialiased — taking
           // alpha straight from it is what gives the features soft edges against the
           // helmet without a single extra sample.
           diffuseColor.rgb = vColor.rgb * uGlow;
           diffuseColor.a = mask;`
        )
        // vColor is the glow source above, so the usual instance-colour multiply must go.
        .replace('#include <color_fragment>', '')
    }
    return mat
  }

}
function sphereCap(radius, phiSpread, thetaSpread, wSeg = 18, hSeg = 12) {
  return new THREE.SphereGeometry(
    radius,
    wSeg,
    hSeg,
    Math.PI / 2 - phiSpread / 2,
    phiSpread,
    Math.PI / 2 - thetaSpread / 2,
    thetaSpread
  )
}


export function createOriginalHeads(scene,count=8){
 const materials=new FaceMaterials();
 const helmet=new THREE.InstancedMesh(new THREE.SphereGeometry(.48,16,11),
   new THREE.MeshStandardMaterial({color:0xdfd7c7,roughness:.26,metalness:.03,envMapIntensity:1.35}),count);
 const visor=new THREE.InstancedMesh(sphereCap(.48*1.032,2.45,Math.PI*.62,20,14),materials._visorMaterial(),count);
 const face=new THREE.InstancedMesh(sphereCap(.48*1.047,1.72,.98,16,10),materials._faceMaterial(),count);
 const frames=new THREE.InstancedBufferAttribute(new Float32Array(count*2),2);
 frames.setUsage(THREE.DynamicDrawUsage);face.geometry.setAttribute('aFrame',frames);
 for(const mesh of [helmet,visor,face]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);}
 helmet.castShadow=true;
 const matrix=new THREE.Matrix4(),offset=new THREE.Matrix4().makeTranslation(0,.46,0),color=new THREE.Color();
 return {
  update(index,root,headBone,elapsed,activity){
   matrix.multiplyMatrices(root,headBone).multiply(offset);
   for(const mesh of [helmet,visor,face])mesh.setMatrixAt(index,matrix);
   const time=elapsed+index*1.3,blink=time%5.7<.12;
   const expression={'idle-chat':FACE.happy,'idle-coffee':FACE.happy,'idle-think':FACE.think1,'idle-wave':FACE.happy,'idle-note':FACE.think2,'idle-watch':FACE.wait}[activity]??FACE.idle;
   const f=blink?FACE.blink:activity==='work'?FACE_LOOPS.working[Math.floor(time/.22)%FACE_LOOPS.working.length]:expression;
   frames.setXY(index,(f%FRAME_COLS)/FRAME_COLS,1-(Math.floor(f/FRAME_COLS)+1)/FRAME_ROWS);
   face.setColorAt(index,activity==='work'?color.setRGB(.35,2.5,1.15):color.setRGB(1.1,1.5,1.7));
  },
  flush(){for(const mesh of [helmet,visor,face])mesh.instanceMatrix.needsUpdate=true;frames.needsUpdate=true;face.instanceColor.needsUpdate=true;}
 };
}
