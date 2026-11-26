import * as THREE from 'three';

// Original soft helmet, front +Z. The local origin is the centre of the head.
// Broad, opaque face forms stay legible at colony zoom without glass sorting.
export function createHelmet({ color = 0xf5823a, seed = 0 } = {}) {
  const root = new THREE.Group();
  root.name = 'Sower helmet';
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xfff3d9, roughness: .78 });
  const orange = new THREE.MeshStandardMaterial({ color, roughness: .65 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x263332, roughness: .94 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xbd6827, roughness: .3, metalness: .14 });
  const honey = new THREE.MeshStandardMaterial({ color: 0xf6b345, roughness: .4 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffedc3, roughness: .65 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x172727, roughness: .8 });
  const unit = new THREE.SphereGeometry(1, 24, 16);
  function oval(name, material, scale, position, parent = root) {
    const mesh = new THREE.Mesh(unit, material);
    mesh.name = name;
    mesh.scale.set(...scale);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  oval('ivory pressure shell', ceramic, [.43, .39, .37], [0, 0, 0]);
  oval('amber visor rim', amber, [.365, .29, .16], [0, -.005, .255]);
  oval('charcoal balaclava', graphite, [.323, .248, .10], [0, -.025, .341]);
  // A thin warm slit reveals only the eyes; the nose and mouth stay covered.
  oval('eye slit', honey, [.255, .078, .027], [0, .052, .431]);
  const eyes = new THREE.Group();
  eyes.name = 'eyes';
  root.add(eyes);
  for (const side of [-1, 1]) {
    oval('warm eye', eyeWhite, [.052, .045, .016], [side * .112, .055, .454], eyes);
    oval('pupil', pupil, [.021, .029, .012], [side * .112 + .006, .054, .47], eyes);
    const fitting = oval('orange temple latch', orange, [.068, .115, .115], [side * .417, .005, .035]);
    fitting.rotation.z = side * -.12;
    oval('temple pivot', graphite, [.017, .045, .045], [side * .476, .005, .045]);
  }
  // The raised honey brow suggests a movable visor without hiding the mask.
  oval('amber brow', honey, [.322, .075, .085], [0, .198, .323]);
  oval('lower mask seam', graphite, [.19, .025, .016], [0, -.17, .431]);
  oval('chin guard', ceramic, [.25, .045, .10], [0, -.267, .285]);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.21, .23, .10, 20), graphite);
  collar.position.y = -.36;
  collar.name = 'neck seal';
  collar.castShadow = true;
  root.add(collar);
  root.userData.eyes = eyes;
  root.userData.blinkPhase = Math.abs(Number(seed) || 0) * 1.73;
  root.userData.design = 'original masked field scout';
  root.userData.animate = (elapsed) => animateHelmet(root, elapsed);
  return root;
}

// Optional quiet blink: deterministic and independent of activity / task state.
export function animateHelmet(helmet, elapsed = 0) {
  const eyes = helmet.userData.eyes;
  if (!eyes || !Number.isFinite(elapsed)) return;
  const phase = ((elapsed + helmet.userData.blinkPhase) % 5.7 + 5.7) % 5.7;
  const open = phase < .14 ? .12 + .88 * Math.abs(phase - .07) / .07 : 1;
  for (const eye of eyes.children) {
    if (!eye.userData.restScaleY) eye.userData.restScaleY = eye.scale.y;
    eye.scale.y = eye.userData.restScaleY * open;
  }
}
