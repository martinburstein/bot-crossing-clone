import {BenchNode} from './controller.mjs';
const $=id=>document.getElementById(id);
let nodes,time,seq,disconnected,coordinator,deploying;
function reset(){nodes=['A','B','C'].map(id=>new BenchNode(id));time=0;seq=0;disconnected=false;coordinator=true;deploying=false;$('fault').textContent='Disconnect node B';$('coordinator').textContent='Disconnect coordinator';render();}
function command(type){seq++;for(const n of nodes)n.command({type,sequence:seq,expiresAt:time+5},time);}
function render(){const sun=40*Math.sin(time/45);const results=nodes.map(n=>({...n,netW:n.loadW-n.controlW,autonomous:time-n.lastCommand>30}));$('telemetry').innerHTML=results.map(n=>`<article><div class="eyebrow">NODE ${n.id}</div><h3>${n.mode}</h3><strong>${n.netW.toFixed(2)} <small>W net</small></strong><p>Pointing: ${n.angle.toFixed(1)}°<br>Net yield: ${n.netWh.toFixed(3)} Wh<br>${n.fault|| (n.autonomous?'Local autonomy':'Fresh coordinator command')}</p></article>`).join('');$('bench-status').textContent=`Simulated elapsed: ${time.toFixed(0)} s · Source: ${sun.toFixed(1)}° · Coordinator ${coordinator?'online':'offline'} · ${results.filter(n=>n.mode==='TRACK').length}/3 tracking · Each tick advances 0.5 simulated seconds. Net yield subtracts controller and motion energy.`;}
$('deploy').onclick=()=>{if(coordinator){deploying=true;command('DEPLOY');render();}};
$('fault').onclick=()=>{disconnected=!disconnected;$('fault').textContent=disconnected?'Reconnect node B':'Disconnect node B';render();};
$('coordinator').onclick=()=>{coordinator=!coordinator;$('coordinator').textContent=coordinator?'Disconnect coordinator':'Reconnect coordinator';$('deploy').disabled=!coordinator;render();};
$('bench-reset').onclick=()=>{reset();$('deploy').disabled=false;};
reset();setInterval(()=>{time+=0.5;nodes.forEach((n,i)=>n.step({sunAngle:40*Math.sin(time/45),connected:i!==1||!disconnected},0.5,time));if(coordinator&&deploying&&time%2===0)command('DEPLOY');render();},500);
