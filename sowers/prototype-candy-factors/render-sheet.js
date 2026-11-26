import * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

const report=await fetch('/sowers/prototypes/canopy-factors/geometry-report.json').then(r=>r.json())
const tileW=320,tileH=400,canvas=document.querySelector('#sheet'),ctx=canvas.getContext('2d')
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true})
renderer.setPixelRatio(1);renderer.setSize(tileW,tileH,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15
const loader=new STLLoader(),status=document.querySelector('#status')
ctx.fillStyle='#f5f1e5';ctx.fillRect(0,0,canvas.width,canvas.height)
ctx.fillStyle='#26392e';ctx.font='700 24px system-ui';ctx.fillText('SOWERS / ITERATION 14 · FOUR CONTROLLED SOLIDS',32,34)
ctx.font='14px system-ui';ctx.fillText('Shared 24 × 30 × 6 mm envelope · same face, arches and seed · orthographic projections from each final STL',32,59)
ctx.strokeStyle='#d9d0bd';ctx.lineWidth=1
for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(i*tileW,75);ctx.lineTo(i*tileW,875);ctx.stroke()}
const lights=scene=>{scene.add(new THREE.HemisphereLight(0xfff4d8,0x6e5941,1.1));const k=new THREE.DirectionalLight(0xffffff,1.7);k.position.set(-25,40,45);scene.add(k);const f=new THREE.DirectionalLight(0xffd188,.62);f.position.set(25,4,-32);scene.add(f)}
for(let i=0;i<report.variants.length;i++){
  const v=report.variants[i],geometry=await loader.loadAsync('/'+v.stl);geometry.computeVertexNormals()
  const scene=new THREE.Scene();scene.background=new THREE.Color('#fffdf6');lights(scene)
  scene.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xe99329,roughness:.74,flatShading:true})))
  const label=`STRIPE ${v.stripe.toUpperCase()} · OUTERWALL ${v.nominalOuterDraftDegrees}°`
  for(let row=0;row<2;row++){
    const y=row*tileH+75;ctx.fillStyle='#26392e';ctx.font='700 15px system-ui';ctx.textAlign='center';ctx.fillText(label,i*tileW+tileW/2,y+21)
    ctx.textAlign='left';ctx.font='700 12px system-ui';ctx.fillText(row===0?'FRONT / ORTHOGRAPHIC':'SIDE / ORTHOGRAPHIC',i*tileW+16,y+44)
    const camera=new THREE.OrthographicCamera(-14,14,17.5,-17.5,.1,200);camera.position.set(...(row===0?[0,15,65]:[65,15,3]));camera.up.set(0,1,0);camera.lookAt(0,15,3)
    renderer.render(scene,camera);ctx.drawImage(renderer.domElement,i*tileW,y+50,tileW,tileH-95)
    ctx.fillStyle='#536254';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(row===0?`24 × 30 mm · ${v.body.volumeMm3.toFixed(3)} mm³`:'6 mm depth, including front relief',i*tileW+tileW/2,y+tileH-10)
  }
}
ctx.textAlign='left';ctx.fillStyle='#586858';ctx.font='12px system-ui';ctx.fillText('2° = true parallel normal offset across +Z 5.45 mm body depth (max 0.190318 mm). Geometry review only.',32,888)
renderer.dispose();status.textContent='Rendered the eight front/side views from the four exported STL files.'
document.querySelector('#save').disabled=false
document.querySelector('#save').addEventListener('click',async()=>{status.textContent='Saving PNG…';const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const response=await fetch('http://127.0.0.1:5399/save',{method:'POST',headers:{'Content-Type':'image/png'},body:blob});status.textContent=response.ok?'Saved factor-comparison.png to the review outputs.':`Save failed (${response.status}).`})
