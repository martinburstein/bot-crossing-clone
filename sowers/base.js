import * as THREE from 'three'
import { clampProgress, constructionStages, stageProgress } from './progress.mjs'

function randomFor(seed) {
  let state = 2166136261
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619)
  return () => { state += 0x6D2B79F5; let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296 }
}

/** Original modular mission hardware. Ground y=0, airlock/ramp faces +Z. */
export function createMissionBase({ seed = 'Sowers', progress = 0, kind = 'habitat', color = 0xf5823a } = {}) {
  const root = new THREE.Group()
  root.name = `Mission base · ${seed}`
  const rand = randomFor(`${seed}:${kind}`)
  const variant = Math.floor(rand() * 3)
  const parts = Object.fromEntries(constructionStages.map(s => [s.id, []]))
  const scaffold = new THREE.Group(); scaffold.name = 'Temporary assembly gantry'; root.add(scaffold)
  const palette = {
    white: new THREE.MeshStandardMaterial({ color: 0xe8e7df, roughness: .62, metalness: .22 }),
    orange: new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .2 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x26333a, roughness: .7, metalness: .55 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x7e8889, roughness: .58, metalness: .7 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xe8aa44, emissive: 0xff9f29, emissiveIntensity: .48, roughness: .23, metalness: .35 }),
    solar: new THREE.MeshStandardMaterial({ color: 0x182c48, roughness: .3, metalness: .65 }),
  }
  function add(geometry, material, x, y, z, stage, parent = root) {
    const m = new THREE.Mesh(geometry, palette[material]); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true
    parent.add(m); if (stage) { parts[stage].push(m); m.userData.constructionStage = stage }; return m
  }
  const box = (w,h,d,mat,x,y,z,stage,parent) => add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,stage,parent)
  const cyl = (r,h,mat,x,y,z,stage,segments=12) => add(new THREE.CylinderGeometry(r,r,h,segments),mat,x,y,z,stage)
  function beam(a,b,r,mat='steel',stage='frame',parent=root) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start)
    const m=add(new THREE.CylinderGeometry(r,r,delta.length(),6),mat,...start.clone().add(end).multiplyScalar(.5).toArray(),stage,parent)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return m
  }
  // Segmented landing deck, independent footings, and a low orange safety edge.
  for (const x of [-1.35,1.35]) for (const z of [-1.25,1.25]) {
    cyl(.32,.24,'dark',x,.12,z,'foundation')
    cyl(.14,.48,'steel',x,.38,z,'foundation')
  }
  for (let i=0;i<5;i++) box(.67,.18,3.25,'dark',(i-2)*.69,.61,0,'foundation')
  box(3.5,.12,.13,'orange',0,.73,1.61,'foundation')
  box(3.5,.12,.13,'orange',0,.73,-1.61,'foundation')
  // Main pressure-cell frame is visible well before exterior panels arrive.
  const tower = kind === 'command' || kind === 'observatory' || kind === 'relay'
  const utility = kind === 'power' || kind === 'solar'
  const lab = kind === 'lab' || kind === 'research'
  const h = tower ? 2.65 : lab ? 2.45 : 2.3
  const w = tower ? 2.3 : 2.85, d = tower ? 2.3 : 2.55
  const bottom=.78, top=bottom+h
  for (const x of [-w/2,w/2]) for(const z of [-d/2,d/2]) {
    beam([x,bottom,z],[x,top-.28,z],.075,'steel')
    beam([x,top-.28,z],[x*.73,top,z*.73],.075,'orange')
  }
  for(const z of [-d/2,d/2]) {
    beam([-w/2,bottom,z],[w/2,bottom,z],.075)
    beam([-w/2,top-.28,z],[w/2,top-.28,z],.075)
  }
  for(const x of [-w/2,w/2]) beam([x,top-.28,-d/2],[x,top-.28,d/2],.075)
  // Front face split around a recessed amber airlock; broad side windows are inset.
  box(w,.3,d,'white',0,bottom+.15,0,'shell')
  box(w,.32,d,'white',0,top-.38,0,'shell')
  box(w-.2,h-.53,.12,'white',0,bottom+h/2,-d/2,'shell')
  for(const x of [-w/2,w/2]) {
    box(.13,h-.48,d,'white',x,bottom+h/2,0,'shell')
    for(let i=0;i<3;i++) box(.045,.48,.48,'glass',Math.sign(x)*(w/2+.09),bottom+h*.59,(i-1)*.66,'systems')
    box(.05,.14,d+.05,'orange',Math.sign(x)*(w/2+.105),bottom+.37,0,'shell')
  }
  for(const x of [-1,1]) {
    box((w-1.36)/2,h-.48,.16,'white',x*(w+1.36)/4,bottom+h/2,d/2,'shell')
    box(.28,.38,.06,'glass',x*w*.37,bottom+h*.61,d/2+.10,'systems')
  }
  const airlock=box(1.36,2.25,.23,'dark',0,bottom+1.125,d/2+.03,'shell'); airlock.name='airlock-surround'
  const door=box(1.2,2.1,.08,'orange',0,bottom+1.05,d/2+.18,'systems'); door.name='airlock-door'
  box(.82,.48,.04,'glass',0,bottom+1.52,d/2+.23,'systems')
  box(.08,.14,.07,'steel',.44,bottom+.84,d/2+.25,'systems')
  // Faceted roof cap, with a different roof silhouette for each seeded variant.
  const roof = add(new THREE.CylinderGeometry(Math.min(w,d)*.5,Math.min(w,d)*.69,.36,4),'white',0,top-.06,0,'shell')
  roof.rotation.y=Math.PI/4
  box(w*.72,.12,d*.72,'orange',0,top+.15,0,'shell')
  if (variant===1 || tower) {
    cyl(.67,.36,'dark',0,top+.37,0,'systems',12)
    add(new THREE.SphereGeometry(.63,12,6,0,Math.PI*2,0,Math.PI/2),'glass',0,top+.53,0,'systems')
  } else if (variant===2) {
    for(const x of [-.55,.55]) box(.38,.24,1.45,'white',x,top+.32,0,'systems')
  } else {
    for(let i=0;i<4;i++) box(.12,.12,1.3,'dark',(i-1.5)*.25,top+.28,0,'systems')
  }
  // Forward access steps: positive Z is the legible working/entry face.
  for(let i=0;i<3;i++) box(1.5,.18, .42,'steel',0,.59-i*.18,d/2+.45+i*.36,'foundation')
  for(const x of [-.6,.6]) {
    beam([x,.45,2.55],[x,1.12,1.55],.035,'orange','systems')
    beam([x,.14,2.55],[x,.45,2.55],.035,'steel','systems')
  }
  // Modular solar outrigger: dark cell grids and protective orange perimeter.
  const solarX = -2.55, solarZ = utility ? -.2 : -.85
  beam([solarX,.12,solarZ],[solarX,1.05,solarZ],.09,'steel','frame')
  const solar = new THREE.Group(); solar.position.set(solarX,1.08,solarZ); solar.rotation.z=.22; root.add(solar)
  box(1.35,.1,2.2,'orange',0,0,0,'systems',solar)
  for(let x=0;x<2;x++) for(let z=0;z<4;z++) box(.59,.03,.48,'solar',(x-.5)*.64,.07,(z-1.5)*.52,'systems',solar)
  // Seed-specific service pod on the starboard side, joined by an exposed utility line.
  const podZ=.25+rand()*.4
  beam([1.4,.5,podZ],[2.5,.5,podZ],.085,'dark','systems')
  cyl(.54,.18,'dark',2.55,.15,podZ,'foundation')
  cyl(.44,lab?1.25:.86,'white',2.55,lab?.85:.65,podZ,'shell')
  cyl(.46,.15,'orange',2.55,lab?1.52:1.12,podZ,'systems')
  for(let i=0;i<3;i++) box(.15,.3,.06,'dark',2.55+(i-1)*.19,.68,podZ+.44,'systems')
  // Articulated dish and high-visibility beacon share a compact rear mast.
  const mastX=tower?1.02:1.14, mastZ=-1.08
  const mastTop=Math.min(4.35,top+1.15)
  beam([mastX,.72,mastZ],[mastX,mastTop,mastZ],.065,'steel','systems')
  const dish=new THREE.Group(); dish.position.set(mastX,mastTop-.35,mastZ); dish.rotation.x=-.4; dish.rotation.z=.2; root.add(dish)
  const bowl = add(new THREE.SphereGeometry(kind==='relay'?.64:.47,14,6,0,Math.PI*2,0,.95),'white',0,0,0,'systems',dish)
  bowl.rotation.x=Math.PI/2
  beam([mastX,mastTop-.35,mastZ],[mastX,mastTop-.35,mastZ+.48],.025,'orange','systems')
  const beacon=cyl(.1,.18,'glass',mastX,mastTop+.13,mastZ,'beacon',8)
  // Temporary gantry and cross-bracing intentionally remain until commissioning.
  for(const x of [-1.88,1.88]) {
    beam([x,.1,-1.68],[x,top+.48,-1.68],.045,'orange',null,scaffold)
    beam([x,.1,1.7],[x,top+.48,1.7],.045,'orange',null,scaffold)
    beam([x,.7,-1.68],[x,top+.15,1.7],.035,'steel',null,scaffold)
    beam([x,.7,1.7],[x,top+.15,-1.68],.035,'steel',null,scaffold)
    beam([x,top+.46,-1.68],[x,top+.46,1.7],.055,'orange',null,scaffold)
  }
  root.userData.setProgress = fraction => {
    const value=clampProgress(fraction)
    for(const stage of constructionStages) {
      const items=parts[stage.id], visible=Math.floor(stageProgress(value,stage)*items.length+1e-8)
      items.forEach((m,i)=>{m.visible=i<visible})
    }
    scaffold.visible=value>0 && value<.94
    root.userData.progress=value
    root.userData.stage=constructionStages.find(s=>value<s.end)?.id || 'complete'
  }
  root.userData.animate = elapsed => { beacon.material.emissiveIntensity=.48+Math.sin(elapsed*2.5)*.12 }
  root.userData.kind=kind; root.userData.variant=variant
  root.userData.height=mastTop+.22; root.userData.footprint=3.7
  root.userData.constructionParts=parts
  root.userData.setProgress(progress)
  return root
}
