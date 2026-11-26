const inactive = new Set(['pending','unaccepted','rejected','retracted'])
const accepted = milestone => milestone && typeof milestone === 'object' && !Array.isArray(milestone) && !milestone.retracted
  && !milestone.retractedAt && milestone.accepted !== false && !inactive.has(milestone.status)

/** A snapshot awards each explicit identity once; conflicting records earn no structure. */
export function acceptedCheckpoints(thread = {}) {
  const milestones = Array.isArray(thread.milestones) ? thread.milestones : []
  const identified = new Map(), anonymous = []
  for (const milestone of milestones) {
    const id = typeof milestone?.id === 'string' ? milestone.id.trim() : ''
    if (!id) { if (accepted(milestone)) anonymous.push(milestone); continue }
    if (!identified.has(id)) identified.set(id,{record:milestone,valid:true})
    if (!accepted(milestone)) identified.get(id).valid=false
  }
  return [...identified.values()].filter(item=>item.valid).map(item=>item.record).concat(anonymous)
}
