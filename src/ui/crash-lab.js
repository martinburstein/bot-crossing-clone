import {putScenario, fundingScenario} from '../office/crash-model.js'
const money = n => n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2})
export function mountCrashLab(root, { closeBank = () => {} } = {}) {
  const el = document.createElement('details')
  el.className = 'office-crash-lab'
  el.style.cssText = 'position:fixed;top:246px;right:24px;width:300px;max-width:calc(100vw - 48px);z-index:32;background:#142b2bf0;color:#e4e9db;border:1px solid #b4bdab77;border-radius:8px;font:12px system-ui;box-shadow:0 8px 24px #0004'
  el.innerHTML = `<summary style="cursor:pointer;padding:12px;font-weight:600">Crash lab <small style="float:right">PAPER ONLY</small></summary>
    <div style="padding:0 12px 12px;max-height:calc(100vh - 330px);overflow:auto">
      <p data-status>Reading saved study…</p>
      <label>Paper put<select data-position aria-label="Paper put" style="display:block;width:100%;margin:5px 0 12px"></select></label>
      <p data-contract></p><p data-quality style="color:#d9c28d"></p>
      <label>Crypto crash <output data-crypto-value>90%</output><input data-crypto aria-label="Crypto crash percent" type="range" min="0" max="100" value="90" style="width:100%"></label>
      <p data-funding></p>
      <label>Stock fall assumption <output data-stock-value>90%</output><input data-stock aria-label="Stock fall assumption percent" type="range" min="0" max="100" value="90" style="width:100%"></label>
      <p style="font-size:11px;color:#bfcdb9">Crypto and stock moves are separate assumptions.</p>
      <label>Timing<select data-path aria-label="Crash timing" style="display:block;width:100%;margin:5px 0 12px">
        <option value="expiry">Crash persists through expiry</option><option value="recovery">Recovers to reference before expiry</option><option value="late">Crash arrives after expiry</option></select></label>
      <label><input data-blocked aria-label="Collection interrupted" type="checkbox"> Collection interrupted</label>
      <button data-lever type="button" style="display:block;width:100%;margin:12px 0;background:#a66545;color:white;border:1px solid #e0b17e;border-radius:5px;padding:10px;font-weight:600;cursor:pointer">Pull crash lever</button>
      <div data-result role="status" aria-live="polite" style="border-top:1px solid #b4bdab55;padding-top:10px"></div>
      <p data-limits style="font-size:10px;color:#bfcdb9"></p>
      <p data-source style="font-size:10px;overflow-wrap:anywhere"></p>
    </div>`
  root.append(el)
  let study = null
  const select = el.querySelector('[data-position]')
  const crypto = el.querySelector('[data-crypto]'), stock = el.querySelector('[data-stock]')
  const result = el.querySelector('[data-result]')
  const text = (selector, value) => { el.querySelector(selector).textContent = value }
  const position = () => study?.positions.find(p => p.id === select.value)
  function inputs() {
    text('[data-crypto-value]', `${crypto.value}%`); text('[data-stock-value]', `${stock.value}%`)
    const p = position(); if (!p) return
    text('[data-contract]', `${p.contracts} × ${p.ticker} $${p.strike} put · ${p.expiry}. Toy allocation ${money(p.allocation)}; entry cost ${money(p.entryCost)}.`)
    text('[data-quality]', `${p.passesSnapshotFilter ? 'Passes' : 'Fails'} the saved quote filter. Delayed ask $${p.ask}; no fill established.`)
    const f = study.funding?.find(f => f.ticker === p.ticker)
    if (f) {
      const r = fundingScenario(f, Number(crypto.value) / 100)
      text('[data-funding]', `Funding sensitivity: collateral ${money(r.collateral)}, coverage ${(r.coverage*100).toFixed(1)}%. ${f.asOf}. ${f.note}`)
    } else text('[data-funding]', 'MSTR: June BTC was unencumbered. This models common-equity loss, not a BTC margin call. October cash buffers are separate dated counterevidence.')
    text('[data-source]', `Captured payload ${p.payloadTimestampUnzoned} (timezone unspecified); last trade ${p.lastTradeUnzoned ?? 'unavailable'}. Ordinary 100-share deliverable assumed, exact terms unresolved.`)
    result.replaceChildren()
    const hint=document.createElement('p');hint.textContent='Set a scenario, then pull the lever.';result.append(hint)
  }
  for (const input of [select, crypto, stock, el.querySelector('[data-path]'), el.querySelector('[data-blocked]')]) input.addEventListener('input', inputs)
  el.querySelector('[data-lever]').onclick = () => {
    const p = position(); if (!p) return
    const blocked = el.querySelector('[data-blocked]').checked
    const r = putScenario(p, { stockDrop:Number(stock.value)/100, path:el.querySelector('[data-path]').value, collection:blocked?0:1 })
    result.replaceChildren()
    for (const [label, value] of [['Conditional net P/L',money(r.pnl)],['Toy allocation ending value',money(r.endingValue)],['Stock at expiry',money(r.terminalSpot)],['Maximum net at stock zero',money(r.maxNetProfit)],['Maximum entry loss',money(r.maxLoss)],['Immediate cash collected',money(r.cashCollected)]]) {
      const row=document.createElement('p');row.style.margin='6px 0';const title=document.createElement('span');title.textContent=`${label}: `;const amount=document.createElement('strong');amount.textContent=value;row.append(title,amount);result.append(row)
    }
    if (blocked) { const pending=document.createElement('p');pending.textContent=`Uncollected modeled claim: ${money(r.uncollectedClaim)}. Timing and recovery unresolved.`;result.append(pending) }
    text('[data-limits]', 'Terminal intrinsic with modeled entry/exit fees. The lever recalculates this preview; it does not change the saved bank result. No event probability, stock forecast, or executable settlement route is established.')
  }
  el.addEventListener('toggle', () => { if (el.open) { closeBank(); void refresh() } })
  async function refresh() {
    try {
      const response = await fetch('/api/financial-office/crash-lab',{cache:'no-store'})
      if (!response.ok) throw Error('Saved crash study unavailable')
      const data = await response.json()
      if (!Array.isArray(data.positions)) throw Error('Invalid paper study')
      const positionsUnchanged = study && JSON.stringify(study.positions) === JSON.stringify(data.positions)
      study=data
      text('[data-status]', study.positions.length ? `${study.researchStatus === 'active' ? 'Research in progress' : study.researchStatus === 'closed' ? 'Research session closed' : study.researchStatus} · paper study` : 'No saved paper study yet.')
      if (positionsUnchanged) return // Preserve the user's selected inputs and computed preview.
      const previous=select.value;select.replaceChildren()
      for (const p of study.positions) { const option=document.createElement('option');option.value=p.id;option.textContent=`${p.ticker} · ${p.contracts} puts`;select.append(option) }
      if (study.positions.some(p=>p.id===previous))select.value=previous
      else if(study.positions.some(p=>p.ticker==='MSTR'))select.value=study.positions.find(p=>p.ticker==='MSTR').id
      inputs()
    } catch (error) { text('[data-status]',error.message) }
  }
  void refresh()
  const timer=setInterval(()=>{if(!document.hidden)void refresh()},30000)
  return {el,refresh,dispose(){clearInterval(timer);el.remove()}}
}
