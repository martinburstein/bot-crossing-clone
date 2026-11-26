# Candy geometry review

These are **positive master candidates**, not mould cavities or approved food-contact tools. The v2 masters use the current Scout, Seed and Bud body paths and the same helmet, mask, happy-eye and leaf-chest paths as the digital mascot. They are one-piece, flat-back reliefs at exactly 30 mm actual outline height and 6 mm overall depth. Their STL coordinates are **millimetres**; STL files do not embed a unit standard.

## Supplier evidence

Reviewed 25 November 2026. [Baker Perkins](https://www.bakerperkins.com/confectionery/products/jelly-gummies/) describes depositing gummy syrup into silicone or metal moulds and producing both 2D and 3D shapes. This supports a moulded-character route, but supplies no numerical minimum web, radius, draft or relief rule for this design.

[TCI Culinary](https://www.tci-culinary.com/starchless-gummy-depositing-moulds.html) asks for tray dimensions, nozzle pitch, row spacing, deposit weight, temperature, setting and demoulding conditions. Its custom-shape guidance says it checks whether detail is deep and wide enough to read at gummy size. It recommends a proof cavity/tray and adjustment of volume, depth or release following trials. Sanding affects cavity surface finish. These are supplier-confirmed process dependencies; the numerical dimensions and targets below are our unvalidated design assumptions.

## v2 geometry

| Feature | Candidate geometry | Status |
| --- | --- | --- |
| Actual outline height / overall depth | 30 / 6 mm | Measured after STL serialization; no shrink compensation |
| Back / body front | z = 0 / 5.35 mm | Flat back; raised details extend beyond body front |
| Outer wall | 2° nominal positive draft | Constant inward normal offset of every sampled contour edge; checked nested profiles |
| Helmet | +0.65 mm; top z = 6 | Canonical footprint at its base |
| Mask | 0.30 mm recess into helmet; floor z = 5.70 | Canonical opening footprint |
| Happy eyes | +0.22 mm above mask; top z = 5.92 | Exact shared eye paths and centers; no independently invented circles/strokes |
| Leaf chest stamp | +0.40 mm; top z = 5.75 | Exact shared leaf path |
| Relief wall draft | 8° between edge blends | Chosen geometric assumption |
| Relief blends | Helmet 0.12 mm; mask, eyes and chest 0.05 mm | Twelve facets per quarter-circle in the normal-offset/depth plane; **approximate blends, not analytic 3D fillets** |
| Outer perimeter edges | Sharp joins to front/back planes | Remaining limitation; no outer edge fillet claimed |
| Web / outline-radius targets | 3 / 0.6 mm | Heuristics, not supplier minima |

The wall loft uses corresponding vertices of parallel-offset polygons, with every straight edge displaced along its own inward normal by `z × tan(2°)`. It does not use uniform XY scaling. At the body front the inset is approximately 0.187 mm. Every offset is checked for validity and nesting; a self-crossing or topology change aborts export. Two endpoint rings represent the constant draft exactly on the sampled polygon. The intermediate 25 profiles are checked without adding redundant coplanar triangles.

Raised features narrow towards +Z. The mask opening widens towards +Z. Their circular transition profiles are also made with inward normal offsets; each quarter-circle has twelve straight segments. The rounded transitions therefore remain faceted. The intended geometric withdrawal direction is **−Z**, towards the broad flat back. This establishes a straight-pull geometry candidate, not release performance.

The digital mascot shares the canonical XY paths and nominal feature heights. Its body has a shallow convex visual surface; the physical candidate has a flat drafted body front. Digital colors, transparency, bevels and motion are presentation choices. The design page's **physical master** mode loads the actual STL, so those visual choices are not evidence of physical geometry. Dimension sheets show canonical feature footprints; the real raised tips are smaller because of draft and blends.

## Exported evidence

The current [geometry report](../../public/sowers/candy-form/geometry-report.json) records measured dimensions, volume, topology, measured draft range, sampled curvature, nested-section checks and relief probes for each variant. The [canonical geometry snapshot](../../public/sowers/candy-form/canonical-geometry.json) retains the exact shared paths used by the export. Hashes pin the canonical path source, digital mascot source, generator, canonical parameter string, geometry snapshot and each STL. Changing any source requires regeneration.

Each exported STL is reloaded from disk and checked for a closed consistently oriented surface, positive volume, one connected component, two incident faces per edge and Euler number 2. The generator intersects the **final serialized triangles** with more than 80 horizontal planes and checks that sections nest towards +Z. It also rejects downward-facing triangles anywhere except the back plane. These section checks are sampled; they accompany the profile construction and complete triangle-normal check rather than proving process-specific extraction.

An independent Node test parses each binary STL and repeats edge orientation, connectivity, Euler number, signed volume, 30 × 6 mm dimensions and downward-surface checks. Every shared sampled body, helmet, mask, eye and chest point must also exist at its expected plane in the actual STL, catching independently substituted face geometry or spacing. Vertical rays through the exported helmet, mask, eyes and chest independently verify their actual surface heights. Provenance tests compare the exact shared feature data with the retained snapshot, and reject stale source/generator/STL hashes.

| Variant | Width mm | Volume mm³ | Canonical back minimum radius mm | Smooth parallel front minimum radius estimate mm |
| --- | ---: | ---: | ---: | ---: |
| Scout | 23.75 | 3110.2 | 0.761 | 0.948 |
| Seed | 23.89 | 2613.7 | 0.945 | 1.132 |
| Bud | 24.43 | 2872.0 | 1.099 | 0.912 |

The back values are sampled analytic quadratic radii. Front values estimate the smooth parallel curve at the 0.187 mm inward offset: convex radii decrease by the offset and concave radii increase. Scout and Seed's minimum back radii occur at concave corners, so blindly subtracting the inset from their absolute minimum would be incorrect. These source-based checks clear the assumed 0.6 mm target at back and estimated front. **They do not assert a 0.6 mm radius on every physical edge: the actual STL perimeter is faceted and its joins to front/back planes remain sharp.** Relief-source curvature is reported separately from the body outline and does not inherit that target.

The body contour eroded by 1.5 mm is also checked as a neck diagnostic. A connected eroded core does **not** establish a 3 mm minimum at every tapered point or prove tear resistance. The shallow eyes, rim and leaf need a physical readability trial, especially after sour sanding.

## Preserved v1

The untouched [v1 folder](../../public/sowers/candy-form/v1/) retains the original three 30 × 6 mm masters, reports, SVGs, generator, contour source and manufacturing notes. They had zero outer draft and sharp recess depth transitions. Scout's 0.061 mm and Bud's 0.498 mm sampled minimum outline radii missed the assumed 0.6 mm target; Seed's was 0.627 mm. v1 is retained as rejected intermediate evidence. Current root files are v2 candidates; no v1 winner is promoted.

## Reproduce and review

Use a local Python environment; no paid service or supplier contact is needed:

~~~sh
python3 -m venv --system-site-packages /tmp/sowers-candy-form-venv
/tmp/sowers-candy-form-venv/bin/python -m pip install numpy==2.0.2 shapely==2.0.7 trimesh==4.11.0 manifold3d==3.3.2 mapbox-earcut==2.0.0
/tmp/sowers-candy-form-venv/bin/python tools/sowers-candy-form.py
node --test test/sowers-candy-form.test.mjs
~~~

Python 3.9.6 with these pinned packages generates the retained files. Node reads the canonical dependency-free JavaScript paths. Failed validation leaves the previous candidate intact; files are staged until all three variants pass, and the report is published last. No external mesh assets are used.

Remaining work includes outer perimeter edge rounding, coating readability, actual deposit volume/recipe target, release trials and process-specific dimensional compensation. Supplier proof work must determine mould material, extraction, shrink and sanding adjustments. No sanding result, release result, food-contact suitability or manufacturing approval has been established. Recipe development, ingredient claims, materials qualification and vendor outreach are outside this geometry review.
