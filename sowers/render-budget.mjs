// Pure scheduling policy for the mission overview. The character studio owns its loop.
// `dirty` means a scene/data/input change needs an immediate frame. The caller must
// clear it only after rendering and keep lastRender unchanged when this returns false.
export function shouldRender({now, lastRender, paused = false, dirty = false, cameraMoving = false, hidden = false, maxFps = 30}) {
  if (hidden || !Number.isFinite(now)) return false
  if (!Number.isFinite(lastRender) || now < lastRender || dirty) return true
  if (paused && !cameraMoving) return false
  const fps = Number.isFinite(maxFps) && maxFps > 0 ? maxFps : 30
  // RAF timestamps can land just below an exact interval (e.g. 33.3ms at 60Hz).
  return now - lastRender >= 1000 / fps - .5
}
