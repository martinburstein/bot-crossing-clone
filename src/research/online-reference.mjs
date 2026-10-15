/** Offline reference generator. C2 continuity applies to the reference, not a plant.
 * Each accepted multi-joint plan uses a common duration and finite Bernstein
 * bounds. Rejected replans leave the current reference untouched. Braking is a
 * bounded search over hypothetical stopping endpoints, not an emergency stop.
 * No timers, hardware, I/O, dynamics, collision or contact model.
 */
import {fitQuintic, evaluateQuintic, certifyQuintic} from './trajectory-replan.mjs';

const clone = value => structuredClone(value);
const finite = (value, name, min, max) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new RangeError(`${name} must be finite in [${min},${max}]`);
  return value;
};

export function createOnlineReference({initial, limits, dtMs = 10, maxRunDurationMs = 60000,
  minDurationMs = 100, maxDurationMs = 8000, durationStepMs = 100, subdivisionDepth = 3,
  maxCommands = 1000} = {}) {
  const joints = Object.keys(initial ?? {});
  if (!joints.length || joints.length > 32 || Array.isArray(initial) || !limits || joints.length !== Object.keys(limits).length) throw new TypeError('initial and limits require 1..32 identical joint keys');
  for (const [value,name,min,max] of [[dtMs,'dtMs',1,100],[maxRunDurationMs,'maxRunDurationMs',dtMs,600000],
    [minDurationMs,'minDurationMs',dtMs,120000],[maxDurationMs,'maxDurationMs',minDurationMs,120000],
    [durationStepMs,'durationStepMs',dtMs,120000],[maxCommands,'maxCommands',1,10000]]) {
    finite(value,name,min,max); if (!Number.isInteger(value)) throw new RangeError(`${name} must be integer milliseconds/count`);
  }
  if ([minDurationMs,maxDurationMs,durationStepMs].some(t => t % dtMs)) throw new RangeError('duration grid must align to dtMs');
  if (Math.ceil((maxDurationMs-minDurationMs)/durationStepMs)+1 > 200) throw new RangeError('duration grid exceeds 200 candidates');
  if (!Number.isInteger(subdivisionDepth) || subdivisionDepth<0 || subdivisionDepth>8) throw new RangeError('subdivisionDepth must be 0..8');
  const L = Object.fromEntries(joints.map(j => {
    const l=limits[j]; if (!l) throw new TypeError(`missing ${j} limits`);
    finite(l.min,`${j}.min`,-1e6,1e6); finite(l.max,`${j}.max`,l.min,1e6);
    finite(initial[j],`${j}.initial`,l.min,l.max);
    return [j,{position:[l.min,l.max],velocityAbs:finite(l.velocity,`${j}.velocity`,0,1e6),
      accelerationAbs:finite(l.acceleration,`${j}.acceleration`,0,1e6),jerkAbs:finite(l.jerk,`${j}.jerk`,0,1e9)}];
  }));
  let state=Object.fromEntries(joints.map(j=>[j,{position:initial[j],velocity:0,acceleration:0,jerk:0}]));
  let simTimeMs=0, sequence=0, plan=null, lastKind='initial', frozen=false;
  const readTarget = target => {
    if (!target || typeof target!=='object' || Array.isArray(target) || Object.keys(target).length!==joints.length || joints.some(j=>!Object.hasOwn(target,j))) throw new TypeError('target must have exactly the configured joint keys');
    return Object.fromEntries(joints.map(j=>[j,finite(target[j],`${j}.target`,...L[j].position)]));
  };
  function propose(kind, target, requestedMinimum = minDurationMs) {
    if(frozen)throw new Error('reference is frozen; create a new experiment before commanding');
    finite(requestedMinimum,'requested minimum duration',0,maxDurationMs);
    if(sequence>=maxCommands)return {accepted:false,reason:'maximum command count reached'};
    const first=Math.max(minDurationMs,Math.ceil(requestedMinimum/dtMs)*dtMs);
    const last=Math.min(maxDurationMs,Math.floor((maxRunDurationMs-simTimeMs)/dtMs)*dtMs);
    let candidatesChecked=0;
    const durations=[];for(let T=first;T<=last;T+=durationStepMs)durations.push(T);
    if(last>=first&&durations.at(-1)!==last)durations.push(last);
    for(const durationMs of durations){
      candidatesChecked++;
      const T=durationMs/1000;
      // This stopping endpoint is a search heuristic, not a globally optimal
      // stop-distance formula. Full bounds still apply to every candidate.
      const endpoints=kind==='braking'?Object.fromEntries(joints.map(j=>[j,state[j].position+state[j].velocity*T/2+state[j].acceleration*T*T/12])):target;
      const curves={},certificates={};let all=true;
      for(const j of joints){
        if(endpoints[j]<L[j].position[0]||endpoints[j]>L[j].position[1]){all=false;break;}
        try{
          curves[j]=fitQuintic({start:state[j],targetPosition:endpoints[j],durationSeconds:T});
          certificates[j]=certifyQuintic(curves[j],L[j],{subdivisionDepth});
          if(!certificates[j].certified){all=false;break;}
        }catch(error){if(!(error instanceof RangeError))throw error;all=false;break;}
      }
      if(!all)continue;
      plan={id:++sequence,kind,startTimeMs:simTimeMs,durationMs,target:clone(endpoints),curves,certificates};lastKind=kind;
      return {accepted:true,simulated:true,id:sequence,kind,durationMs,target:clone(endpoints),candidatesChecked};
    }
    return {accepted:false,reason:'no bounded candidate on the finite duration grid',candidatesChecked};
  }
  function retarget(target,{durationMs}={}){return propose('moving',readTarget(target),durationMs??minDurationMs);}
  function brake(){return propose('braking',null);}
  function freeze(){plan=null;frozen=true;lastKind='abrupt-freeze';for(const j of joints)state[j]={...state[j],velocity:0,acceleration:0,jerk:0};return snapshot();}
  function step(count=1){
    if(!Number.isInteger(count)||count<1||count>100000)throw new RangeError('step count must be 1..100000');
    if(simTimeMs+count*dtMs>maxRunDurationMs)throw new RangeError('step exceeds total simulation duration');
    simTimeMs+=count*dtMs;
    if(plan){
      const elapsed=Math.min(plan.durationMs,simTimeMs-plan.startTimeMs);
      state=Object.fromEntries(joints.map(j=>[j,evaluateQuintic(plan.curves[j],elapsed/1000)]));
      if(elapsed===plan.durationMs){
        state=Object.fromEntries(joints.map(j=>[j,{position:plan.target[j],velocity:0,acceleration:0,jerk:0}]));
        plan=null;
      }
    }
    return snapshot();
  }
  function snapshot(){return clone({simTimeMs,state,activeMotion:plan,commands:sequence,frozen,
    status:frozen?'frozen':plan?plan.kind:'holding',lastKind,
    guarantee:'C2 reference with floating-point Bernstein bounds; jerk may jump at splices; no plant or physical guarantee'});}
  return {retarget,brake,freeze,step,snapshot};
}
