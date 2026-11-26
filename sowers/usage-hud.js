const compact=value=>Number.isFinite(value)?Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(value):'—'
export function mountUsageHUD(host) {
  host.innerHTML='<div class="usage-line"><span class="usage-scope">MEASURED USAGE</span><span>Chat <strong data-chat>—</strong></span><span>Wave <strong data-wave>—</strong></span><span class="usage-allowance" data-allowance>Allowance unavailable</span><button type="button" data-details aria-label="Usage scope and timestamps" aria-expanded="false">ⓘ</button></div><div class="usage-details" data-panel hidden><p data-description></p><p data-time></p><div data-workers></div><p data-warning></p></div>'
  const $=s=>host.querySelector(s),button=$('[data-details]'),panel=$('[data-panel]')
  button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden))}
  let last=null,observation=null,pending=false,observedWave=null
  function draw() {
    $('[data-chat]').textContent=compact(last?.chat?.totalTokens)
    const ids=observation?.agents?.map(a=>a.id)||[]
    const sameWave=ids.length===3&&last?.workers?.length===3&&last.workers.every(w=>ids.includes(w.id))
    $('[data-wave]').textContent=sameWave?compact(last.waveTokens):'—'
    const account=last?.account,age=account?.reportedAt?Date.now()-Date.parse(account.reportedAt):Infinity
    const historical=Boolean(last?.stale)||account?.status!=='connected'||age>120000
    $('[data-allowance]').textContent=Number.isFinite(account?.remainingPercent)?`${historical?'Last known · ':''}${account.remainingPercent}% left`:'Allowance unavailable'
    $('[data-allowance]').classList.toggle('historical',historical)
    $('[data-description]').textContent='Processed tokens from the maintained AI Tools monitor. Cached input is included in input; reasoning is included in output. Account allowance is shared across the sign-in. These counts do not measure construction progress.'
    $('[data-time]').textContent=last?`Chat report ${last.chat.reportedAt?new Date(last.chat.reportedAt).toLocaleString():'unavailable'} · allowance ${account?.reportedAt?new Date(account.reportedAt).toLocaleString():'unavailable'}${account?.windowMinutes?` · ${Math.round(account.windowMinutes/1440*10)/10}-day window`:''}`:'Waiting for a local usage report.'
    const rows=[]
    for(const worker of sameWave?last.workers:[]) {
      const row=document.createElement('p'),agent=observation.agents.find(a=>a.id===worker.id)
      row.textContent=`${agent?.name||'Worker'} · ${compact(worker.totalTokens)} processed tokens${worker.totalTokens===null?' · not reported':''}`;rows.push(row)
    }
    $('[data-workers]').replaceChildren(...rows)
    $('[data-warning]').textContent=last?.warnings?.join(' ')||''
  }
  async function refresh() {
    if(pending)return;pending=true
    try {const response=await fetch('/api/sowers/usage',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('unavailable');last=await response.json()}
    catch {if(last)last={...last,stale:true};else last={chat:{totalTokens:null},account:{remainingPercent:null},warnings:['Local usage observer is unavailable.']}}
    finally {pending=false;draw()}
  }
  draw();void refresh();const timer=setInterval(refresh,60000)
  return {setObservation(value){observation=value;draw();if(value?.id!==observedWave){observedWave=value?.id;void refresh()}},refresh,dispose(){clearInterval(timer)},get snapshot(){return last}}
}
