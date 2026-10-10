// Prospective discussion authored by Balthasar; these are imagined role voices.
const questions = {
  "r01": "What kind of companion would make a person feel more curious about the world?",
  "r02": "How can a simple request become a gesture that feels understood?",
  "r03": "What makes a movement recognizable as a wave: its shape, its timing, or the meaning we give it?",
  "r04": "When does a machine’s response become part of a conversation?",
  "r05": "How can we learn the difference between what we meant and what happened?",
  "r06": "Could a simulated gesture help us invent new ones before we try them?",
  "r07": "What might one thoughtful experiment teach us that repetition cannot?",
  "r08": "When something unexpected happens, how can we turn surprise into understanding?",
  "r09": "What should the companion remember so the next interaction feels connected to this one?",
  "r10": "Could a small flourish make a gesture feel joyful without making it feel grand?",
  "r11": "How might the companion show its personality through motion and expression?",
  "r12": "What helps a person understand what the companion knows, wonders, or has yet to learn?",
  "r13": "Where does a human intention end and a machine’s interpretation begin?",
  "r14": "What discoveries might come from letting people play with ideas before choosing one?",
  "r15": "How can each new interaction leave behind a story someone else can understand?"
}

export function campfirePhilosophy(campus, roleCatalog = []) {
  const ids = [...(campus.campRoleIds || []), campus.chargingRoleId]
    .filter((id, i, all) => questions[id] && id !== campus.activeRoleId && all.indexOf(id) === i)
  return {
    title: 'Odradek at the Campfire',
    opening: 'What should we try next, and what kind of companion do we want to become?',
    disclosure: 'Balthasar imagines these perspectives in one philosophy session. Ideas for future work; no independent agent messages or accepted project facts.',
    voices: ids.map(id => ({id, title: roleCatalog.find(role => role.id === id)?.title || id.toUpperCase(), remote: id === campus.chargingRoleId, text: questions[id]})),
    synthesis: 'We want a companion that invites curiosity, makes room for play, and helps people learn from the space between intention and response. Small gestures and a visible understanding of what happened can let personality grow alongside honest communication.'
  }
}

// Balthasar-authored possible thoughts. Browser playback never dispatches a model.
const exchanges = {
  r01: ['What would make a companion invite curiosity?', 'Maybe it leaves room for wonder.', 'Could a question be its gentlest greeting?', 'Then curiosity can lead the way.'],
  r02: ['How can a request feel understood?', 'Perhaps the gesture carries its meaning clearly.', 'Maybe a familiar rhythm helps.', 'And a person can teach it new meanings.'],
  r03: ['What makes a wave feel like a wave?', 'Perhaps shape and timing meet halfway.', 'A pause might be part of the greeting.', 'Meaning may live in the motion between us.'],
  r04: ['When does a response become conversation?', 'When both sides can make sense of it?', 'Perhaps even a quiet response counts.', 'Then listening belongs in the design.'],
  r05: ['How do we learn what happened?', 'By staying curious about the gap.', 'Intention and outcome can both teach us.', 'A clear story helps the next question grow.'],
  r06: ['Could play help us invent gestures?', 'Imagination is a lovely first workshop.', 'We could sketch a gesture in the air.', 'A pretend world can hold real ideas.'],
  r07: ['What can one thoughtful experiment teach?', 'Maybe which question to ask next.', 'Careful attention can be its own discovery.', 'Learning needn’t hurry to be useful.'],
  r08: ['How can surprise become understanding?', 'By giving surprise a little room to speak.', 'An odd moment might be a clue.', 'Wonder helps us look again.'],
  r09: ['What should a companion remember?', 'The small details that make a moment yours.', 'Perhaps a favorite greeting?', 'Memory can make tomorrow feel welcoming.'],
  r10: ['Can a small flourish bring joy?', 'A little sparkle can be enough.', 'Maybe delight hides in the timing.', 'A modest gesture can have a bright heart.'],
  r11: ['How can motion show personality?', 'Perhaps through a recognizable rhythm.', 'A companion can have a gentle style.', 'Character grows through repeated meaning.'],
  r12: ['How can we show what the companion knows?', 'With room for “I’m still wondering.”', 'Curiosity can be visible too.', 'Honest uncertainty has its own warmth.'],
  r13: ['Where does intention meet interpretation?', 'Maybe where we learn together.', 'A shared question can bridge the gap.', 'Let’s leave room for another interpretation.'],
  r14: ['What can playful ideas uncover?', 'Paths we might never plan in advance.', 'A silly sketch may hold a useful seed.', 'Play lets possibility stretch its legs.'],
  r15: ['How can an interaction become a story?', 'By leaving a thread for someone else to follow.', 'Small moments make good beginnings.', 'Let’s keep the wonder easy to pass along.'],
}
const replies = ['What could we try to explore that?', 'Let’s carry that question into the next idea.']

export function campfireExchange(campus, elapsed, roleCatalog = []) {
  if (!campus || campus.mode !== 'awake' || !Number.isFinite(elapsed) || elapsed < 0) return null
  const voices = campfirePhilosophy(campus, roleCatalog).voices
  if (!voices.length) return null
  const beat = Math.floor(elapsed / 7), turn = Math.floor(beat / 2)
  const voice = voices[turn % voices.length], round = Math.floor(turn / voices.length) % 3
  const lines = exchanges[voice.id]
  return { ...voice, turn, replying: beat % 2 === 1,
    thought: lines[round === 0 ? 0 : round + 1],
    reply: round === 0 ? lines[1] : replies[round - 1],
  }
}

