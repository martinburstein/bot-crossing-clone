import * as THREE from 'three'
import {Engine} from '../core/engine.js'
import {CameraRig} from '../core/camera.js'
import {Settings} from '../core/settings.js'

// The main Bot Crossing app owns these implementations. The lab supplies only
// scenery, its UI, and a few named camera destinations; it has no separate loop,
// renderer, projection, navigation bindings or postprocessing implementation.
export function createLabRuntime(stage){
 const settings=new Settings({storageKey:'botcrossing.kestrel.settings.v1'})
 settings.transient=true
 settings.applyAll({tiltShift:false,antialias:true,shadows:'high',autoFrame:false,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches})
 const engine=new Engine(settings).mount(stage)
 const rig=new CameraRig(engine.camera,engine.canvas,settings)
 // The floating island is wider than the normal colony's ground footprint.
 // Configure the shared rig's existing limits; do not fork its navigation.
 rig.maxDistance=560;rig.worldLimit=160
 function focus(point,{distance=240,azimuth=0,polar=.82,snap=false}={}){
  rig.focus(point,{distance,elevated:true})
  rig.setOrbit(false);rig.desiredAzimuth=azimuth;rig.desiredPolar=polar
  if(snap){rig.target.copy(rig.desiredTarget);rig.distance=rig.desiredDistance;rig.azimuth=azimuth;rig.polar=polar;rig.update(0)}
 }
 function home(snap=false){focus(new THREE.Vector3(28,-10,4),{distance:450,azimuth:.14,polar:1.08,snap})}
 home(true)
 return {engine,rig,settings,focus,home,scene:engine.scene,camera:engine.camera,renderer:engine.renderer}
}
