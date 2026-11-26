import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSower } from '../avatar.js';

const wrap = document.querySelector('#canvas-wrap');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const captions = {
  working: 'Small, busy hand motions: quietly getting on with it.',
  review: 'An inquisitive tilt. A careful look before the next little step.',
  waiting: 'A tiny wave: ready when you are.',
  idle: 'A quiet little turn while waiting for the next job.',
  complete: 'A little hop for a little victory.',
  error: 'A puzzled tilt. Still full of resolve.',
};
const names = { '#f5823a': 'Apricot', '#7fa594': 'Sage', '#82a6bf': 'Mist blue', '#b396ba': 'Heather' };
const state = { status: 'working', moving: false, paused: reducedMotion.matches, color: '#f5823a', time: 1.6 };
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch {
  const message = document.querySelector('#render-message');
  message.hidden = false;
  message.textContent = 'This character studio needs WebGL. Open it in a browser with hardware acceleration enabled to explore the scout.';
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
}

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.domElement.setAttribute('aria-label', 'Original Sower scout with amber visor, dark lower-face mask, and sprout badge. Drag or use arrow keys to orbit.');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.tabIndex = 0;
  wrap.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, .05, 60);
  camera.position.set(.12, 1.5, 4.5);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, .99, 0);
  orbit.enableDamping = !reducedMotion.matches;
  orbit.dampingFactor = .08;
  orbit.enablePan = false;
  orbit.minDistance = 1.5;
  orbit.maxDistance = 7;
  orbit.minPolarAngle = .35;
  orbit.maxPolarAngle = Math.PI * .52;
  orbit.addEventListener('start', () => {
    document.querySelectorAll('[data-view]').forEach(button => button.classList.remove('active'));
  });
  scene.add(new THREE.HemisphereLight(0xfff8e9, 0xa7b28e, 2.6));
  const key = new THREE.DirectionalLight(0xfff1da, 4.2);
  key.position.set(-3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -2;
  key.shadow.camera.right = key.shadow.camera.top = 2;
  key.shadow.camera.near = .5;
  key.shadow.camera.far = 14;
  key.shadow.normalBias = .025;
  key.shadow.bias = -.0003;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8f0df, 2);
  fill.position.set(3, 3, -3);
  scene.add(fill);

  const platform = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(.92, .98, .10, 96), new THREE.MeshStandardMaterial({ color: 0xdad9c5, roughness: .85 }));
  plinth.position.y = -.06;
  plinth.receiveShadow = true;
  platform.add(plinth);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.92, .92, .018, 96), new THREE.MeshStandardMaterial({ color: 0xebe8d8, roughness: .95 }));
  top.position.y = -.005;
  top.receiveShadow = true;
  platform.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.84, .003, 6, 96), new THREE.MeshStandardMaterial({ color: 0xc1c7af, roughness: 1 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = .006;
  platform.add(ring);
  scene.add(platform);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: 0x6e775c, opacity: .12 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.115;
  floor.receiveShadow = true;
  scene.add(floor);
  let scout;
  const disposeScout = () => {
    if (!scout) return;
    scene.remove(scout);
    const geometries = new Set();
    const materials = new Set();
    scout.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  };
  const settle = () => {
    for (let i = 0; i < 100; i++) scout.userData.animate(state.time, 1 / 60, { status: state.status, moving: state.moving });
  };
  const createScout = () => {
    disposeScout();
    scout = createSower({ color: state.color, seed: 4, variant: new URLSearchParams(location.search).get('shape') || 'scout' });
    scene.add(scout);
    settle();
  };
  createScout();
  const updatePlayback = () => {
    const button = document.querySelector('#play');
    button.textContent = state.paused ? '▶ Play' : 'Ⅱ Pause';
    button.setAttribute('aria-pressed', String(state.paused));
    button.setAttribute('aria-label', state.paused ? 'Play character animation' : 'Pause character animation');
  };
  updatePlayback();
  const togglePlay = () => { state.paused = !state.paused; updatePlayback(); };
  document.querySelector('#play').addEventListener('click', togglePlay);
  const chooseStatus = status => {
    state.status = status;
    document.querySelectorAll('[data-status]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.status === status)));
    document.querySelector('#gesture-caption').textContent = state.moving ? 'A springy little walk in place. Switch Walking off to inspect this gesture.' : captions[status];
    if (state.paused) settle();
  };
  document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => chooseStatus(button.dataset.status)));
  const toggleWalk = () => {
    state.moving = !state.moving;
    document.querySelector('#walking').setAttribute('aria-pressed', String(state.moving));
    chooseStatus(state.status);
  };
  document.querySelector('#walking').addEventListener('click', toggleWalk);
  document.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => {
    state.color = button.dataset.color;
    document.querySelectorAll('[data-color]').forEach(swatch => {
      const active = swatch === button;
      swatch.classList.toggle('active', active);
      swatch.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('#color-name').textContent = names[state.color];
    createScout();
  }));
  const setView = view => {
    if (view === 'detail') {
      camera.position.set(.03, 1.56, 2.7);
      orbit.target.set(0, 1.38, 0);
    } else {
      camera.position.set(.12, 1.5, view === 'back' ? -4.5 : 4.5);
      orbit.target.set(0, .99, 0);
    }
    orbit.update();
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  };
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.addEventListener('keydown', event => {
    if (event.altKey || event.metaKey || event.ctrlKey || event.repeat) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    // Buttons retain their standard Enter / Space behavior.
    if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); togglePlay(); }
    if (/^[1-6]$/.test(event.key)) chooseStatus(Object.keys(captions)[Number(event.key) - 1]);
    if (event.key.toLowerCase() === 'w') toggleWalk();
    if (event.key.toLowerCase() === 'r') setView('front');
    if (event.target === renderer.domElement && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const offset = camera.position.clone().sub(orbit.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      if (event.key === 'ArrowLeft') spherical.theta -= .15;
      if (event.key === 'ArrowRight') spherical.theta += .15;
      if (event.key === 'ArrowUp') spherical.phi = Math.max(orbit.minPolarAngle, spherical.phi - .1);
      if (event.key === 'ArrowDown') spherical.phi = Math.min(orbit.maxPolarAngle, spherical.phi + .1);
      camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical));
      orbit.update();
    }
  });
  reducedMotion.addEventListener('change', event => {
    orbit.enableDamping = !event.matches;
    if (event.matches) { state.paused = true; updatePlayback(); }
  });
  const resize = () => {
    const { width, height } = wrap.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(wrap);
  resize();
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    const delta = Math.min((now - previous) / 1000, .05);
    previous = now;
    if (!state.paused && !document.hidden) {
      state.time += delta;
      scout.userData.animate(state.time, delta, { status: state.status, moving: state.moving });
    }
    orbit.update();
    renderer.render(scene, camera);
  });
}
