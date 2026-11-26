# Sowers candy character and brand review

Review route: `/sowers/design/`. Source: `sowers/design/index.html`, `main.js`, and `style.css`.

The board compares three original silhouettes in a shared brand setting. Scout is the initial view, not a claimed winner. The front-of-pack pouches are layout concepts; flavor names and copy are creative concepts. The page does not establish market demand or production readiness.

## Shared artwork and the physical master

The cards, 32-pixel silhouette checks, front-view fallback and pouches use the shared contour, helmet, face, eyes and chest paths in `sowers/candy/silhouettes.mjs`. They remain flat character illustrations.

The hero explicitly switches between **Agent** and **Candy master**. Agent loads the procedural digital mascot with optional animation, expressions and material studies. Candy master is the default and loads the actual exported `${variant}-positive-mm.stl` from `/sowers/candy-form/` using Three.js STLLoader. It displays one mesh with one material. The visor, eyes, helmet and chest on the physical model are its real relief geometry, without painted inserts. Material changes adjust that one material; One color still controls the flat-art silhouette comparison.

Every master selection fetches the geometry report without caching, requests the asset with its SHA-256 fingerprint in the URL, and verifies the received bytes against the report. It also checks actual 30 mm height, bounds and total depth matching the geometry report, and triangle count. Raw bounds in millimeters, the full STL fingerprint, asset URL, generator/source fingerprints where supplied, and variant are exposed through the read-only `window.sowersDesignReview.masterEvidence` diagnostic. The browser verifies the STL bytes against the report; it does not independently reproduce the generator or verify source code hashes. The status line names the export version and shortened STL fingerprint. A missing, mismatched or invalid export produces a visible error and an empty hero, rather than silently substituting the agent.

Physical XY coordinates remain y-up; the front is positive Z. The master is centered across its depth and scaled uniformly from 30 mm to 1.85 scene units. Front, three-quarter, side and back cameras inspect the same geometry. Side/back views expose depth, drafted edges and the flat back independently of the face illustration.

## Visual system

An original SVG SOWERS wordmark uses rounded strokes, a tilted O and a small seed cue. It needs no remote fonts or images. Charcoal, warm paper, pale pink, lilac and acid yellow support citrus, lime and berry color concepts. Three CSS pouch studies reuse the selected character in their fixed flavor palettes.

## Interaction and resource management

One WebGL canvas displays one selected model. Quick variant controls, comparison cards and packaging selection stay synchronized. Flavor, matte/gummy finish, flat-art monochrome, camera and agent pose/expression controls are local to this page. Nothing writes task or worker state.

The page starts paused. A static scene draws after interaction, resize or camera change; agent animation is capped at about 30 rendered frames per second. Hidden and offscreen views skip rendering. Pixel ratio is capped at 1.7. Model replacement disposes old geometry and material objects. An abort controller and generation counter prevent a stale STL request from replacing the current selection. Flat comparison art uses SVG rather than extra WebGL canvases.

Keys 1–3 select shapes, M toggles flat-art monochrome, R resets the front camera, and arrow keys orbit the focused canvas. Buttons/selects retain native keyboard behavior. Reduced motion starts paused and still permits explicit Play. WebGL initialization failure exposes an explicitly identified illustration fallback, with no claim that the physical master was rendered.

## Browser validation

Run the optional real-browser verifier with a local Playwright module:

```sh
SOWERS_PLAYWRIGHT_MODULE=/path/to/playwright node tools/verify-sowers-candy-browser.cjs
```

Defaults: dev server `http://127.0.0.1:5288`, installed macOS Chrome, 900 seconds of sustained interactions after initial checks. `SOWERS_URL`, `SOWERS_CHROME`, `SOWERS_STRESS_SECONDS` and `SOWERS_CANDY_OUTPUT` override those settings. A zero-second stress setting runs the initial checks only; it is not a sustained validation result.

The verifier asserts that each real STL loads, its fingerprint matches, actual bounds, total depth and triangle counts agree with the geometry report, and the master has a single geometry/material. It checks front/side/back views, 320/390/768/1440-pixel layouts, paused idle rendering, keyboard controls, reduced motion and a deliberate missing-STL response. The sustained run cycles variant, source, material, monochrome, pose, expression and camera controls. Every minute it logs live WebGL buffers, textures and programs, cumulative creations/deletions, Three.js memory counts, export evidence and page errors. Settled snapshots must remain bounded. Renderer-owned lighting/shadow textures may remain live between model changes; buffers and programs must show disposal.

Machine-readable results and screenshots are written beneath `.cache/sowers-candy-browser/` by default. Consult the report's actual duration, cycle count, versions and status before interpreting a run. A run spanning evolving development assets is useful for interaction stability but cannot establish final-version visual acceptance.

## Limits

These are design concepts and positive-master previews. Coating readability, edible formulation, shrinkage, release behavior, tooling, food-contact materials, labeling, clearance and consumer appeal remain unvalidated. Manufacturing assumptions and the independently versioned exports are documented in `docs/sowers/candy-manufacturing.md` and the geometry report.
