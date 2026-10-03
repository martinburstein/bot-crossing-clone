# Bot Crossing 15-3A

Branch `15-3A` provides the visual world for the consolidated `../swarm-protocol` installation. Open the viewer root to see three separated crews of five home hexagons. All fifteen astronauts retain the existing body/helmet design and share the default ivory suit and amber station trim. Melchior, Balthasar and Casper remain identity labels, not suit colors.

## Run

```powershell
npm ci
npm run dev -- --host 127.0.0.1
```

Without a configured bridge, the viewer opens with fifteen **standby** personas. This does not start or represent live model work. The hangar and idle activities work in standby.

For an existing running protocol viewer, set its exact loopback state URL before starting Bot Crossing:

```powershell
$env:BOT_CROSSING_MAGI_URL = 'http://127.0.0.1:<protocol-port>/api/state'
npm run dev -- --host 127.0.0.1
```

For the normal three-layer desktop, the canonical command runs from `../swarm-protocol`:

```powershell
node swarm-start.mjs start --bot-crossing-root ../bot-crossing-clone
```

That command belongs to the Swarm startup workflow and may initialize its coordinator. It was **not run for this visual implementation**. This viewer never dispatches workers. A prepared bounded plan and confirmed Swarm bindings remain prerequisites for active vehicle operation.

The default receipt reader uses `../swarm-protocol/runtime/launcher/session.json` to find the current run. For another installation use `BOT_CROSSING_PROTOCOL_ROOT`; for a specific CLI store use `BOT_CROSSING_MAGI_STORE`. The bridge projection and receipt store must agree on project and revision.

## Token construction

- **25,000 uncached input + output tokens** earns an addition or upgrade for the exact persona that owns the turn.
- **250,000 tokens** earns another hexagon. Counting is cumulative; expansion does not spend the tokens twice.
- A cell has six outer building slots and a vehicle bay. Its first six small awards create buildings; the next four upgrade them. The next cell starts receiving items at 275,000 tokens.
- Cached input is subtracted from Codex's inclusive input count. Repeated polling, task acceptance, elapsed time, transcript bytes, and coordinator usage do not earn construction.
- Usage is counted when a valid `turn.completed` receipt arrives. A running or interrupted turn without such a receipt remains pending. There is no estimated live token counter.
- Receipt identities are checked against the lease and turn token. Shared cluster-session usage is assigned only to the leased persona. Receipts are deduplicated, saved locally, and scoped to the project.
- A temporary receipt outage keeps the last measured total and labels it cached. A bridge outage stops all active poses and vehicles. The browser can restore the last display snapshot with all activity cleared.
- Rendering is capped at 61 hexagons per persona (915 total). Further earned hexagons remain counted and are explicitly shown as deferred in the panel. Cluster camps are reserved during expansion; homes and existing earned cells stay put.

Viewer state uses `data/colony-15-3A.json` and `data/magi-token-receipts.json`, or the equivalent paths under `BOT_CROSSING_DATA`. The legacy `data/colony.json` is separate. Per-persona vehicle choices and the last display snapshot are browser-local. No protocol mutation function is imported.

## Fleet and idle life

The [reference gallery](references/mars-mission/index.html) contains eleven human vehicle/side-build instruction images, plus eight original set-context images. The [manifest](references/mars-mission/manifest.json) records exact manual URLs, page numbers, catalog links and SHA-256 hashes. Source images remain reference material, separate from the original procedural game models. No alien craft is modeled.

| Set | Astronaut vehicles recreated |
| --- | --- |
| 7690 | Eagle command shuttle |
| 7691 | Mothership-assault defence sled |
| 7692 | MX-71 Recon Dropship and six-wheel drilling rover |
| 7693 | Mining truck with articulated vertical drill |
| 7694 | MT-31 Trike |
| 7695 | MX-11 Astro Fighter |
| 7697 | MT-51 Claw-Tank |
| 7699 | Six-wheel MT-101 Drilling Unit, transport scout and two-wheel scout bike |

Open **Explore the vehicle hangar** to rotate and zoom each model and choose its pilot. Each persona has a stable default vehicle; explicit browser choices take precedence over an optional projected `vehicleId`. Confirmed active personas walk to their bay, board, and operate the vehicle there. Air vehicles hover, wheels/drills turn, and articulated arms move. When activity ends, the pilot disembarks. Reduced motion keeps vehicles still.

Idle crews rotate through paired conversation, tinkering with a hammer, reading their camp message board, and sipping a robot snack. Pairing excludes active and unavailable personas. Routes avoid camp furniture, vehicles, and earned buildings. Unknown or failed states do not masquerade as casual idle activity.

## Verification

`npm test` covers existing behavior plus token boundaries, deduplication/recovery, project isolation, cluster layout/growth, idle pairs, all model geometry, boarding/disembarking, reduced motion and isolated save files. `npm run build` produces the production viewer.

For reproducible visual checking while the dev server is running, open `/tools/visual-check/magi.html`. The page is prominently marked **SIMULATED DATA**, uses the real render/animation code, makes no protocol calls and saves no colony data. Controls exercise 3 active personas, growth, disconnects, all vehicles, close-up views and deterministic 30-second movement. It is not included in the production build.

The browser check confirmed all fifteen idle personas reached their activities, three simulated active pilots boarded their vehicles, a constructed plot remained navigable, and unknown activity stopped vehicle operation. This is rendering/behavior evidence, not evidence of provider execution.

Use `?legacy=1` for the pre-15-3A ordinary colony or `?legacy=1&swarm=1` for its historical Swarm adapter. Existing Dyson deliverables and synchronization helpers remain in place.

### Verified build, 2026-10-03

- 97/97 Node tests passed.
- Production Vite build passed; the existing large Three.js chunk warning is non-blocking.
- Chrome visual check: all 15 idle destinations reached; 3/3 simulated active pilots mounted; constructed plots remained navigable; unknown states disembarked pilots and stopped vehicles.
- Hangar assignment updated the selected persona's vehicle and was restored to its default after checking.
- [Idle crew screenshot](docs/15-3A/idle-crew.jpg).
