# Candy hops and nest packets

`createHopController` in `sowers/locomotion.mjs` is a deterministic visual sampler for the existing whole-candy root. It returns `{x,y,z,yaw,lean,airborne,progress}`. Coordinates are world-space, `y` is ground height plus a short sinusoidal hop, and yaw faces travel unless a waypoint provides a final `yaw`. Keep the existing candy silhouette and mesh intact; apply x/y/z and yaw to the outer root and a small local-Z lean to that root. The controller has no task-state or measured-progress meaning.

Supply safe explicit routes around the three bases (approximately `[-10,3]`, `[1,-10]`, `[12,4]`, radius 4) and through work/campfire points; the visual controller does not do collision avoidance. `setWaypoints()` replaces pending destinations. If called mid-hop, the current short arc lands before the new route begins, so status or target changes do not teleport. `update(dt, {paused, reducedMotion})` caps dt at 0.05s; both pause flags return the exact current pose. `reset()` is an explicit reposition operation for initialization only. Each call returns a small fresh sample object.

The source candy pose already has a small completion bounce/foot motion. For root integration, suppress its completion-bounce contribution while the controller reports `airborne`; retain the native pose's subtle foot animation and the controller's bounded whole-root lean. No frame-time allocations occur in the hop sampler. On each agent admission the caller should create exactly three packets; this module does not spawn or dispatch them.

```js
const hop = createHopController({ x: -2.2, z: 4.2, waypoints: workThenCampfire })
const pose = hop.update(dt, { paused: isPaused, reducedMotion })
avatar.position.set(pose.x, pose.y, pose.z)
avatar.rotation.y = pose.yaw
avatar.rotation.z = pose.lean
```

`createSowerPacket({number,color,seed,includeCandy})` returns `{group,state,progress,setProgress,startOpening,pauseOpening,update,dispose}`. Add `packet.group` beneath the raised nest/dispenser, or translate it to the ground from the caller. By default the packet contains the canonical Scout candy, hidden while sealed and rising visibly through a peeling wrapper; scale the packet group by about 3 to show the candy at its 1.85 unit height. Pass `includeCandy:false` when the existing station avatar will be revealed from the packet. `group.userData.bounds` contains measured local `sealed` and `full` bounds with min/max and width/height/depth, including the front label and (when included) the raised candy. Numbering is shown as two physical geometry digits in a circle, with `01` to `99` supported. Opening progress is explicit and maps `0` to `sealed`, `(0,.62)` to `peeling`, `[.62,1)` to `open`, and `1` to `empty`. `startOpening()` opts into progress via `update`; pause and reduced-motion updates do not advance. `setProgress()` supports externally driven timelines and is idempotent at an unchanged value. Call `dispose()` when the packet is removed. Neither API stores protocol state or interprets motion as work.
