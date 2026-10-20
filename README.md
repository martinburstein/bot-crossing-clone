# Bot Crossing — Office Demo

A separate, self-contained office scene with eight anonymous suited characters. It reuses the desk design, original character faces and visors, character body, animations, and suit styling from the original office scene. During the active-work phase, each character sits down, rolls into the keyboard, and types with alternating hand taps and subtle head motion. They stand up before walking the aisles or visiting a colleague. The original faces remain intact.

## Open

On Windows with Node.js installed, double-click **Start Office Demo.cmd**. Keep its terminal open while viewing the demo. Close it to stop the local server.

On macOS/Linux, run `node server.mjs` in this folder, then open http://127.0.0.1:8770. No npm install or internet connection is needed. A local server is required for the character asset and JavaScript modules.

Drag to orbit, scroll to zoom, right-drag to pan. Buttons pause the scene, reset the camera, and enter full screen. Space also pauses. Movement pauses while the browser tab is hidden.

This is a visual animation, not live AI work. No model calls, worker dispatch, account connections, research data, investment systems, balances, transactions, identity roster, or trade displays are included. It does not read the original project.

Editable scene code is in `src/`. Local dependencies are in `vendor/`. Original Bot Crossing code is MIT; see LICENSE. Three.js is MIT; see vendor/LICENSE. Character model and animations are CC0; see assets/CREDITS.md.

## Work animation

The baked clips `officeSitDown` (1.2 seconds), `officeTyping` (4-second loop), and `officeStandUp` (1.2 seconds) are selected by the `sit-down`, `typing`, and `stand-up` states in `src/main.js`. The demo schedules simulated tasks. These states are the animation hooks for a future task-status integration; no live task source is connected. Chair movement and character position use the same transition timing.

## Idle behaviors

Ten six-second idle gestures: conversation, coffee sipping, stretching, reading a note, thinking, waving, checking a wristwatch, adjusting a tie, looking around, and foot tapping. Conversation partners meet face-to-face on a shared schedule. Coffee breaks use the counter, a held mug, and a sip motion; note-reading uses a small card. Original facial expressions accompany the gestures.

The four pairs are staggered across a 180-second demo day. Work, social time, coffee visits, and quiet pauses happen at different times. `src/idle-routes.js` selects the activities; `src/idle-poses.js` defines the ten gestures; `src/idle-props.js` attaches the mug and note. Movement uses clear aisles between workstations. These remain visual demo behaviors.

## Geometry review

The idle gestures have clearance adjustments for the helmet, jacket, and opposite hand. Mug and note transforms follow the hand bone: the mug grip sits at the handle, and the paper has a printed reader-facing front and a plain back. The coffee loop starts and ends in a carrying pose. `geometry-review.json` records the full-loop sample checks and their scope.

## Animation picker

Open http://127.0.0.1:8770/animation-preview.html while the demo server is running. The picker has eleven entries, including Sitting & typing: a 10.4-second sequence with sit-down, two typing loops, and stand-up. Pause, scrub by seconds, change playback speed, or use the camera controls to inspect it.

The seated animation and preview use the same body rig, desk and chair geometry as the full office. The workstation height, chair footprint and movement, palm orientation, reach sequence and grounded leg motion were adjusted together. `sitting-geometry-review.json` records the sampled clipping checks.

## GitHub backup

This is the `office-demo` branch of `martinburstein/bot-crossing-clone`. Keep it in its own checkout beside the active Big Short viewer. Run `node verify-backup.mjs` to verify the backup files. On macOS, run `node server.mjs` or use `Start Office Demo.command` with Node installed. If port 8770 is occupied, run `PORT=8772 node server.mjs` and use that port in the browser.
