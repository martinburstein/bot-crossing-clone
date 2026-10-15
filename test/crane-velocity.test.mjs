import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCraneLab, CRANE_LAB } from '../src/world/crane-lab.js';
import { ROARM_MODEL_SOURCE } from '../src/world/roarm-model.js';
import { forwardKinematics, LEGACY_MODEL_REVISION } from '../src/kinematics.mjs';

const EPS_WORLD = 2e-8;
const norm = v => Math.hypot(v.x, v.y, v.z);
const distance = (a, b) => norm(a.clone().sub(b));
const close = (actual, expected, eps = EPS_WORLD) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} differs from ${expected}`);
function setup() {
  const scene = new THREE.Scene();
  const lab = createCraneLab(scene, { now: () => Date.parse('2026-10-12T12:00:00.000Z') });
  const targetNode = lab.group.getObjectByName('velocity-target-marker');
  const modeled = targetNode?.parent;
  const tip = modeled?.getObjectByName('roarm-wrist-tool');
  const markers = () => ({ target: modeled.getObjectByName('velocity-target-marker'), origin: modeled.getObjectByName('velocity-origin-marker') });
  const world = object => { scene.updateMatrixWorld(true); return object.getWorldPosition(new THREE.Vector3()); };
  assert.ok(modeled && tip);
  return { scene, lab, modeled, tip, markers, world };
}
function researchWorld(lab, modeled, xyzMm) {
  const s = ROARM_MODEL_SOURCE.scale;
  const local = new THREE.Vector3(xyzMm[1] * s, (xyzMm[2] + ROARM_MODEL_SOURCE.geometryMm.l1) * s, xyzMm[0] * s);
  modeled.updateMatrixWorld(true);
  return modeled.localToWorld(local);
}
function researchWristWorld(lab, modeled, pose) {
  const fk = forwardKinematics({ ...pose, gripper: .5 }, LEGACY_MODEL_REVISION);
  return researchWorld(lab, modeled, [fk.x, fk.y, fk.z]);
}

test('zero-offset target coincides with actual wrist; changed target follows independent research axes', () => {
  const { lab, modeled, tip, markers, world } = setup();
  try {
    const initial = lab.startVelocity();
    assert.equal(initial.mode, 'velocity');
    assert.equal(initial.velocity.simulationOnly, true);
    const { target, origin } = markers();
    assert.ok(target && origin);
    const zero = lab.setTargetOffsetMm([0, 0, 0]);
    assert.deepEqual(zero.velocity.engine.target.offsetMm, [0, 0, 0]);
    const plant = zero.velocity.engine.plant.position;
    const independentTip = researchWristWorld(lab, modeled, plant);
    assert.ok(distance(world(tip), independentTip) < EPS_WORLD, 'world wrist must match independent legacy research FK and manual axis mapping');
    assert.ok(distance(world(target), world(tip)) < EPS_WORLD, 'zero-offset target node must coincide with actual wrist');
    assert.ok(distance(world(origin), world(tip)) < EPS_WORLD, 'zero-offset origin marker must coincide with actual wrist');

    const changedOffset = [30, -30, 30];
    const changed = lab.setTargetOffsetMm(changedOffset);
    const expectedTarget = researchWorld(lab, modeled, changed.velocity.engine.target.xyzMm);
    const expectedVector = new THREE.Vector3(changedOffset[1], changedOffset[2], changedOffset[0])
      .multiplyScalar(CRANE_LAB.scale * ROARM_MODEL_SOURCE.scale);
    assert.ok(distance(world(target), expectedTarget) < EPS_WORLD, 'changed target node must match independent research coordinates');
    assert.ok(distance(world(target).sub(world(origin)), expectedVector) < EPS_WORLD,
      'changed xyz must map onto world y,z,x axes with source scale');
  } finally { lab.dispose(); }
});

test('other offset edits move marker by exact source scale and marker-tip error follows analytic modeled error', () => {
  const { lab, modeled, tip, markers, world } = setup();
  try {
    lab.startVelocity();
    const { target, origin } = markers();
    const faulted = lab.setVelocityFaults({ latencyMs: 100, dropEvery: 2 });
    assert.deepEqual(faulted.velocity.engine.faultSettings, { latencyMs: 100, dropEvery: 2, acceptedPatchCount: 1, pendingCount: 0 });
    const offset = [-12, 24, 7];
    const changed = lab.setTargetOffsetMm(offset);
    const stateBefore = changed.velocity.engine;
    assert.ok(distance(world(target), researchWorld(lab, modeled, stateBefore.target.xyzMm)) < EPS_WORLD);
    assert.ok(distance(world(origin), researchWorld(lab, modeled, stateBefore.originMm)) < EPS_WORLD);
    const expectedVector = new THREE.Vector3(offset[1], offset[2], offset[0]).multiplyScalar(CRANE_LAB.scale * ROARM_MODEL_SOURCE.scale);
    assert.ok(distance(world(target).sub(world(origin)), expectedVector) < EPS_WORLD);
    for (let i = 0; i < 10; i++) lab.update(.01, i * .01);
    const state = lab.snapshot();
    assert.ok(distance(world(tip), researchWristWorld(lab, modeled, state.velocity.engine.plant.position)) < EPS_WORLD);
    const displayedErrorMm = distance(world(target), world(tip)) / (CRANE_LAB.scale * ROARM_MODEL_SOURCE.scale);
    close(displayedErrorMm, Math.hypot(...state.velocity.engine.modeledPlantErrorMm), 2e-6);
  } finally { lab.dispose(); }
});

test('fresh measured overlay is unchanged by velocity tracking and reset returns to legacy mode', () => {
  const { lab, modeled, world } = setup();
  try {
    const measuredPose = { base: .1, shoulder: .22, elbow: .9, gripper: 2.7 };
    const observation = { state: 'live', source: 'simulator', observedAt: '2026-10-12T12:00:00.000Z', pose: measuredPose };
    const initialMeasurement = lab.updateObservation(observation).measurement;
    assert.equal(initialMeasurement.available, true);
    assert.equal(lab.measured.group.visible, true);
    const measuredWrist = lab.measured.group.getObjectByName('roarm-wrist-tool');
    const before = world(measuredWrist);
    lab.startVelocity();
    assert.deepEqual(lab.snapshot().measurement, initialMeasurement);
    assert.equal(lab.measured.group.visible, true);
    assert.ok(distance(before, world(measuredWrist)) < EPS_WORLD, 'velocity preview must not alter measured overlay');
    assert.equal(modeled.visible, true);
    const reset = lab.reset();
    assert.equal(reset.mode, 'legacy');
    assert.equal(reset.measurement.available, true);
    assert.equal(lab.measured.group.visible, true);
    assert.equal(modeled.visible, false);
    assert.equal(lab.simulation.group.visible, true);
  } finally { lab.dispose(); }
});

test('measured seeding primes legacy preview while velocity mode starts at its fixed internal pose', () => {
  const { lab, modeled, tip } = setup();
  try {
    const pose = { base: .25, shoulder: .4, elbow: 1.2, gripper: 2.4 };
    lab.updateObservation({ state: 'live', source: 'simulator', observedAt: '2026-10-12T12:00:00.000Z', pose });
    const seeded = lab.seedFromMeasured();
    assert.equal(seeded.mode, 'legacy');
    assert.deepEqual(seeded.pose, pose);
    const velocity = lab.startVelocity().velocity.engine;
    assert.deepEqual(velocity.plant.position, { base: .2, shoulder: .3, elbow: 1.1 });
    assert.notDeepEqual(velocity.plant.position, { base: pose.base, shoulder: pose.shoulder, elbow: pose.elbow });
    assert.ok(distance(worldTip(lab, modeled, tip), researchWristWorld(lab, modeled, velocity.plant.position)) < EPS_WORLD);
  } finally { lab.dispose(); }
});

function worldTip(lab, modeled, tip) {
  modeled.updateMatrixWorld(true);
  const scene = modeled.parent.parent;
  scene.updateMatrixWorld(true);
  return tip.getWorldPosition(new THREE.Vector3());
}

test('practice and realtime modes remain reachable around velocity mode', () => {
  const { lab, modeled } = setup();
  try {
    lab.startVelocity();
    lab.practice([{ base: .1, shoulder: .2, elbow: .8, gripper: 2.8 }]);
    assert.equal(lab.snapshot().mode, 'legacy');
    assert.equal(modeled.visible, false);
    assert.equal(lab.simulation.group.visible, true);
    lab.smooth([{ base: .05, shoulder: .14, elbow: .72, gripper: 2.9 }]);
    assert.equal(lab.snapshot().mode, 'realtime');
    assert.equal(modeled.visible, true);
    assert.equal(lab.simulation.group.visible, false);
    assert.equal(lab.snapshot().velocity.status, 'disposed');
    lab.reset();
    assert.equal(lab.snapshot().mode, 'legacy');
  } finally { lab.dispose(); }
});

test('realtime to velocity to realtime transition can restart the realtime driver', () => {
  const { lab } = setup();
  try {
    lab.smooth([{ base: .05, shoulder: .14, elbow: .72, gripper: 2.9 }]);
    assert.equal(lab.snapshot().mode, 'realtime');
    lab.startVelocity();
    assert.equal(lab.snapshot().mode, 'velocity');
    assert.doesNotThrow(() => lab.smooth([{ base: .1, shoulder: .2, elbow: .8, gripper: 2.8 }]));
    assert.equal(lab.snapshot().mode, 'realtime');
  } finally { lab.dispose(); }
});
