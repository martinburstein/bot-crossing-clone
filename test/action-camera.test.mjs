import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { CameraRig } from '../src/core/camera.js'
import { ActionCamera } from '../src/core/action-camera.js'

class TestRig extends CameraRig { _bind() {} }
function fixture() {
  const rig = new TestRig(new THREE.PerspectiveCamera(38, 1, .5, 900), {}, { get: key => key === 'autoFrame' })
  const director = new ActionCamera(rig)
  const subjects = [
    { id: 'a', pos: new THREE.Vector3(0, 1, 0), yaw: 0, groundSpeed: 1, thread: {} },
    { id: 'b', pos: new THREE.Vector3(20, 1, 10), yaw: Math.PI / 2, groundSpeed: 0, thread: {} },
  ]
  const step = (seconds, list = subjects) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) { director.update(1 / 60, list); rig.update(1 / 60) }
  }
  return { rig, director, subjects, step }
}

test('trailing shot stays behind a moving subject without isometric drift', () => {
  const { rig, subjects } = fixture()
  const subject = subjects[0]
  rig.followSubject(() => subject)
  for (let i = 0; i < 600; i++) { subject.pos.z += .02; rig.update(1 / 60) }
  assert.ok(rig.camera.position.z < subject.pos.z - 8)
  assert.ok(rig.camera.position.y > subject.pos.y + 5)
  assert.ok(Math.abs(rig.polar - 1.05) < .001)
  assert.ok(rig.target.distanceTo(rig.desiredTarget) < .2)
})

test('heading wrap takes the short turn and missing subjects release the shot', () => {
  const { rig, subjects } = fixture()
  let subject = subjects[0]
  subject.yaw = Math.PI - .01
  rig.azimuth = rig.desiredAzimuth = -.02
  rig.followSubject(() => subject)
  rig.update(1 / 60)
  assert.ok(Math.abs(rig.desiredAzimuth) < .03)
  subject.yaw = -Math.PI + .01
  rig.update(1 / 60)
  assert.ok(Math.abs(rig.desiredAzimuth) < .03)
  subject = null
  rig.update(1 / 60)
  assert.equal(rig.following, false)
})

test('idle camera holds its subject, rotates shots, pauses and resumes', () => {
  const { rig, director, subjects, step } = fixture()
  director.setEnabled(true)
  step(1)
  assert.equal(director.subjectId, subjects[0].id)
  step(20)
  assert.equal(director.subjectId, subjects[0].id)
  step(2)
  assert.equal(director.subjectId, subjects[1].id)
  director.interrupt()
  step(9)
  assert.equal(rig.following, false)
  step(1.1)
  assert.equal(rig.following, true)
  director.setEnabled(false)
  step(30)
  assert.equal(rig.following, false)
})

test('manual shots and orbit release tracking, and vanished characters are replaced', () => {
  const { rig, director, subjects, step } = fixture()
  director.setEnabled(true)
  step(1)
  step(.1, [subjects[1]])
  assert.equal(director.subjectId, subjects[1].id)
  rig.focus(new THREE.Vector3(0, 0, 0))
  assert.equal(rig.following, false)
  rig.followSubject(() => subjects[0])
  rig.setOrbit(true)
  assert.equal(rig.following, false)
  assert.equal(rig.orbiting, true)
})
