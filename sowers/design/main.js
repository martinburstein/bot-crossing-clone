import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCandySower } from '../candy/mascot.js';
import { getCandyFeatures, candySegmentsPath, getCandyContour } from '../candy/silhouettes.mjs';

// Drawn here rather than relying on an external font. Round terminals, a tilted O,
// and a wide W make the compact mark legible on the small packaging studies.
const wordmark = `<svg class="wordmark" viewBox="0 0 552 108" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M72 25C58 9 17 12 14 34C10 58 75 46 75 72C74 98 29 99 11 82"/><ellipse cx="129" cy="55" rx="31" ry="36" transform="rotate(-9 129 55)"/><path d="M179 20L196 91L220 42L243 91L260 20M340 20H288V91H340M288 54H328M374 91V20H403Q440 20 437 43Q436 62 405 62H374M406 62L440 91M533 25C519 9 478 12 475 34C471 58 536 46 536 72C535 98 490 99 472 82"/></g><path d="M127 20Q125 5 141 4Q143 17 127 20Z" fill="currentColor"/></svg>`;
document.querySelectorAll('[data-wordmark]').forEach(el => { el.innerHTML = wordmark; });

const variants = {
  scout: { name: 'Scout', number: '01', short: 'The seed packet', text: 'A broad helmet, small crown and compact body. A little explorer with a clear head-to-body shape.', strength: 'The most character-led' },
  seed: { name: 'Seed', number: '02', short: 'The little voyager', text: 'A tilted seed crown and tapered body. The simplest organic direction, with a quiet little grin.', strength: 'The simplest candy read' },
  bud: { name: 'Bud', number: '03', short: 'The leaf ranger', text: 'A broad leaf crown and compact shield body. A bolder sprout cue with attached mitten tabs.', strength: 'The strongest seed cue' },
};
const flavors = {
  citrus: { name: 'citrus concept', color: '#ff9848', background: '#ffa24b', ink: '#382338', pop: '#edf16b', label: 'Citrus<br>scout.', tilt: '-4deg' },
  lime: { name: 'lime concept', color: '#c7e45c', background: '#d2e965', ink: '#412c53', pop: '#a987d2', label: 'Lime<br>littleling.', tilt: '2deg' },
  berry: { name: 'berry concept', color: '#e96392', background: '#c6a1e6', ink: '#4a2341', pop: '#f77997', label: 'Berry<br>brave.', tilt: '-2deg' },
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const state = { variant: 'scout', flavor: 'citrus', material: 'matte', monochrome: false, pose: 'candy', source: 'master', status: 'idle', paused: true, time: 0 };
const $ = selector => document.querySelector(selector);
let refreshModel = () => {};
let resetCamera = () => {};
let renderer;
const updateSourceControls = () => {
  document.querySelectorAll('[data-source]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.source === state.source)));
  document.querySelectorAll('[data-pose], #play').forEach(button => { button.disabled = !renderer || state.source === 'master'; });
  $('#status').disabled = !renderer || state.source === 'master' || state.pose !== 'agent';
  $('#master-status').hidden = state.source !== 'master';
  $('#model-caption').textContent = `${variants[state.variant].name} · ${state.source === 'master' ? 'actual positive master / one color' : 'digital agent'}`;
};
const announce = text => { $('#announcement').textContent = text; };

/** Front-view art uses the very same quadratic contour as the 3D extrusion. */
function characterSvg(variant, color, { silhouette = false, className = '', label = '' } = {}) {
  const features = getCandyFeatures(variant);
  const featurePath = (feature, fill, opacity = 1) => `<path d="${candySegmentsPath(feature.segments)}" fill="${fill}" opacity="${opacity}"/>`;
  return `<svg class="${className}" viewBox="-.55 -1.06 1.1 1.12" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><g transform="scale(1,-1)"><path d="${getCandyContour(variant)}" fill="${color}"/>${silhouette ? '' : featurePath(features.helmet, '#fff5ce', .25) + featurePath(features.face, '#33433c') + features.eyes.map(eye => featurePath(eye, '#fff5ce')).join('') + featurePath(features.chest, '#fff5ce', .6)}</g></svg>`;

}

function renderVariantCards() {
  $('#variant-grid').innerHTML = Object.entries(variants).map(([key, spec]) => `<button class="variant-card variant-${key}" data-variant="${key}" aria-pressed="${key === state.variant}" aria-label="Select ${spec.name}: ${spec.short}"><span class="variant-card-top"><span>${spec.number} / ${spec.short}</span><span class="selection-mark" aria-hidden="true">${key === state.variant ? '✓' : ''}</span></span>${characterSvg(key, flavors[state.flavor].color, { silhouette: state.monochrome, className: 'variant-character' })}<div class="variant-card-copy"><h3>${spec.name}</h3><p>${spec.text}</p><div class="silhouette-test">${characterSvg(key, '#211c2b', { silhouette: true })}<span>32 px / one color<br>${spec.strength}</span></div></div></button>`).join('');
  $('#variant-grid').querySelectorAll('[data-variant]').forEach(button => button.addEventListener('click', () => chooseVariant(button.dataset.variant)));
}

function renderPacks() {
  $('#pack-shelf').innerHTML = Object.entries(flavors).map(([key, flavor]) => `<article class="pack" aria-label="${key} packaging concept with ${variants[state.variant].name} character" style="--pack-bg:${flavor.background};--pack-ink:${flavor.ink};--pack-pop:${flavor.pop};--tilt:${flavor.tilt}">${wordmark}<span class="pack-subline">Sour little explorers</span><span class="pack-dot" aria-hidden="true"></span><span class="pack-flavor">${flavor.label}</span><span class="pack-burst" aria-hidden="true"></span>${characterSvg(state.variant, key === 'citrus' ? '#ffcb63' : key === 'lime' ? '#a382ce' : '#f27d9d', { className: 'pack-mascot', silhouette: state.monochrome })}<span class="pack-bottom">Little<br>sour scouts.</span><span class="pack-concept">Packaging concept</span></article>`).join('');
  $('#pack-selection').textContent = variants[state.variant].name;
}

function refreshFlatArt() {
  renderVariantCards();
  renderPacks();
  $('#fallback-character').innerHTML = characterSvg(state.variant, state.monochrome ? '#211c2b' : flavors[state.flavor].color, { silhouette: state.monochrome });
  $('#stage-kicker').textContent = `${variants[state.variant].number} / ${variants[state.variant].name.toUpperCase()}`;
  $('#model-caption').textContent = `${variants[state.variant].name} · ${state.monochrome ? 'one-color silhouette' : flavors[state.flavor].name}`;
  document.querySelectorAll('[data-quick-variant]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.quickVariant === state.variant)));
}

function chooseVariant(variant) {
  if (!variants[variant]) return;
  const focusCard = document.activeElement?.matches('[data-variant]');
  state.variant = variant;
  refreshFlatArt();
  refreshModel();
  if (focusCard) document.querySelector(`[data-variant="${variant}"]`)?.focus({ preventScroll: true });
  announce(`${variants[variant].name} selected. Hero and all three packaging studies updated.`);
}

document.querySelectorAll('[data-quick-variant]').forEach(button => button.addEventListener('click', () => chooseVariant(button.dataset.quickVariant)));

document.querySelectorAll('[data-flavor]').forEach(button => button.addEventListener('click', () => {
  state.flavor = button.dataset.flavor;
  document.querySelectorAll('[data-flavor]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
  refreshFlatArt();
  refreshModel();
  announce(`${flavors[state.flavor].name} selected.`);
}));

document.querySelectorAll('[data-material]').forEach(button => button.addEventListener('click', () => {
  state.material = button.dataset.material;
  document.querySelectorAll('[data-material]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
  refreshModel();
  announce(`${state.material === 'gummy' ? 'Sour gummy material study' : 'Matte character material'} selected.`);
}));

function updatePlayback() {
  $('#play').textContent = state.paused ? 'Play' : 'Pause';
  $('#play').setAttribute('aria-label', state.paused ? 'Play character animation' : 'Pause character animation');
  $('#play').setAttribute('aria-pressed', String(!state.paused));
}
function setPose(pose) {
  state.pose = pose;
  document.querySelectorAll('[data-pose]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.pose === pose)));
  $('#status').disabled = pose !== 'agent' || state.source === 'master';
  if (pose === 'agent' && !reducedMotion.matches) state.paused = false;
  if (pose === 'candy') state.paused = true;
  updatePlayback();
  refreshModel();
  announce(pose === 'agent' ? 'Agent pose selected. Animation is available in the hero.' : 'Candy form selected. The single-piece silhouette is shown at rest.');
}
document.querySelectorAll('[data-pose]').forEach(button => button.addEventListener('click', () => setPose(button.dataset.pose)));
$('#status').disabled = true;
$('#status').addEventListener('change', event => { state.status = event.target.value; refreshModel(); });
$('#monochrome').addEventListener('click', () => {
  state.monochrome = !state.monochrome;
  $('#monochrome').setAttribute('aria-pressed', String(state.monochrome));
  refreshFlatArt();
  refreshModel();
  announce(state.source === 'master' ? 'The candy master always uses one color. Packaging silhouette comparison updated.' : state.monochrome ? 'One-color silhouette mode on. Face details hidden.' : 'Full color restored.');
});
document.querySelectorAll('[data-source]').forEach(button => button.addEventListener('click', () => {
  state.source = button.dataset.source;
  if (state.source === 'master') state.paused = true;
  updateSourceControls();
  updatePlayback();
  refreshModel();
  announce(state.source === 'master' ? 'Actual exported candy master. One material, physical relief details.' : 'Digital agent selected.');
}));
$('#play').addEventListener('click', () => {
  if (state.pose === 'candy') { setPose('agent'); state.paused = false; }
  else state.paused = !state.paused;
  updatePlayback();
});

refreshFlatArt();
const stage = $('#model-stage');
try {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
} catch {
  $('#render-fallback').hidden = false;
  $('#master-status').textContent = '3D is unavailable. The illustration is a front-view character study, not the exported master.';
  document.querySelectorAll('[data-camera], #play').forEach(button => { button.disabled = true; });
  updateSourceControls();
}

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Selected Sower shape in 3D. Drag to rotate, or focus this view and use arrow keys.');
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 25);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, .97, 0);
  orbit.enableDamping = !reducedMotion.matches;
  orbit.dampingFactor = .09;
  orbit.enablePan = false;
  orbit.minDistance = 2.7;
  orbit.maxDistance = 6.2;
  orbit.minPolarAngle = .5;
  orbit.maxPolarAngle = Math.PI * .53;
  const hemi = new THREE.HemisphereLight(0xfff6e9, 0xb99bbb, 2.1);
  scene.add(hemi);
  const light = new THREE.DirectionalLight(0xfff4df, 2.7);
  light.position.set(-3, 6, 5);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -2, right: 2, top: 3, bottom: -2, near: .5, far: 14 });
  light.shadow.normalBias = .02;
  light.shadow.bias = -.0002;
  light.shadow.radius = 4;
  scene.add(light);
  const rim = new THREE.DirectionalLight(0xffffff, 1.3);
  rim.position.set(3, 3, -3);
  scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ color: '#61415f', opacity: .18 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.01;
  ground.receiveShadow = true;
  scene.add(ground);

  let mascot;
  let loadSerial = 0;
  let loadController;
  const masterEvidence = { status: 'loading' };
  const stlLoader = new STLLoader();
  let needsRender = true;
  function disposeMascot() {
    if (!mascot) return;
    scene.remove(mascot);
    const geometries = new Set(), materials = new Set();
    mascot.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    mascot = null;
  }
  function poseMascot() {
    if (!mascot || state.source === 'master') return;
    if (state.pose === 'candy') mascot.userData.resetPose?.();
    else {
      for (let i = 0; i < 12; i++) mascot.userData.animate?.(state.time || 1.3, 1 / 60, { status: state.status, moving: state.status === 'working' });
    }
  }
  refreshModel = async () => {
    const serial = ++loadSerial;
    loadController?.abort();
    loadController = new AbortController();
    const { signal } = loadController;
    disposeMascot();
    updateSourceControls();
    hemi.intensity = state.source === 'master' ? 1.2 : 2.1;
    light.intensity = state.source === 'master' ? 3.4 : 2.7;
    light.shadow.normalBias = state.source === 'master' ? .004 : .02;
    $('#master-error').hidden = true;
    needsRender = true;
    if (state.source === 'agent') {
      Object.assign(masterEvidence, { status: 'inactive' });
      mascot = createCandySower({ variant: state.variant, color: flavors[state.flavor].color, seed: 4, materialMode: state.monochrome ? 'silhouette' : state.material });
      scene.add(mascot);
      poseMascot();
      return;
    }
    const variant = state.variant;
    Object.assign(masterEvidence, { status: 'loading', variant });
    $('#master-status').textContent = `Loading ${variants[variant].name} exported STL…`;
    let geometry;
    try {
      const reportResponse = await fetch(`/sowers/candy-form/geometry-report.json?t=${Date.now()}`, { signal, cache: 'no-store' });
      if (!reportResponse.ok) throw new Error(`Geometry report HTTP ${reportResponse.status}`);
      const report = await reportResponse.json();
      const entry = report.variants?.find(item => item.id === variant);
      if (!entry?.stlSha256) throw new Error('Geometry report has no STL fingerprint');
      const assetUrl = `/sowers/candy-form/${variant}-positive-mm.stl?sha=${entry.stlSha256}`;
      const response = await fetch(assetUrl, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`STL HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
      if (digest !== entry.stlSha256) throw new Error('STL fingerprint differs from its geometry report. Reload after export completes.');
      geometry = stlLoader.parse(bytes);
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      const size = bounds.getSize(new THREE.Vector3());
      const triangles = geometry.attributes.position.count / 3;
      if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 0) || Math.abs(size.y - 30) > .1 || triangles < 100) throw new Error('STL dimensions or triangle count are invalid');
      if (entry.faceCount && triangles !== entry.faceCount) throw new Error('STL triangle count differs from its geometry report');
      const boundsMm = [bounds.min.toArray(), bounds.max.toArray()];
      if (!Array.isArray(entry.boundsMm) || !boundsMm.every((point, row) => point.every((value, axis) => Number.isFinite(entry.boundsMm[row]?.[axis]) && Math.abs(value - entry.boundsMm[row][axis]) < .002))) throw new Error('STL bounds differ from the geometry report');
      geometry.translate(0, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
      geometry.scale(1.85 / 30, 1.85 / 30, 1.85 / 30);
      // Preserve the STL's real faceted/rounded recess geometry. One material only.
      const material = new THREE.MeshPhysicalMaterial({ color: flavors[state.flavor].color, roughness: state.material === 'gummy' ? .3 : .65, metalness: 0, clearcoat: state.material === 'gummy' ? .25 : 0 });
      if (serial !== loadSerial || signal.aborted) { geometry.dispose(); material.dispose(); return; }
      mascot = new THREE.Mesh(geometry, material);
      mascot.name = `${variant}-exported-positive-master`;
      mascot.castShadow = true;
      mascot.receiveShadow = true;
      mascot.userData.master = { assetUrl, stlSha256: digest, boundsMm, reportedBoundsMm: entry.boundsMm, measuredDepthMm: size.z, reportedDepthMm: entry.depthMm, triangles, version: report.version || report.kind, sourceSha256: report.sourceSha256, generatorSha256: report.generatorSha256 || null, sourceHashes: report.sourceHashes || null, parametersSha256: report.parametersSha256 || null, provenance: report.provenance || null };
      scene.add(mascot);
      Object.assign(masterEvidence, { status: 'ready', variant, ...mascot.userData.master });
      $('#master-status').textContent = `${Number(size.y.toFixed(2))} mm tall / ${Number(size.z.toFixed(2))} mm total depth · ${triangles.toLocaleString()} triangles · STL ${digest.slice(0, 10)} · ${report.version || report.kind || 'positive master'}`;
      needsRender = true;
    } catch (error) {
      geometry?.dispose();
      if (serial !== loadSerial || signal.aborted) return;
      Object.assign(masterEvidence, { status: 'error', variant, message: error.message });
      $('#master-status').textContent = 'Candy master unavailable';
      $('#master-error').textContent = `${error.message} Choose Agent to view the digital character, or reload to retry the export.`;
      $('#master-error').hidden = false;
      needsRender = true;
    }
  };
  refreshModel();
  resetCamera = (view = 'front') => {
    const positions = { front: [0, 1.3, 4.8], three: [2.7, 1.65, 4.1], side: [4.8, 1.3, 0], back: [0, 1.3, -4.8] };
    camera.position.set(...positions[view]);
    orbit.target.set(0, .97, 0);
    orbit.update();
    document.querySelectorAll('[data-camera]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.camera === view)));
  };
  resetCamera();
  document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => resetCamera(button.dataset.camera)));
  orbit.addEventListener('change', () => { needsRender = true; });
  orbit.addEventListener('start', () => document.querySelectorAll('[data-camera]').forEach(button => button.setAttribute('aria-pressed', 'false')));
  reducedMotion.addEventListener('change', event => { orbit.enableDamping = !event.matches; needsRender = true; });
  renderer.domElement.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const offset = camera.position.clone().sub(orbit.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= .15;
    if (event.key === 'ArrowRight') spherical.theta += .15;
    if (event.key === 'ArrowUp') spherical.phi = Math.max(orbit.minPolarAngle, spherical.phi - .1);
    if (event.key === 'ArrowDown') spherical.phi = Math.min(orbit.maxPolarAngle, spherical.phi + .1);
    camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical));
    orbit.update();
  });
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    needsRender = true;
  };
  new ResizeObserver(resize).observe(stage);
  resize();
  let visible = true, lastTime = 0, lastRender = 0;
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { rootMargin: '150px' }).observe(stage);
  const frame = time => {
    requestAnimationFrame(frame);
    const delta = Math.min((time - lastTime) / 1000, .05);
    lastTime = time;
    if (document.hidden || !visible) return;
    const playing = state.source === 'agent' && state.pose === 'agent' && !state.paused && mascot;
    if (playing) {
      state.time += delta;
      mascot.userData.animate?.(state.time, delta, { status: state.status, moving: state.status === 'working' });
    }
    const controlsChanged = orbit.update();
    if (!needsRender && !controlsChanged && !playing) return;
    if (!needsRender && !controlsChanged && time - lastRender < 1000 / 30) return;
    renderer.render(scene, camera);
    needsRender = false;
    lastRender = time;
  };
  requestAnimationFrame(frame);
  // Read-only diagnostic for browser QA. No app or worker state is written.
  window.sowersDesignReview = { state, renderer, scene, camera, getMascot: () => mascot, masterEvidence };
}

document.addEventListener('keydown', event => {
  if (event.altKey || event.metaKey || event.ctrlKey || event.repeat) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (/^[1-3]$/.test(event.key)) chooseVariant(Object.keys(variants)[Number(event.key) - 1]);
  if (event.key.toLowerCase() === 'm') $('#monochrome').click();
  if (event.key.toLowerCase() === 'r') resetCamera();
});
reducedMotion.addEventListener('change', event => {
  if (event.matches) { state.paused = true; updatePlayback(); }
});
