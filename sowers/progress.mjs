import { acceptedCheckpoints } from './evidence.mjs'

/** Ordered assembly phases; these describe the model, never inferred task completion. */
export const constructionStages = Object.freeze([
  Object.freeze({ id: 'foundation', start: 0, end: 0.16 }),
  Object.freeze({ id: 'frame', start: 0.16, end: 0.38 }),
  Object.freeze({ id: 'shell', start: 0.38, end: 0.68 }),
  Object.freeze({ id: 'systems', start: 0.68, end: 0.94 }),
  Object.freeze({ id: 'beacon', start: 0.94, end: 1 }),
])

export function clampProgress(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

export function stageProgress(fraction, stage) {
  const spec = typeof stage === 'string' ? constructionStages.find(s => s.id === stage) : stage
  if (!spec) return 0
  return clampProgress((clampProgress(fraction) - spec.start) / (spec.end - spec.start))
}

/**
 * Only an explicit, finite completion fraction or a declared plan denominator can
 * produce a percentage. Status, elapsed time, transcript bytes and tokens cannot.
 * Milestones alone count earned work but reveal no remaining-work denominator.
 */
export function observedConstruction(thread = {}) {
  const explicit = thread.constructionProgress
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit >= 0 && explicit <= 1) {
    return { fraction: explicit, source: 'explicit', label: 'Reported construction progress', completed: null, total: null }
  }
  const steps = thread.plan?.steps
  if (Array.isArray(steps) && steps.length > 0) {
    const completed = steps.filter(s => s?.status === 'completed').length
    return { fraction: completed / steps.length, source: 'plan', label: `${completed} of ${steps.length} declared steps complete`, completed, total: steps.length }
  }
  const milestones = acceptedCheckpoints(thread)
  return { fraction: null, source: milestones.length ? 'milestones' : 'unknown', label: milestones.length ? `${milestones.length} observed checkpoints; remaining work unknown` : 'Awaiting measured checkpoints', completed: milestones.length, total: null }
}
