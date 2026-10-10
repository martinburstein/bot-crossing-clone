import { odradekDiscussion } from './campfire-odradek-discussion.js'
import {campusSlotAssignments,campusSlotName} from '../campus-slot-assignments.js'
// Imagined prospective role voices; their host follows the campus assignment.
const questions = {
  "r01": "What kind of companion would make a person feel more curious about the world?",
  "r02": "Could a clear start, pause, and finish make an arm's small wave easier to read?",
  "r03": "What timing would make a short wave feel expressive without hiding its endpoint?",
  "r04": "When does a machine’s response become part of a conversation?",
  "r05": "Could the display place requested and measured angles side by side to show feedback precision honestly?",
  "r06": "Could a simulated gesture help us invent new ones before we try them?",
  "r07": "What might one thoughtful experiment teach us that repetition cannot?",
  "r08": "When something unexpected happens, how can we turn surprise into understanding?",
  "r09": "What should the companion remember so the next interaction feels connected to this one?",
  "r10": "Could a small flourish make a gesture feel joyful without making it feel grand?",
  "r11": "How might the companion show its personality through motion and expression?",
  "r12": "What helps a person understand what the companion knows, wonders, or has yet to learn?",
  "r13": "Where does a human intention end and a machine’s interpretation begin?",
  "r14": "Which next project question would teach us most: expression, visible latency, or measured feedback?",
  "r15": "How can each new interaction leave behind a story someone else can understand?"
}

export function campfirePhilosophy(campus, roleCatalog = []) {
  const assignments=campusSlotAssignments(campus)
  if(!assignments)return {title:'Imagined camp discussion',opening:'Campus slot mapping is unavailable.',disclosure:'The discussion is hidden until the three real slot assignments are valid.',voices:[],synthesis:''}
  const hostName=campusSlotName(assignments.camper)
  const ids = [...(campus.campRoleIds || [])]
    .filter((id, i, all) => questions[id] && id !== campus.activeRoleId && id !== campus.chargingRoleId && all.indexOf(id) === i)
  return {
    title: 'Odradek at the Campfire',
    opening: 'How might an expressive arm make a small greeting feel clear and alive?',
    disclosure: `${hostName} hosts this imagined project discussion in one visual session. These are prospective ideas, not independent agent messages, accepted findings, or evidence of model execution.`,
    hostSlotId:assignments.camper,hostName,
    voices: ids.map(id => ({id, title: roleCatalog.find(role => role.id === id)?.title || id.toUpperCase(), remote: id === campus.chargingRoleId, text: questions[id]})),
    synthesis: 'Possible next steps: sketch a small wave with a distinct pause, show request and response latency in the interface, compare intended and measured angles before describing precision, then choose one bounded project question from what remains unclear.'
  }
}

// Historical role notes retain their authorship; browser playback never dispatches a model.
const exchanges = {
  r01: ['What would make a companion invite curiosity?', 'Maybe it leaves room for wonder.', 'Could a question be its gentlest greeting?', 'Then curiosity can lead the way.'],
  r02: ['Could a clear start, pause, and finish make the arm wave readable?', 'A small path could give the greeting a beginning and an end.', 'We could sketch the timing before choosing a path.', 'The sketch is an idea, not a tested movement.'],
  r03: ['What timing could make the gesture expressive?', 'A visible pause might let the greeting breathe.', 'Keep the endpoint simple enough to describe.', 'Then compare the idea with measured feedback.'],
  r04: ['When does a response become conversation?', 'When both sides can make sense of it?', 'Perhaps even a quiet response counts.', 'Then listening belongs in the design.'],
  r05: ['How might we show feedback precision?', 'Put the requested and measured angles beside each other.', 'Also show the response delay, with units.', 'Do not imply accuracy beyond those observations.'],
  r06: ['Could play help us invent gestures?', 'Imagination is a lovely first workshop.', 'We could sketch a gesture in the air.', 'A pretend world can hold real ideas.'],
  r07: ['What can one thoughtful experiment teach?', 'Maybe which question to ask next.', 'Careful attention can be its own discovery.', 'Learning needn’t hurry to be useful.'],
  r08: ['How can surprise become understanding?', 'By giving surprise a little room to speak.', 'An odd moment might be a clue.', 'Wonder helps us look again.'],
  r09: ['What should a companion remember?', 'The small details that make a moment yours.', 'Perhaps a favorite greeting?', 'Memory can make tomorrow feel welcoming.'],
  r10: ['Can a small flourish bring joy?', 'A little sparkle can be enough.', 'Maybe delight hides in the timing.', 'A modest gesture can have a bright heart.'],
  r11: ['How can motion show personality?', 'Perhaps through a recognizable rhythm.', 'A companion can have a gentle style.', 'Character grows through repeated meaning.'],
  r12: ['How can we show what the companion knows?', 'With room for “I’m still wondering.”', 'Curiosity can be visible too.', 'Honest uncertainty has its own warmth.'],
  r13: ['Where does intention meet interpretation?', 'Maybe where we learn together.', 'A shared question can bridge the gap.', 'Let’s leave room for another interpretation.'],
  r14: ['What should the next project explore?', 'Choose one question from expression, latency, and measured feedback.', 'A small comparison could resolve a real uncertainty.', 'Keep the proposal bounded and label it prospective.'],
  r15: ['How can an interaction become a story?', 'By leaving a thread for someone else to follow.', 'Small moments make good beginnings.', 'Let’s keep the wonder easy to pass along.'],
}
Object.assign(exchanges, odradekDiscussion)

export function campfireExchange(campus, elapsed, roleCatalog = []) {
  if (!campus || campus.mode !== 'awake' || !Number.isFinite(elapsed) || elapsed < 0) return null
  const session=campfirePhilosophy(campus, roleCatalog),voices = session.voices
  if (!voices.length) return null
  const beat = Math.floor(elapsed / 7), turn = Math.floor(beat / 2)
  const voice = voices[turn % voices.length]
  const lines = exchanges[voice.id]
  const round = Math.floor(turn / voices.length) % Math.floor(lines.length / 2)
  return { ...voice,hostSlotId:session.hostSlotId,hostName:session.hostName, turn, replying: beat % 2 === 1,
    thought: lines[round * 2],
    reply: lines[round * 2 + 1],
  }
}

