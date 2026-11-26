import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMissionBase } from '../base.js';
import { createCheckpointExpansion } from '../expansion.js';
import { createSower } from '../avatar.js';
import { createHelmet } from '../helmet.js';
import { constructionStages } from '../progress.mjs';

const $ = selector => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const state = { seed: 'little-dawn-01', kind: 'habitat', fraction: 1, mode: 'fraction', checkpoints: [], next: 1, paused: reducedMotion.matches, time: 1.6 };
const notes = [
  ['Footings find their place.', 'Independent feet and a segmented landing deck establish the footprint. Forward steps give the little builder a way in.', ['Four independent footings', 'Five landing-deck segments and orange safety edges', 'Three forward access steps']],
  ['A frame reaches upward.', 'Pressure-cell uprights, roof rails and solar support reveal the structure beneath the shell.', ['Steel pressure-cell uprights', 'Orange roof joints and cross rails', 'Solar outrigger support; temporary assembly gantry']],
  ['A shelter takes shape.', 'Ivory wall panels and a faceted roof enclose the frame. A recessed airlock and service pod give it a working face.', ['Ivory pressure-shell panels', 'Faceted roof and orange cap', 'Airlock surround and seeded service pod']],
  ['The useful little details.', 'An amber door, solar cells, side windows and a dish turn the shelter into an outpost. Purpose changes the geometry.', ['Amber airlock, side windows and access rails', 'Solar-cell grid and utility connections', 'Roof hardware, service-pod cap and rear dish']],
  ['A light comes on.', 'The beacon arrives; temporary gantries step away. The outpost is ready for its next little story.', ['Amber mast beacon installed', 'Temporary assembly gantry removed', 'Pressure shell, systems and access steps retained']],
];
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
catch {
  $('#render-message').hidden = false;
  $('#render-message').textContent = 'The 3D assembly table needs WebGL. Enable browser hardware acceleration to explore the model. This is a fictional design sandbox; no live work is connected.';
  document.querySelectorAll('button,input,select').forEach(control => { control.disabled = true; });
}
if (renderer) {
  const wrap = $('#canvas-wrap');
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Fictional Sowers outpost with scout for scale. Drag or use arrow keys to orbit, scroll to zoom.');
  wrap.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = !reducedMotion.matches;
  orbit.dampingFactor = .09;
  orbit.enablePan = false;
  orbit.minDistance = 5;
  orbit.maxDistance = 24;
  orbit.minPolarAngle = .12;
  orbit.maxPolarAngle = Math.PI * .49;
  scene.add(new THREE.HemisphereLight(0xfff7e5, 0xabb49b, 2.7));
  const key = new THREE.DirectionalLight(0xffefd8, 3.8);
  key.position.set(-6, 12, 9); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -8;
  key.shadow.camera.right = key.shadow.camera.top = 8;
  key.shadow.camera.far = 35;
  key.shadow.normalBias = .03;
  key.shadow.bias = -.0003;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8eddf, 1.8); fill.position.set(4, 4, -5); scene.add(fill);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(7.25, 7.4, .17, 96), new THREE.MeshStandardMaterial({ color: 0xe5dfcc, roughness: .95 }));
  plinth.position.y = -.1; plinth.receiveShadow = true; scene.add(plinth);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.95, .012, 5, 96), new THREE.MeshStandardMaterial({ color: 0xc6bda1, roughness: 1 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -.008; scene.add(ring);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: 0x6d775b, opacity: .10 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.19; floor.receiveShadow = true; scene.add(floor);
  const scout = createSower({ seed: 8, helmetFactory: createHelmet });
  scout.position.set(1.8, 0, 3.15); scout.rotation.y = -.22; scene.add(scout);
  scout.userData.animate(state.time, 1, { status: 'idle', moving: false });
  let base, expansion;
  function dispose(object) {
    if (!object) return;
    const geometries = new Set(), materials = new Set();
    object.traverse(part => { if (part.geometry) geometries.add(part.geometry); for (const material of [].concat(part.material || [])) materials.add(material); });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); object.removeFromParent();
  }
  function rebuild() {
    dispose(base); expansion?.userData.dispose();
    base = createMissionBase({ seed: state.seed, kind: state.kind, progress: state.mode === 'fraction' ? state.fraction : 1 });
    expansion = createCheckpointExpansion({ seed: state.seed });
    expansion.userData.setCheckpoints(state.checkpoints);
    scene.add(base, expansion);
    $('#model-kind').textContent = state.kind.toUpperCase();
    $('#variant').textContent = state.kind === 'relay' ? 'RELAY DOME · SEEDED SERVICE POD' : `ROOF VARIANT ${String(base.userData.variant + 1).padStart(2, '0')} · SEEDED SERVICE POD`;
    updateUI();
  }
  function setView(view = 'overview') {
    const extended = state.checkpoints.length > 0;
    const mobile = wrap.clientWidth < 550;
    if (view === 'entry') { camera.position.set(.15, 3.4, 10.5); orbit.target.set(0, 1.8, .4); }
    else if (view === 'plan') { camera.position.set(0, extended ? 21 : 16, 1); orbit.target.set(0, .8, 0); }
    else { camera.position.set(extended ? 13 : mobile ? 11 : 9, extended ? 10 : 7.8, extended ? 16 : mobile ? 14 : 12); orbit.target.set(0, 1.25, .1); }
    orbit.update();
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  }
  function updateUI() {
    const unknown = state.mode === 'checkpoints';
    $('#fraction').textContent = unknown ? 'Unknown' : `${Math.round(state.fraction * 100)}%`;
    $('#construction').disabled = unknown;
    $('#construction').value = Math.round(state.fraction * 100);
    $('#fraction-note').textContent = unknown ? 'Complete reference shell shown for design context. Checkpoints do not reveal completion.' : 'A manually chosen model fraction, never generated progress.';
    $('#completion').textContent = unknown ? 'Unknown · no denominator' : `${Math.round(state.fraction * 100)}% · manually selected`;
    $('#checkpoint-count').textContent = state.checkpoints.length;
    $('#retract').disabled = !state.checkpoints.length;
    $('#add').disabled = state.checkpoints.length >= 12;
    $('#checkpoint-note').textContent = state.checkpoints.length ? `${state.checkpoints.length} fictional checkpoint${state.checkpoints.length === 1 ? '' : 's'} → ${expansion.userData.displayedCount} hardware extension${expansion.userData.displayedCount === 1 ? '' : 's'}. Retract removes the last one.${state.checkpoints.length === 12 ? ' Study limit reached.' : ''}` : 'No extensions yet. Add a checkpoint to attach a hardware module.';
    const index = unknown ? -1 : constructionStages.findIndex(stage => state.fraction <= stage.end);
    document.querySelectorAll('[data-stage]').forEach(button => { button.disabled = unknown; button.setAttribute('aria-pressed', String(Number(button.dataset.stage) === index)); });
    if (unknown) {
      $('#phase-title').textContent = 'A reference shell. An open question.';
      $('#phase-description').textContent = 'The completed shell is a fixed design reference in this mode. Only the accepted checkpoint hardware changes; neither the shell nor the checkpoint count reports task completion.';
      $('#phase-parts').replaceChildren(...['A fixed full shell for inspecting the design', 'Accepted fictional checkpoints attach distinct hardware', 'Retraction removes hardware; completion stays unknown'].map(text => Object.assign(document.createElement('li'), { textContent: text })));
    } else {
      const selected = Math.max(0, index), note = notes[selected];
      $('#phase-title').textContent = `${String(selected + 1).padStart(2, '0')} / ${note[0]}`;
      $('#phase-description').textContent = state.fraction === 0 ? 'An empty site. Move the fraction slider or inspect a stage to place the first physical pieces.' : `${note[1]}${state.fraction < constructionStages[selected].end ? ' This phase is partially assembled at the selected fraction.' : ''}`;
      $('#phase-parts').replaceChildren(...note[2].map(text => Object.assign(document.createElement('li'), { textContent: text })));
    }
  }
  function chooseStage(index) { if (state.mode !== 'fraction') return; state.fraction = constructionStages[index].end; base.userData.setProgress(state.fraction); updateUI(); }
  $('#construction').addEventListener('input', event => { state.fraction = Number(event.target.value) / 100; base.userData.setProgress(state.fraction); updateUI(); });
  document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => chooseStage(Number(button.dataset.stage))));
  document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
    state.kind = button.dataset.kind;
    document.querySelectorAll('[data-kind]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
    rebuild();
  }));
  $('#seed').addEventListener('change', event => { state.seed = event.target.value.trim() || 'little-dawn-01'; event.target.value = state.seed; rebuild(); });
  $('#new-seed').addEventListener('click', () => { state.seed = `little-dawn-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`; $('#seed').value = state.seed; rebuild(); });
  $('#mode').addEventListener('change', event => { state.mode = event.target.value; base.userData.setProgress(state.mode === 'fraction' ? state.fraction : 1); updateUI(); });
  $('#add').addEventListener('click', () => {
    if (state.checkpoints.length >= 12) return;
    const first = !state.checkpoints.length;
    state.checkpoints.push({ id: `sandbox-${state.next++}`, status: 'accepted' });
    expansion.userData.setCheckpoints(state.checkpoints); updateUI(); if (first) setView();
  });
  $('#retract').addEventListener('click', () => { state.checkpoints.pop(); expansion.userData.setCheckpoints(state.checkpoints); updateUI(); if (!state.checkpoints.length) setView(); });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  orbit.addEventListener('start', () => document.querySelectorAll('[data-view]').forEach(button => button.classList.remove('active')));
  function updateMotion() { $('#motion').textContent = state.paused ? 'Play scout motion' : 'Pause scout motion'; $('#motion').setAttribute('aria-pressed', String(state.paused)); }
  $('#motion').addEventListener('click', () => { state.paused = !state.paused; updateMotion(); });
  reducedMotion.addEventListener('change', event => { orbit.enableDamping = !event.matches; if (event.matches) state.paused = true; updateMotion(); });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || ['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) return;
    if (/^[1-5]$/.test(event.key)) chooseStage(Number(event.key) - 1);
    if (event.key.toLowerCase() === 'r') setView();
    if (event.target === renderer.domElement && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const offset = camera.position.clone().sub(orbit.target), spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += event.key === 'ArrowLeft' ? -.15 : event.key === 'ArrowRight' ? .15 : 0;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + (event.key === 'ArrowUp' ? -.1 : event.key === 'ArrowDown' ? .1 : 0), orbit.minPolarAngle, orbit.maxPolarAngle);
      camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical)); orbit.update();
    }
  });
  function resize() { const { width, height } = wrap.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(wrap);
  rebuild(); resize(); setView(); updateMotion();
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    const delta = Math.min((now - previous) / 1000, .05); previous = now;
    if (document.hidden) return;
    if (!state.paused) { state.time += delta; scout.userData.animate(state.time, delta, { status: 'idle', moving: false }); base.userData.animate(state.time); }
    orbit.update(); renderer.render(scene, camera);
  });
}
