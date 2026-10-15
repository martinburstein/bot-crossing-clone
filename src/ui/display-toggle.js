/** Display preference only. Never changes Swarm work or world state. */
export function mountDisplayToggle(root,{office=false,onChange=()=>{}}={}) {
  const key = 'botcrossing.15-3A.displayMenusHidden'
  let hidden = !office
  if(!office)try { const saved = localStorage.getItem(key); if (saved !== null) hidden = saved === 'true' } catch { /* Optional local preference. */ }
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'display-menu-toggle'
  button.title = office?'Show or hide the HUD; keep the left toolbox and Dual View bar':'Show or hide the Swarm and Bot Crossing menus'
  const sync = () => {
    document.body.classList.toggle('display-menus-hidden', hidden)
    button.textContent = hidden ? 'Show Display' : 'Hide Display'
    button.setAttribute('aria-expanded', String(!hidden))
    button.setAttribute('aria-label', hidden ? 'Show Display' : 'Hide Display')
    onChange(!hidden)
  }
  button.addEventListener('click', () => {
    hidden = !hidden
    if(!office)try { localStorage.setItem(key, String(hidden)) } catch { /* Still works without storage. */ }
    sync()
  })
  root.append(button)
  sync()
  button.setHidden=value=>{hidden=!!value;sync()}
  button.isHidden=()=>hidden
  return button
}
