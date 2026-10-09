import * as THREE from 'three'

// Source dimensions are the controller's EEMode-0 kinematic approximation.
// The June 30 source supplies the small distal link offset; this is a source
// equation reference, not an installed-firmware attestation.
export const ROARM_MODEL_SOURCE = Object.freeze({
  mode: 'EEMode 0',
  revision: 'roarm-m2-260630-eemode0-sha256:d07556deb490cfcb1a439d7b6af023a696c7e95eb7950c7971ea0c85a3cabb90',
  geometryMm: Object.freeze({ l1: 126.06, l2A: 236.82, l2B: 30, l3A: 280.15, l3B: 1.73 }),
  scale: 0.035,
  coordinates: 'x=robotY*S, y=(robotZ+l1)*S+0.7, z=robotX*S',
  gripper: Object.freeze({
    closedRawRad: 3.144660615,
    closedTicks: 2050,
    openCandidateRawRad: 1.08,
    openCandidateTicks: 705,
    opening: 'illustrative only; open endpoint candidate is not calibrated',
  }),
})
const { l1, l2A, l2B, l3A, l3B } = ROARM_MODEL_SOURCE.geometryMm
const SCALE = ROARM_MODEL_SOURCE.scale
const L2 = Math.hypot(l2A,l2B), L3 = Math.hypot(l3A,l3B)
const T2 = Math.atan2(l2B,l2A), T3 = Math.atan2(l3B,l3A)
const MATERIALS = Object.freeze({
  base: 0x4e606b, dark: 0x273943, cream: 0xe7e1d7,
  orange: 0xe99a46, steel: 0x7f8d91, glass: 0x91cbd3,
  rubber: 0x30363a,
})

function requirePose(pose) {
  if (!pose || typeof pose !== 'object') throw new TypeError('observation pose must be an object')
  for (const key of ['base','shoulder','elbow','gripper'])
    if (!Number.isFinite(pose[key])) throw new TypeError(`observation pose.${key} must be finite radians`)
  return pose
}

/** Calculate the sourced two-link forward kinematics without commanding motion. */
export function roarmForwardKinematics(pose) {
  requirePose(pose)
  const shoulder = pose.shoulder + T2
  const distal = pose.shoulder + pose.elbow + T3
  const radial = L2 * Math.sin(shoulder) + L3 * Math.sin(distal)
  const robotZ = L2 * Math.cos(shoulder) + L3 * Math.cos(distal)
  return {
    robotX: radial*Math.cos(pose.base),
    robotY: radial*Math.sin(pose.base),
    robotZ,
    x: radial*Math.sin(pose.base)*SCALE,
    y: (robotZ+l1)*SCALE+.7,
    z: radial*Math.cos(pose.base)*SCALE,
    shoulderAngle: shoulder,
    distalAngle: distal,
  }
}

function materialSet() {
  return Object.fromEntries(Object.entries(MATERIALS).map(([name,color]) => [name,
    new THREE.MeshStandardMaterial({color,roughness:name==='steel'?.38:.68,metalness:name==='steel'?.35:.02})]))
}

/**
 * Build a static low-polygon RoArm model. Joint transforms change only when a
 * valid measured observation is supplied; stale observations freeze the last
 * measured pose and never synthesize interpolation or autonomous motion.
 */
export function createRoArmModel() {
  const group = new THREE.Group(); group.name='roarm-measured-model'; group.visible=false;group.position.y=.7
  const materials=materialSet(), geometries=new Set()
  function mesh(parent,name,geometry,material,position=[0,0,0]) {
    geometries.add(geometry)
    const object=new THREE.Mesh(geometry,materials[material]); object.name=name
    object.position.set(...position); object.castShadow=true; object.receiveShadow=true; parent.add(object); return object
  }
  function cylinder(parent,name,radiusTop,radiusBottom,height,material,sides=8,position=[0,0,0]) {
    return mesh(parent,name,new THREE.CylinderGeometry(radiusTop,radiusBottom,height,sides),material,position)
  }
  function box(parent,name,w,h,d,material,position=[0,0,0]) {
    return mesh(parent,name,new THREE.BoxGeometry(w,h,d),material,position)
  }
  function link(parent,name,a,b,radius,material,sides=8) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start)
    const item=mesh(parent,name,new THREE.CylinderGeometry(radius,radius,delta.length(),sides),material,start.clone().add(end).multiplyScalar(.5).toArray())
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())
    return item
  }
  const yaw=new THREE.Group(); yaw.name='roarm-base-assembly'; group.add(yaw)
  cylinder(yaw,'roarm-base',2.27,2.38,.38,'base',10,[0,.19,0])
  cylinder(yaw,'roarm-turntable',1.88,1.98,.24,'orange',10,[0,.5,0])
  cylinder(yaw,'roarm-upright',1.3,1.48,l1*SCALE-.38,'dark',8,[0,(l1*SCALE-.38)/2+.62,0])
  const shoulderPivot=new THREE.Group(); shoulderPivot.name='roarm-shoulder-pivot';
  shoulderPivot.position.y=l1*SCALE; yaw.add(shoulderPivot)
  cylinder(shoulderPivot,'roarm-shoulder-yoke',.82,.9,.6,'orange',8,[0,0,0])
  const shoulderJoint=new THREE.Group(); shoulderJoint.name='roarm-shoulder-joint'; shoulderPivot.add(shoulderJoint)
  const upperLength=L2*SCALE, distalLength=L3*SCALE
  link(shoulderJoint,'roarm-upper-link-left',[-.48,0,0],[-.32,upperLength,0],.32,'cream')
  link(shoulderJoint,'roarm-upper-link-right',[.48,0,0],[.32,upperLength,0],.32,'cream')
  link(shoulderJoint,'roarm-upper-link-accent-left',[-.77,.16,0],[-.61,upperLength-.18,0],.075,'orange',6)
  link(shoulderJoint,'roarm-upper-link-accent-right',[.77,.16,0],[.61,upperLength-.18,0],.075,'orange',6)
  const elbowPivot=new THREE.Group(); elbowPivot.name='roarm-distal-joint'; elbowPivot.position.y=upperLength; shoulderJoint.add(elbowPivot)
  const axle=cylinder(elbowPivot,'roarm-elbow',.6,.6,.92,'steel',10); axle.rotation.z=Math.PI/2
  for(const x of [-.51,.51]) {const cap=cylinder(elbowPivot,x<0?'roarm-elbow-cap-left':'roarm-elbow-cap-right',.38,.38,.14,'orange',8,[x,0,0]);cap.rotation.z=Math.PI/2}
  const forearm=new THREE.Group(); forearm.name='roarm-forearm-assembly'; elbowPivot.add(forearm)
  link(forearm,'roarm-forearm-left',[-.34,0,0],[-.23,distalLength,0],.27,'cream')
  link(forearm,'roarm-forearm-right',[.34,0,0],[.23,distalLength,0],.27,'cream')
  link(forearm,'roarm-forearm-tie',[-.24,distalLength-.28,0],[.24,distalLength-.28,0],.12,'orange',8)
  const wrist=new THREE.Group(); wrist.name='roarm-wrist-tool'; wrist.position.y=distalLength; forearm.add(wrist)
  cylinder(wrist,'roarm-wrist',.46,.46,.52,'dark',8)
  const plate=box(wrist,'roarm-gripper-plate',.78,.24,.58,'steel',[0,.43,.08])
  // Paired jaws open symmetrically. The servo-to-opening span is only a visual
  // estimate because the candidate open calibration endpoint is not verified.
  const jaws=[
    link(wrist,'roarm-gripper-left',[-.19,.43,0],[-.19,1.02,0],.095,'dark',6),
    link(wrist,'roarm-gripper-right',[.19,.43,0],[.19,1.02,0],.095,'dark',6),
  ]
  link(wrist,'roarm-gripper-crossbar',[-.19,1.02,0],[.19,1.02,0],.08,'orange',6)

  // The pilot station belongs to the rotating base, not the wrist. It turns
  // with measured base yaw but remains fixed when shoulder or elbow move.
  // The seat faces +Z, toward the arm; its console is mounted on the base deck.
  const cab=new THREE.Group();cab.name='roarm-pilot-cab';yaw.add(cab)
  const cabUpright=new THREE.Group();cabUpright.name='roarm-pilot-cab-upright';cab.add(cabUpright)
  box(cabUpright,'roarm-pilot-deck',1.9,.18,3.9,'dark',[0,.55,-1.48])
  box(cabUpright,'roarm-pilot-seat',1.02,.16,.82,'orange',[0,.91,-2.72])
  box(cabUpright,'roarm-pilot-backrest',1.02,.76,.16,'cream',[0,1.32,-3.05])
  box(cabUpright,'roarm-pilot-headrest',.58,.28,.16,'orange',[0,1.78,-3.05])
  for(const x of [-.69,.69]) {
    link(cabUpright,x<0?'roarm-cab-rail-left':'roarm-cab-rail-right',[x,.63,-3.18],[x,2.35,-3.18],.065,'steel',6)
    link(cabUpright,x<0?'roarm-cab-roof-left':'roarm-cab-roof-right',[x,2.35,-3.18],[x,2.35,-1.35],.065,'orange',6)
  }
  link(cabUpright,'roarm-cab-roof-front',[-.69,2.35,-1.35],[.69,2.35,-1.35],.065,'orange',6)
  link(cabUpright,'roarm-cab-roof-back',[-.69,2.35,-3.18],[.69,2.35,-3.18],.065,'orange',6)
  box(cabUpright,'roarm-pilot-console',1.48,.72,.2,'dark',[0,1.76,-1.48])
  box(cabUpright,'roarm-pilot-screen',1.12,.48,.035,'glass',[0,1.82,-1.60])
  box(cabUpright,'roarm-pilot-screen-status',.42,.045,.025,'orange',[0,1.55,-1.62])
  // Excavator controls: a separate lever and grip on each armrest.
  for(const [index,x] of [-.43,.43].entries()) {
    box(cabUpright,`roarm-pilot-lever-base-${index+1}`, .24,.09,.32,'steel',[x,1.04,-2.05])
    link(cabUpright,`roarm-pilot-lever-${index+1}`,[x,1.08,-2.05],[x+(index===0?-.08:.08),1.48,-1.92],.035,'dark',6)
    mesh(cabUpright,`roarm-pilot-lever-grip-${index+1}`,new THREE.SphereGeometry(.095,8,6),'orange',[x+(index===0?-.08:.08),1.50,-1.92])
  }
  const seatAnchor=new THREE.Object3D();seatAnchor.name='roarm-pilot-seat-anchor';seatAnchor.position.set(0,.96,-2.72);cab.add(seatAnchor)

  let lastPose=null, observation=null, disposed=false
  function setPose(pose) {
    lastPose={base:pose.base,shoulder:pose.shoulder,elbow:pose.elbow,gripper:pose.gripper}
    yaw.rotation.y=lastPose.base
    shoulderJoint.rotation.x=lastPose.shoulder+T2
    elbowPivot.rotation.x=lastPose.elbow+T3-T2
    // the wrist frame's local +z points down the jaw rails; rotate it with the
    // distal plane while keeping the cab as a separately levelled child.
    wrist.rotation.x=0
    const closed=ROARM_MODEL_SOURCE.gripper.closedRawRad, open=ROARM_MODEL_SOURCE.gripper.openCandidateRawRad
    const opening=THREE.MathUtils.clamp((closed-lastPose.gripper)/(closed-open),0,1)
    jaws[0].position.x=-.19-opening*.24; jaws[1].position.x=.19+opening*.24
    group.visible=true
    group.updateMatrixWorld(true)
  }
  function updateObservation(data) {
    if(!data||typeof data!=='object')throw new TypeError('observation must be an object')
    const {source,state,pose,observedAt}=data
    const validState=state==='live'||state==='measured'
    const stale=data.stale===true||state==='stale'||state==='unavailable'||state==='error'||state==='offline'
    if(stale) {
      observation={source:source??null,state:'stale',observedAt:observedAt??observation?.observedAt??null,pose:lastPose?{...lastPose}:null,frozen:Boolean(lastPose)}
      return {...observation}
    }
    if(!validState)throw new TypeError('observation state must be live, measured, or stale')
    const measured=requirePose(pose)
    setPose(measured)
    observation={source:source??null,state:'measured',observedAt:observedAt??null,pose:{...lastPose},frozen:false}
    return {...observation}
  }
  function pilotSeat() {
    if(!lastPose||!group.visible)return null
    group.updateMatrixWorld(true)
    const position=seatAnchor.getWorldPosition(new THREE.Vector3())
    return {position,yaw:lastPose.base}
  }
  function pilotYaw() { return lastPose&&group.visible?lastPose.base:null }
  function dispose() {
    if(disposed)return
    disposed=true; group.removeFromParent()
    for(const geometry of geometries)geometry.dispose()
    for(const material of Object.values(materials))material.dispose()
  }
  return {group,updateObservation,pilotSeat,pilotYaw,dispose,get observation(){return observation?{...observation,pose:observation.pose?{...observation.pose}:null}:null},get metadata(){return ROARM_MODEL_SOURCE}}
}
