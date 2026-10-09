import * as THREE from 'three'
import {createRoArmModel} from './roarm-model.js'

// A self-contained presentation layer for the shared RoArm worksite. Coordinates
// are deliberately exported so colony routing can approach the scene without
// importing or changing the authoritative MAGI layout.
export const ROARM_WORKSITE = Object.freeze({
  arm: Object.freeze({x:0,z:0}),
  camp: Object.freeze({x:0,z:-38}),
  sharedCamp: Object.freeze({x:0,z:-38}),
  hangar: Object.freeze({x:-46,z:-22}),
  ship: Object.freeze({x:48,z:-30}),
  board: Object.freeze({x:-22,z:22}),
})
export const ROARM_LAYOUT = ROARM_WORKSITE
export const ROARM_SERVICE_POINTS = Object.freeze([
  Object.freeze({clusterId:'melchior',x:0,z:-9,normal:Object.freeze({x:0,z:1})}),
  Object.freeze({clusterId:'balthasar',x:-8,z:4.6,normal:Object.freeze({x:.867,z:-.498})}),
  Object.freeze({clusterId:'casper',x:8,z:4.6,normal:Object.freeze({x:-.867,z:-.498})}),
])
export const ROARM_IDLE_GOAL_COUNT=15

const COLORS = Object.freeze({cream:0xe8e2d6, orange:0xe99a46, dark:0x384751, steel:0x718087, pale:0xf4eee3, cyan:0xace5ef, ground:0xb87842})
const HEX_EDGE_NORMALS=Object.freeze(Array.from({length:6},(_,i)=>Object.freeze([Math.cos(Math.PI/6+i*Math.PI/3),Math.sin(Math.PI/6+i*Math.PI/3)])))
function containsHex(x,z,{x:cx,z:cz,radius}) {
  const dx=x-cx,dz=z-cz,apothem=radius*Math.sqrt(3)/2
  for(const [nx,nz] of HEX_EDGE_NORMALS)if(dx*nx+dz*nz>apothem+1e-9)return false
  return true
}

export function createRoArmWorksite(scene) {
  if (!scene?.add) throw new TypeError('createRoArmWorksite requires a Three.js scene')
  const group = new THREE.Group()
  group.name = 'roarm-worksite'
  scene.add(group)
  const materials = Object.fromEntries(Object.entries(COLORS).map(([name,color])=>[name,new THREE.MeshStandardMaterial({color,roughness:name==='steel'?.4:.72,metalness:name==='steel'?.38:.02})]))
  const ownGeometry = geometry => geometry
  let defaultParent=group
  function mesh(geometry,material,x,y,z,parent=defaultParent) {
    const item = new THREE.Mesh(ownGeometry(geometry),materials[material])
    item.position.set(x,y,z); item.castShadow=true; item.receiveShadow=true; parent.add(item); return item
  }
  function box(x,y,z,w,h,d,material,parent=defaultParent) { return mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z,parent) }
  function cylinder(x,y,z,rTop,rBottom,height,material,sides=8,parent=defaultParent) { return mesh(new THREE.CylinderGeometry(rTop,rBottom,height,sides),material,x,y,z,parent) }
  function sphere(x,y,z,r,material,segments=8,parent=defaultParent) { return mesh(new THREE.SphereGeometry(r,segments,6),material,x,y,z,parent) }
  function beam(a,b,r,material,sides=8,parent=defaultParent) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start)
    const item=mesh(new THREE.CylinderGeometry(r,r,delta.length(),sides),material,...start.clone().add(end).multiplyScalar(.5).toArray(),parent)
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return item
  }
  function slabHex(x,z,r,y,h,material,parent=defaultParent) {
    const g=new THREE.CylinderGeometry(r,r,h,6,1,false); g.rotateY(Math.PI/6)
    return mesh(g,material,x,y,z,parent)
  }
  function labelCanvas(width,height,draw) {
    if(typeof document==='undefined') return null
    const canvas=document.createElement('canvas'); canvas.width=width;canvas.height=height
    const ctx=canvas.getContext('2d'); draw(ctx,width,height)
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide})
    return {canvas,ctx,texture,material}
  }
  const textureMaterials=[]
  const surfaceRecords=[]

  // Connected, low hex work deck; this is scenic scaffolding only.
  const deck=slabHex(0,0,15,.25,.7,'dark');deck.name='roarm-hex-foundation';surfaceRecords.push({x:0,z:0,radius:15,height:.6})
  const armDeck=slabHex(0,0,14,.64,.12,'ground');armDeck.name='roarm-arm-deck-surface';surfaceRecords.push({x:0,z:0,radius:14,height:.7})
  for(const [x,z] of [[-12,-7],[-12,7],[12,-7],[12,7]]) {
    cylinder(x,.9,z,.5,.62,.5,'orange',6)
    cylinder(x,1.23,z,.17,.17,.18,'pale',8)
  }
  // The robot silhouette is driven only by a measured controller observation.
  const armModel=createRoArmModel();group.add(armModel.group)

  // One common recharge canopy and twelve seats/power cradles around one
  // shared hearth: not twelve separate tents or autonomous work claims.
  const camp=new THREE.Group();camp.name='shared-recharge-camp';camp.position.set(ROARM_WORKSITE.camp.x,0,ROARM_WORKSITE.camp.z);group.add(camp)
  const campBase=slabHex(0,.6,14,.38,.55,'dark',camp);campBase.name='shared-camp-foundation';surfaceRecords.push({x:ROARM_WORKSITE.camp.x,z:ROARM_WORKSITE.camp.z+.6,radius:14,height:.655})
  const campDeck=slabHex(0,.6,13.2,.68,.12,'ground',camp);campDeck.name='shared-camp-deck-surface';surfaceRecords.push({x:ROARM_WORKSITE.camp.x,z:ROARM_WORKSITE.camp.z+.6,radius:13.2,height:.74})
  for(let i=0;i<6;i++) {
    const a=i*Math.PI/3
    beam([Math.cos(a)*10,.8,.6+Math.sin(a)*10],[Math.cos(a)*3.3,8,.6+Math.sin(a)*3.3],.25,'cream',6,camp)
    cylinder(Math.cos(a)*10,1.05,.6+Math.sin(a)*10,.38,.46,.55,'orange',6,camp)
  }
  // Faceted communal canopy.
  // A broad cut-away sector opens toward +z so seated residents remain visible.
  const canopy=mesh(new THREE.ConeGeometry(10.7,3.1,6,1,true,Math.PI*.75,Math.PI*1.5), 'orange',0,7.85,.6,camp);canopy.rotation.y=Math.PI/6;canopy.name='shared-camp-open-canopy'
  cylinder(0,6.9,.6,.55,.55,1.2,'steel',8,camp)
  cylinder(0,1.1,.6,1.5,1.8,.72,'cream',8,camp)
  const campObstacles=[]
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6, x=Math.cos(a)*7.6,z=.6+Math.sin(a)*7.6
    const seat=box(x,1.18,z,1.45,.6,1.05,i%3===0?'orange':'cream',camp);seat.rotation.y=-a;seat.name=`camp-recharge-seat-${i+1}`
    const pad=box(x,1.72,z,1.3,.12,.85,'cyan',camp);pad.rotation.y=-a;pad.name=`camp-recharge-pad-${i+1}`
    campObstacles.push({x:x+ROARM_WORKSITE.camp.x,z:z+ROARM_WORKSITE.camp.z,r:1.05,campSeat:i+1})
    beam([x,1.55,z],[x*.78,3.1,.6+(z-.6)*.78],.055,'steel',6,camp)
  }
  // The communications console and a pair of activity props sit inside the
  // central hearth footprint; this leaves a clear ring for all fifteen homes.
  box(0,1.03,-2,2.55,.62,.85,'dark',camp).name='camp-communications-console'
  box(0,1.4,-2,2.8,.16,1.02,'orange',camp)
  box(0,2.05,-2.32,1.95,1.08,.16,'cyan',camp).name='camp-console-screen'
  for(const x of [-.76,-.25,.25,.76]) sphere(x,1.52,-1.72,.08,'pale',6,camp)
  box(-.55,1.72,.25,.48,.2,.4,'orange',camp).name='camp-shared-snack-prop'
  box(.55,1.74,.25,.48,.24,.4,'steel',camp).name='camp-shared-tool-prop'
  campObstacles.push({x:ROARM_WORKSITE.camp.x,z:ROARM_WORKSITE.camp.z-2,r:1.55,worksite:'camp-console'})
  campObstacles.push({x:ROARM_WORKSITE.camp.x,z:ROARM_WORKSITE.camp.z+.6,r:1.8,worksite:'camp-hearth'})
  const idleGoals=Array.from({length:ROARM_IDLE_GOAL_COUNT},(_,i)=>{
    const angle=-Math.PI/2+i*Math.PI*2/ROARM_IDLE_GOAL_COUNT
    return new THREE.Vector3(Math.cos(angle)*5.5,0,.6+Math.sin(angle)*5.5)
  })
  // Reserved spot for the dedicated pilot when the coordinator explicitly
  // releases duty; it is outside the shared ring of ordinary resident goals.
  const pilotRestSpot=new THREE.Vector3(0,0,10.5)
  const campTargets={
    talk:[new THREE.Vector3(-1.1,0,3.3),new THREE.Vector3(1.1,0,3.3)],
    tinker:[new THREE.Vector3(-2.8,0,2.8)],
    board:[new THREE.Vector3(0,0,-.95)],console:[new THREE.Vector3(0,0,-.95)],
    snack:[new THREE.Vector3(2.8,0,2.8)],
  }
  const campLooks={
    talk:new THREE.Vector3(0,0,2.2),tinker:new THREE.Vector3(-2.8,0,1.5),
    board:new THREE.Vector3(0,0,-2.8),console:new THREE.Vector3(0,0,-2.8),snack:new THREE.Vector3(2.8,0,1.5),
  }
  // Distinctive service board, readable as a large shared landmark. Browser
  // labels show live bounty/reward counts; userData retains the exact projection
  // for headless tests and hosts without canvas support.
  const board=new THREE.Group();board.name='blocker-bounty-board';board.position.set(ROARM_WORKSITE.board.x,0,ROARM_WORKSITE.board.z);group.add(board)
  const boardDeck=slabHex(0,0,10,.34,.52,'dark',board);boardDeck.name='bounty-board-deck-surface';surfaceRecords.push({x:ROARM_WORKSITE.board.x,z:ROARM_WORKSITE.board.z,radius:10,height:.6})
  box(0,3.6,0,15,6.2,.9,'dark',board)
  for(const x of [-7.25,7.25]) beam([x,.7,0],[x,7,0],.25,'orange',6,board)
  box(0,6.75,.52,15.5,.48,.25,'orange',board)
  box(0,.55,.52,15.5,.42,.25,'orange',board)
  const boardCanvas=labelCanvas(1200,520,(ctx,w,h)=>{
    ctx.fillStyle='#263943';ctx.fillRect(0,0,w,h)
    ctx.fillStyle='#e99a46';ctx.fillRect(0,0,w,86)
    ctx.fillStyle='#fff6e9';ctx.font='bold 60px sans-serif';ctx.textAlign='left';ctx.fillText('BLOCKER BOUNTIES',34,63)
    ctx.fillStyle='#f0e8dc';ctx.font='bold 36px sans-serif';ctx.fillText('Waiting for live worksite data',36,160)
    ctx.font='30px sans-serif';ctx.fillStyle='#ace5ef';ctx.fillText('Verified acceptance earns service credit',36,220)
    ctx.fillStyle='#b9c6c9';ctx.fillText('No blocker reported yet',36,300)
  })
  let boardLabel=null
  if(boardCanvas) {
    textureMaterials.push(boardCanvas)
    boardLabel=new THREE.Mesh(new THREE.PlaneGeometry(13.7,5.8),boardCanvas.material)
    boardLabel.position.set(0,3.93,.48);board.add(boardLabel)
  }
  const boardLight=box(0,7.25,.62,10,.12,.12,'cyan',board)
  const projection={bounties:[],serviceCredits:[],stale:true,updatedAt:null}
  function update(data={}) {
    if(!data||typeof data!=='object') throw new TypeError('worksite update must be an object')
    projection.bounties=Array.isArray(data.bounties)?data.bounties.filter(item=>item?.status==='open').slice():[]
    const credits=data.serviceCredits??data.rewards
    projection.serviceCredits=Array.isArray(credits)?credits.slice():credits&&typeof credits==='object'?Object.values(credits):[]
    projection.stale=data.stale===undefined?true:Boolean(data.stale)
    projection.updatedAt=data.updatedAt??null
    const serviceCreditTotal=projection.serviceCredits.reduce((sum,item)=>sum+(Number.isFinite(item?.amount)?item.amount:0),0)
    const latestCreditWorkerId=projection.serviceCredits.at(-1)?.workerId??null
    board.userData.projection={bounties:projection.bounties,serviceCredits:projection.serviceCredits,serviceCreditTotal,latestCreditWorkerId,stale:projection.stale,updatedAt:projection.updatedAt}
    boardLight.material=materials[projection.bounties.length?'orange':'cyan']
    if(boardCanvas) {
      const {ctx,canvas,texture}=boardCanvas
      ctx.fillStyle='#263943';ctx.fillRect(0,0,canvas.width,canvas.height)
      ctx.fillStyle='#e99a46';ctx.fillRect(0,0,canvas.width,86)
      ctx.textAlign='left';ctx.fillStyle='#fff6e9';ctx.font='bold 60px sans-serif';ctx.fillText('BLOCKER BOUNTIES',34,63)
      ctx.font='bold 38px sans-serif';ctx.fillStyle='#f0e8dc'
      ctx.fillText(`${projection.bounties.length} open · ${serviceCreditTotal} verified credits`,36,154)
      ctx.fillStyle=projection.stale?'#f3c36a':'#ace5ef';ctx.font='bold 22px sans-serif'
      ctx.fillText(projection.stale?'SAVED SNAPSHOT · MAY BE STALE':'FEED UPDATED',canvas.width-380,63)
      const entries=projection.bounties.slice(0,4)
      ctx.font='28px sans-serif';ctx.fillStyle='#ace5ef'
      if(!entries.length) ctx.fillText('No blocker reported yet',36,220)
      entries.forEach((b,i)=>ctx.fillText(`${i+1}. ${String(b.description??'Reported blocker').slice(0,52)}`,36,220+i*56))
      const reward=projection.serviceCredits.at(-1)
      if(reward) {ctx.fillStyle='#f3c36a';ctx.fillText(`Latest credit: ${String(latestCreditWorkerId??'unknown worker')} · ${Number.isFinite(reward.amount)?reward.amount:0}`,36,492)}
      texture.needsUpdate=true
    }
  }
  update()

  // Expand the scenic deck by connected hex stepping stones toward all four
  // named service locations; they guide the colony integration visually.
  defaultParent=group
  for(const path of [
    [[0,-12],[0,-24],[0,-30]], // camp approach
    [[-12,-6],[-23,-12],[-34,-18]], // hangar approach
    [[12,-7],[25,-15],[37,-23]], // ship approach
    [[-12,7],[-17,14]], // board approach
  ]) for(const [x,z] of path) {
    const p=slabHex(x,z,5.8,.1,.42,'dark');p.name='connected-worksite-walkway'
    const walkingSurface=slabHex(x,z,5.05,.34,.08,'ground');walkingSurface.name='worksite-walkway-surface';surfaceRecords.push({x,z,radius:5.05,height:.38})
    for(const side of [-1,1]) cylinder(x+side*4.8,.55,z,.15,.15,.12,'orange',6)
  }

  group.updateMatrixWorld(true)
  function surfaceHeight(x,z) {
    if(!Number.isFinite(x)||!Number.isFinite(z))return null
    let highest=null
    for(const surface of surfaceRecords)if(containsHex(x,z,surface)&&(highest===null||surface.height>highest))highest=surface.height
    return highest
  }
  function pilotSeat() {
    const local=armModel.pilotSeat()
    if(!local)return null
    group.updateMatrixWorld(true)
    const position=local.position.clone()
    const rotation=new THREE.Quaternion()
    group.getWorldQuaternion(rotation)
    const forward=new THREE.Vector3(Math.sin(local.yaw),0,Math.cos(local.yaw)).applyQuaternion(rotation)
    return {position,yaw:Math.atan2(forward.x,forward.z)}
  }
  function updateObservation(data) { return armModel.updateObservation(data) }
  function dispose() {
    if(disposed) return
    disposed=true
    scene.remove(group)
    const geometries=new Set(),sharedMaterials=new Set(Object.values(materials)),armObjects=new Set()
    armModel.group.traverse(object=>armObjects.add(object))
    group.traverse(object=>{
      if(armObjects.has(object))return
      if(object.geometry&&!geometries.has(object.geometry)){geometries.add(object.geometry);object.geometry.dispose()}
      if(object.material&&!Array.isArray(object.material)&&!sharedMaterials.has(object.material)) object.material.dispose()
    })
    for(const material of sharedMaterials) material.dispose()
    for(const entry of textureMaterials){entry.texture.dispose();entry.material.dispose()}
    armModel.dispose()
  }
  let disposed=false
  const clearingRecords=[
    {x:ROARM_WORKSITE.arm.x,z:ROARM_WORKSITE.arm.z,r:6,service:'central-arm'},
    {x:ROARM_WORKSITE.camp.x,z:ROARM_WORKSITE.camp.z,r:14,service:'shared-camp'},
    {x:ROARM_WORKSITE.board.x,z:ROARM_WORKSITE.board.z,r:10,service:'bounty-board'},
    {x:ROARM_WORKSITE.hangar.x,z:ROARM_WORKSITE.hangar.z,r:13,service:'hangar-approach'},
    {x:ROARM_WORKSITE.ship.x,z:ROARM_WORKSITE.ship.z,r:13,service:'ship-approach'},
  ]
  const obstacleRecords=[
    {x:ROARM_WORKSITE.arm.x,z:ROARM_WORKSITE.arm.z,r:5.2,worksite:'arm-base'},
    ...campObstacles,
    ...[-7.25,7.25].map(x=>({x:x+ROARM_WORKSITE.board.x,z:ROARM_WORKSITE.board.z,r:.42,worksite:'board-post'})),
  ]
  return {
    group,layout:ROARM_LAYOUT,servicePoints:ROARM_SERVICE_POINTS,
    clearings:()=>clearingRecords.map(record=>({...record})),
    obstacles:()=>obstacleRecords.map(record=>({...record})),
    camp:{group:camp,targets:campTargets,looks:campLooks,idleGoals,restSpot:pilotRestSpot,obstacles:()=>campObstacles.map(record=>({...record})),dispose},
    board,update,surfaceHeight,updateObservation,pilotSeat,armModel,dispose,
  }
}
