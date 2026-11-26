# Sower candy silhouette options

Three original procedural alternatives remain available for review. The second pass removes Scout's fragile folded crown, broadens its helmet beyond the attached hand span, blunts Seed's tip, and lowers Bud's crown into two broad outward leaf lobes. These are design studies; no market preference or tooling approval is implied.

| Variant | Recognition cue | Remaining review question |
| --- | --- | --- |
| `scout` — Scout / Seed Packet | Broad rounded rectangular helmet, compact tapered torso, integral short hands and boots | Strongest explorer proportions in this pass; inspect its shallow mask/chest relief after real coating. |
| `seed` — Seed / Little Voyager | Blunt tilted seed crown and tapered torso | Clearest seed outline; the narrower helmet must remain contained in the drafted positive. |
| `bud` — Bud / Leaf Ranger | Broad leaf lobes spreading outward over the mask | Crown has improved from the rabbit-ear reading; still needs small-size and consumer review. |

Each body is one continuous connected extrusion, with broad attached mitten tabs and an open shallow foot notch. No antenna, separate finger, narrow bridge, ear pod or inflated sphere is used. Two deliberate front cues give the body structure: a broad rounded helmet boundary around a recessed mask, and one shallow tilted leaf stamp on the chest. The happy eyes use the same closed quadratic profile in all consumers.

## Canonical geometry

`sowers/candy/silhouettes.mjs` has no Three.js dependency. It exports:

- `CANDY_VARIANTS`, `describeCandyOutline(variant)` and `getCandyOutline(variant, {height: 1})`: frozen source specifications and fresh y-up XY control arrays.
- `getCandyRoundedSegments(variant)`: the outer quadratic path, with `{before, corner, after}` segments.
- `getCandyContour(variant)` and `candySegmentsPath(segments)`: SVG paths in mathematical XY; flip Y for upright SVG presentation.
- `getCandyFeatures(variant)`: fresh global normalized XY paths for `helmet`, `face`, `eyes` and `chest`. Every feature contains quadratic `segments`, the canonical 12-step `points` sampling, `surface` metadata and optional bounds/center metadata.
- `sampleCandySegments(segments, steps=12)`: the shared sampler. A physical consumer must use these paths rather than invent its own rounded rectangle, eye spacing or stroke profile.
- `getCandyFrontBulge(variant, x, y)`: a shallow digital height field. This does not change the contour and is explicitly separate from the drafted physical master profile.

Eye centers are exactly `face.x ± .09`, `face.y + .008` in normalized global coordinates. Their nominal spacing is about 5.4mm at 30mm full height, after the contour's small crown-rounding normalization. The original independent physical spacing of ±2.3mm is no longer the canonical path.

Nominal relief metadata, in millimetres at 30mm height, is shared with the positive-master generator: helmet +.65 above the body front; mask recessed .30 below the helmet crest; eyes +.22 above the mask floor; chest leaf +.40 above the body front. Declared small edge rounds are .12mm helmet and .05mm mask/eyes/chest. They are geometry-study values, not supplier-confirmed minima. The chest's local curvature cannot support the larger .12mm draft/blend combination without crossing its own offset, hence its smaller declared blend.

The physical generator separately defines the nominal 6mm overall master thickness, draft and loft/blend approximation. The digital body retains its .20 normalized central slab and .027 bevel at each end. Its front also has a shallow convex head field (maximum .025 normalized, about .75mm at 30mm height) and torso field (maximum .012, about .36mm). The digital body depth and convex profile therefore differ from the drafted physical positive; the physical STL view is the dimensional reference. Neither a glossy digital material nor sugar artwork establishes physical relief survival.

## Renderer contract

```js
createCandySower({
  color: 0xf5823a,
  seed: 0,
  variant: 'scout', // scout | seed | bud
  materialMode: 'matte', // matte | gummy | silhouette
});
```

The result is a `THREE.Group`, front toward +Z, with neutral feet at Y=0 and total neutral height 1.85. `userData.animate(elapsed, delta, {status, moving, selected})` preserves the existing idle/working/review/waiting/complete/error interface. Connected hand tabs flex, outer boot tips lift during walking, the body turns gently and completion adds a small hop. `userData.resetPose()` restores the full frozen neutral state. The original body buffer is private to the instance.

`userData.variant`, `body`, `face`, `features`, `contour`, `neutralHeight` and `getStatus()` expose review metadata. The `face` group contains all front relief, including the leaf. `silhouette` hides that complete group. `gummy` uses one material for body, rim, mask floor, eyes and chest; it implies no black or cream inserts. `matte` uses optional cream/dark digital colors while retaining the same front geometry.

The cap's shallow front crown uses bounded tessellation and analytic height-field normals, avoiding the triangular shading seams from displacing a large flat extrusion cap. The surrounding bevel retains intentional facets. Total geometry is approximately 11,000 vertices and 17,000 triangles per complete character; only roughly 2,000 body vertices participate in the connected-tab deformation. There are no runtime textures, remote models or inference requests.

## Checks and limits

`node --test test/sowers-candy-mascot.test.mjs` passes ten regression checks. Coverage includes all canonical front paths inside the body, eyes inside the mask, exact shared eye centers, a neutral 1.85 height with grounded feet, finite geometry in all three modes, actual mask recess below the helmet crest, monochrome gummy material identity, 4,320 pose frames across six statuses/both walking states, invalid-time guards and exact neutral restoration. These are bounded digital checks rather than continuous collision or manufacturing proofs.

The minimum sampled quadratic contour radius at 30mm full height is approximately Scout **.761mm**, Seed **.945mm**, Bud **1.099mm**, exceeding the assumed .6mm design target. The target is a conversation aid and remains supplier-specific. These outer-contour values do not describe tiny eye/chest details, their coating readability or their physical process limits.

Actual rendered models must be reviewed alongside the one-color relief and actual exported STL. Inspect front, side, rear, 32px thumbnail and 30mm views before choosing a direction. No winner is declared by implementation alone.
