# Connected candy Sower motion

Wave 6 uses the canonical neutral candy outline and relief as the reset state. The physical master represents that neutral state only. Runtime expressions are digital variations; they do not change the mold drawing or imply a confectionery mechanism.

Six held poses are designed to differ even when the renderer pauses at elapsed zero:

| Explicit source status | Connected gesture | Eye cue |
| --- | --- | --- |
| idle | Upright, hands resting | Canonical friendly arches |
| working | Small side bend and forward intent, both mittens reaching | Inward focus and lower gaze |
| review | Clear inquisitive side bend | Unequal arch pivots |
| waiting | Opposite lean, one integral mitten raised | Gaze lifted toward raised mitten |
| complete | Both integral mittens lifted and spread | Lifted cheerful arches |
| error | Inward mittens, opposite bend and forward hunch | Inward sorrowful arch pivots, lowered gaze |

The body mesh and every helmet, visor, eye and chest vertex receive the same continuous bend. Eye vertices first pivot around their canonical centers. The face group never slides or rotates independently of the body. Broad mitten bases remain part of the single connected contour. No detached limbs, props, added screens or body scale pulsing are used. The feet stay grounded outside locomotion/celebration; the latter lifts the whole connected character by at most 0.105 world units (about 1.8 pixels at a 32-pixel 1.85-height character), while its held arms remain expressive between hops. Neutral height remains 1.85.

These gestures consume the supplied viewer status only. Animation never infers state, completion, checkpoint acceptance or activity. Station tint remains its supplied identity; status does not recolor the character. Unknown status uses the resting gesture.

`resetPose()` restores every body and relief vertex exactly, all pose transforms, selection emission and motion damping. Geometry tests cover all three variants over 4,320 sampled poses, invalid times, finite world transforms, no balloon scaling, world-ground clearance and exact canonical relief restoration. Six held Scout contours and eye poses are also compared numerically. These are sampled checks, not a continuous collision proof.

## Actual small render check

Run against a local Vite instance (the renderer imports source modules):

```sh
SOWERS_URL=http://127.0.0.1:5292 \
SOWERS_PLAYWRIGHT_MODULE=/path/to/playwright \
SOWERS_MISSION_OUTPUT=.cache/sowers-candy-poses-wave6 \
node tools/soak-sowers-mission.cjs --poses
```

The check renders all six actual 3D poses at 32, 64 and 128 pixels with the same frontal orthographic camera, lights, seed and palette. It retains PNGs and all fifteen image-pair differences at each size. Each pair must differ by at least eight salient pixels or 0.7% of the image, whichever is greater, with channel difference at least 24/255. This checks actual rendered differences; it does not prove users will correctly name the six statuses. A paused character need not communicate task state without its text label.

## Production mission observation

The same tool without `--poses` opens the production mission viewer in an isolated headless Chrome context. Browser-local routes replace only the native-thread and optional-broadcast GET responses; no source session, protocol store or work assignment is changed. Twelve fixtures rotate through all six explicit statuses at real native polling cadence. Each roughly eight-second observation exercises nine/three pagination and selection; repeated pause/resume and mobile layout checks are included. Checkpoint acceptance/retraction is asserted against the visible total. The script records timestamps, source/build SHA-256 pins, Git revision, GL allocations/deletions, heap samples, errors, context losses and navigation count.

Default minimum end time is 2026-11-26 07:30 UTC (23:30 Pacific November 25), measured using the actual wall clock. Set `SOWERS_SOAK_UNTIL` only for an explicitly different run. The final report checks no reload, unchanged pinned sources/build, no page errors/context losses, hard resource ceilings and the same population's warmed resource plateau. The synthetic fixture population and software GPU limit the claim: this checks renderer behavior and read-only source handling, not a real agent's progress, GPU diversity or production concurrency limits. Only a `passed` report containing the actual end timestamp constitutes completion.
