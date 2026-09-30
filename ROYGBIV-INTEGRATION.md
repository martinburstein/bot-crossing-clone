# ROYGBIV integration

The base colony now has seven configured Swarm stations: Red, Orange, Yellow, Green, Blue, Indigo and Violet. The viewer remains roster-driven and supports expansion. Stable station keys retain hexagon identity while visible labels follow the current color and task. The standard astronaut geometry and animation are unchanged.

The independent Desktop/Swarm protocol owns plans, task scrolls, capacity leases, dependency scheduling, evidence, independent review and acceptance. Its current roles are mission/planning, research, interfaces, implementation, verification, critical review and integration. Role assignments can change per activation.

The sibling [private Swarms copy](https://github.com/martinburstein/swarms-fork) retains upstream history and an upstream remote. Its `integrations/bot_crossing` package observes actual Python callables and writes minimal lifecycle metadata into the configured Swarm installation. The protocol reader validates exact run/shell/worker/attempt identities and heartbeat age. This viewer projects those observed records without importing Python or starting model calls. Python workers have no fake Codex Open link.

The local architecture and management documentation are `../Swarm/ARCHITECTURE.md` and `../Swarm/MANAGEMENT.md`. The source inventory/adoption matrix live in `../swarms-fork/integrations/bot_crossing/AUDIT.md`. The independent protocol and its personal run history are not bundled into either repository.

Validation for this update: 71 viewer tests; production build; 21 independent protocol tests, including a complete synthetic seven-color lifecycle and twelve-shell expansion; six Python bridge unit tests; one actual upstream graph smoke test with three deterministic workers; 166 selected offline upstream telemetry tests. The preserved Dyson suite also passes five software tests and twelve engineering verification groups. These checks establish software behavior, not provider performance or flight readiness.

The former ten-color Dyson run was accepted and archived before changing the base roster. All seven base shells are Ready. This update did not launch a new product activation. See [fork differences](FORK-CHANGES.md) for the rest of the clone's changes.

## Read-only MAGI top-layer mode

The standalone Swarm launcher may start this checkout as the 15-worker Bot Crossing cover by setting `BOT_CROSSING_MAGI_URL` to the local Swarm viewer's `http://127.0.0.1:<port>/api/state` endpoint and opening `?swarm=1&magi=1`. In that opt-in mode, `/api/threads` returns only the validated upstream worker projection (`w01`–`w15`); this checkout does not scan local agent stores or read a second Swarm roster. Reservations remain idle visually, and only confirmed running or reviewing leases count toward the three-cluster alignment lights. Failed, stale, or incomplete source state is rejected and the last roster is cleared. The top-layer exposes `/api/magi/health` as a read-only readiness check. Harness launch and legacy Swarm control routes are unavailable in this mode. With the environment variable unset, the established seven-shell view is unchanged.
