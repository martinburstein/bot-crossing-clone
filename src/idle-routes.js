import {PROFILES} from './profiles.js';

export const DAY_LENGTH=180;
export function makeRoute(p){
 const partner=PROFILES[p.index^1],side=p.index%2===0?-1:1;
 const a={x:p.desk.x,z:p.desk.z+3.8},lane=p.desk.z+8.6;
 const meet={x:(p.desk.x+partner.desk.x)/2+side*1.25,z:lane};
 const coffee={x:-24+side*1.4,z:-18.4};
 const segments=[];let total=0,current=a;
 function hold(duration,mode,yaw=Math.PI){segments.push({start:total,duration,a:current,b:current,mode,yaw});total+=duration;}
 function go(point){const duration=Math.hypot(point.x-current.x,point.z-current.z)/3.6;if(duration>.001){segments.push({start:total,duration,a:current,b:point,mode:'walk'});total+=duration;}current=point;}
 hold(1.2,'sit-down');hold(28,'typing');hold(1.2,'stand-up');
 go({x:a.x-1.8,z:a.z});hold(6,'idle-stretch');hold(6,'idle-tie');
 go({x:a.x-1.8,z:lane});go(meet);
 // A shared clock and symmetric meeting positions make each pair really meet.
 if(total<56)hold(56-total,'idle-look',-side*Math.PI/2);
 hold(6,'idle-chat',-side*Math.PI/2);hold(6,'idle-wave',-side*Math.PI/2);
 go({x:-15.35,z:lane});go({x:-15.35,z:-18.4});go(coffee);
 hold(6,'idle-coffee');hold(6,'idle-note');
 go({x:-15.35,z:-18.4});go({x:-15.35,z:lane});go({x:a.x-1.8,z:lane});go({x:a.x-1.8,z:a.z});
 hold(6,'idle-watch');hold(6,'idle-think');hold(6,'idle-foot');
 // Quiet alternating glances fill the remainder without freezing the rig.
 const returnTime=1.8/3.6;
 if(total+returnTime<DAY_LENGTH-.5)hold(DAY_LENGTH-total-returnTime-.5,'idle-look');
 go(a);hold(.5,'idle');
 if(Math.abs(total-DAY_LENGTH)>.001)throw Error('Office route exceeds its shared day');
 return {segments,total};
}
