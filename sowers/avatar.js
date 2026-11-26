import { createCandySower } from './candy/mascot.js'

/** The live character uses the same candy-first contour as the design studies. */
export function createSower(options = {}) {
  return createCandySower({ ...options, variant: options.variant || 'scout' })
}
