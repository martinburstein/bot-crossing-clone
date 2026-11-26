import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;

/** An original, code-native soft toy astronaut. Feet sit at y=0; forward is +Z. */
export function createSower({ color = 0xf5823a, seed = 0, helmetFactory } = {}) {
  const root = new THREE.Group();
  root.name = 'Sower';
  const numericSeed = Number.isFinite(Number(seed)) ? Number(seed) : 0;
  const phase = ((Math.sin(numericSeed * 127.1 + 19.7) * 43758.5453) % 1 + 1) % 1 * TAU;
  const tint = new THREE.Color(color);
  const suit = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.74 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff4dd, roughness: 0.82 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b4050, roughness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: tint.clone().lerp(new THREE.Color(0xffffff), 0.36), roughness: 0.7 });
  const badgeMaterial = new THREE.MeshStandardMaterial({ color: 0x81bd81, roughness: 0.66, emissive: 0x3c793c, emissiveIntensity: 0.1 });
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const capsule = new THREE.CapsuleGeometry(1, 1, 5, 14);
  const makeBall = (parent, name, material, position, scale) => {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const makeCapsule = (parent, name, material, position, radius, length) => {
    const mesh = new THREE.Mesh(capsule, material);
    mesh.name = name;
    mesh.position.set(...position);
    // The shared capsule spans [-1.5, 1.5]. Scale to the requested overall length.
    mesh.scale.set(radius, length / 3, radius);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const joint = (parent, name, x, y, z) => {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  };

  const bounce = joint(root, 'soft-bounce', 0, 0, 0);
  const torso = joint(bounce, 'torso', 0, 0.91, 0);
  makeBall(torso, 'bean-shaped-suit', suit, [0, 0.04, 0], [0.39, 0.44, 0.29]);
  makeBall(torso, 'soft-bib', cream, [0, 0.08, 0.245], [0.255, 0.29, 0.085]);
  makeBall(torso, 'waist-band', trim, [0, -0.245, 0], [0.365, 0.09, 0.275]);
  makeBall(torso, 'neck-ring', cream, [0, 0.365, 0], [0.3, 0.095, 0.255]);
  const pack = joint(torso, 'little-backpack', 0, 0.06, -0.25);
  makeBall(pack, 'backpack', cream, [0, 0, -0.065], [0.275, 0.29, 0.14]);
  makeBall(pack, 'backpack-color-panel', trim, [0, 0, -0.185], [0.19, 0.2, 0.045]);
  for (const side of [-1, 1]) {
    makeCapsule(pack, 'backpack-pod', suit, [side * 0.23, -0.025, -0.05], 0.075, 0.37);
    makeBall(torso, 'bib-fastener', trim, [side * 0.19, 0.25, 0.28], [0.037, 0.037, 0.021]);
  }

  // A tiny sprout pressed into the bib, built from smooth primitive shapes.
  const emblem = joint(torso, 'sprout-badge', 0, 0.12, 0.328);
  makeCapsule(emblem, 'sprout-stem', badgeMaterial, [0, -0.005, 0], 0.013, 0.12);
  const leafL = makeBall(emblem, 'left-leaf', badgeMaterial, [-0.035, 0.02, 0], [0.047, 0.024, 0.012]);
  leafL.rotation.z = -0.6;
  const leafR = makeBall(emblem, 'right-leaf', badgeMaterial, [0.032, 0.048, 0], [0.047, 0.024, 0.012]);
  leafR.rotation.z = 0.6;
  makeBall(torso, 'small-control-button', trim, [0.13, -0.095, 0.321], [0.025, 0.025, 0.016]);

  const head = joint(torso, 'head-pivot', 0, 0.54, 0);
  let helmet;
  if (typeof helmetFactory === 'function') helmet = helmetFactory({ color, seed });
  if (!helmet?.isObject3D) {
    helmet = new THREE.Group();
    makeBall(helmet, 'fallback-shell', cream, [0, 0, 0], [0.43, 0.405, 0.38]);
    const glass = new THREE.MeshStandardMaterial({ color: 0x26364a, roughness: 0.27 });
    makeBall(helmet, 'fallback-visor', glass, [0, 0.015, 0.295], [0.33, 0.255, 0.12]);
    for (const x of [-0.11, 0.11]) makeBall(helmet, 'fallback-eye', cream, [x, 0.04, 0.409], [0.029, 0.045, 0.012]);
  }
  helmet.name ||= 'helmet';
  head.add(helmet);

  const arms = [-1, 1].map(side => {
    const shoulder = joint(torso, `${side < 0 ? 'left' : 'right'}-shoulder`, side * 0.36, 0.23, 0);
    makeBall(shoulder, 'puffy-shoulder', suit, [side * 0.045, -0.045, 0], [0.17, 0.18, 0.17]);
    makeCapsule(shoulder, 'sleeve', suit, [0, -0.145, 0], 0.12, 0.34);
    const elbow = joint(shoulder, 'elbow', 0, -0.275, 0);
    makeCapsule(elbow, 'forearm', suit, [0, -0.065, 0], 0.115, 0.23);
    makeBall(elbow, 'wrist-cuff', trim, [0, -0.135, 0], [0.13, 0.065, 0.13]);
    makeBall(elbow, 'mitten', cream, [0, -0.215, 0.025], [0.13, 0.14, 0.13]);
    makeBall(elbow, 'mitten-thumb', cream, [-side * 0.095, -0.195, 0.075], [0.062, 0.075, 0.065]);
    return { shoulder, elbow, side };
  });
  const legs = [-1, 1].map(side => {
    const hip = joint(bounce, `${side < 0 ? 'left' : 'right'}-hip`, side * 0.19, 0.67, 0);
    makeCapsule(hip, 'trouser', suit, [0, -0.17, 0], 0.145, 0.42);
    const knee = joint(hip, 'knee', 0, -0.31, 0);
    makeBall(knee, 'knee-pad', trim, [0, 0.015, 0.12], [0.11, 0.105, 0.052]);
    makeCapsule(knee, 'shin', suit, [0, -0.06, 0], 0.132, 0.24);
    makeBall(knee, 'boot-cuff', cream, [0, -0.125, 0], [0.157, 0.075, 0.15]);
    makeBall(knee, 'round-boot', cream, [0, -0.225, 0.055], [0.175, 0.135, 0.235]);
    const sole = makeBall(knee, 'boot-sole', dark, [0, -0.285, 0.063], [0.175, 0.075, 0.235]);
    return { hip, knee, sole, side };
  });

  let locomotion = 0;
  let currentStatus = 'idle';
  const pose = { work: 0, review: 0, wait: 0, complete: 0, error: 0, selected: 0 };
  const footMatrix = new THREE.Matrix4();
  const damp = (value, target, speed, dt) => THREE.MathUtils.damp(value, target, speed, dt);
  root.userData.animate = (elapsed, delta, { status = 'idle', moving = false, selected = false } = {}) => {
    const dt = Number.isFinite(delta) ? clamp(delta, 0, 0.1) : 1 / 60;
    const time = Number.isFinite(elapsed) ? elapsed : 0;
    const t = time + phase;
    currentStatus = status;
    locomotion = damp(locomotion, moving ? 1 : 0, 8, dt);
    for (const [key, state] of Object.entries({ work: 'working', review: 'review', wait: 'waiting', complete: 'complete', error: 'error' })) {
      pose[key] = damp(pose[key], status === state && !moving ? 1 : 0, 5, dt);
    }
    pose.selected = damp(pose.selected, selected ? 1 : 0, 6, dt);
    const gait = t * 7.5;
    const step = Math.sin(gait);
    const idle = 1 - locomotion;
    const breathe = Math.sin(t * 2.4);
    const wiggle = Math.sin(t * 3.1 + 0.6);
    // A short periodic greeting. Seed offsets keep the crowd from saluting together.
    const resting = clamp(1 - pose.work - pose.review - pose.wait - pose.complete - pose.error, 0, 1);
    const greeting = Math.pow(Math.max(0, Math.sin(t * 0.48)), 18) * idle * resting;
    const celebration = pose.complete * Math.max(0, Math.sin(t * 4.2));
    const bounceAmount = Math.abs(step) * 0.065 * locomotion + celebration * 0.09;
    bounce.position.y = bounceAmount;
    torso.rotation.z = Math.sin(t * 1.8) * 0.035 * idle + step * 0.055 * locomotion;
    torso.rotation.x = locomotion * 0.09 + pose.work * 0.13 + pose.review * 0.035;
    torso.scale.set(1 + breathe * 0.012 * idle - bounceAmount * 0.18, 1 + breathe * 0.015 * idle + bounceAmount * 0.32, 1 + breathe * 0.01 * idle);
    head.rotation.x = -torso.rotation.x * 0.55 + pose.work * 0.13 + pose.review * 0.1;
    head.rotation.y = Math.sin(t * 0.75) * 0.13 * idle + pose.wait * Math.sin(t * 1.4) * 0.14;
    head.rotation.z = -torso.rotation.z * 0.6 + pose.review * 0.13 + pose.error * 0.14;
    pack.rotation.z = Math.sin(t * 1.8 - 0.4) * 0.035 * idle + step * 0.04 * locomotion;
    for (const { shoulder, elbow, side } of arms) {
      const swing = Math.sin(gait + side * Math.PI * 0.5);
      shoulder.rotation.x = swing * 0.55 * locomotion + Math.sin(t * 2.1 + side) * 0.045 * idle;
      shoulder.rotation.z = side * (0.15 + 0.035 * wiggle * idle);
      elbow.rotation.x = -0.1 - Math.max(0, swing) * 0.25 * locomotion;
      elbow.rotation.z = 0;
      shoulder.rotation.y = 0;
      if (side === 1) {
        shoulder.rotation.z += (greeting * 1.8 + pose.wait * 0.34 + pose.complete * 2.35 + pose.error * 2.1);
        shoulder.rotation.x -= greeting * 0.35 + pose.work * 1.05 + pose.review * 0.48 + pose.error * 0.42;
        shoulder.rotation.y -= pose.work * 0.25 + pose.review * 0.45;
        elbow.rotation.x -= pose.work * (0.3 + Math.sin(t * 8) * 0.12) + pose.review * 1.1 + pose.error * 1.2;
        elbow.rotation.z -= greeting * Math.sin(t * 13) * 0.28 + pose.wait * Math.sin(t * 5.5) * 0.15;
      } else {
        shoulder.rotation.z -= pose.complete * 2.35;
        shoulder.rotation.x -= pose.work * 0.95 + pose.review * 0.1;
        shoulder.rotation.y += pose.work * 0.22;
        elbow.rotation.x -= pose.work * 0.48;
      }
    }
    for (const { hip, knee, sole, side } of legs) {
      const legStep = Math.sin(gait + (side === 1 ? Math.PI : 0));
      hip.rotation.x = legStep * 0.48 * locomotion;
      hip.rotation.z = side * 0.035 + Math.sin(t * 1.8) * 0.025 * idle;
      knee.rotation.x = Math.max(0, -legStep) * 0.38 * locomotion;
      hip.position.y = 0.67 + Math.max(0, legStep) * 0.035 * locomotion;
      // Ground the ellipsoid sole in rig space, even while the hip rolls sideways.
      hip.updateMatrix();
      knee.updateMatrix();
      sole.updateMatrix();
      footMatrix.multiplyMatrices(hip.matrix, knee.matrix).multiply(sole.matrix);
      const e = footMatrix.elements;
      const soleBottom = e[13] - Math.hypot(e[1], e[5], e[9]);
      hip.position.y += Math.max(0, legStep) * 0.05 * locomotion - soleBottom;
    }
    badgeMaterial.emissiveIntensity = 0.1 + pose.selected * (0.18 + Math.sin(t * 3) * 0.06);
    helmet.userData.animate?.(time, dt, { status, moving, selected });
  };
  root.userData.kind = 'sower';
  root.userData.helmet = helmet;
  root.userData.getStatus = () => currentStatus;
  return root;
}
