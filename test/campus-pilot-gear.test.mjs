import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import * as THREE from 'three'
import {createCampusPilotGear,isCampusPilot} from '../src/world/campus-pilot-gear.js'

const identity={worldProfile:'roarm-campus',roleId:'pilot',workerId:'w00',slotId:'melchior'}
const astronautSource=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../src/agents/astronauts.js'),'utf8')
function extractMethod(startMarker,endMarker,parameters=[],values=[]) {
  const start=astronautSource.indexOf(startMarker),end=astronautSource.indexOf(endMarker,start)
  assert.ok(start>=0&&end>start,`Astronauts method ${startMarker} remains available`)
  const method=astronautSource.slice(start,end).trim()
  return new Function(...parameters,`return ({${method}}).${startMarker.match(/\s+([\w]+)\(/)[1]}`)(...values)
}
const syncCampusPilot=extractMethod('  _syncCampusPilot(agent) {','\n  _disposeCampusPilot',
  ['isCampusPilot','createCampusPilotGear'],[isCampusPilot,createCampusPilotGear])
const disposeCampusPilot=extractMethod('  _disposeCampusPilot(agent) {','\n  _renderScale')
const renderScale=extractMethod('  _renderScale(agent) {','\n  _syncRewards',
  ['CREW_SCALE','PILOT_CAPTAIN_SCALE'],[.56,1.14])

test('campus pilot identity is exact and cannot match an executor or another profile',()=>{
  assert.equal(isCampusPilot(identity),true)
  for(const change of [
    {worldProfile:'roarm-16'},
    {roleId:'r01'},
    {workerId:'w06'},
    {slotId:'balthasar'},
  ])assert.equal(isCampusPilot({...identity,...change}),false)
  assert.equal(isCampusPilot(null),false)
  assert.equal(isCampusPilot(undefined),false)
})

test('astronaut lifecycle attaches campus-only gear and preserves role scales and hidden camper identity',()=>{
  const owner={group:new THREE.Group()},agent={thread:{...identity},scale:1}
  syncCampusPilot.call(owner,agent)
  assert.equal(agent.isCampusPilot,true)
  assert.equal(agent.campusPilotGear.parent,owner.group)
  const gear=agent.campusPilotGear
  gear.update(new THREE.Matrix4(),new THREE.Matrix4(),new THREE.Matrix4())
  gear.hide()
  assert.equal(gear.getObjectByName('campus-pilot-helmet-frame').visible,false)
  const scaleFor=a=>renderScale.call(owner,a)
  assert.equal(scaleFor(agent),.56*1.14)
  assert.equal(scaleFor({scale:1,isRoArm16Captain:true,thread:{worldProfile:'roarm-16'}}),.56*1.14)
  assert.equal(scaleFor({scale:1,isCampusPilot:false,thread:{worldProfile:'15-3A'}}),.56)
  const camper={scale:1,thread:{worldProfile:'roarm-campus',shellId:'w16'}}
  assert.equal(scaleFor(camper),0)
  assert.equal(camper.scale,1,'zero render scale leaves the logical agent state intact')
  disposeCampusPilot.call(owner,agent)
  assert.equal(owner.group.children.length,0)
})

test('pilot fittings stay compact, luminous, bone-aligned, and dispose their owned geometry',()=>{
  const parent=new THREE.Group(),gear=createCampusPilotGear()
  parent.add(gear)
  assert.ok(gear instanceof THREE.Group)
  assert.equal(gear.name,'campus-pilot-gear')
  assert.equal(gear.userData.characterScale,1.14)

  const root=new THREE.Matrix4().compose(new THREE.Vector3(2,1,-3),new THREE.Quaternion(),new THREE.Vector3(1.14,1.14,1.14))
  const head=new THREE.Matrix4(),chest=new THREE.Matrix4().makeTranslation(0,-.2,0)
  gear.update(root,head,chest)
  assert.ok(gear.getObjectByName('campus-pilot-helmet-frame').matrix.equals(root.clone().multiply(head)))
  assert.ok(gear.getObjectByName('campus-pilot-suit-frame').matrix.equals(root.clone().multiply(chest)))
  gear.updateMatrixWorld(true)
  const meshes=[],geometries=new Set(),materials=new Set()
  gear.traverse(object=>{
    if(!object.isMesh)return
    meshes.push(object)
    geometries.add(object.geometry)
    materials.add(object.material)
    object.geometry.computeBoundingBox()
    const bounds=object.geometry.boundingBox
    assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),`${object.name} has finite geometry`)
    assert.ok(object.material instanceof THREE.MeshStandardMaterial)
  })
  assert.ok(meshes.length<=10,`small attachment, got ${meshes.length} meshes`)
  const triangleCount=[...geometries].reduce((sum,geometry)=>sum+(geometry.index?geometry.index.count:geometry.getAttribute('position').count)/3,0)
  assert.ok(triangleCount<=700,`small procedural cost, got ${triangleCount} triangles`)
  const bounds=new THREE.Box3().setFromObject(gear)
  assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))
  assert.ok(bounds.getSize(new THREE.Vector3()).x>1,'helmet ring is visibly wider than the ordinary .96-unit helmet shell')
  assert.ok(gear.getObjectByName('campus-pilot-helmet-ring'))
  assert.ok(gear.getObjectByName('campus-pilot-eye-light-left'))
  assert.ok(gear.getObjectByName('campus-pilot-chest-rank'))
  const cyan=gear.getObjectByName('campus-pilot-eye-light-left').material
  assert.ok(cyan.emissive.getHex()>0,'cyan light has an emissive component')
  assert.equal(gear.getObjectByName('campus-pilot-helmet-ear-left').material.color.getHex(),0x28728e)

  let geometryDisposals=0,materialDisposals=0
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>geometryDisposals++)
  for(const material of materials)material.addEventListener('dispose',()=>materialDisposals++)
  gear.dispose();gear.dispose()
  assert.equal(parent.children.length,0)
  assert.equal(geometryDisposals,geometries.size)
  assert.equal(materialDisposals,materials.size)
})
