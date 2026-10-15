import {validatePaperBank} from './paper-bank.js';

export class PaperBankController{
  constructor({onChange=()=>{}}={}){this.state=null;this.error=null;this.onChange=onChange;this.pending=false;this.polling=false;this.nextPoll=0;this.nextAction=0;this.stages=new Map();}
  accept(state){validatePaperBank(state);if(!this.state||state.revision>=this.state.revision){this.state=state;this.error=null;this.onChange(this);}}
  async refresh(){if(this.polling)return;this.polling=true;try{const r=await fetch('/api/financial-office/paper-bank',{cache:'no-store'});if(!r.ok)throw Error('Paper bank unavailable');this.accept(await r.json());}catch(e){this.error=e.message;this.onChange(this);}finally{this.polling=false;}}
  async action(action){if(this.pending)throw Error('A bank action is already being saved');this.pending=true;
    try{const r=await fetch('/api/financial-office/paper-bank',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...action,baseRevision:this.state?.revision})});const data=await r.json();if(!r.ok){await this.refresh();throw Error(data.error??'Bank action unavailable');}this.accept(data);return data;}
    finally{this.pending=false;}
  }
  tick(elapsed,world,agents){
    if(elapsed>=this.nextPoll){this.nextPoll=elapsed+1;void this.refresh();}
    world?.paperBank?.update(this.state);
    if(!this.state||this.pending||this.error||elapsed<this.nextAction)return;
    for(const job of this.state.jobs.filter(j=>!['closed','complete'].includes(j.stage))){
      const stage=this.stages.get(job.id);if(stage?.name!==job.stage){this.stages.set(job.id,{name:job.stage,at:elapsed});continue;}
      let type=null;
      if(job.stage==='running'){if(elapsed-stage.at>=4)type='finish';}
      else{
        const agent=agents.find(a=>a.thread.officeProfileId===job.profileId),goal=agent&&world?.paperBank?.target(agent.thread)?.position;
        if(!agent||!goal||Math.hypot(agent.pos.x-goal.x,agent.pos.z-goal.z)>.7||elapsed-stage.at<.8)continue;
        type={collecting:'pickup',carrying:'deposit',returning:'pickup-return','carrying-back':'deposit-bank'}[job.stage];
      }
      if(type){this.nextAction=elapsed+.8;void this.action({type,id:job.id}).catch(e=>{this.error=e.message;this.onChange(this);});break;}
    }
  }
}
