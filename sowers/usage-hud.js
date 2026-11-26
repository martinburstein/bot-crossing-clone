const compact=value=>Number.isFinite(value)?Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(value):'—'
export function mountUsageHUD(host) {
  host.innerHTML='<div class="usage-line"><span class="usage-scope">MEASURED USAGE</span><span>Chat <strong data-chat>—</strong><small data-chat-status></small></span><span>Wave <strong data-wave>—</strong><small data-wave-status></small></span><span class="usage-allowance" data-allowance>Allowance unavailable</span><button type="button" data-details aria-label="Usage scope and timestamps" aria-expanded="false">ⓘ</button></div><div class="usage-details" data-panel hidden><p data-description></p><p data-time></p><div data-workers></div><p data-warning></p></div>'
  const $=s=>host.querySelector(s),button=$('[data-details]'),panel=$('[data-panel]')
  button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden))}
  let last=null,observation=null,pending=false,observedWave=null
  function draw() {
    const chat=last?.chat,chatAge=chat?.reportedAt?Date.now()-Date.parse(chat.reportedAt):Infinity
    const chatHistorical=Boolean(last?.stale||chat?.stale||chat?.status!=='connected'||chatAge>120000)
    $('[data-chat]').textContent=compact(chat?.totalTokens)
    $('[data-chat-status]').textContent=Number.isFinite(chat?.totalTokens)&&chatHistorical?' · last known':''
    $('[data-chat-status]').classList.toggle('historical',chatHistorical)
    const ids=observation?.agents?.map(a=>a.id)||[]
    const workerIds=last?.workers?.map(w=>w.id)||[]
    const sameWave=ids.length===3&&new Set(ids).size===3&&workerIds.length===3&&new Set(workerIds).size===3&&workerIds.every(id=>ids.includes(id))
    const workersFresh=last?.workersFresh===false?false:sameWave&&last.workers.every(w=>w.status==='connected'&&!w.stale)
    const waveHistorical=Boolean(last?.waveStale||!workersFresh||last?.stale||last?.workers?.some(w=>w.stale||w.status!=='connected'))
    $('[data-wave]').textContent=sameWave?compact(last.waveTokens):'—'
    $('[data-wave-status]').textContent=sameWave&&Number.isFinite(last?.waveTokens)&&waveHistorical?' · last known':''
    $('[data-wave-status]').classList.toggle('historical',waveHistorical)
    const account=last?.account,age=account?.reportedAt?Date.now()-Date.parse(account.reportedAt):Infinity
    const historical=Boolean(account?.stale)||account?.status!=='connected'||age>120000
    $('[data-allowance]').textContent=Number.isFinite(account?.remainingPercent)?`${historical?'Last known · ':''}${account.remainingPercent}% left`:'Allowance unavailable'
    $('[data-allowance]').classList.toggle('historical',historical)
    $('[data-description]').textContent='Processed tokens from the maintained AI Tools monitor. Cached input is included in input; reasoning is included in output. Account allowance is shared across the sign-in. These counts do not measure construction progress.'
    $('[data-time]').textContent=last?`Chat report ${last.chat.reportedAt?new Date(last.chat.reportedAt).toLocaleString():'unavailable'} · allowance ${account?.reportedAt?new Date(account.reportedAt).toLocaleString():'unavailable'}${account?.windowMinutes?` · ${Math.round(account.windowMinutes/1440*10)/10}-day window`:''}`:'Waiting for a local usage report.'
    const rows=[]
    for(const worker of sameWave?last.workers:[]) {
      const row=document.createElement('p'),agent=observation.agents.find(a=>a.id===worker.id)
      const old=worker.stale||worker.status!=='connected'||last.waveStale||last.workersFresh===false
      row.textContent=`${agent?.name||'Worker'} · ${compact(worker.totalTokens)} processed tokens${worker.totalTokens===null?' · not reported':old?' · last known':''}`;rows.push(row)
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
