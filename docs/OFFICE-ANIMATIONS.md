# Office animation library

The shared character rig now includes ten office gestures and the seated work sequence from the anonymous office demo. This is source-level animation canon: original character meshes, face atlas, and existing clip names are preserved.

## Preview on Windows or Mac

After building and starting the viewer, open `/animations/` on that viewer's existing localhost address. The picker uses `src/agents/crew.js` itself, so it previews the same baked library available to the main renderer. It has eleven choices, pause, replay, speed, scrubbing and camera controls. It makes no model or research calls.

```sh
npm ci --ignore-scripts --no-audit --no-fund
node tools/check-office-animations.mjs
node --test test/office-animations.test.mjs
npm run build
```

Start the Big Short viewer with its existing `node tools/named-dual-view.mjs big-crypto-short` command. Its normal launcher and private project location are unchanged. `main` also includes the library and picker, but the Big Short installation should stay on `codex/financial-office-2026-10-15`.

## Updating the Mac's existing Big Short checkout

Check `git status --short --branch` and preserve local changes first. Fetch `origin` and update from `origin/codex/financial-office-2026-10-15` using a fast-forward when possible. A restored viewer may be detached at its saved commit; create a local working branch before fast-forwarding. If the histories have diverged, integrate the animation change on a separate branch or worktree; do not reset or overwrite local changes. Do not switch the research repository or rerun the pinned restore tool merely to update this viewer.

Build and run the checks above, then restart the viewer's own process if it still serves an old build. Verify the picker has eleven choices and includes Sitting & typing, the mug, and the note. Actual Mac launch/window permission verification happens on the Mac.

## Shared renderer API

`loadCrew()` returns the following additional `rig.clips` keys; `frameFor` and `attachMatrixAt` work as for existing clips:

| Clip | Length | Loop |
| --- | --- | --- |
| `idle-chat` | 6 s | yes |
| `idle-coffee` | 6 s | yes |
| `idle-stretch` | 6 s | yes |
| `idle-note` | 6 s | yes |
| `idle-think` | 6 s | yes |
| `idle-wave` | 6 s | yes |
| `idle-watch` | 6 s | yes |
| `idle-tie` | 6 s | yes |
| `idle-look` | 6 s | yes |
| `idle-foot` | 6 s | yes |
| `officeSitDown` | 1.2 s | no |
| `officeTyping` | 4 s | yes |
| `officeStandUp` | 1.2 s | no |

`OFFICE_ANIMATIONS` and `OFFICE_CLIPS` in `src/agents/office-animations.js` are the catalogue and bake specs. `src/agents/idle-poses.js` contains the ten gestures. `createIdleProps` from `src/world/office-idle-props.js` adds a hand-attached mug or note; pass the same root matrix, baked right-hand matrix and clip key as the character. Call `hide()` before writing a frame and `dispose()` when removing the owner.

These are available motions, not a replacement task scheduler. Existing main-view activity/status mappings and the financial office's telemetry, desk layout, bank and research state are preserved. The picker opts into the new clips directly. A project can map its own display states to these keys without issuing model calls or changing task status.

### Seated placement contract

The tested furniture is in `animations/office.js`. At scale 1.65, the standing root is `(desk.x, 0.8, desk.z + 3.8)` facing yaw PI. Smooth seated progress `s` is `u*u*(3-2*u)`, where `u` is transition time / 1.2. The body root moves backward in Z by `0.90*s`; `setChair(index,s)` moves the fitted chair. The picker demonstrates the entire sequence. Do not put the seated clip at a different desk height and assume the prior clearance check applies. For a live project, finish standing up before returning to navigation. Animation state never proves a worker is executing.

## Validation and provenance

The asset is the existing CC0 KayKit crew, with the original Bot Crossing heads and suit styling. No new downloaded art or external service is required. `test/office-animations.test.mjs` checks finite poses, clean restoration, closed loops, transitions and 387 seated furniture-clearance samples. Prior idle and sitting visual/geometry reviews are preserved in `animations/*-geometry-review.json`. Sampled checks are not continuous collision proofs.

`OFFICE-ANIMATIONS.json` pins the portable source files. `node tools/check-office-animations.mjs` verifies those hashes and the thirteen exported clip definitions.

## Standalone office demo backup

The same repository's `office-demo` branch is the standalone eight-colleague scene, with its own small Node server and local dependencies. Clone it into a separate directory rather than replacing the active Big Short checkout:

```sh
git clone --single-branch --branch office-demo https://github.com/martinburstein/bot-crossing-clone.git bot-crossing-office-demo
cd bot-crossing-office-demo
node server.mjs
```

Open `http://127.0.0.1:8770/` for the office or `/animation-preview.html` for its picker. If that port is occupied on the Mac, use `PORT=8772 node server.mjs`. No npm install or internet connection is needed after cloning the demo.
