/** Display preference only. Never changes Swarm work or world state. */
export function mountDisplayToggle(root) {
  const key = 'botcrossing.15-3A.displayMenusHidden'
  let hidden = true
  try { const saved = localStorage.getItem(key); if (saved !== null) hidden = saved === 'true' } catch { /* Optional local preference. */ }
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'display-menu-toggle'
  button.title = 'Show or hide the Swarm and Bot Crossing menus'
  const sync = () => {
    document.body.classList.toggle('display-menus-hidden', hidden)
    button.textContent = hidden ? 'Show Display' : 'Hide Display'
    button.setAttribute('aria-expanded', String(!hidden))
    button.setAttribute('aria-label', hidden ? 'Show Swarm and Bot Crossing menus' : 'Hide Swarm and Bot Crossing menus')
  }
  button.addEventListener('click', () => {
    hidden = !hidden
    try { localStorage.setItem(key, String(hidden)) } catch { /* Still works without storage. */ }
    sync()
  })
  root.append(button)
  sync()
  return button
}
