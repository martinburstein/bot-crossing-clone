import {FRONTERA,memorialPoint,paintCanPosition} from '../world/frontera-layout.js';
export const CEREMONY_SECONDS=Object.freeze({pickup:2.8,spray:5.5,putback:2.8});
// Clearance contract for the fitted office astronaut at its canonical scale.
// The resident stops outside the paint-box slats and far enough from the wall
// that its arm, spray can, and helmet never enter either solid.
export const MEMORIAL_CLEARANCE=Object.freeze({paintBoxStandOff:2.4,wallStandOff:3.8,arrivalRadius:.42});
export const CEREMONY_LABELS=Object.freeze({approach:'Walking to the paint box',pickup:'Picking up a spray can',carry:'Carrying the can to the wall',spray:'Spraying the symbol',return:'Returning to the paint box',putback:'Putting the can back',complete:'Symbol complete · can returned',cancelled:'Ceremony stopped',blocked:'Could not reach the next stop'});
// Pure, bounded presentation state. It never writes a memorial or changes real task status.
export class MemorialCeremony {
  constructor(){this.job=null;this.last=null;}
  start(entry,agentId,now=0,canIndex=0){
    if(this.job)throw Error('Finish or stop the current painting first');
    const mark=memorialPoint(entry.placement,MEMORIAL_CLEARANCE.wallStandOff);
    const crate=paintCanPosition(canIndex),approach={x:FRONTERA.crate.x+MEMORIAL_CLEARANCE.paintBoxStandOff,z:crate.z};
    this.job={entry,agentId,canIndex,crate,approach,stage:'approach',startedAt:now,stageAt:now,elapsed:0,holding:false,revealed:false,progress:0,mark,trace:[{stage:'approach',at:now}]};return this.job;
  }
  advance(stage,now){const j=this.job;j.stage=stage;j.stageAt=now;j.elapsed=0;j.trace.push({stage,at:now});}
  target(){const j=this.job;if(!j)return null;const box=['approach','pickup','return','putback'].includes(j.stage);return {position:box?j.approach:j.mark,look:box?j.crate:memorialPoint(j.entry.placement,0),activity:`memorial-${j.stage}`};}
  update(now,agent){
    const j=this.job;if(!j)return null;
    if(!agent||agent.thread?.running){this.stop('cancelled',now);return this.last;}
    j.elapsed=Math.max(0,now-j.stageAt);
    if(now-j.startedAt>180){this.stop('blocked',now);return this.last;}
    const p=this.target().position,arrived=Math.hypot(agent.pos.x-p.x,agent.pos.z-p.z)<MEMORIAL_CLEARANCE.arrivalRadius;
    if(['approach','carry','return'].includes(j.stage)){
      if(arrived)this.advance({approach:'pickup',carry:'spray',return:'putback'}[j.stage],now);
    }else if(!arrived){this.stop('blocked',now);return this.last;}
    else if(j.stage==='pickup'){
      j.holding=j.elapsed>=CEREMONY_SECONDS.pickup*.55;
      if(j.elapsed>=CEREMONY_SECONDS.pickup){j.holding=true;this.advance('carry',now);}
    }else if(j.stage==='spray'){
      j.progress=Math.min(1,j.elapsed/CEREMONY_SECONDS.spray);j.revealed=j.progress>0;
      if(j.progress===1)this.advance('return',now);
    }else if(j.stage==='putback'){
      j.holding=j.elapsed<CEREMONY_SECONDS.putback*.55;
      if(j.elapsed>=CEREMONY_SECONDS.putback)this.stop('complete',now);
    }
    return this.job??this.last;
  }
  stop(stage='cancelled',now=0){if(!this.job)return;const j=this.job;j.holding=false;j.stage=stage;j.trace.push({stage,at:now});this.last=j;this.job=null;}
  snapshot(){const j=this.job??this.last;return j?{stage:j.stage,label:CEREMONY_LABELS[j.stage],agentId:j.agentId,preview:!!j.entry.preview,holding:j.holding,revealed:j.revealed,progress:j.progress,elapsed:j.elapsed,trace:j.trace.map(t=>({...t}))}:null;}
}
