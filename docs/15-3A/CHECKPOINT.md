# Approved 15-3A checkpoint — 2026-10-03

Martin approved this version as the baseline for future work after the rover orientation and wheel-direction corrections. Preserve the approved vehicle designs and make focused changes from this checkpoint.

- Repository: https://github.com/martinburstein/bot-crossing-clone
- Development branch: `15-3A`
- Checkpoint tag: `checkpoint/15-3A-approved-2026-10-03`
- Approved implementation commit: `91264b6` (the checkpoint commit adds this guide and updates verification documentation).

## What is preserved

The complete tracked viewer, built GLB art assets and credits, lockfile, reference gallery with its source/hash manifest, all eleven procedural Mars vehicles, three-bay rental hangar, normal-size seated pilots, clean cockpit linings, animated tracks, corrected wheel directions, and drill-facing rover/camera are included. The branch also retains the prior viewer history and synchronization helpers.

The three five-persona clusters have outward openings and token-based construction. Confirmed activity controls rental/return behavior; idle crews use their camps. The viewer remains read-only with respect to Swarm execution.

Evidence and screenshots are in this directory. See [geometry review](geometry-review.md) for validation scope and [pilot fit results](pilot-fit-results.json) for all 44 sampled fits. Older screenshots document earlier iterations; `rover-driving-direction.jpg` shows the final rover orientation.

## Restore and run

Use Node.js 22.13 or newer. From a new terminal:

```powershell
git clone --branch 15-3A https://github.com/martinburstein/bot-crossing-clone.git bot-crossing-checkpoint
cd bot-crossing-checkpoint
git switch --detach checkpoint/15-3A-approved-2026-10-03
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite (normally port 5274). The root opens the 15-3A colony in standby without requiring a running Swarm. Open **Explore the vehicle hangar** to inspect the fleet. The drilling rover defaults to a view from its drill end. For new work, create a branch from the checkpoint, for example `git switch -c codex/next-iteration`.

The browser inspection pages are `/tools/visual-check/vehicles.html` and `/tools/visual-check/magi.html`. The latter uses explicitly simulated data to exercise three rentals, boarding, return, growth and disconnect behavior. Neither page dispatches workers.

For live integration, follow [README-15-3A](../../README-15-3A.md) and the separate consolidated `swarm-protocol` repository's startup instructions. That protocol checkout and live runtime are not part of this viewer repository. Do not infer execution from visible bots.

## Verification at approval

- `npm test`: 104 passing tests.
- `npm run build`: successful; the existing large Three.js bundle warning is non-blocking.
- 55 moving-assembly samples: connected, zero mechanism clearance failures.
- 660 cockpit sightlines: no coincident first visible opaque surfaces.
- 44 actual normal-scale pilot samples: zero reported interior/canopy intrusions.
- Browser inspection: final rover heading and camera, clean interiors, and full fleet reviewed.

These are visual and sampled geometry checks, not continuous collision or manufacturing certification.

## Local-only state

The existing ignore rules keep dependency/build directories, research/download caches, logs, local agent settings, and personal colony JSON out of this public repository. Vehicle choices, parked inventory and UI preferences may also live in browser storage. The approved models and default layout are reproducible without that personal state. Historical ignored Dyson research artifacts remain in the original local checkout; this checkpoint does not expand the public viewer backup to that separate work.
