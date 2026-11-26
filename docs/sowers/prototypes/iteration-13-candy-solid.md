# Iteration 13 — Canopy candy solid study

## Purpose and source direction

This controlled geometry study turns the iteration-11 canopy character and iteration-12 candy-view concept into one actual slab-like positive solid. The source illustration remains a preference reference, not physical geometry. The illustration's undercut cowl edge is reinterpreted as broad planar front relief; the body, mitten tabs, and boots are one sampled front contour.

The front contour is an original, explicitly authored sampled path rather than a traced or image-derived mask. Its crown is broad and rounded, shoulders flow into the torso, the mitten tabs are attached side bulges, and two short boots meet through a shallow central arch. A shallow face recess carries two thick, round-ended inverted-U arch strokes with open gaps underneath and one raised seed. The back is flat and blank. The profile is a constant-thickness slab with no wraparound shell, underside, straps, or tiny seam marks.

## Geometry and browser evidence

- Nominal envelope: **24 × 30 × 6 mm** (W × H × D), including relief.
- Export: [`canopy-solid-mm.stl`](../../../public/sowers/prototypes/canopy-blockout/canopy-solid-mm.stl), SHA-256 `8e182dc7db823137effbd306747166977f1d4045e142549c6847794205c46484`.
- Report: [`geometry-report.json`](../../../public/sowers/prototypes/canopy-blockout/geometry-report.json).
- The browser loads that exact STL for all views. The front, side, and back captures are true orthographic camera projections, not separately authored drawings: [front](../../../public/sowers/prototypes/canopy-blockout/front-orthographic.png), [side](../../../public/sowers/prototypes/canopy-blockout/side-orthographic.png), [back](../../../public/sowers/prototypes/canopy-blockout/back-orthographic.png).
- Interactive viewer: [`index.html`](../../../sowers/prototype-candy/index.html). It reports the same STL hash and dimensions at runtime. The rendered contour retains some mild sampled-curve facetting; Three.js vertex normals are smoothed for display only and do not alter the STL.

## Validation

The exported STL has finite vertices, is watertight, has exactly two incident faces per edge, consistent winding, Euler number 2, positive volume, and one connected component. It measures 24 × 30 × 6 mm and has 3,081.08 mm³ volume. The geometry is one generated mesh; no view-specific geometry or hidden backing part is used.

## Contour/profile deviations and limits

The illustration's canopy cowl projects forward and folds around the face; this model uses a shallow inset window and raised features on a single planar slab. The candy illustration's round bulb mittens, more sculpted lower torso, and contoured footwear are reduced to attached silhouette lobes. The reference profile is a softly rounded thicker candy, while this study uses a uniform 6 mm slab with relief accounting for the full depth. No illustrator texture, grain, or highlight was copied.

This is a geometry review study only. It does not establish release readiness, tooling or mold feasibility, demolding, tolerance, shrink behavior, supplier acceptance, food-contact suitability, material choice, coating readability, or physical candy performance. The faceted positive mesh has not been tested with a supplier or physical sample.

Coordinator reconciliation: recomputed final STL volume is 3079.506744 mm³, matching geometry-report.json; replaced the stale prior volume. Adaptive orthographic fit now retains the whole contour at390×900. The crown stripe is absent and outer walls have zero draft; no release claim is made.
