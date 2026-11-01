# Kestrel Field Lab

A small, interactive grasslands view of the spacesuit research team. It retains
the three original MAGI supercomputers, the campfire/common and Frontera wall.
The crane, ships, pads, memory pods, pilot/camper bodies and other campus scenery
are omitted in this view. The normal campus and financial office remain separate.

## Pick this up

Branch: `codex/kestrel-grasslands-lab` in
`https://github.com/martinburstein/bot-crossing-clone`.

```sh
git fetch origin
git switch codex/kestrel-grasslands-lab
npm ci
node tools/kestrel-lab.mjs
```

Open `http://127.0.0.1:5286/suit-lab/`. The launcher reuses a healthy matching
local page, otherwise starts Vite on loopback only. Change the port with
`--port 5287`; use `--no-open` for headless startup. The launcher never connects
to the Swarm controller or starts model sessions.

On Martin's Windows desktop, `node tools/kestrel-lab.mjs --dual` uses the saved
two-pane layout: existing Codex caller left, this scene right. It reuses the
existing owned Bot Crossing browser profile. It does not start a robot, camera,
model, scheduler or research worker. Other platforms use a normal browser window;
the Windows equal-halves launcher has not been tested on macOS or Linux.

The standard `npm run dev` also serves `/suit-lab/`. `npm run build` includes
`dist/suit-lab/index.html` and copies all role Markdown files. Production assets
need an ordinary HTTP server; Vite is not needed to execute the built page.

## The 15/3 distinction

There are **15 visual residents**, each with a different suit colour, name,
specialty and equipment silhouette. There are **three preview assignment slots**:
Melchior, Balthasar and Casper. Choose any resident and click Hire on an open unit.
The resident walks there; Release returns them to the camp. A fourth simultaneous
assignment and duplicate assignment of one resident are rejected.

These are simulated assignments, persisted in this browser under
`botcrossing.kestrel-field-lab.v1`. No actual agent is spawned, no inference is
performed and no model backend is contacted. The UI labels the sample explicitly.
Do not report these 15 characters, lights or movements as live execution.

## Replaceable definitions

`public/suit-lab/roles/r01.md` through `r15.md` are independent plain-text briefs.
The identity/suit catalogue is `src/suit-lab/team.js`. A resident identity is not
a permanent model/session identity. The current role names are starting defaults.

Select a resident and choose **Replace role file** to load a `.md`/`.txt` file
up to64KiB. Its text and incremented version are stored locally in the browser,
independent of the visual body. The file is neither evaluated as code nor sent to
a model/server. File selection stays attached to the resident selected when the
dialog opened, even if the selection changes before reading finishes.

A future real execution adapter must bind at most three actual sessions to
explicit frozen role-definition versions, with real start/finish receipts. Keep
visual assignment state separate from confirmed running state. Do not silently
replace an active execution's instructions or add research work just to animate
the scene. The completed AURA study records and automation are outside this sample.

## Source map

- `suit-lab/index.html`: dedicated entry point.
- `src/suit-lab/main.js`: scene composition, camera, interaction and local state.
- `src/suit-lab/researcher.js`: fifteen original procedural chibi astronauts.
- `src/suit-lab/team.js`: catalogue and pure assignment/replacement rules.
- `src/suit-lab/style.css`: responsive interface; no remote fonts.
- `tools/kestrel-lab.mjs`: standalone local launcher and optional Windows Dual View.
- `test/suit-lab.test.mjs`: role-file completeness, three-slot limits, uniqueness,
  release/reassignment and replaceable-definition versioning.

The retained computer/hearth geometry comes from `createFreeCampusScene`; this
view filters its local group without changing the shared implementation. The
Frontera wall is reused with view-local scaling. Existing locally available marks
are fetched from the read-only memorial endpoint, with no append/paint calls.
No memorial records, private research, screenshots, tokens, runtime state or
browser storage are committed. Without a local archive the wall remains empty.

## Verification

Run `node --test test/suit-lab.test.mjs` and `npm run build`. Visual/UI verification
should cover the grassland scene, all three visible computers,15 residents,
select/hire/release across all three units and local role-file replacement.
Respects reduced motion. Actual mobility/survivability of a spacesuit is not
demonstrated by this miniature scene.
