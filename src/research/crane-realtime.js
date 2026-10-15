import {createLab} from './realtime-lab.mjs'
import {ROARM_PREVIEW_LIMITS_RAD} from '../world/roarm-preview.js'

const joints=Object.keys(ROARM_PREVIEW_LIMITS_RAD)
export const CRANE_RESEARCH_LIMITS=Object.freeze(Object.fromEntries(joints.map(j=>[j,Object.freeze({min:ROARM_PREVIEW_LIMITS_RAD[j][0],max:ROARM_PREVIEW_LIMITS_RAD[j][1],velocity:.7,acceleration:1.4,jerk:6})])))
const pose=p=>{
  if(!p||Object.keys(p).length!==4)throw Error('A complete four-joint pose is required')
  return Object.fromEntries(joints.map(j=>{const v=p[j],l=CRANE_RESEARCH_LIMITS[j];if(!Number.isFinite(v)||v<l.min||v>l.max)throw Error(`${j} is outside the finite illustrative range`);return[j,v]}))
}

/** Browser scheduling adapter; fixed simulation time is separate from elapsed host time. */
export function createCraneRealtime(initial,{onPose=()=>{},nowMs=null}={}){
  let origin=pose(initial),engine=null,targets=[],index=0,accumulator=0,status='ready',disposed=false
  let hostElapsedMs=0,stallCount=0,reason=null,latest=null,lastPlanningMs=null,retargetCount=0
  let intentIntervalMs=null,intentIndex=0,intentsDispatched=0
  let startedAtHostMs=null
  if(nowMs!==null&&typeof nowMs!=='function')throw Error('nowMs must be a clock function or null')
  const open=()=>{if(disposed)throw Error('Crane realtime driver is disposed')}
  const createEngine=start=>createLab({referenceMode:'online-c2',initial:start,limits:CRANE_RESEARCH_LIMITS,dtMs:10,lagSeconds:.15,observationEverySteps:5,latencyMs:30,staleAfterMs:300,maxRunDurationMs:60000,maxDurationMs:20000,maxStoredSamples:1200})
  function initialize(start){const checked=pose(start),next=createEngine(checked);engine?.dispose();origin=checked;engine=next;latest=engine.snapshot();onPose(latest.plant.position,latest.reference.position)}
  function start(moves,{startPose=latest.plant.position,intervalMs=null}={}){
    open();if(status==='running')throw Error('Simulation is running; interrupt or finish it first')
    if(status==='interrupted'&&(!latest.plantSettled||latest.activeMotion))throw Error('Interrupted modeled plant is still settling; wait or explicitly reset the simulation')
    if(!Array.isArray(moves)||moves.length<1||moves.length>10)throw Error('Choose 1 to 10 finite simulation targets')
    if(intervalMs!==null&&(!Number.isSafeInteger(intervalMs)||intervalMs<100||intervalMs>5000||intervalMs%10!==0))throw Error('Intent interval must be 100 to 5000 ms in 10 ms steps')
    const checked=Array.from(moves,pose),start=pose(startPose)
    // Validate the whole script on a disposable deterministic engine first.
    const probe=createEngine(start)
    try{for(const [i,target]of checked.entries()){probe.send(target);let s=probe.snapshot();if(intervalMs!==null&&i<checked.length-1){while(s.simTimeMs<(i+1)*intervalMs)s=probe.step()}else{while(s.activeMotion||!s.plantSettled)s=probe.step()}}}finally{probe.dispose()}
    initialize(start);targets=checked;index=0;accumulator=0;hostElapsedMs=0;stallCount=0;reason=null;lastPlanningMs=null;retargetCount=0;intentIntervalMs=intervalMs;intentIndex=0;intentsDispatched=1;status='running';engine.send(targets[0]);latest=engine.snapshot();startedAtHostMs=nowMs?.()??null;return snapshot()
  }
  function retarget(target){
    open();if(status!=='running')throw Error('Start a simulation before changing its target in motion')
    const checked=pose(target),started=performance.now();engine.send(checked);lastPlanningMs=performance.now()-started;
    targets=[checked];index=0;intentIntervalMs=null;intentIndex=0;intentsDispatched++;retargetCount++;latest=engine.snapshot();return snapshot()
  }
  function interrupt(why='user interruption'){open();if(status!=='running')return snapshot();reason=String(why);engine.interrupt(reason);latest=engine.snapshot();status='interrupted';return snapshot()}
  function update(dt){
    open();if(!Number.isFinite(dt)||dt<0)throw Error('Frame delta must be finite and nonnegative')
    if(!['running','interrupted'].includes(status)||status==='interrupted'&&latest.plantSettled&&!latest.activeMotion)return snapshot()
    // The rendering delta may begin before the UI starts the simulation.
    // Exclude preflight/idle time only on this first frame; later stalls retain
    // the normal fail-closed rule. Pure callers may omit the wall clock.
    if(startedAtHostMs!==null){const elapsed=nowMs()-startedAtHostMs;if(!Number.isFinite(elapsed)||elapsed<0)throw Error('Host clock must be finite and monotonic');dt=Math.min(dt,elapsed/1000);startedAtHostMs=null}
    hostElapsedMs+=dt*1000
    if(dt>.25){stallCount++;if(status==='running')interrupt('browser frame gap exceeded 250 ms');accumulator=0;return snapshot()}
    accumulator+=dt*1000
    // No hidden-tab catch-up: at most 25 fixed steps in any rendering call.
    for(let n=0;n<25&&accumulator+1e-8>=10;n++){
      accumulator-=10
      if(latest.simTimeMs>=60000){interrupt('finite 60 second simulation budget reached');break}
      latest=engine.step()
      if(latest.interrupted&&status==='running'){status='interrupted';reason='simulated observation became stale'}
      if(status==='running'&&intentIntervalMs!==null&&intentIndex<targets.length-1&&latest.simTimeMs>=(intentIndex+1)*intentIntervalMs){
        const started=performance.now();engine.send(targets[intentIndex+1]);lastPlanningMs=performance.now()-started;intentIndex++;intentsDispatched++;retargetCount++;latest=engine.snapshot()
      }
      if(status==='running'&&latest.referenceComplete&&latest.plantSettled){
        if(intentIntervalMs!==null){if(intentIndex===targets.length-1){index=1;status='complete';break}}
        else{index++;if(index===targets.length){status='complete';break}engine.send(targets[index]);intentsDispatched++;latest=engine.snapshot()}
      }
      if(status==='interrupted'&&latest.plantSettled&&!latest.activeMotion)break
    }
    onPose(latest.plant.position,latest.reference.position);return snapshot()
  }
  function setFaults(patch){open();latest=engine.setFaults(patch);return snapshot()}
  function reset(start=origin){open();initialize(start);targets=[];index=0;accumulator=0;status='ready';hostElapsedMs=0;stallCount=0;reason=null;lastPlanningMs=null;retargetCount=0;intentIntervalMs=null;intentIndex=0;intentsDispatched=0;startedAtHostMs=null;return snapshot()}
  function snapshot(){return structuredClone({simulationOnly:true,status,pose:{...latest.plant.position},completedMoves:index,totalMoves:intentIntervalMs===null?targets.length:1,intentIntervalMs,intentsDispatched,scheduledIntents:intentIntervalMs===null?0:targets.length,completionMeaning:intentIntervalMs===null?'settled targets':'final target settled; earlier intents may be superseded',hostElapsedMs,stallCount,reason,lastPlanningMs,retargetCount,clock:'fixed 10 ms simulation steps; browser scheduling is soft realtime',limits:CRANE_RESEARCH_LIMITS,engine:latest})}
  initialize(origin)
  return {start,retarget,update,interrupt,setFaults,reset,snapshot,dispose(){if(disposed)return;engine.dispose();latest=engine.snapshot();disposed=true;status='disposed'}}
}
