/** Deterministic, bounded whole-root candy hops. Waypoints are caller-owned and
 * should route around bases; this visual sampler has no collision/progress logic. */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const smooth = t => t * t * (3 - 2 * t)
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a))

export function createHopController({ x = 0, z = 0, yaw = 0, groundY = 0,
  hopDuration = 0.62, maxHop = 1.35, arcHeight = 0.36, maxLean = 0.12,
  waypoints = [] } = {}) {
  const cfg = { hopDuration: clamp(finite(hopDuration, .62), .25, 1.2), maxHop: clamp(finite(maxHop,1.35),.25,2), arcHeight:clamp(finite(arcHeight,.36),0,.7), maxLean:clamp(finite(maxLean,.12),0,.2) }
  let pos = { x: finite(x,0), z: finite(z,0), yaw: finite(yaw,0) }
  let route = [], pendingRoute = null
  let elapsed = 0, from = { ...pos }, to = { ...pos }, active = false
  function finite(v, fallback) { return Number.isFinite(v) ? v : fallback }
  function cleanPoint(p) { return { x: finite(p?.x,pos.x), z: finite(p?.z,pos.z), yaw: Number.isFinite(p?.yaw) ? p.yaw : null } }
  function enqueue(points) { pendingRoute = Array.isArray(points) ? points.slice(0,256).map(cleanPoint) : []; if (!active) { route=pendingRoute;pendingRoute=null } return api }
  function beginHop() {
    if (pendingRoute !== null) { route=pendingRoute;pendingRoute=null }
    while (route.length) {
    const goal = route[0]
    const dx = goal.x - pos.x, dz = goal.z - pos.z, distance = Math.hypot(dx,dz)
    if (distance < 1e-5) { pos.x=goal.x;pos.z=goal.z;pos.yaw=goal.yaw ?? pos.yaw;route.shift(); continue }
    from = { ...pos }
    const scale = Math.min(1, cfg.maxHop / distance)
    to = { x: pos.x + dx*scale, z: pos.z + dz*scale, yaw: goal.yaw ?? Math.atan2(dx,dz) }
    // Keep the final explicit facing at the waypoint; intermediate hops face travel.
    to.finalYaw = distance <= cfg.maxHop ? (goal.yaw ?? to.yaw) : null
    elapsed = 0; active = true
    return
    }
  }
  const api = {
    setWaypoints(points) { return enqueue(points) },
    get waypointsRemaining() { return (pendingRoute !== null ? pendingRoute.length : route.length) + (active ? 1 : 0) },
    update(dt, { paused = false, reducedMotion = false } = {}) {
      dt = clamp(finite(dt,0),0,.05)
      if (paused || reducedMotion) return this.sample()
      if (!active && route.length) beginHop()
      if (active) {
        elapsed = Math.min(cfg.hopDuration, elapsed + dt)
        const t = elapsed / cfg.hopDuration, eased = smooth(t)
        pos.x = from.x + (to.x-from.x)*eased
        pos.z = from.z + (to.z-from.z)*eased
        pos.yaw = from.yaw + wrapAngle(to.yaw-from.yaw)*eased
        if (t >= 1) {
          pos.x=to.x;pos.z=to.z
          if (to.finalYaw != null) pos.yaw=to.finalYaw
          const goal=route[0]
          if (goal && Math.hypot(goal.x-pos.x,goal.z-pos.z)<1e-5) route.shift()
          active=false; elapsed=0
          if (pendingRoute !== null) { route=pendingRoute;pendingRoute=null }
        }
      }
      return this.sample()
    },
    sample() {
      const t = active ? elapsed / cfg.hopDuration : 0
      return Object.freeze({ x:pos.x, y:finite(groundY,0) + (active ? cfg.arcHeight * Math.sin(Math.PI*t) : 0), z:pos.z, yaw:pos.yaw,
      lean: active ? Math.sin(Math.PI*t) * clamp(wrapAngle(to.yaw-from.yaw) * .35,-cfg.maxLean,cfg.maxLean) : 0,
        airborne: active && t > 0 && t < 1, progress: active ? t : 0 })
    },
    reset({ x: nx = pos.x, z: nz = pos.z, yaw: ny = pos.yaw } = {}) { pos={x:finite(nx,pos.x),z:finite(nz,pos.z),yaw:finite(ny,pos.yaw)};route=[];pendingRoute=null;active=false;elapsed=0;return this.sample() },
  }
  enqueue(waypoints)
  return api
}
