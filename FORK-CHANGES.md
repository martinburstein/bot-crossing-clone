# Changes in this fork

The dedicated `?swarm=1` view now starts projects with seven home platforms and avatars. Evidence-backed minor milestones add or upgrade items; major milestones add outward hexagons without moving existing construction. Runtime activity alone earns no progress. A read-only health endpoint lets the external Swarm launcher start/reuse this exact modded clone. See [SWARM-MILESTONES.md](SWARM-MILESTONES.md).

Baseline: a497242, “Codex and Cursor support, Windows and Linux fixes, and a read-only colony (#21)”. Original authorship and license remain intact.

## ROYGBIV Swarm stations

Seven base shell identities (Red, Orange, Yellow, Green, Blue, Indigo, Violet) occupy distinct hexagons. The external roster can expand. Suit colors and matching plot accents identify each station; the astronaut design otherwise stays the same. Stable plot keys let assignment labels change without moving stations. The Swarm panel shows tasks, observed status, review state and each agent's scroll. Shells cannot be archived from the viewer. The former ten-color Dyson run remains archived outside this repository.

Codex worker matching uses the exact parent task and agent path, with duplicate observations removed. Python Swarms matching uses exact run, worker and shell identities after the external state reader checks attempt IDs and heartbeat freshness. Ready, queued, working and unobserved assignments remain distinguishable. A visual shell is not itself a running agent, and visible stations do not override the agent runtime's concurrency limit.

## Runtime observation

Codex scanning recognizes subagent lifecycle records and supports explicitly scoped parent tasks. Incremental reads handle long turns, stale Windows modification times, partial records, replaced files and read errors. Scope controls keep unrelated tasks out of a focused swarm view. Regression tests cover these cases.

## Separate protocol

The authoritative roster, task preparation, state validation, review gates and history live in the separately installed Desktop/Swarm folder. This repository contains a read-only adapter, configured by swarm.config.json or BOT_CROSSING_SWARM_ROOT, plus a compatibility CLI launcher. Browser and HTTP code do not invoke protocol mutations.

The ordinary colony continues to work if Swarm is absent; the API reports an integration warning. Adapter tests load a synthetic external provider and do not rely on a developer's local Swarm installation. See [SWARM-VIEWER.md](SWARM-VIEWER.md) for the interface.

## Dyson demonstrations and local evidence

The /dyson/ page contains the earlier Sunseed illustration and a three-node software controller/power simulation. The optional mission panel and artifact routes display local research outputs when present. These are design and software demonstrations, not flight qualification or measured energy delivery.

The later space-01 engineering study uses different assumptions from the earlier illustration. Its evidence remains a separate local snapshot, rather than an assertion that both represent one validated spacecraft design. Generated research, downloaded toolchains, machine settings and personal colony data are excluded from this repository.

Desktop/Swarm/examples/dyson contains a standalone copy of the five bench tests and twelve space-01 engineering verification groups. Run npm run test:dyson from Swarm. The runner needs only Node, refreshes its copied verification report, and establishes digital consistency only. This external package is not part of the viewer commit.

## Update helper and verification

sync.cmd and tools/sync.mjs fetch and report updates, or apply a guarded fast-forward. They do not push, reset, clean or stash. See [SYNC.md](SYNC.md).

For this viewer, install with npm ci, run npm test, then npm run build. The test suite covers runtime observation, adapter behavior, mission data, artifact routing, the software bench model and update safety. Protocol tests belong to the separate Swarm installation.
