import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'
import {IDLE_ACTIONS,applyIdlePose} from './idle-poses.js'

/**
 * Real skeletal animation for the whole crew, in one draw call.
 *
 * The body is KayKit's Mannequin_Medium and the motion is KayKit's Character Animations
 * (both CC0) — hand-authored walk cycles, hammering, sitting, cheering. What they are not
 * is instanceable: three skins a `SkinnedMesh` from a `Skeleton` object, one skeleton per
 * character, which for three hundred threads means three hundred draw calls and three
 * hundred skeletons stepped on the CPU every frame.
 *
 * So the animation is **baked once, at load, into a bone-matrix texture**. Every clip is
 * sampled at a fixed rate and each frame's twenty-one skinning matrices are written into a
 * float texture. At draw time one `InstancedMesh` carries the whole crew, and each instance
 * reads its own row of that texture from a single per-instance float — the frame it is on.
 * Skinning happens in the vertex shader against a texture fetch rather than against a
 * uniform block that would have to be re-uploaded per character.
 *
 * The cost is a texture of about a megabyte and a second of work at boot. What it buys is
 * that the crew costs the same whether there are six of them or six hundred.
 *
 * Because the matrices also sit in an ordinary array on the CPU, anything that has to ride
 * *on* a bone — the helmet, the visor, the backpack — can be placed by reading one matrix
 * out of it, with no skeleton to evaluate. See `boneMatrixAt()`.
 */

/** Sampling rate for the bake. Fast enough that the shader's lerp has nothing to hide. */
const BAKE_FPS = 30

/** Floats per bone in the texture: a full mat4, four RGBA texels. */
const TEXELS_PER_BONE = 4

/**
 * Bones the colony hangs things off. Their *world* transforms are baked into a small
 * side-table on the CPU as well, because a helmet does not want the skinning matrix — it
 * wants to know where the head actually is. Three bones over the whole animation set is a
 * hundred and forty kilobytes; the alternative is evaluating a skeleton per astronaut per
 * frame.
 */
const ATTACH = ['head', 'chest', 'hand.r']

/**
 * The clips, and how the colony uses them. `loop` false means the clip is a one-shot that
 * holds on its last frame — which is what a sit-down or a spawn wants.
 */
const CLIP = {
  ...Object.fromEntries(IDLE_ACTIONS.map(action=>['idle-'+action,{name:'Idle_A',loop:true,pose:'idle-'+action,duration:6}])),
  idle: { name: 'Idle_A', loop: true },
  idleAlt: { name: 'Idle_B', loop: true },
  walk: { name: 'Walking_A', loop: true },
  run: { name: 'Running_A', loop: true },
  work: { name: 'Hammering', loop: true },
  workAlt: { name: 'Working_A', loop: true },
  cheer: { name: 'Cheering', loop: true },
  jump: { name: 'Jump_Full_Short', loop: false },
  wave: { name: 'Waving', loop: true },
  sitDown: { name: 'Sit_Floor_Down', loop: false },
  sit: { name: 'Sit_Floor_Idle', loop: true },
  standUp: { name: 'Sit_Floor_StandUp', loop: false },
  hit: { name: 'Hit_A', loop: true },
  spawn: { name: 'Spawn_Ground', loop: false },
  interact: { name: 'Interact', loop: true },
  tinker: {name:'Working_A',loop:true},
  talk: {name:'Idle_A',loop:true,pose:'talk',duration:4},
  readBoard: {name:'Idle_B',loop:true,pose:'read',duration:5},
  snack: {name:'Idle_A',loop:true,pose:'snack',duration:4},
  drive: {name:'Sit_Floor_Idle',loop:true,pose:'drive',duration:3},
  carryWalk: {name:'Walking_A',loop:true,pose:'carry'},
  carryIdle: {name:'Idle_A',loop:true,pose:'carry'},
  officeSitDown: {name:'Idle_A',loop:false,pose:'office-down',duration:1.2},
  officeTyping: {name:'Idle_A',loop:true,pose:'office-type',duration:4},
  officeStandUp: {name:'Idle_A',loop:false,pose:'office-up',duration:1.2},
}

const CREW_URL = new URL('../assets/crew.glb', import.meta.url).href

/**
 * The mannequin's own head is left out of the body: the colony puts its own helmet, visor
 * and screen-face on the head bone instead, which is the whole of the astronaut's identity.
 */
const DROP_MESHES = ['Mannequin_Medium_Head']

let loading = null
let rig = null

/** Load and bake the rig. Idempotent — the first caller owns the work. */
export function loadCrew() {
  if (!loading) loading = bake().then((r) => (rig = r))
  return loading
}

/** The baked rig, or null if `loadCrew()` has not resolved yet. */
export function crewRig() {
  return rig
}

async function bake(dropMeshes = DROP_MESHES) {
  const gltf = await new GLTFLoader().loadAsync(CREW_URL)
  const root = gltf.scene
  root.updateMatrixWorld(true)

  const skinned = []
  root.traverse((o) => {
    if (o.isSkinnedMesh) skinned.push(o)
  })
  if (!skinned.length) throw new Error('crew: crew.glb has no skinned mesh')

  const skeleton = skinned[0].skeleton
  const bones = skeleton.bones
  const boneIndex = new Map(bones.map((b, i) => [b.name, i]))

  const geometry = mergeBody(skinned, dropMeshes)
  const bake = bakeClips(root, skeleton, skinned[0], gltf.animations)

  return { geometry, bones, boneIndex, ...bake }
}

/**
 * Merge the mannequin's six parts into one geometry.
 *
 * They already share a skin, so the joint indices line up and no remapping is needed. The
 * UVs go: the pack's texture is a name badge and a smiley, and the colony paints its crew
 * from its own suit palette instead.
 */
function mergeBody(skinned, dropMeshes) {
  const drop = new Set(dropMeshes)
  const parts = []

  for (const mesh of skinned) {
    if (drop.has(mesh.name)) continue
    const geo = new THREE.BufferGeometry()
    const src = mesh.geometry
    const count = src.attributes.position.count

    for (const [name, size] of [
      ['position', 3],
      ['normal', 3],
      ['skinIndex', 4],
      ['skinWeight', 4],
    ]) {
      const a = src.getAttribute(name)
      if (!a) throw new Error(`crew: ${mesh.name} has no ${name}`)
      const data = new Float32Array(count * size)
      for (let i = 0; i < count; i++) {
        for (let k = 0; k < size; k++) data[i * size + k] = a.getComponent(i, k)
      }
      geo.setAttribute(name, new THREE.BufferAttribute(data, size))
    }
    if (src.index) geo.setIndex(Array.from(src.index.array))
    parts.push(geo)
  }

  const merged = parts.length === 1 ? parts[0] : BufferGeometryUtils.mergeGeometries(parts, false)
  if (merged !== parts[0]) parts.forEach((g) => g.dispose())
  merged.computeBoundingBox()
  return merged
}

/**
 * Step every clip and record the skinning matrices.
 *
 * What is stored is the matrix the shader can use directly — three's bind matrices folded
 * in — so the vertex stage is a plain weighted sum with nothing left to reconstruct.
 */
function bakeClips(root, skeleton, mesh, animations) {
  const boneCount = skeleton.bones.length
  const byName = new Map(animations.map((a) => [a.name, a]))

  // Lay the clips out end to end in one table and remember where each one starts.
  const clips = {}
  let frameCount = 0
  for (const [key, spec] of Object.entries(CLIP)) {
    const clip = byName.get(spec.name)
    if (!clip) {
      console.warn(`crew: crew.glb has no clip "${spec.name}" — run \`npm run assets\``)
      continue
    }
    // A looping clip needs its wrap-around frame; a one-shot ends where it ends.
    const duration=spec.duration || clip.duration
    const frames = Math.max(2, Math.round(duration * BAKE_FPS) + 1)
    clips[key] = { start: frameCount, frames, duration, loop: spec.loop, name: spec.name,pose:spec.pose }
    frameCount += frames
  }

  const stride = boneCount * TEXELS_PER_BONE * 4
  const data = new Float32Array(frameCount * stride)

  // Side-table of world transforms for the attachment bones — what the helmet and backpack
  // read. The skinning matrices in `data` cannot answer "where is the head": they map bind
  // space to posed space, which is only the same thing when the bind matrices are identity.
  // Three's loader sanitises node names on the way in — a dot is a path separator in an
  // animation track, so `hand.r` arrives as `handr`. Matching loosely costs nothing and the
  // alternative is a table of silent zeros and a prop pinned to the world origin.
  const plain = (n) => n.replace(/[.\s_]/g, '').toLowerCase()
  const attachBones = ATTACH.map((name) => skeleton.bones.findIndex((b) => plain(b.name) === plain(name)))
  const lost = ATTACH.filter((_, i) => attachBones[i] < 0)
  if (lost.length) throw new Error(`crew: no bone for attachment ${lost.join(', ')}`)
  const attach = new Float32Array(frameCount * ATTACH.length * 16)

  const mixer = new THREE.AnimationMixer(root)
  const scratch = new THREE.Matrix4()
  // `world * bindMatrixInverse * bone * bindMatrix` is the whole of three's skinning
  // pipeline for a vertex, so baking it means the shader has only the weighted sum left.
  // The mesh's own world matrix belongs in there because the merged geometry is left in
  // its authored frame rather than being pre-transformed.
  const bind = mesh.bindMatrix
  const pre = new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse)

  for (const spec of Object.values(clips)) {
    const clip = byName.get(spec.name)
    const action = mixer.clipAction(clip)
    action.play()

    for (let f = 0; f < spec.frames; f++) {
      const raw = spec.frames > 1 ? (f / (spec.frames - 1)) * spec.duration : 0
      // The last frame of a loop is the clip's own end, which equals its start again — that
      // is exactly the wrap frame the shader interpolates into. A one-shot must stop just
      // short of it: sampled at precisely its duration the mixer's default loop mode wraps,
      // so the frame a sit-down or a spawn *holds* would be the pose it started from, and
      // the astronaut snaps back to standing on the last frame of sitting down.
      const t = spec.loop ? raw : Math.min(raw, Math.max(0, spec.duration - 1e-3))
      mixer.setTime(spec.pose?.startsWith('office-')||spec.pose?.startsWith('idle-')?0:t)
      const restore=spec.pose?.startsWith('idle-')?applyIdlePose(skeleton.bones,spec.pose.slice(5),t,spec.duration):spec.pose?.startsWith('office-')?applyOfficePose(skeleton.bones,spec.pose,t):applyCampPose(skeleton.bones,spec.pose,t)
      root.updateMatrixWorld(true)
      skeleton.update()

      const offset = (spec.start + f) * stride
      for (let b = 0; b < boneCount; b++) {
        scratch.fromArray(skeleton.boneMatrices, b * 16)
        scratch.premultiply(pre).multiply(bind)
        scratch.toArray(data, offset + b * 16)
      }

      const attachOffset = (spec.start + f) * ATTACH.length * 16
      attachBones.forEach((b, slot) => {
        if (b < 0) return
        skeleton.bones[b].matrixWorld.toArray(attach, attachOffset + slot * 16)
      })
      restore()
    }

    action.stop()
  }

  const texture = new THREE.DataTexture(
    data,
    boneCount * TEXELS_PER_BONE,
    frameCount,
    THREE.RGBAFormat,
    THREE.FloatType
  )
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true

  mixer.stopAllAction()
  mixer.uncacheRoot(root)

  return {
    boneTexture: texture,
    attach,
    attachSlot: new Map(ATTACH.map((name, i) => [name, i])),
    boneCount,
    frameCount,
    clips,
    fps: BAKE_FPS,
  }
}

// Additive camp gestures are baked into the same GPU animation table as locomotion.
// Restore local quaternions after every sample so untracked bones cannot accumulate drift.
function applyOfficePose(bones,pose,time){
  const saved=bones.map(b=>[b,b.position.clone(),b.quaternion.clone()]);
  const find=name=>bones.find(b=>b.name.replace(/[.\s_]/g,'').toLowerCase()===name);
  const smooth=v=>{v=THREE.MathUtils.clamp(v,0,1);return v*v*(3-2*v);};
  const seated=pose==='office-down'?smooth(time/1.2):pose==='office-up'?1-smooth(time/1.2):1;
  const root=bones[0];root.updateWorldMatrix(true,true);
  for(const [side,suffix]of [[-1,'r'],[1,'l']]){const upper=find('upperarm'+suffix),world=upper.getWorldQuaternion(new THREE.Quaternion());world.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),side*.34));upper.quaternion.copy(upper.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));upper.updateWorldMatrix(true,true);}
  const originals=Object.fromEntries(['footl','footr','handl','handr'].map(n=>[n,{position:find(n).getWorldPosition(new THREE.Vector3()),rotation:find(n).getWorldQuaternion(new THREE.Quaternion())}]));
  find('hips').position.y-=.17*seated;
  find('chest').quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.045*seated,0,0)));
  root.updateWorldMatrix(true,true);
  function aim(bone,child,target){
    const origin=bone.getWorldPosition(new THREE.Vector3()),from=child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
    const world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(from,to));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(true,true);
  }
  function solve(upper,lower,end,target,out,rotation){
    const origin=upper.getWorldPosition(new THREE.Vector3()),joint=lower.getWorldPosition(new THREE.Vector3()),tip=end.getWorldPosition(new THREE.Vector3());
    const a=origin.distanceTo(joint),b=joint.distanceTo(tip),delta=target.clone().sub(origin),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(a-b)+.0001,a+b-.0001),direction=delta.normalize();
    out.addScaledVector(direction,-out.dot(direction)).normalize();
    const c=THREE.MathUtils.clamp((a*a+distance*distance-b*b)/(2*a*distance),-1,1);
    const bend=origin.clone().addScaledVector(direction,a*c).addScaledVector(out,a*Math.sqrt(1-c*c));
    aim(upper,lower,bend);aim(lower,end,origin.clone().addScaledVector(direction,distance));
    end.quaternion.copy(end.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));end.updateWorldMatrix(true,true);
  }
  for(const [side,suffix]of [[-1,'r'],[1,'l']]){
    const foot=originals['foot'+suffix],target=foot.position.clone();target.z=THREE.MathUtils.lerp(target.z,.25,seated);
    solve(find('upperleg'+suffix),find('lowerleg'+suffix),find('foot'+suffix),target,new THREE.Vector3(0,0,1),foot.rotation);
    const hand=originals['hand'+suffix],lift=smooth(seated/.42),reach=smooth((seated-.30)/.70);
    const tap=pose==='office-type'?.010*(1+Math.sin(time*Math.PI*6+side*Math.PI/2))*smooth(time/.25)*smooth((4-time)/.25):0;
    const palm=new THREE.Vector3(THREE.MathUtils.lerp(hand.position.x,side*.30,reach),THREE.MathUtils.lerp(hand.position.y,1.00+tap,lift)+.05*Math.sin(Math.PI*reach),THREE.MathUtils.lerp(hand.position.z,.52,lift));
    const rotation=hand.rotation.clone().slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0)),lift);
    solve(find('upperarm'+suffix),find('lowerarm'+suffix),find('hand'+suffix),palm,new THREE.Vector3(side,-.15,0),rotation);
  }
  find('head').quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.025*seated,pose==='office-type'?.025*Math.sin(time*Math.PI/2):0,0)));
  return ()=>{for(const [bone,position,rotation]of saved){bone.position.copy(position);bone.quaternion.copy(rotation);}};
}

function applyCampPose(bones,pose,time) {
  if(!pose)return ()=>{}
  const saved=[]
  const rotate=(name,x=0,y=0,z=0)=>{
    const bone=bones.find(b=>b.name.replace(/[.\s_]/g,'').toLowerCase()===name)
    if(!bone)return
    saved.push([bone,bone.quaternion.clone()])
    bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)))
  }
  const wave=Math.sin(time*Math.PI/2),sip=.5-.5*Math.cos(time*Math.PI/2)
  if(pose==='talk') {rotate('head',.05*wave,.16*wave);rotate('upperarmr',-.35-.13*wave,0,.22);rotate('lowerarmr',-.55,0,.12*wave);rotate('chest',0,.06*wave)}
  if(pose==='read') {rotate('head',.12+.06*Math.sin(time*Math.PI*2/5),.16*Math.sin(time*Math.PI*2/5));rotate('upperarml',-.45);rotate('lowerarml',-.75)}
  if(pose==='snack') {rotate('upperarmr',-.55-.38*sip,0,.12);rotate('lowerarmr',-1.15-.42*sip);rotate('head',.08*sip);rotate('handr',0,0,.1*sip)}
  if(pose==='drive') {rotate('upperarmr',-.65,0,.15);rotate('upperarml',-.65,0,-.15);rotate('lowerarmr',-.5);rotate('lowerarml',-.5);rotate('head',0,.08*Math.sin(time*Math.PI*2/3))}
  if(pose==='carry') {
    const find=name=>bones.find(b=>b.name.replace(/[.\s_]/g,'').toLowerCase()===name),chest=find('chest');
    // Two-bone arm placement is baked, never evaluated by a live worker or per-frame IK.
    if(chest)for(const [side,suffix]of [[-1,'r'],[1,'l']]){
      const upper=find('upperarm'+suffix),lower=find('lowerarm'+suffix),hand=find('hand'+suffix);if(!upper||!lower||!hand)continue;
      saved.push([upper,upper.quaternion.clone()],[lower,lower.quaternion.clone()]);chest.updateWorldMatrix(true,true);
      const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=lower.getWorldPosition(new THREE.Vector3()),palm=hand.getWorldPosition(new THREE.Vector3());
      const target=chest.localToWorld(new THREE.Vector3(side*.4,.02,.53)),l1=shoulder.distanceTo(elbow),l2=elbow.distanceTo(palm),delta=target.clone().sub(shoulder),distance=Math.min(delta.length(),l1+l2-.001),direction=delta.normalize();
      const out=new THREE.Vector3(side,0,0).addScaledVector(direction,-direction.x*side).normalize(),cos=THREE.MathUtils.clamp((l1*l1+distance*distance-l2*l2)/(2*l1*distance),-1,1);
      const bend=shoulder.clone().addScaledVector(direction,l1*cos).addScaledVector(out,l1*Math.sqrt(1-cos*cos));
      function aim(bone,child,point){const origin=bone.getWorldPosition(new THREE.Vector3()),from=child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize(),to=point.clone().sub(origin).normalize(),change=new THREE.Quaternion().setFromUnitVectors(from,to),world=bone.getWorldQuaternion(new THREE.Quaternion());world.premultiply(change);const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(world));bone.updateWorldMatrix(true,true);}
      aim(upper,lower,bend);aim(lower,hand,target);
    hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0))));hand.updateWorldMatrix(true,true);
    }
  }
  return ()=>saved.forEach(([bone,q])=>bone.quaternion.copy(q))
}

/**
 * Where an attachment bone is, in character space, on a given frame.
 *
 * This is how anything worn rather than skinned gets placed: the helmet reads `head`, the
 * backpack reads `chest`. A straight array slice — no skeleton is evaluated and nothing is
 * allocated. The frame is rounded rather than interpolated; at 30 fps the worst case is
 * half a frame of lag on a helmet whose own body is drawn from the same table, and matrix
 * interpolation here would cost more than it is worth.
 */
export function attachMatrixAt(rig, frame, slot, out) {
  const f = Math.min(rig.frameCount - 1, Math.max(0, Math.round(frame)))
  return out.fromArray(rig.attach, (f * ATTACH.length + slot) * 16)
}

/**
 * Where in the frame table an agent is, given a clip and how long it has been playing.
 * Looping clips wrap; one-shots hold their last frame.
 */
export function frameFor(clip, time) {
  if (!clip) return 0
  const last = clip.frames - 1
  const f = time * BAKE_FPS
  return clip.start + (clip.loop ? f % last : Math.min(f, last))
}

/**
 * Adds GPU skinning to any three material.
 *
 * Slotted in around `<beginnormal_vertex>` and `<begin_vertex>`, which are upstream of
 * three's own instancing — so the skinned vertex still goes through `instanceMatrix` and
 * the crew stays one instanced draw. Three's `USE_SKINNING` path is deliberately not used:
 * it binds to a `Skeleton` object, which is the thing being replaced.
 *
 * `normals` must be false for the shadow pass. Three's depth shader only includes
 * `<beginnormal_vertex>` behind `USE_DISPLACEMENTMAP`, so a depth material decorated as if
 * it had normals would skin against an uninitialised matrix and the crew would cast the
 * shadow of a folded-up bind pose.
 */
export function decorateSkinned(material, uniforms, { normals = true } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute vec4 skinIndex;
         attribute vec4 skinWeight;
         attribute float aFrame;
         uniform highp sampler2D uBones;
         uniform float uFrameMax;

         mat4 boneAt( int bone, int row ) {
           int x = bone * ${TEXELS_PER_BONE};
           return mat4(
             texelFetch( uBones, ivec2( x + 0, row ), 0 ),
             texelFetch( uBones, ivec2( x + 1, row ), 0 ),
             texelFetch( uBones, ivec2( x + 2, row ), 0 ),
             texelFetch( uBones, ivec2( x + 3, row ), 0 )
           );
         }

         // The two rows either side of a fractional frame, mixed. A component-wise mix of
         // two skinning matrices is not a true interpolation, but a thirtieth of a second
         // apart the error is far below a pixel and it costs one instruction. Both rows are
         // clamped: a one-shot clip holds on its last frame, and its "next" row would
         // otherwise be the first frame of whatever clip was baked after it.
         mat4 botSkinMatrix() {
           float f = clamp( aFrame, 0.0, uFrameMax );
           int a = int( floor( f ) );
           int b = min( a + 1, int( uFrameMax ) );
           float t = f - float( a );
           mat4 m = mat4( 0.0 );
           for ( int i = 0; i < 4; i ++ ) {
             float w = skinWeight[ i ];
             if ( w <= 0.0 ) continue;
             int bone = int( skinIndex[ i ] );
             m += w * ( boneAt( bone, a ) * ( 1.0 - t ) + boneAt( bone, b ) * t );
           }
           return m;
         }

         mat4 botSkin;`
      )

    if (normals) {
      // Three runs the normal stage first, so the matrix is built there and the position
      // stage reuses it — one set of texture fetches per vertex rather than two.
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
           botSkin = botSkinMatrix();
           objectNormal = mat3( botSkin ) * objectNormal;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           transformed = ( botSkin * vec4( transformed, 1.0 ) ).xyz;`
        )
    } else {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         botSkin = botSkinMatrix();
         transformed = ( botSkin * vec4( transformed, 1.0 ) ).xyz;`
      )
    }
  }
  return material
}
