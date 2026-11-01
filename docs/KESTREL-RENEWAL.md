# Kestrel island: fifteen bodies, five stages

The user clarified that the numbers 3, 6, 9, 12, 15 count bodies across the
stages. They are not increasing concurrency. The steady state is exactly:

| Stage | Bodies | Meaning |
| --- | ---: | --- |
| 1 | 3 | Working at the three computers |
| 2 | 3 | First idle/context stage |
| 3 | 3 | Second idle/context stage |
| 4 | 3 | Third idle/context stage |
| 5 | 3 | Planting a signature flower, then renewing |

The three planting bodies are **not** three extra model workers. They perform a
local animation while the active three work. There is no idle inference loop.

## Timing

The five trios are A=r01–r03, B=r04–r06, C=r07–r09, D=r10–r12, E=r13–r15.
This is the preview's deterministic order; a future canonical scheduler owns
real role selection and receipts.

| Global wave | Working | Planting | Other bodies |
| --- | --- | --- | --- |
| 1 | A, generation 1 | none | initial pool |
| 2 | B, generation 1 | none | A idle; others initial pool |
| 3 | C, generation 1 | none | A/B idle; others initial pool |
| 4 | D, generation 1 | none | A/B/C idle; E initial pool |
| 5 | E, generation 1 | A, generation 1 | B/C/D idle |
| 6 | A, generation 2 | B, generation 1 | C/D/E idle |
| 7 | B, generation 2 | C, generation 1 | D/E/A idle |

Thus an agent works, idles through three stages, and plants during the fourth
intervening wave. Its next activation is fresh. Planting does not wait until
the next activation or block the current working trio. Advancing the wave does
wait for all three planting animations to complete, so renewal cannot be skipped.

## Identity and memory

The fifteen named bodies and department coats persist. An agent incarnation is
the pair `(bodyId, generation)`. The retiring incarnation's notes and signature
are archived on its flower. Renewal increments generation and clears that
incarnation's working notes. The community's archived flowers and wave handoffs
remain readable. A real fresh context would receive the current frozen role
brief and a curated, source-linked community handoff, rather than inheriting
the retired session's raw context indefinitely.

Flowers are small original parametric meshes: curved stem, two leaves, one
blossom. Their petal count, shape, bend, cup, proportions and colour are computed
continuously from their identity seed. No pictures, sprite set, stock flower
catalogue or image-generation service is used. The geometry fingerprint excludes
the seed itself and is checked against existing flowers before planting.

## Current implementation is a preview

The Garden panel explicitly says **Lifecycle preview**. Start/Finish preview
wave manipulates only browser-local visual state. Optional notes are user-entered
preview notes, never manufactured agent reports or verified research. No models,
workers, hardware, budgets or old memorial records are touched.

Storage: `botcrossing.kestrel.renewal-preview.v1`. Restore replays the completed
preview wave ledger, regenerates the deterministic signatures and compares the
whole state. Inconsistent saved state is retained and blocks further preview
progress; it is not silently deleted. Planting is committed atomically only after
all three bodies reach their positions and finish their gestures. A reload during
planting restarts that visual ceremony without duplicating committed flowers.

Before connecting real execution, implement the lifecycle in the owning
`swarm-protocol` system, expose an accepted read-only projection to this scene,
and supply actual completion/retirement receipts, retiring agents' own signature
recipes and source-linked handoffs. Do not treat this browser ledger as a second
real protocol or let a pretty animation count as verified work.

## Files and checks

- `src/suit-lab/island.js`: finite grass island and rock underside, no walls.
- `src/suit-lab/flowers.js`: parametric flower recipes, geometry and positions.
- `src/suit-lab/renewal.js`: pure preview transitions, immutable archives, restore.
- `src/suit-lab/main.js`: Garden controls and planting choreography.
- `test/suit-lab-renewal.test.mjs`: five-stage overlap, generation/context changes,
  complete-trio gate, duplicate rejection, restore, signature uniqueness and land.

The main campus and financial office retain their canonical Frontera wall and
historical marks. The opt-in Kestrel island no longer imports or reads that wall.
