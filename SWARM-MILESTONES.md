# Milestone-driven Swarm visuals

Open `/?swarm=1` for the dedicated Swarm view. It shows all configured shells, with a ROYGBIV base of seven, and polls every three seconds. Swarm owns the milestone evidence; this clone only renders it.

Each new project begins with seven perimeter home hexagons and seven avatars. Empty platforms contain no pre-earned buildings or random cargo. Minor milestones add items; after six items on a tile, subsequent minors upgrade them. Every major milestone adds an adjacent outward tile and a structure. The layout retains existing homes and growth between updates and avoids other project plots. The panel reports exact minor/major/tile counts and the latest checkpoint.

Only recorded milestones drive this construction. Time running, transcript size and polling do not award progress. Runtime status remains separately observed. Completed project construction can remain visible from the protocol's archived display pointer until the next activation.

`/api/swarm/health` identifies the modded clone, its configured protocol root and milestone support to the canonical Swarm launcher. The launcher and all mutations remain outside this repository in Desktop/Swarm. Read `../Swarm/MILESTONES.md` and `../Swarm/AGENTS.md` for the default activation process and evidence requirements.
