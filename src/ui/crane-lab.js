import {CRANE_LAB} from '../world/crane-lab.js'

export function mountCraneLab(root,lab,{focus,home}){
  const button=document.createElement('button');button.className='crane-lab-toggle';button.textContent='Crane Lab';button.type='button'
  const panel=document.createElement('section');panel.className='crane-lab-panel';panel.hidden=true
  panel.innerHTML='<div class="crane-lab-title"><h2>Crane Lab</h2><button type="button" aria-label="Close Crane Lab">×</button></div><p class="crane-lab-intro">Gold follows the simulated plant. Lavender traces its planned motion; cyan shows fresh measured joints when available. Change a target while it moves to try a smooth replan.</p><p class="crane-lab-source"></p><div class="crane-lab-joints"></div><div class="crane-lab-actions"></div><p class="crane-lab-result" role="status"></p><dl class="crane-lab-metrics"></dl><p class="crane-lab-note">Simulation only · uncalibrated lag model. No load, contact or collision physics. Interrupt attempts smooth reference braking; a failed brake is shown as an abrupt freeze. The modeled arm can still settle.</p>'
  const inputs={},source=panel.querySelector('.crane-lab-source'),result=panel.querySelector('.crane-lab-result'),controls=panel.querySelector('.crane-lab-actions')
  const velocityEntry=document.createElement('button');velocityEntry.type='button';velocityEntry.className='crane-velocity-start';velocityEntry.textContent='Start velocity tracking · 10 seconds'
  const velocityControls=document.createElement('div');velocityControls.className='crane-velocity-controls';velocityControls.hidden=true
  velocityControls.innerHTML='<p>Pink marks the target; green marks the fixed origin. Offsets use robot x/y/z in millimetres. Gold follows a synthetic plant; lavender shows its reference.</p>'
  const targetInputs=[],targetOutputs=[]
  for(const [i,axis]of ['x','y','z'].entries()){
    const row=document.createElement('label');row.className='crane-lab-joint';const name=document.createElement('span');name.textContent=`Target ${axis}`
    const input=document.createElement('input');input.type='range';input.min=-30;input.max=30;input.step=1;input.value=[20,-15,10][i];input.setAttribute('aria-label',`Target ${axis} offset millimetres`)
    const output=document.createElement('output');output.textContent=`${input.value} mm`;targetInputs.push(input);targetOutputs.push(output)
    input.oninput=()=>{output.textContent=`${input.value} mm`;try{lab.setTargetOffsetMm(targetInputs.map(v=>Number(v.value)));refresh()}catch(e){result.textContent=e.message}}
    row.append(name,input,output);velocityControls.append(row)
  }
  const faultRow=document.createElement('div');faultRow.className='crane-velocity-faults'
  const latency=document.createElement('select'),drops=document.createElement('select');latency.setAttribute('aria-label','Synthetic observation latency');drops.setAttribute('aria-label','Synthetic observation drops')
  for(const ms of [20,100,180])latency.add(new Option(`${ms} ms delay`,String(ms)))
  for(const [text,value]of [['No drops','0'],['Drop every second','2']])drops.add(new Option(text,value))
  const changeFaults=()=>{try{lab.setVelocityFaults({latencyMs:Number(latency.value),dropEvery:Number(drops.value)});refresh()}catch(e){result.textContent=e.message}}
  latency.onchange=changeFaults;drops.onchange=changeFaults;faultRow.append(latency,drops);velocityControls.append(faultRow)
  const velocityActions=document.createElement('div');velocityActions.className='crane-lab-actions';velocityControls.append(velocityActions)
  for(const [text,fn]of [['Interrupt velocity simulation',()=>lab.interrupt()],['Back to joint gestures',()=>{lab.reset();load()}]]){
    const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>{try{fn();refresh()}catch(e){result.textContent=e.message}};velocityActions.append(b)
  }
  velocityEntry.onclick=()=>{try{lab.startVelocity();for(const [i,v]of [20,-15,10].entries()){targetInputs[i].value=v;targetOutputs[i].textContent=`${v} mm`}latency.value='20';drops.value='0';refresh()}catch(e){result.textContent=e.message}}
  panel.querySelector('.crane-lab-joints').before(velocityEntry,velocityControls)
  for(const [joint,bounds]of Object.entries(lab.limitsRad)){
    const row=document.createElement('label');row.className='crane-lab-joint';const name=document.createElement('span');name.textContent=joint
    const input=document.createElement('input');input.type='range';input.min=Math.ceil(bounds[0]*180/Math.PI);input.max=Math.floor(bounds[1]*180/Math.PI);input.step=.1;input.setAttribute('aria-label',`${joint} simulation degrees`)
    const output=document.createElement('output');input.oninput=()=>output.textContent=`${Number(input.value).toFixed(1)}°`;inputs[joint]=input;row.append(name,input,output);panel.querySelector('.crane-lab-joints').append(row)
  }
  function load(){for(const [j,input]of Object.entries(inputs)){input.value=String(lab.snapshot().pose[j]*180/Math.PI);input.oninput()}}
  const action=(title,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=title;b.onclick=()=>{try{fn();refresh()}catch(e){result.textContent=e.message}};controls.append(b);return b}
  action('Move to target',()=>{const target=Object.fromEntries(Object.entries(inputs).map(([j,i])=>[j,Number(i.value)*Math.PI/180]));return lab.snapshot().status==='previewing'&&lab.snapshot().mode==='realtime'?lab.retarget(target):lab.smooth([target])})
  action('Expressive scan',()=>lab.scan())
  action('Flowing scan',()=>lab.flow())
  action('Rehearse wave',()=>{const p=lab.snapshot().pose;lab.smooth([{...p,elbow:.25},{...p,elbow:.9},{...p,elbow:.25},p])})
  action('Interrupt simulation',()=>lab.interrupt())
  action('Drop observations',()=>lab.setFaults({dropEvery:1}))
  const seed=action('Use measured pose',()=>{lab.seedFromMeasured();load()})
  action('Reset simulation',()=>{lab.reset();load()})
  action('Campus view',()=>{panel.hidden=true;home()})
  function refresh(){
    const s=lab.snapshot();seed.disabled=!s.measurement.available
    const velocityMode=s.mode==='velocity';velocityControls.hidden=!velocityMode;controls.hidden=velocityMode;panel.querySelector('.crane-lab-joints').hidden=velocityMode
    velocityEntry.textContent=velocityMode?'Reset velocity tracking · new 10-second run':'Start velocity tracking · 10 seconds'
    panel.querySelector('.crane-lab-intro').textContent=velocityMode?'Velocity tracking (simulation). Edit a spatial target during a finite run. Pink target and error use the research model; measured joints remain a separate cyan overlay.':'Gold follows the simulated plant. Lavender traces its planned motion; cyan shows fresh measured joints when available. Change a target while it moves to try a smooth replan.'
    panel.querySelector('.crane-lab-note').textContent=velocityMode?'Simulation only · approximate geometry and uncalibrated lag. Tracking intent expires at 9.5 s; the run ends at 10 s. A browser gap over 250 ms ends intent and parks after a bounded reference brake; the paused plant may be unsettled. No load, contact or collision model.':'Simulation only · uncalibrated lag model. No load, contact or collision physics. Interrupt attempts smooth reference braking; a failed brake is shown as an abrupt freeze. The modeled arm can still settle.'
    source.textContent=s.measurement.available?`Measured overlay: ${s.measurement.source} · fresh`:'Measured overlay unavailable · offline practice is ready'
    if(velocityMode){
      const v=s.velocity,e=v.engine,editable=v.status==='running'&&!e.reference.intentLatched
      targetInputs.forEach(i=>i.disabled=!editable);latency.disabled=!editable;drops.disabled=!editable
      const error=Math.hypot(...e.observationErrorMm),plantError=Math.hypot(...e.modeledPlantErrorMm),violations=Object.values(e.plant.limitViolations).reduce((a,b)=>a+b,0)
      result.textContent=`${v.parked?'Paused model; plant may be unsettled':v.status==='complete'?'Finite run ended':e.reference.status==='braking'?'Reference braking':'Velocity simulation'} · ${v.status}`+(v.reason?` · ${v.reason}`:'')
      const metrics=[['Simulation time',`${(e.timeMs/1000).toFixed(2)} / 10.00 s`],['Observed target error',`${error.toFixed(3)} mm · synthetic`],['Current plant error',`${plantError.toFixed(3)} mm · modeled`],['Observation age',`${e.observation.ageMs} ms`],['Reference state',e.reference.status],['Target revision',`${e.committedRevision} used / ${e.targetRevision} requested`],['Reference updates',`${e.acceptedRetargetCount} accepted / ${e.rejectedRetargetCount} rejected`],['Brake outcome',e.reference.brakeResolution?.outcome??'None requested'],['Plant limit violations',String(violations)],['Reference / plant gap',`${(v.maxReferencePlantGapRad*180/Math.PI).toFixed(4)}°`],['Modeled plant speed',`${v.maxModeledPlantVelocityRadPerS.toFixed(6)} rad/s`],['Frame gaps',String(v.frameGapCount)]]
      panel.querySelector('.crane-lab-metrics').replaceChildren(...metrics.flatMap(([key,value])=>{const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=key;detail.textContent=value;return[term,detail]}));return
    }
    result.textContent=`${s.realtime.engine.braking?'Braking simulation':s.status==='previewing'?'Rehearsing':s.status==='complete'?'Rehearsal complete':s.status==='interrupted'?'Interrupted':'Ready'} · ${s.completedMoves}/${s.totalMoves} moves`+(s.realtime.scheduledIntents?` · ${s.realtime.intentsDispatched}/${s.realtime.scheduledIntents} intents; only final target must settle`:'')+(s.realtime.reason?` · ${s.realtime.reason}`:'')+(s.comparison?` · modeled tip separation ${s.comparison.tipSeparationMm.toFixed(1)} mm`:'')
    const e=s.realtime.engine,tracking=Math.max(...Object.keys(e.plant.position).map(j=>Math.abs(e.reference.position[j]-e.plant.position[j])))
    const metrics=[['Simulation time',`${(e.simTimeMs/1000).toFixed(2)} s · 100 Hz steps`],['Observation age',`${e.observationAgeMs.toFixed(0)} ms (synthetic)`],['Reference / plant',`${e.referenceStatus} / ${e.plantSettled?'settled':'tracking'}`],['Largest tracking gap',`${(tracking*180/Math.PI).toFixed(2)}°`],['Target planning (host)',s.realtime.lastPlanningMs===null?'No target update yet':`${s.realtime.lastPlanningMs.toFixed(2)} ms · ${s.realtime.retargetCount} updates`],['Smooth brakes / freezes',`${e.metrics.smoothBrakePlans} / ${e.metrics.referenceAbruptions}`],['Dropped samples',String(e.metrics.droppedSamples)],['Frame stalls',String(s.realtime.stallCount)]]
    panel.querySelector('.crane-lab-metrics').replaceChildren(...metrics.flatMap(([key,value])=>{const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=key;detail.textContent=value;return[term,detail]}))
  }
  button.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden){focus(CRANE_LAB);refresh()}}
  panel.querySelector('[aria-label="Close Crane Lab"]').onclick=()=>panel.hidden=true
  root.append(button,panel);load();refresh()
  let lastRefresh=-1
  return {refresh,update(elapsed){if(!panel.hidden&&elapsed-lastRefresh>.2){lastRefresh=elapsed;refresh()}},dispose(){button.remove();panel.remove()}}
}
