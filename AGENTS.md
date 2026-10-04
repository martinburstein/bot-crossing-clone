# Bot Crossing: visual layer

The current 15/3A installation observes `../swarm-protocol` through its configured read-only MAGI endpoint. The legacy Swarm references below remain historical compatibility guidance. Vehicle missions are presentation only: deploy at most one confirmed pilot per cluster, never create work or treat scene effects as execution evidence. Preserve the approved fleet/astronaut geometry and checkpoint tag. Read `docs/15-3A/VEHICLE-MISSIONS.md` for the current mission behavior and checks.

Swarm tactics and authoritative state live in ../Swarm, outside this clone.
For “activate the swarm”, read ../Swarm/AGENTS.md, ../Swarm/README.md and ../Swarm/MANAGEMENT.md. Run the canonical CLI from that directory. Do not recreate a local protocol or write a second roster/run store in this clone.

This repository owns rendering, interaction, runtime observation and a read-only Swarm adapter. swarm.config.json selects the installation; BOT_CROSSING_SWARM_ROOT may override it. Keep station identities and colors stable across visual changes. Preserve the astronaut design; only suit color differs.

Protocol files: ../Swarm/{roster.json,active.json,shells,plans,runs,lib,tools}. This clone must not import protocol mutation functions in its server or browser. tools/swarm.mjs is a compatibility launcher, not a protocol implementation.

Existing Dyson artifacts remain product deliverables at their current paths. Historical relative task paths resolve against the workspace in ../Swarm/WORKSPACES.json. Preserve those artifacts, existing user changes and sync helpers. Editing the visual layer does not authorize resuming physical/product work.
