# Kestrel Field Lab

A small, interactive floating grass island for the spacesuit research team. It
retains the three original MAGI supercomputers and campfire/common. There is no
perimeter wall. New Kestrel signatures are procedural flowers.
The crane, ships, pads, memory pods, pilot/camper bodies and other campus scenery
are omitted in this view. The normal campus and financial office remain separate.

The roofless miniature workshop has one shared suit in its assembly cradle,
surrounded by nine fabrication and test bays. The original Bot Crossing bots
work at specialty benches and take turns visiting the shared suit along the
aisles. The hearth remains outside the workshop for campfire reviews.

Read [KESTREL-RENEWAL.md](KESTREL-RENEWAL.md) for the user's five-stage ritual:
three working, nine idle/context bodies and three planting, followed by fresh
agents inhabiting the same bodies. The Garden panel provides an explicit,
browser-only preview with no real execution.

## Shared Bot Crossing engine and uniforms

The lab directly instantiates the main app's `Engine`, `Settings` and
`CameraRig` from `src/core/`. That engine owns the perspective camera, renderer,
postprocessing, canvas resize and animation loop. Do not add a second renderer,
orthographic camera, OrbitControls or separate requestAnimationFrame loop here.
The lab is scenery and UI hosted by the existing engine.

Camera gestures are the standard Bot Crossing gestures: left-drag pans;
right/middle-drag or Shift/Ctrl-drag rotates and tilts; wheel/pinch zooms at the
cursor. Drags never select a bot or focus an instrument. Overview, equipment
focus and View uniform use the shared camera rig's focus state, so subsequent
manual navigation takes over normally.

All fifteen department heads wear the same ivory helmet, slate undersuit,
white lab coat and brass chief insignia. Coats differ in cut, length, collar,
pocket layout and specialty details. The coats share the original bot body's
skin weights and animation texture; faces, helmets and base rigs remain the
original Bot Crossing characters. **View uniform** focuses the selected head.

## Workshop and testing tour

Use **Lab tour** or click an instrument to inspect a bay. The catalogue covers:

- Suit assembly, helmet/pack integration and joint fixtures.
- Pressure, vacuum, seam leakage and seal cycling.
- Hot/cold thermal-vacuum equipment, solar lamps and cooling loops.
- Shielded radiation beamline scenery, material cassettes and detectors.
- Fiber/textile/laminate fabrication, printing, microscopy and failure coupons.
- Oxygen, ventilation, CO₂ removal, humidity and breathing-loop fixtures.
- Moon/Mars body-weight support, walking, joint effort and tool tasks.
- Enclosed dust/abrasion equipment, impact and puncture specimens.
- Fit, glove/boot tasks, repair, sensor calibration and electronics.

Each bay has an eight-second **Preview cycle**: a visual equipment animation
with bounded progress, no fabricated measurements, no pass/fail result and no
hardware/model dispatch. These are fictional facilities in the sample; their
presence is not evidence of physical test capability or validated engineering.
Selecting another bay cancels the prior sequence. **Overview** returns to the
whole workshop; Escape or the close button returns to the existing hiring UI.

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

There are **15 visual residents** using the same Bot Crossing bots as the main
campus: shared body rig, helmet, animated screen face, backpack, antenna and
animation clips. Each retains its own name, specialty and director coat. There
are **three preview assignment slots**:
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
- `src/suit-lab/runtime.js`: thin adapter to the actual shared Engine, Settings
  and CameraRig; named camera destinations only.
- `src/suit-lab/island.js`: finite floating turf, cliff underside and clouds.
- `src/suit-lab/flowers.js`: unique code-built signature flowers; no image assets.
- `src/suit-lab/renewal.js`: five-stage visual lifecycle and replay-checked state.
- `src/suit-lab/researcher.js`: local preview adapter for the shared Bot Crossing
  `Astronauts` renderer and `loadCrew()` rig; no duplicated character geometry.
- `src/suit-lab/workshop.js`: roofless laboratory, shared prototype and equipment
  animations. The displayed prototype is a concept mannequin, not the bot model.
- `src/suit-lab/facilities.js`: nine bays, equipment catalogue, fifteen operator
  positions and bounded visual-preview timing.
- `src/suit-lab/team.js`: catalogue and pure assignment/replacement rules.
- `src/suit-lab/uniforms.js`: common uniform palette and fifteen coat recipes.
- `src/suit-lab/lab-coats.js`: animated coat overlays on the original body rig.
- `src/suit-lab/style.css`: responsive interface; no remote fonts.
- `tools/kestrel-lab.mjs`: standalone local launcher and optional Windows Dual View.
- `test/suit-lab.test.mjs`: role-file completeness, three-slot limits, uniqueness,
  release/reassignment and replaceable-definition versioning.

The retained computer/hearth geometry comes from `createFreeCampusScene`; this
view filters its local group without changing the shared implementation. The
Frontera wall and old archives remain in the canonical campus and financial
office. The island does not import the wall or read/write its memorial endpoint.
No memorial records, private research, screenshots, tokens, runtime state or
browser storage are committed. A new garden starts with no invented signatures.

## Verification

Run `node --test test/suit-lab*.test.mjs` and `npm run build`. Visual/UI verification
should cover the grassland scene, all three visible computers,15 residents,
select/hire/release across all three units and local role-file replacement,
the laboratory tour, camera focus, equipment cycles and their terminal state,
right-drag rotation, left-drag panning, wheel zoom and director coat closeups.
Respects reduced motion. Actual mobility/survivability of a spacesuit is not
demonstrated by this miniature scene.
