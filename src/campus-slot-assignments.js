export const CAMPUS_SLOT_IDS = Object.freeze(['melchior','balthasar','casper'])
export const LEGACY_CAMPUS_SLOT_ASSIGNMENTS = Object.freeze({
  pilot:'melchior', camper:'balthasar', executor:'casper',
})
const DUTIES = Object.freeze(['pilot','executor','camper'])
const NAMES = Object.freeze({melchior:'Melchior',balthasar:'Balthasar',casper:'Casper'})

/** Resolve an optional visual duty mapping; invalid mappings fail closed. */
export function campusSlotAssignments(campus) {
  const value=campus?.slotAssignments
  if(value===undefined)return LEGACY_CAMPUS_SLOT_ASSIGNMENTS
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==DUTIES.length||DUTIES.some(duty=>!CAMPUS_SLOT_IDS.includes(value[duty]))||
    new Set(DUTIES.map(duty=>value[duty])).size!==DUTIES.length||value.pilot!=='melchior')return null
  return value
}

export function campusSlotName(slotId) { return NAMES[slotId]||null }
