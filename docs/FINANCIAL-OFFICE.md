# The Big Short financial office

Run `node tools/financial-office.mjs` (or `Launch-Financial-Office.cmd`) after
`npm ci` and `npm run build`. This opens the existing caller on the left and the
office on the right. The loopback office server uses port 57986. It makes no
model calls, starts no workers and does not start robot hardware.

`FINANCIAL-OFFICE.json` is an editable project variant. `CANON-VISUAL.json`,
the default scene, `tools/dual-view.mjs` and its saved settings remain the original
canon. Its byte-identical source specification is retained under
`visuals/financial-office/canon-source.json`. Shared civic geometry comes directly
from the canon's `createFreeCampusScene`: campfire, board and three supercomputers
retain their positions, rotations and geometry. This variant hides the memory
petals, service pads and lander, and creates no hangar or crane.

Eight walnut desks, triple screens, reading material, chairs, coffee counter,
plants and a continuous open-air floor replace the hexagonal resident plots.
Eight persistent Bot Crossing bodies wear distinct two-piece suits. These are
editorial research simulations of Eisman, Burry, Ledley, Mai, Daniel, Moses,
Collins and Hockett; the styling is not a likeness or a claim about their clothes.
Use the roster to inspect a character and the camera buttons to frame the office,
campfire or complete campus. Idle characters read, visit, get coffee and walk.

Eight characters share the existing three executor slots. Only a fresh upstream
running/reviewing assignment with an actual worker binding illuminates a MAGI
unit. Task IDs and the full simulation title bind identities across rotating
transport workers. Missing or stale data shows standby/unavailable, never invented
execution. Ambient motion and conversation playback require no model turns.

The project owns the history, not this viewer. The bounded, checksum-verified
`office/history.json` feed is served read-only. It distinguishes curated source
notes, questions, project decisions and verified accepted contributions. The fire
replays this anthology continuously; the ledger exposes attribution. Use the
project's `build-office-plan.mjs` to add its compact digest to a future bounded
plan. Use its `office-history.mjs import-accepted <authoritative-store>` after
accepted work; this verifies submission content and artifact hashes and deduplicates
entries. It cannot dispatch a task. See the private project's office README.

History defaults to sibling
`crypto-research-lab/projects/crypto-swarm-2026-10-15/office`; override with
`BOT_CROSSING_OFFICE_ROOT` when relocating. The server accepts no history writes.
Office settings and colony saves have their own namespace/files. Private research,
runtime capabilities, full AGENT instructions and history do not belong in this
viewer's public origin. The complete source snapshot is backed up in the user's
private Crypto Research Lab repository.

Validation: `node --test test/financial-office.test.mjs`, the complete `npm test`
suite and `npm run build`. The office tests check renderable geometry/materials,
all eight identities/suits, unchanged civic positions/canon bytes, all walking
destinations, no fleet creation, three-slot limits, freshness and history integrity.
