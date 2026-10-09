import * as THREE from 'three'

const SHAPES=new Set(['box','sphere','cylinder','cone','torus'])
const KINDS=new Set(['hat','accessory'])
const ANCHORS=new Set(['head','back'])
const DESIGN_KEYS=['name','story','kind','anchor','parts']
const PART_KEYS=['shape','color','position','rotation','scale']
const WORKER_ID=/^(?:w(?:0[0-9]|1[0-5])|balthasar|casper)$/
const HASH=/^[a-f0-9]{64}$/i
const freezeDeep=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freezeDeep(child)}return value}

// Authored for the accepted-only wearable lifecycle contract.
// This is a blueprint proposal; no earned reward is created by this module.
export const DOCKLIGHT_MERIDIAN_CROWN=freezeDeep({
  name:'Docklight Meridian Crown',
  story:'A low-profile copper survey cap with a pale crown, a blue rearward marker, and an amber beacon. It marks a worker whose accepted reward is projected into their inventory and stays attached to the animated astronaut head.',
  kind:'hat',anchor:'head',parts:[
    {shape:'torus',color:'#E99A46',position:[0,.96,-.22],rotation:[Math.PI/2,0,0],scale:[.68,.68,.12]},
    {shape:'cone',color:'#E7E1D7',position:[0,1.12,-.22],rotation:[0,0,0],scale:[.48,.34,.48]},
    {shape:'box',color:'#91CBD3',position:[0,1.0,-.40],rotation:[0,0,0],scale:[.24,.08,.055]},
    {shape:'sphere',color:'#F2BD55',position:[0,1.31,-.22],rotation:[0,0,0],scale:[.13,.12,.13]},
  ],
})

function plainRecord(value) {return value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)}
function exactKeys(value,keys) {const found=Object.keys(value).sort(),expected=[...keys].sort();return found.length===expected.length&&found.every((key,index)=>key===expected[index])}
function vector(value,label,{positive=false,max=2}={}) {
  if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))throw new TypeError(`${label} must be a finite 3-tuple`)
  if(positive?value.some(n=>n<=0||n>max):value.some(n=>Math.abs(n)>max))throw new RangeError(`${label} is outside the allowed bounds`)
  return [...value]
}
function extentY(part) {
  const [sx,sy,sz]=part.scale
  if(part.shape==='box'||part.shape==='sphere')return sy*.5
  if(part.shape==='cylinder'||part.shape==='cone')return sy*.5
  // TorusGeometry lies in XY; estimate its rotated world-Y extent from its
  // normal thickness, including the recipe's Euler rotation.
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.rotation))
  const radius=.6,local=new THREE.Vector3(radius*sx,0,0).applyQuaternion(q)
  const other=new THREE.Vector3(0,radius*sy,0).applyQuaternion(q)
  const tube=new THREE.Vector3(0,0,.1*sz).applyQuaternion(q)
  return Math.abs(local.y)+Math.abs(other.y)+Math.abs(tube.y)
}
function extentZ(part) {
  if(part.shape==='torus')return .6*Math.max(...part.scale)
  return .5*part.scale[2]
}

/** Strict JSON-only recipe validation at the renderer boundary. */
export function validateRewardDesign(input) {
  if(!plainRecord(input)||!exactKeys(input,DESIGN_KEYS))throw new TypeError('reward design has an invalid shape')
  if(typeof input.name!=='string'||input.name.trim()!==input.name||input.name.length<1||input.name.length>80)throw new TypeError('reward design name must be 1-80 trimmed characters')
  if(typeof input.story!=='string'||input.story.trim()!==input.story||input.story.length<1||input.story.length>500)throw new TypeError('reward design story must be 1-500 trimmed characters')
  if(!KINDS.has(input.kind)||!ANCHORS.has(input.anchor)||(input.kind==='hat'&&input.anchor!=='head')||!Array.isArray(input.parts)||input.parts.length<1||input.parts.length>24)throw new TypeError('reward design kind, anchor, or part count is invalid')
  const parts=input.parts.map((part,index)=>{
    if(!plainRecord(part)||!exactKeys(part,PART_KEYS))throw new TypeError(`reward part ${index} has an invalid shape`)
    if(!SHAPES.has(part.shape))throw new TypeError(`reward part ${index} has an unsupported primitive`)
    if(typeof part.color!=='string'||!/^#[0-9a-f]{6}$/i.test(part.color))throw new TypeError(`reward part ${index} color must be #RRGGBB`)
    const clean={shape:part.shape,color:part.color.toUpperCase(),position:vector(part.position,`reward part ${index} position`),rotation:vector(part.rotation,`reward part ${index} rotation`),scale:vector(part.scale,`reward part ${index} scale`,{positive:true})}
    if(input.kind==='hat'&&input.anchor==='head') {
      const minY=clean.position[1]-extentY(clean)
      if(minY<.88)throw new RangeError(`reward hat part ${index} floats below the helmet crown`)
      if(clean.position[2]+extentZ(clean)>.22&&minY<1.02)throw new RangeError(`reward hat part ${index} obscures the visor`)
    }
    return clean
  })
  return {name:input.name,story:input.story,kind:input.kind,anchor:input.anchor,parts}
}

/** Stable renderer-side geometry key; the core remains authoritative for SHA-256 awards. */
export function rewardGeometryKey(design) {
  const clean=validateRewardDesign(design)
  const parts=clean.parts.map(({shape,color,position,rotation,scale})=>({shape,color:color.toUpperCase(),position,rotation,scale}))
  // Match core's fingerprint canonicalization: part order is not geometry.
  parts.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return JSON.stringify({kind:clean.kind,anchor:clean.anchor,parts})
}

/** Render only unique accepted records projected for their owning worker. */
export function selectEarnedWearables(records,workerId) {
  if(!Array.isArray(records)||!WORKER_ID.test(workerId||''))return {inventory:[],wearing:null}
  const seenFingerprints=new Set(),seenGeometry=new Set(),inventory=[]
  for(const record of records) {
    if(!plainRecord(record)||record.workerId!==workerId||!['taskId','submissionId','leaseId'].every(key=>typeof record[key]==='string'&&record[key].length>0)||!Number.isFinite(record.awardedAt)||record.awardedAt<0||!Number.isSafeInteger(record.sequence)||record.sequence<1||!HASH.test(record.fingerprint||''))continue
    let design
    try {design=validateRewardDesign(record.rewardDesign)} catch {continue}
    const fingerprint=record.fingerprint.toLowerCase(),geometryKey=rewardGeometryKey(design)
    if(seenFingerprints.has(fingerprint)||seenGeometry.has(geometryKey))continue
    seenFingerprints.add(fingerprint);seenGeometry.add(geometryKey)
    inventory.push({taskId:record.taskId,submissionId:record.submissionId,leaseId:record.leaseId,workerId,awardedAt:record.awardedAt,sequence:record.sequence,fingerprint,design})
  }
  inventory.sort((a,b)=>a.awardedAt-b.awardedAt||a.sequence-b.sequence)
  return {inventory,wearing:inventory.at(-1)||null}
}

function geometry(shape) {
  switch(shape) {
    case 'box':return new THREE.BoxGeometry(1,1,1)
    case 'sphere':return new THREE.SphereGeometry(.5,8,6)
    case 'cylinder':return new THREE.CylinderGeometry(.5,.5,1,8)
    case 'cone':return new THREE.ConeGeometry(.5,1,8)
    case 'torus':return new THREE.TorusGeometry(.5,.1,6,12)
  }
}

export function createRewardWearable(input) {
  const design=validateRewardDesign(input),group=new THREE.Group(),geometries=new Set(),materials=new Set()
  group.name=`earned-${design.kind}-${design.anchor}`
  for(const part of design.parts) {
    const geo=geometry(part.shape),material=new THREE.MeshStandardMaterial({color:part.color,roughness:.62,metalness:part.shape==='torus'?.35:.04})
    geometries.add(geo);materials.add(material)
    const mesh=new THREE.Mesh(geo,material);mesh.name=`reward-${part.shape}`
    mesh.position.set(...part.position);mesh.rotation.set(...part.rotation);mesh.scale.set(...part.scale)
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)
  }
  let disposed=false
  return {group,design,dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const geo of geometries)geo.dispose();for(const material of materials)material.dispose()}}
}

/** Reconcile one agent's accepted inventory without ever creating an award. */
export function syncRewardWearable(agent,records,workerId,parent,boneReady) {
  const selected=selectEarnedWearables(records,workerId),wearing=selected.wearing,fingerprint=wearing?.fingerprint||null
  agent.earnedWearables=selected.inventory;agent.wornReward=wearing
  if(agent.rewardFingerprint===fingerprint&&(!wearing||agent.rewardWearable||!boneReady))return selected
  agent.rewardWearable?.dispose();agent.rewardWearable=null;agent.rewardFingerprint=fingerprint
  if(wearing&&boneReady) {
    const wearable=createRewardWearable(wearing.design);wearable.group.matrixAutoUpdate=false;wearable.group.visible=false
    parent.add(wearable.group);agent.rewardWearable={...wearable,fingerprint,anchor:wearing.design.anchor}
  }
  return selected
}

/** Place local recipe geometry on the same per-frame bone transform as the helmet/backpack. */
export function applyRewardBoneTransform(wearable,root,bone) {
  if(!wearable?.group?.matrix||!root?.isMatrix4||!bone?.isMatrix4)throw new TypeError('wearable and bone matrices are required')
  wearable.group.matrix.multiplyMatrices(root,bone)
  wearable.group.matrixWorldNeedsUpdate=true;wearable.group.visible=true
  return wearable.group.matrix
}
