# Mission renderer assessment

Wave 3, 2026-11-25. Tested the running Vite viewer at port 5286 using Playwright and installed Chrome, headless, at 1440×1000/DPR 1 and 390×844/DPR 3. These are local, short instrumented samples, not device certification or a GPU timer benchmark. GL draw entry points were wrapped before module load; CDP Performance TaskDuration and ScriptDuration were sampled. Browser wrappers add overhead. Tests ran separately from the coordinator's browser checks.

## Baseline before render scheduling

| Scene | Sample | RAF callbacks | GL calls / callback | Median / p95 callback interval | CDP task time |
| --- | --- | ---: | ---: | --- | ---: |
| Three fictional preview stations | 1.5 s | 90 | 917 | 16.7 / 16.7 ms | 0.414 s |
| Nine working stations, complete bases, one accepted checkpoint each | 1.5 s | 63 | 2709 | 16.7 / 33.4 ms | 1.557 s |
| Three preview stations, prefers-reduced-motion | 1.5 s | 91 | 917 | 16.7 / 16.8 ms | 0.409 s |
| Forced WebGL context failure | 1.5 s | 90 | 0 | 16.7 / 16.7 ms | 0.019 s |

The nine-station desktop sample is slower and costs approximately three times the draw submissions of the preview. Geometry/checkpoint evidence differs between fixtures, so these counts are scene-specific. No page errors occurred in these cases or the compact case. Task duration includes script, layout and other main-thread work; it is not process CPU or GPU duration.

A second nine-station fixture without checkpoint extensions, paused, still issued 197,836 draw calls during 131 callbacks over 2.5 seconds (0.792 s CDP task time). Pausing therefore stopped procedural motion but did not avoid repeated identical scene/shadow rendering. Reduced motion showed the same behavior as the normal preview. This is the measured reason for the narrow scheduling change.

The initial compact sample had only six callbacks and was insufficient for a stable timing conclusion. A warmed independent 390×844/DPR 3 sample with nine complete stations and no extensions produced 150 callbacks over 2.5 seconds, 43,500 GL calls and 0.538 s CDP task time. Only the selected station was visible; the render buffer was capped by the existing 1.75 pixel ratio (682×1286). No adaptive resolution change is justified by these measurements.

## Accessibility and framing checks

- Keyboard Enter selected Worker 4 but initially left focus on BODY because roster nodes were replaced. The coordinator repaired focus preservation; a subsequent run observed a focused BUTTON after selection.
- Reduced motion initially set aria-pressed=true while retaining the action text “Pause motion.” The coordinator repaired initial action text.
- The compact camera control accessibility tree contained only “⌖”, “◎”, “↻”, “Ⅱ”: hidden display:none spans did not provide names. The coordinator repaired these names. Final accessibility snapshots read Overview, Follow Sower, Orbit and Resume motion (pressed) when paused.
- All nine compact roster entries remained selectable. Selecting Worker 8 updated the detail panel and showed its complete base and avatar between the top detail and bottom roster panels. Screenshot inspection found no selected-station clipping at 390×844 and no horizontal page overflow. This does not establish framing at every height or base/checkpoint configuration.
- Forced getContext failure showed the readable 3D fallback, retained all three preview roster buttons, disabled scene controls and emitted no uncaught page errors.
- Opening a second headless tab and bringing it forward did not make document.hidden true. Actual OS background throttling was therefore not measured. Source inspection found no visibility guard in the original loop; the scheduler's hidden contract is unit tested.

## Targeted scheduler contract

`sowers/render-budget.mjs` exports a pure `shouldRender({now,lastRender,paused,dirty,cameraMoving,hidden,maxFps=30})` policy for the mission overview. The character studio keeps its own loop. Six tests cover hidden/first frames, 60Hz-to-30Hz scheduling, paused data/input response, paused camera damping and alternate caps.

Hidden pages never render. A first frame or dirty scene renders immediately. An unchanged paused scene sleeps. Active animation and camera movement use the frame cap; a 0.5 ms tolerance avoids losing every other eligible frame to rounded RAF timestamps. The helper holds no state and performs no DOM access.

Integration responsibilities:

1. Schedule the next RAF, then decide whether to render. Keep lastRender unchanged on skipped callbacks; clear dirty only after rendering. Set dirty for new observations, selection/filter/mode changes, resize, interaction and pause/resume.
2. Read the Three clock delta only on accepted frames, or accumulate skipped callback deltas. Otherwise 30 rendered frames advance only half the intended animation time. Reset/consume the clock when returning from hidden state; preserve the existing delta clamp.
3. Treat OrbitControls change events caused by damping as camera movement at the cap. Do not continually set dirty from every damping change and thereby bypass the cap. Render enough settling frames to complete damping/focus transitions, and keep follow/orbit state moving only when applicable.
4. Mark the frame dirty when visibility returns. Keep polling and stale-source semantics separate from scene cadence; an early return must not prevent the stale status transition.

Source-level cost centers are the per-frame scene plus 2048² soft shadow render, per-entry avatar/base animation, and label projection/style writes. The integrated loop now skips procedural work for invisible compact entries. Geometry/material merging and resolution adaptation were not implemented: they would require new evidence and larger changes to the visual modules.

## Final integration remeasurement

The final main module was intercepted only in the test browser to count actual `renderer.render` calls and observe animation elapsed time and camera position. GL wrappers remained enabled. No source file was changed by this instrumentation.

| Final scene | Rendered frames / wall sample | Simulation time advanced | Median / p95 render interval | CDP task time |
| --- | --- | --- | --- | ---: |
| Three preview stations | 60 / 2.005 s | 1.9995 s | 33.3 / 34.6 ms | 0.196 s |
| Nine working stations with checkpoint extensions | 61 / 2.008 s | 2.0344 s | 33.2 / 34.7 ms | 0.455 s |
| Three preview stations, orbit enabled | 61 / 2.021 s | 2.0325 s | 33.4 / 33.9 ms | 0.280 s |
| Nine stations, orbit enabled | 56 / 2.027 s | 1.9800 s | 33.6 / 49.2 ms | 0.997 s |
| Three preview stations, paused and static | 0 / 2.006 s | 0 s | no rendered frames | 0.021 s |
| Nine stations, paused and static | 0 / 2.005 s | 0 s | no rendered frames | 0.024 s |

Simulation time tracks wall time, so the accepted-frame clock delta avoids halving motion speed. Camera positions changed during orbit while frame counts stayed near the 30Hz cap; control damping did not bypass the cap. Pausing immediately after orbit legitimately rendered 9–11 further frames over two seconds while the camera settled. Those were moving-camera frames, with procedural elapsed time unchanged. Static paused samples submitted exactly zero GL draws in both scenes. Both final scenes emitted zero page errors. A run interrupted by Vite hot reload was discarded; all table entries use uninterrupted sample windows. Final compact accessibility snapshots exposed the repaired button names. A separate reduced-motion static preview test submitted zero draws for 1.5 seconds, submitted 917 GL calls after a canvas ArrowLeft keypress, then returned to zero draws for a further settled 1.5 seconds. The action remained named Resume motion. This verifies paused keyboard camera input repaints without reintroducing continuous paused rendering.

Public-activity campfire peer review found no blocking issue in the explicit channel allowlist, bounded cold tail scan, incremental append cache or documented cache invalidation contract. It does not infer task lifecycle from commentary or expose tool arguments.
