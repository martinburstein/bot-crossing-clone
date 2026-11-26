import * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

const canvas = document.querySelector('#model')
const host = canvas.parentElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
const scene = new THREE.Scene()
scene.background = null
scene.add(new THREE.HemisphereLight(0xfff4d8, 0x6e5941, 1.05))
const key = new THREE.DirectionalLight(0xffffff, 1.65); key.position.set(-25, 40, 45); scene.add(key)
const fill = new THREE.DirectionalLight(0xffd188, .62); fill.position.set(25, 4, -32); scene.add(fill)
const camera = new THREE.OrthographicCamera(-15,15,18,-18,.1,300)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = false
controls.enablePan = false
controls.minZoom = .6
controls.maxZoom = 3.5
const target = new THREE.Vector3(0,15,3)
controls.target.copy(target)
const loader = new STLLoader()
const loadState = document.querySelector('#load-state')
const material = new THREE.MeshStandardMaterial({ color: 0xf28a16, roughness: .72, metalness: 0 })
let mesh

function resize(){
  const w=host.clientWidth,h=host.clientHeight,aspect=w/h,span=Math.max(35,28/aspect)
  camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2
  camera.updateProjectionMatrix();renderer.setSize(w,h,false)
}
function pointView(name){
  const p={front:[0,15,60],side:[60,15,3],back:[0,15,-60]}[name]
  camera.position.set(...p);camera.up.set(0,1,0);camera.lookAt(target);controls.target.copy(target);controls.update()
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)))
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>pointView(button.dataset.view)))
const render=()=>renderer.render(scene,camera)
window.addEventListener('resize',()=>{resize();render()})
controls.addEventListener('change',render)
resize();pointView('front');render()

Promise.all([
  new Promise((resolve,reject)=>loader.load('/sowers/prototypes/canopy-blockout/canopy-solid-mm.stl',resolve,undefined,reject)),
  fetch('/sowers/prototypes/canopy-blockout/geometry-report.json').then(r=>{if(!r.ok)throw Error('Geometry report unavailable');return r.json()})
]).then(([geometry,report])=>{
  geometry=mergeVertices(geometry,1e-4)
  geometry.computeVertexNormals()
  mesh=new THREE.Mesh(geometry,material)
  mesh.position.set(0,0,0);scene.add(mesh);render()
  document.querySelector('#dimensions').textContent=`${report.widthMm} × ${report.heightMm} × ${report.depthMm} mm`
  document.querySelector('#hash').textContent=report.stlSha256
  loadState.hidden=true
}).catch(error=>{loadState.textContent=`Could not load solid: ${error.message}`})
