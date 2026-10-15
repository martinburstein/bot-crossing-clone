/** Soft-realtime scheduling only; the engine owns fixed 10 ms simulated time. */
import {createVelocityLiveLab} from './velocity-live-lab.mjs';

export function createVelocityFrameDriver({onState=()=>{},nowMs=null,createEngine=createVelocityLiveLab}={}) {
  if(typeof onState!=='function'||typeof createEngine!=='function'||nowMs!==null&&typeof nowMs!=='function')throw TypeError('Invalid driver callback');
  let engine=null,latest=null,status='ready',disposed=false,accumulator=0,hostElapsedMs=0;
  let frameGapCount=0,gapLatched=false,firstFrameAt=null,reason=null,lastSteps=0,events=[];
  const open=()=>{if(disposed)throw Error('Velocity frame driver is disposed');};
  const publish=()=>{if(latest)onState(structuredClone(latest));return snapshot();};
  function settleGapStatus(){
    if(!gapLatched)return;
    if(latest.reference.status==='brake-unresolved'||latest.terminal){status='paused-brake-unresolved';accumulator=0;}
    else if(latest.reference.status==='holding-interrupted'){status='paused-after-frame-gap';accumulator=0;}
    else status='braking-after-frame-gap';
  }
  function start(){
    open();const next=createEngine();engine?.dispose();engine=next;latest=engine.snapshot();
    status='running';accumulator=0;hostElapsedMs=0;frameGapCount=0;gapLatched=false;reason=null;lastSteps=0;events=[];
    firstFrameAt=nowMs?.()??null;return publish();
  }
  function setTargetOffsetMm(value){open();if(status!=='running')throw Error('Start a fresh velocity run before editing its target');latest=engine.setTargetOffsetMm(value);return publish();}
  function setFaults(value){open();if(!['running','interrupted'].includes(status))throw Error('Fault edits require a running velocity experiment');latest=engine.setFaults(value);return publish();}
  function interrupt(why='user interrupted velocity tracking'){
    open();if(!engine||!['running','interrupted'].includes(status))return snapshot();
    latest=engine.interrupt(why);status='interrupted';reason=why;return publish();
  }
  function update(dt){
    open();if(!Number.isFinite(dt)||dt<0)throw RangeError('Frame delta must be finite and nonnegative');lastSteps=0;
    if(!['running','interrupted','braking-after-frame-gap'].includes(status))return snapshot();
    if(firstFrameAt!==null){const elapsed=nowMs()-firstFrameAt;if(!Number.isFinite(elapsed)||elapsed<0)throw Error('Host clock must be finite and monotonic');dt=Math.min(dt,elapsed/1000);firstFrameAt=null;}
    hostElapsedMs+=dt*1000;
    const debt=accumulator+dt*1000;
    if(dt>.25||debt>250+1e-8){
      frameGapCount++;accumulator=0;
      if(!gapLatched){
        gapLatched=true;reason='frame-gap-over-250ms';events.push({kind:reason,deltaMs:dt*1000,debtMs:debt,atSimulationMs:latest.timeMs});
        latest=engine.interrupt(reason);
      }
      settleGapStatus();return publish();
    }
    accumulator=debt;
    for(let n=0;n<25&&accumulator+1e-8>=10;n++){
      accumulator=Math.max(0,accumulator-10);latest=engine.step();lastSteps++;
      if(gapLatched){settleGapStatus();if(status.startsWith('paused-'))break;}
      else if(latest.terminal){status='complete';reason=latest.terminal.reason;accumulator=0;break;}
      else if(latest.reference.intentLatched){status='interrupted';reason=latest.reference.brakeResolution?.requestedReason??'tracking intent ended';}
    }
    return publish();
  }
  function snapshot(){
    const p=latest?.plant,r=latest?.reference.currentReference;
    const gap=p?Math.max(...Object.keys(p.position).map(j=>Math.abs(p.position[j]-r[j].position))):null;
    const velocity=p?Math.max(...Object.values(p.velocity).map(Math.abs)):null;
    return structuredClone({status,engine:latest,simulationOnly:true,physicalMovementVerified:false,physicalCertificate:false,
      hostElapsedMs,accumulatorMs:accumulator,lastFrameSteps:lastSteps,frameGapCount,reason,events,
      parked:status.startsWith('paused-'),plantMayBeUnsettled:status.startsWith('paused-'),
      maxReferencePlantGapRad:gap,maxModeledPlantVelocityRadPerS:velocity,
      clock:'fixed 10 ms simulation; at most 25 steps per browser frame; missed time discarded'});
  }
  function dispose(){if(!disposed){engine?.dispose();latest=engine?.snapshot()??null;disposed=true;status='disposed';}return snapshot();}
  return Object.freeze({start,reset:start,setTargetOffsetMm,setFaults,interrupt,update,snapshot,dispose});
}
