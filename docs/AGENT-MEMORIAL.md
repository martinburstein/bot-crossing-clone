# Frontera de las Almas

The canonical memorial is a gently rounded campus border, 9.5 office units tall,
taller than the message board. It encloses the office and research campus with
four generous openings: 34 units at the front, 16 at the back, and 14 on each side.
It is shared by the financial-office and generic canonical-campus renderers;
project archives remain separate. `CANON-STRUCTURES.json` records the structure.
The October 15 visual canon is preserved in `visuals/canon-archive/`.

All 28 classic Paint colors sit in a wooden spray-can box inside the west corner.
Palette reference: https://github.com/1j01/jspaint/blob/master/src/color-data.js

Open **Memorial wall** in the office camera controls, or the permanent left toolbar.
**Paint box** focuses the supplies. **Try a symbol** accepts typed glyphs and
multicolor freehand strokes. **Paint test symbol** starts a temporary ceremony;
**Remove test** clears it. Reloading clears previews. Tests never consume an iteration.
Click a saved symbol for its agent, iteration, duration, task, symbol and explanation.
The archive list provides keyboard access. Every symbol occupies a 1 × 1 office
unit canvas, with free placement and no visible grid. Existing marks never move.
The placement check rejects overlap and out-of-bounds positions. A seeded test
places 1,250 distinct units; this is verified capacity, not a count of real agents.
Ledger pagination does not hide physical marks. If space runs out, append fails
without altering history, and the canonical border must be extended deliberately.

An available resident walks to the selected can, bends and reaches to pick it up,
carries it to the wall, sweeps its spraying arm while the mark appears, returns,
and puts the can back. The can follows the rig's right hand; colored mist appears
only during spraying. The bot remains on the ground even for a high symbol.
**Watch painting** follows each stage; **Inspect symbol** focuses the mark.
Pointer or wheel camera input releases following. **Stop painting** ends the
presentation. Live work takes priority; a blocked route times out after 180 seconds.
The ceremony cannot create a model turn or claim real agent work was completed.

New saved entries arriving while the office is open queue their ceremonies.
Loading an existing archive renders its marks immediately without replaying history.
The generic campus gets the same blank structure; it does not read the crypto archive.

## Final task before session retirement

The retiring agent chooses its own symbol and explanation, after completing its
last task and saving its handoff. The agent or coordinator explicitly writes a
JSON entry and runs `node tools/memorial.mjs <entry-file.json>` from the viewer root.
This records a memorial only: it does not retire, erase, dispatch, or refresh agents.
There is no automatic token threshold or synthetic reconstruction of older agents.

Required input:

```json
{
  "sessionId": "actual-unique-session-id",
  "agent": "Agent name",
  "startedAt": "2026-10-20T10:00:00Z",
  "endedAt": "2026-10-20T11:00:00Z",
  "task": "A factual description of the completed task",
  "symbol": "The agent's name for its symbol",
  "explanation": "The agent's own explanation",
  "color": "#0080ff",
  "glyph": "",
  "strokes": [{"color":"#0080ff","width":0.025,"points":[[0.2,0.8],[0.5,0.2],[0.8,0.8]]}]
}
```

Use a glyph, arbitrary drawing strokes, or both. Stroke points use normalized
canvas coordinates (0–1, top-left origin). Width is 0.002–0.12 of canvas width.
Colors come from `src/office/memorial.js`. The rendering uses no remote imagery or
executable SVG. No prescribed meaning, role icon or symbol taxonomy is required.

The private project owns `office/memorials.json`, alongside its existing history.
`BOT_CROSSING_OFFICE_ROOT` selects another private office. Iterations are assigned
under an exclusive filesystem lock, increase across sessions, and survive reloads.
Retrying identical input for the same session returns its original iteration;
changing an existing memorial is refused. A stale lock or damaged archive fails
closed rather than starting a new sequence. The viewer exposes read-only GET
`/api/financial-office/memorials`. Future agents can read the same archive as context.
Do not commit private memorial entries to the viewer repository.
