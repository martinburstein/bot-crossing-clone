# Vehicle missions

The approved fleet and astronaut geometry stay unchanged. The colony now gives confirmed active workers visible Mars jobs instead of parking every rental just outside the hangar. This is a visual metaphor for coding work, not physical operations or additional Swarm tasks.

| Vehicle | Visible function |
| --- | --- |
| Eagle command shuttle | Survey the camp approach with a scanning marker |
| Defense sled | Intercept a large incoming meteor during a meteor alert |
| Recon Dropship | Carry supplies from the motor pool to camp and back |
| Recon drilling rover | Drill for mineral samples |
| Mining truck | Dig foundation post holes with soil and post markers |
| Trike | Check a wider camp perimeter |
| Astro Fighter | Scout the route between camps |
| Claw-Tank | Pick up and move construction materials |
| Armored Drilling Unit | Excavate a foundation trench |
| Transport scout | Survey another camp's remote work site |
| Scout bike | Carry reports between two camps and the motor pool |

Only a confirmed running/reviewing persona deploys a vehicle, with at most one per cluster and three total. Pilots deploy seated immediately. Rentals use terrain heights and a vehicle-width navigation grid; failed routes never fall back to crossing buildings. Active vehicles have a cyan marker. Drills and claws operate at work stops while wheels retain their stopped position. Cargo/reporting and survey missions repeat their routes while the worker remains active.

Work sites now follow the exposed outer rim of the worker's starting cluster, on sides facing away from the colony center. Construction and survey stops face outward; report/scouting routes connect the groups' outer work fronts, passing through the clear apron without operating there. The rim updates when earned tiles grow. If growth covers or encloses a rental's old position, the display relocates it to free ground before routing to the new front. Work-front clearings exclude decorative rocks, and the three vehicle searches have a bounded larger search budget for expanded colonies. This changes presentation only; it does not add tiles or model work.

Known task titles choose the suitable mission. Reviews use camp reporting. For general coding work without a clear vehicle function, the three cluster defaults are supplies, post foundations and camp reporting; a compatible saved vehicle preference can choose another visual job. A preference cannot override an explicit mission requirement or manufacture a meteor alert. The defense effect is an explicitly visual incoming-meteor event associated with an active interception title, not a weather sensor or evidence of a real hazard.

When work stops, fails, becomes unknown or leaves the roster, the rental parks immediately and its mission effects disappear. Off-shift personas retain their camp routines: talking, tinkering, board reading and snack breaks. Failed or unknown assignments appear as idle crew, without exclamation points, red fault eyes or stalled poses. Camp leisure is visual ambience; assignment outcomes remain unchanged in the protocol, and connection availability remains in the panel. The existing shift handoff is unchanged. Reduced motion freezes vehicle movement while keeping its active marker and status.

The viewer remains read-only. Mission props and trip history are transient; they do not earn hexagons, produce task receipts, change lease limits or start models. The original mission implementation was checked with research stopped; the October 4 outer-rim follow-up was made while the separately authorized Run-2 continued. The approved checkpoint tag remains intact; the current changes live on `codex/vehicle-missions`.

## Verification

Run `npm test` and `npm run build`. The updated tests exercise job selection, meteor gating, three independent cluster pilots, immediate disconnect parking, drilling versus wheel motion, vehicle-width obstacle avoidance, reduced motion and the approved rover orientation/seat fit. Existing geometry and asset tests continue to verify the canonical fleet.

The browser fixture at `/tools/visual-check/magi.html` is labeled **SIMULATED DATA** and never calls the protocol or saves a colony. `tools/check-vehicle-missions.cjs` checks three mounted pilots/twelve idle workers, motion, cargo/report visits to camp stops, an actual visible meteor/beam and immediate disconnect parking. Set `BOT_CROSSING_TEST_URL` to an existing loopback Vite server and `BOT_CROSSING_PLAYWRIGHT` to an installed `@playwright/test` module when it is not available in this checkout. Generated captures and logs stay under ignored `.cache/vehicle-missions-check`.

Observed Windows result on October 3, 2026: 109 tests passed, zero failures; production build passed; Chrome/WebGL mission checks passed. These checks use simulated active workers and are not proof that the stopped live research project resumed.

The off-shift presentation follow-up passed 19 focused tests, the production build and Chrome/WebGL checks. Simulated failed and unavailable assignments returned all fifteen personas to camp activities, parked every rental and displayed zero exclamation badges; the three-pilot active state still passed.

## Pilot speech and telemetry

Click a seated vehicle pilot to select that worker, including during departure from the hangar. A pixel-style speech bubble tracks the pilot's helmet with one line of at most three words, changing with the current mission phase. The bubble disappears when the pilot parks, leaves the selection or moves out of view.

The right panel replaces the generic repository card with the actual assigned task, current activity and vehicle, mission, observed speed in scene units per second, altitude, destination distance, coordinates, measured tokens and the next construction thresholds. Idle crew show camp activity and their last task. No percentage is invented for task completion. F3 or the telemetry button expands receipt counts, route waypoints, feed availability, the underlying task record, worker binding, FPS, frame time, draw calls, triangle count and render-buffer size. Coordinates and rendering observations refresh four times per second; crew/vehicle geometry and shift rotation are unchanged.

`node --test test/worker-inspector.test.mjs` checks all eleven mission labels, the three-word cap, phase changes, measured values and off-shift clearing. `tools/check-worker-inspector.cjs` exercises the actual application's mouse selection, live panel updates, F3, compact window layout and a disconnected feed. It intercepts every API request in its isolated browser, including colony saves, so its simulated workers never reach the host protocol. Set `BOT_CROSSING_TEST_URL` and `BOT_CROSSING_PLAYWRIGHT` as for the mission checks above. Captures stay in ignored `.cache/worker-inspector-check`.

The pilot inspection follow-up passed 16 focused tests, the production build and the browser checks, including the 1152 × 480 desktop panel size. The browser sent zero API calls to the host service.

October 4 outer-rim follow-up: all 114 tests and the production build passed. Chrome/WebGL checks covered three mounted pilots, twelve off-shift workers, outer routes through a 75-tile simulated colony, growth during a trip, meteor gating and immediate disconnect parking. Mounted-pilot clicking, three-word speech and F3 telemetry also passed, with zero API calls sent to the host protocol.
