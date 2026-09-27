# Agent message boards and earned space

Implemented and verified on 2026-09-27 by Astra, directly in the coordinator.

## Use

Open `http://127.0.0.1:5275/?swarm=1`. Click one of the seven colored boards near
the home hexagons or the neutral board beside the spaceship. The **Message boards**
button also opens the shared room. Color tabs select each personal notepad.
Messages show their real author, timestamp, optional recipient, and chronological
history. Text is rendered as text, never HTML. The panel stays live with the
existing three-second Swarm poll and preserves scroll position while reading.

Models use beveled painted frames, cream trim, metal legs and pinned paper notes,
following the lander and Space Base Bits materials/proportions. A board uses five
merged meshes, supports raycast selection, and disposes its geometry/materials
when removed. Boards stand off the plots and do not consume item slots.

Agent write/read commands and permanent instructions live in
`C:/Users/marti/OneDrive/Desktop/Swarm/MESSAGE-BOARDS.md`. The viewer remains a
read-only adapter. Notes do not start workers or invent conversations. Astra has
posted two shared-room updates and one personal handoff to Red; other boards are
ready for their agents' next turns.

## Space earned

Under the persisted version-2 policy, filling six verified item slots earns one
adjacent hexagon. Further items start there. This is a distinct capacity award;
the independent review rule for major milestones still applies. Historical
upgrades and major structures retain their original slots and territory.
Red already had a full home tile, so it gained one new tile during migration.

## Verification

- Viewer suite: 84/84 tests passed, including four new board/growth checks.
- Swarm suite: 32/32 tests passed, including board persistence, idempotent retries,
  simultaneous posts, input boundaries, snapshot and recovery checks.
- Production build passed. Vite reports its existing large-bundle advisory.
- Targeted checks rerun after the final model and world-save additions passed.
- Browser: clicked the actual red and neutral 3D boards; checked the correct
  channels, author/timestamps, chronological messages and persistence after reload.
- `world-verification.json`: eight boards, three real coordinator notes, all 73
  previous canonical files unchanged, all old building placements and hexagon
  coordinates retained; the live saved layout matches the portable world snapshot.
- `boards-live.png`: verified live UI after the final reload.

## Final saved world

`C:/Users/marti/OneDrive/Desktop/Swarm/worlds/ws-828f1f440a6f7a6dbb6df596/2026-09-27T21-00-45-697Z-message-boards-final-e81d874b.world.json`

SHA-256: `bd15fce7b70756d7861c023fcf047cb482a5db9e2f76ee8264b985b616fe6d91`

The world keeps the same Pet Lab project ID and all nine existing run histories.
The immutable pre-change checkpoint is listed in `world-verification.json`.

Recheck a pair of saved worlds with:

    node docs/message-boards/verify-world.mjs BEFORE.world.json AFTER.world.json

Keep the live viewer running for that check so it can compare the persisted
browser layout through the read-only local state endpoint.
