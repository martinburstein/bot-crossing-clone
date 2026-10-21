# Canonical Dual View

`CANON-VISUAL.json` is the current visual canon, adopted from the latest Waveshare
campus on October 15, 2026, with Frontera de las Almas added October 21 through
`CANON-STRUCTURES.json`. It belongs here in Bot Crossing and applies across
projects. Project tasks and histories remain in Swarm; the visual is shared.

Say **Launch Dual View**, run `node tools/dual-view.mjs`, or open
`Launch-Dual-View.cmd`. Codex fills the left half and Bot Crossing the right,
separated by four pixels. The token count and remaining allowance stay in the
Bot Crossing HUD. There is no standalone MAGI Atlas or Token Counter interface.

The campus uses the existing `free-campus-scene.js` and `free-campus-layout.js`
geometry: Balthasar above camp, Casper left, Melchior right, fifteen memory pods,
seventeen resident bodies, and the current offline crane landmark. The actual
Waveshare campus projection continues through its existing renderer. Generic
fifteen-worker projects reuse that same scenery through `canonical-campus.js`;
the Pilot and Camper role-library bodies are marked display-only, never two
additional workers. Real activity still comes from the selected project's feed.

Ordinary Dual View sets `presentation=1`: no hardware-observation polling, camera
service, USB connection, model turn or task dispatch. The crane remains an offline
simulation. Explicit RoArm startup remains a separate workflow.

`data/dual-view.json` privately pins HUD usage to the caller chat. The latest
verified layout receipt is private in `data/dual-view-last.json`. Neither file is
part of the public GitHub source backup. The installed skill's portable source is
`skills/launch-dual-view/SKILL.md`.
