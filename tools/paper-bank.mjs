import {operatePaperBank,readPaperBank} from '../server/paper-bank.mjs';
const [command,...args]=process.argv.slice(2);
if(command==='status')console.log(JSON.stringify(await readPaperBank(),null,2));
else if(command==='request'){
  const options=Object.fromEntries(args.reduce((a,v,i)=>{if(i%2===0)a.push([v.replace(/^--/,''),args[i+1]]);return a;},[]));
  const state=await operatePaperBank({type:'start',id:options.id??`sim-${crypto.randomUUID()}`,profileId:options.profile,amount:Number(options.amount),returnPct:Number(options.return),idea:options.idea,source:options.source});
  console.log(JSON.stringify({revision:state.revision,simulation:state.jobs.at(-1),interpretation:'Paper scenario queued; the open financial office animates delivery. No model or transaction was started.'},null,2));
}else if(command==='return'){console.log(JSON.stringify(await operatePaperBank({type:'release',id:args[0]}),null,2));}
else throw Error('Use status, request --profile <id> --amount <whole dollars> --return <assumed total percent> --idea <name> [--source <artifact>], or return <simulation-id>.');
