import './token-hud.css'
export function mountTokenHud(root) {
  const panel = document.createElement('section')
  panel.className = 'token-hud'
  panel.setAttribute('aria-label','Token Counter')
  panel.innerHTML = '<div class="token-hud-brand">DUAL VIEW <span>MAGI</span></div><div><small>Chat tokens</small><strong data-tokens>—</strong></div><div><small>Codex remaining</small><strong data-remaining>—</strong></div><p data-detail>Connecting to usage…</p>'
  root.append(panel)
  let stopped = false, timer
  async function refresh() {
    try {
      const response = await fetch('/api/token-hud',{signal:AbortSignal.timeout(20000),cache:'no-store'})
      if (!response.ok) throw Error('Unavailable')
      const value = await response.json()
      const tokensKnown = Number.isSafeInteger(value.tokens) && value.tokens >= 0
      const accountFresh = value.accountStatus === 'connected' && Number.isFinite(value.remaining) && Date.now()-Date.parse(value.accountAt) < 120000
      panel.querySelector('[data-tokens]').textContent = tokensKnown ? value.tokens.toLocaleString() : '—'
      panel.querySelector('[data-remaining]').textContent = accountFresh ? `${Math.round(value.remaining)}%` : '—'
      const windowLabel = value.windowMinutes === 10080 ? 'Weekly' : value.windowMinutes === 300 ? '5-hour' : value.windowMinutes ? `${value.windowMinutes / 60}-hour` : 'Account'
      panel.querySelector('[data-detail]').textContent = `${tokensKnown ? value.tokenStatus === 'connected' ? 'This chat' : 'Last recorded count' : 'Token count unavailable'} · ${accountFresh ? windowLabel+' allowance left' : 'Allowance unavailable'}`
      panel.title = [value.taskTitle, tokensKnown && value.tokenAt ? `Tokens recorded ${new Date(value.tokenAt).toLocaleTimeString()}` : '',accountFresh && value.resetsAt ? `Allowance resets ${new Date(value.resetsAt*1000).toLocaleString()}` : ''].filter(Boolean).join('\n')
    } catch {
      panel.querySelector('[data-tokens]').textContent = '—'
      panel.querySelector('[data-remaining]').textContent = '—'
      panel.querySelector('[data-detail]').textContent = 'Usage connection unavailable'
    }
    if (!stopped) timer = setTimeout(refresh,5000)
  }
  void refresh()
  window.addEventListener('pagehide',() => {stopped = true;clearTimeout(timer)},{once:true})
  return panel
}
