# Bot Crossing — Office Demo

A separate, self-contained office scene with eight anonymous suited characters. It reuses the desk design, original character faces and visors, character body, animations, and suit styling from the original office scene. During the active-work phase, each character sits down, rolls into the keyboard, and types with alternating hand taps and subtle head motion. They stand up before walking the aisles or visiting a colleague. The original faces remain intact.

## Open

On Windows with Node.js installed, double-click **Start Office Demo.cmd**. Keep its terminal open while viewing the demo. Close it to stop the local server.

On macOS/Linux, run `node server.mjs` in this folder, then open http://127.0.0.1:8770. No npm install or internet connection is needed. A local server is required for the character asset and JavaScript modules.

Drag to orbit, scroll to zoom, right-drag to pan. Buttons pause the scene, reset the camera, and enter full screen. Space also pauses. Movement pauses while the browser tab is hidden.

Live mode is the default. It observes local Codex chats and subagents through the same read-only lifecycle adapter used by Bot Crossing. Starting a task assigns an anonymous colleague to a desk; the colleague walks back, sits, and types until the recorded turn completes or is interrupted, then stands and resumes roaming. Eight desks can work simultaneously; additional active tasks are counted in the footer. The Show demo button selects the original scripted animation.

The server reads local Codex session status (CODEX_HOME or ~/.codex) without changing it. Only anonymous seat booleans and counts reach the browser; no names, session IDs, prompts, paths, or transcripts are sent. It makes no model calls and does not start workers. No account connections, investment systems, balances, transactions, identity roster, or trade displays are included. Node 22.13+ is recommended; older Node versions use transcript-only detection.

The browser polls every two seconds. A disconnected feed clears working assignments; Codex not found produces an idle office. The inherited adapter expires an unfinished turn after 30 minutes without transcript activity, so abruptly killed processes may remain shown as active until that timeout. This observes activity, not successful task completion or output quality. Agent activity on another computer is visible only when this server runs on that computer.

Editable scene code is in `src/`. Local dependencies are in `vendor/`. Original Bot Crossing code is MIT; see LICENSE. Three.js is MIT; see vendor/LICENSE. Character model and animations are CC0; see assets/CREDITS.md.

## Work animation

The baked clips `officeSitDown` (1.2 seconds), `officeTyping` (4-second loop), and `officeStandUp` (1.2 seconds) are selected by the `sit-down`, `typing`, and `stand-up` states in `src/main.js`. Live mode selects these states from observed task activity. Demo mode schedules simulated tasks. Chair movement and character position use the same transition timing.

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

## Validation

Run `node --test test/activity.test.mjs` for lifecycle detection, anonymous desk assignment, overflow, and continuous aisle return/stand transitions across all eight office routes. The canonical Codex adapter and filesystem helper were copied from Bot Crossing commit ee0d35f.

A specific character can be assigned locally by setting `OFFICE_DEMO_SEAT_BINDINGS` to a JSON array of `{index, id}` pairs before starting the server. Index 4 is lilac; IDs use the canonical `codex:` prefix. Bindings stay server-side and affect only active tasks. Never commit or publish personal session IDs.

To show only research workers, `OFFICE_DEMO_EXCLUDE_IDS` accepts a comma-separated list of coordinator session IDs to omit from desk assignment and the working count. These values are local runtime configuration, not part of this backup.
