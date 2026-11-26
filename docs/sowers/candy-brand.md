# Sowers candy character and brand review

Review route: `/sowers/design/`. Source: `sowers/design/index.html`, `main.js`, and `style.css`.

The board compares three original silhouettes in a shared brand setting. Scout is the initial view, not a claimed winner. The front-of-pack pouches are layout concepts; flavor names and copy are creative concepts. The page does not establish market demand or production readiness.

## Shared artwork and the physical master

The cards, 32-pixel silhouette checks, front-view fallback and pouches use the shared contour, helmet, face, eyes and chest paths in `sowers/candy/silhouettes.mjs`. They remain flat character illustrations.

The hero explicitly switches between **Character** and **Candy master**. Character loads the procedural digital mascot with optional animation, expressions and material studies. Candy master is the default and loads the actual exported `${variant}-positive-mm.stl` from `/sowers/candy-form/` using Three.js STLLoader. It displays one mesh with one material. The visor, eyes, helmet and chest on the physical model are its real relief geometry, without painted inserts. The master keeps one physical material. Character finish, Rest/Animated pose and expression controls appear only when Character is selected. **Silhouette check** controls only the cards, pouches and illustration fallback; it never hides or replaces the physical relief, changes the 3D character finish or requests a different master.

Every master selection fetches the geometry report without caching, requests the asset with its SHA-256 fingerprint in the URL, and verifies the received bytes against the report. It also checks actual 30 mm height, bounds and total depth matching the geometry report, and triangle count. Raw bounds in millimeters, the full STL fingerprint, asset URL, generator/source fingerprints where supplied, and variant are exposed through the read-only `window.sowersDesignReview.masterEvidence` diagnostic. The browser verifies the STL bytes against the report; it does not independently reproduce the generator or verify source code hashes. The status line keeps measured height and total depth visible. A collapsed **View source evidence** drawer holds the triangle count, measured bounds, asset URL, export version and full STL/generator/parameter/source fingerprints. A missing, mismatched or invalid export produces a visible error and an empty hero, rather than silently substituting the agent.

Physical XY coordinates remain y-up; the front is positive Z. The master is centered across its depth and scaled uniformly from 30 mm to 1.85 scene units. Front, three-quarter, side and back cameras inspect the same geometry. Side/back views expose depth, drafted edges and the flat back independently of the face illustration.

## Visual system

An original path-drawn SVG SOWERS wordmark uses rounded strokes, evenly spaced letters, a tilted O and a small seed cue. Downloadable original SVG files are available under `/sowers/brand-kit/`: the wordmark and a one-ink Scout/Seed/Bud silhouette sheet. The sheet contains only contour paths, so face-feature tuning cannot leave it with stale facial artwork. It needs no remote fonts or images. Charcoal, warm paper, pale pink, lilac and acid yellow support citrus, lime and berry color concepts. Three CSS pouch studies reuse the selected character in their fixed flavor palettes.

## Interaction and resource management

One WebGL canvas displays one selected model. Quick variant controls, comparison cards and packaging selection stay synchronized. Flavor, character matte/gummy finish, flat-art silhouette check, camera and character pose/expression controls are local to this page. Citrus, Lime and Berry are short flavor-concept labels; adjacent copy describes palette colors, without composition claims. The pack layout reserves a band above each mascot for the flavor label, including on mobile. Nothing writes task or worker state.

The page starts paused. A static scene draws after interaction, resize or camera change; agent animation is capped at about 30 rendered frames per second. Hidden and offscreen views skip rendering. Pixel ratio is capped at 1.7. Model replacement disposes old geometry and material objects. An abort controller and generation counter prevent a stale STL request from replacing the current selection. Flat comparison art uses SVG rather than extra WebGL canvases.

Keys 1–3 select shapes, M toggles the flat-art silhouette check, R resets the front camera, and arrow keys orbit the focused canvas. Buttons/selects retain native keyboard behavior. Reduced motion starts paused and still permits explicit Play. WebGL initialization failure exposes an explicitly identified illustration fallback, with no claim that the physical master was rendered.

## Browser validation

Run the optional real-browser verifier with a local Playwright module:

```sh
SOWERS_PLAYWRIGHT_MODULE=/path/to/playwright node tools/verify-sowers-candy-browser.cjs
```

Defaults: dev server `http://127.0.0.1:5288`, installed macOS Chrome, 900 seconds of sustained interactions after initial checks. `SOWERS_URL`, `SOWERS_CHROME`, `SOWERS_STRESS_SECONDS` and `SOWERS_CANDY_OUTPUT` override those settings. Set `SOWERS_REQUIRE_STABLE=1` to require unchanging local source, exported STL and parameter fingerprints with no reloads. `SOWERS_DISABLE_HMR=1` blocks the development-only Vite WebSocket during observation; this is recorded in the report. A zero-second stress setting runs the initial checks only; it is not a sustained validation result.

The verifier asserts that source-specific controls are contextual, dimensions remain visible, the evidence drawer starts collapsed, the flat-art silhouette check preserves the exact master mesh, and pack flavor labels do not cross a face at the four tested viewport widths. It also asserts that each real STL loads, its fingerprint matches, actual bounds, total depth and triangle counts agree with the geometry report, and the master has a single geometry/material. It checks front/side/back views, 320/390/768/1440-pixel layouts, paused idle rendering, keyboard controls, reduced motion and a deliberate missing-STL response. The sustained run cycles variant, source, character material, flat-art silhouette, pose, expression and camera controls. Every minute it logs live WebGL buffers, textures and programs, cumulative creations/deletions, Three.js memory counts, export evidence and page errors. Settled snapshots must remain bounded. Renderer-owned lighting/shadow textures may remain live between model changes; buffers and programs must show disposal.

Machine-readable results and screenshots are written beneath `.cache/sowers-candy-browser/` by default. Consult the report's actual duration, cycle count, versions and status before interpreting a run. A run spanning evolving development assets is useful for interaction stability but cannot establish final-version visual acceptance.

## Recorded stable-candidate result — November 25, 2026

The final frozen-v2 browser run passed from 21:46:47 to 22:02:05 Pacific, including **903.048 seconds of sustained interactions and 282 complete cycles**. It recorded zero page errors, zero reloads and no source changes. Initial functional checks passed all three exported STLs, flavor/card/pack synchronization, four camera angles, four responsive widths, paused idle rendering, keyboard controls, reduced motion, a missing-STL error, a delayed superseded request and WebGL fallback.

Settled snapshots held at **6 live WebGL buffers, 8 textures and 3 programs**, with two Three.js geometries. The final counter showed 7,074 buffer creations / 7,068 deletions and 1,140 program creations / 1,137 deletions. The fixed eight textures were renderer/shadow resources rather than accumulating model textures. These counts describe this Chromium/SwiftShader run; they are not a universal device performance claim or proof against every possible leak.

The report verified the STL bytes and these source/parameter fingerprints remained pinned throughout:

- Shared contours/features: `4ace24fd1694fcb346b4679cd18febfbbef619aa225b4410495b92c5e81e1a17`
- Digital mascot: `f25a26bbbb0b390cf2a3413f73a3cdcc2930012b3fbf921f8aa07357b27f151d`
- Physical generator: `5049f82748f365b5e96cb3573ce5e1757a5f90de8e26ec5b6846b3943f2363b2`
- Physical parameters: `d50e4a45a1c0a20a32bc39e2ce1a0ea9e92feb2a49a951573435c06c888cf711`

Detailed local evidence: `.cache/sowers-candy-stress-final/report.json`, `final-desktop.png`, `final-mobile.png` and `master-{front,three,side,back}.png`. The Vite HMR WebSocket was intentionally blocked while the source files remained frozen. A separate development observation passed 903.477 seconds / 271 cycles while source assets evolved from v1 to v2; its report explicitly records source drift and is not the final-candidate result. An earlier unblocked development attempt was interrupted by HMR resetting the source mode and is not counted as a sustained pass.


## Wave 6 creator review — November 25, 2026

The review now has one **Character / Candy master** source selector above the hero. Character finish, Rest/Animated pose, expression and playback controls appear together only for Character. The flat-art **Silhouette check** is explicitly independent of the 3D preview. Physical dimensions remain immediately visible, while export counts/fingerprints move into the native, keyboard-accessible evidence drawer. The original wordmark has revised letter spacing and lighter rounded strokes; downloadable path-only wordmark and one-ink contour SVGs use no embedded fonts or third-party artwork.

The focused regression passed **153.916 seconds / 38 cycles**, with zero page errors and zero reloads. Settled resources stayed at **6 buffers / 8 textures / 3 programs**. Final counters were 2,892 buffer creations / 2,886 deletions and 238 program creations / 235 deletions. HMR was blocked; the report records concurrent source changes in the mobile CSS and digital mascot module. This validates the observed interaction/resource behavior, and is not a frozen-final-source result. The earlier 903-second frozen-v2 evidence remains historical rather than being attributed to the new UI.

Functional checks covered verified actual STLs, contextual controls, collapsed evidence, exact master preservation during silhouette checks, 320/390/768/1440-pixel layouts, keyboard view/shape selection, reduced motion, a deliberately missing STL, a delayed superseded request and WebGL fallback. An additional pass checked all three shapes at all four widths: none of the 36 flavor/face combinations overlapped. Desktop Character/evidence screenshots and successful HTTP requests for both original SVG downloads were also inspected. The 320-pixel decorative SOUR stamp was reduced after visual review to clear the crown.

Local evidence: `.cache/sowers-candy-wave6-ui-focused/report.json` contains the focused regression. `.cache/sowers-candy-wave6-ui-initial/` contains Character/evidence and Scout pack screenshots; `.cache/sowers-candy-wave6-ui-final/` contains the post-refinement functional report and four-width pack/hero screenshots. These are implementation and layout checks; they do not validate consumer preference, flavor, candy composition or manufacture.

## Limits

These are design concepts and positive-master previews. Coating readability, edible formulation, shrinkage, release behavior, tooling, food-contact materials, labeling, clearance and consumer appeal remain unvalidated. Manufacturing assumptions and the independently versioned exports are documented in `docs/sowers/candy-manufacturing.md` and the geometry report.
