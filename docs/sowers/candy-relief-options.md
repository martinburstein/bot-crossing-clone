# Scout relief options — retained wave 6 study

These separately versioned positive masters hold Scout's 30 mm outer contour and both eye centers fixed. The broad options target roughly **1 mm main arch stroke at its crest** for visual readability. This is an explicit design assumption, not a supplier's minimum feature rule. No source silhouette, digital mascot or baseline master was edited by this study.

The exact reusable geometry is in each [`*-candidate.json`](../../public/sowers/candy-studies/): `parameters.eyeLocalSegments` contains local normalized quadratic definitions; `normalizedSource.features` contains translated global normalized segments, sampled points and all surface parameters. Copy those definitions to promote a candidate; do not redraw from its thumbnail. Eye centers remain x = ±.09, y = .753. The normalized-to-physical factor is retained per candidate because the **actual** sampled outline sets the 30 mm height.

## Measured relief comparison

All numbers below were measured from the reloaded binary STL, including horizontal sections at .0001 mm above the mask floor and .0001 mm below the eye crest. Eye-arm widths refer to a horizontal line through the unchanged eye-center Y; crown stroke is the vertical line through one arch's center X. These are local sections, not a minimum width over tapered terminals.

| Candidate | Mask depth / eye rise mm | Eye floor / top Z mm | Arm base / crest mm | Crown base / crest mm | Volume mm³ |
| --- | --- | --- | --- | --- | --- |
| Baseline v2 | .30 / .22 | 5.70 / 5.92 | .662 / .432 | .807 / .578 | 3110.179 |
| Broad moderate | .55 / .40 | 5.45 / 5.85 | 1.243 / .961 | 1.257 / .978 | 3084.945 |
| Broad strong | .65 / .55 | 5.35 / 5.90 | 1.426 / 1.101 | 1.467 / 1.145 | 3076.466 |
| Moderate + rounded top perimeter | .55 / .40 | 5.45 / 5.85 | 1.243 / .961 | 1.257 / .978 | 3082.900 |

The body front is Z=5.35 mm, helmet crest Z=6, and chest crest Z=5.75 in all four. None exceeds the 6 mm total depth. Moderate increases broad crest stroke by about 2.2 times at center Y, with less recess depth than the strong alternative. The strong option places the mask floor at the body-front plane. Candidate selection still requires the coordinator's pinned lighting comparison and a physical proof, especially after sour sanding.

Moderate uses outer/inner half-width .053/.012 and roof heights .054/.012. Strong uses .058/.011 and .060/.011. Both have straight-leg joins at Y=−.015 and smooth rounded lower terminal tips at Y=−.035. The two lower tips each use two quadratic pieces so adjacent eye quadratics have aligned tangents, preserving an open arch without pointed closures. The JSON contains the full eight segments and the exact .40/.55 mm surface rise, .05 mm transition radius and shared mask surfaces.

## Radius and outer-perimeter checks

Analytic quadratic speed extrema give moderate's source eye-curve radius range **.244–5.390 mm** and strong's **.218–5.819 mm**. Baseline is .206–6.436 mm. These ranges cover individual normalized quadratic interiors after physical scaling. Tangent continuity is independently checked on all eight new quadratics, including the loop closure. Curvature can jump at joins; neither these source radii nor the one-mm stroke target establish a minimum radius on every physical edge. The STL is faceted, and the eye's nominal .05 mm edge transition is a twelve-facet quarter-circle approximation.

The rounded-top alternative changes only the body's outer **front** edge transition. Its .30 mm quarter-circle normal-offset profile is superimposed on the 2° drafted wall, sampled in twelve angular facets. The back remains flat at Z=0 and the widest extraction opening. Insets increase monotonically towards the top, reaching about .487 mm at the body front; no back-edge fillet or reverse draft was introduced. The unchanged helmet remains contained in the narrowed body-front footprint. Compare the rounded-top STL with moderate's sharp-perimeter STL before promotion; this study does not claim an analytic 3D fillet.

## Positive topology and provenance checks

Every positive is one connected consistently oriented watertight solid, with two faces on every edge, Euler number 2, positive volume and exactly 30×6 mm actual height/depth. More than 85 sections of the **serialized triangles** nest towards +Z; every downward-facing triangle is confined to the back plane. Independent Node tests parse every STL and repeat topology, signed volume, exact back contour, unchanged eye centers and vertical-ray feature-height checks.

[`study-report.json`](../../public/sowers/candy-studies/study-report.json) pins the exact parameter string, each artifact and retained source snapshots. The study script defaults to those retained v2 silhouette/base-generator snapshots, so a later canonical promotion does not silently rewrite this comparison. `sourceHashes` records their original logical source names; `sourceSnapshotFiles` identifies the retained bytes. The current tool and its retained copy are also pinned. Candidate JSON contains the precise STL SHA-256, full surface profiles and serialized feature measurements. The moderate master SHA-256 is `b064861eaf0987f79c499b0789ec06d2afde795ec33852c63fa1be1180de7c98`.

## Negative proof-cavity coupon checks

The [`2×2 negative coupon`](../../public/sowers/candy-studies/broad-moderate-2x2-negative-coupon-mm.stl) is a geometric proof aid made by reflecting the **actual broad-moderate positive** across Z=0, arranging four copies on a 32×38 mm grid, and subtracting them from stock. It is a separate artifact, not a replacement positive or a machine-ready tray.

Assumed stock is 65.748×78×9 mm: 5 mm perimeter stock, at least 8 mm between cavity opening bounding boxes, and a 3 mm floor beneath the 6 mm deepest cavities. Openings lie at Z=0; the stock bottom is Z=−9; cavities deepen to Z=−6. The intended extraction axis is **+Z**, towards the broad flat-back openings. Sixty-five serialized sections confirm cavity openings widen towards +Z. Independent vertical rays through every source feature in all four cavities reproduce the reflected positive's actual depths.

The coupon is connected, watertight, consistently oriented, Euler 2, and has exactly two faces per edge. Its measured volume is 33815.215 mm³, within .0015 mm³ of stock volume minus four measured positive volumes. The report retains source-positive and coupon hashes, layout, floor and edge assumptions, extraction direction and section evidence. Layout stock is a bounding-box clearance check, not a structural stiffness or process assessment.

No food-contact suitability, tooling approval, release trial, shrink compensation, sanding performance, recipe, material qualification or production approval is established. Supplier process dependencies remain in [candy-manufacturing.md](candy-manufacturing.md).

## Reproduce

```sh
/tmp/sowers-candy-form-venv/bin/python tools/sowers-candy-studies.py
node --test test/sowers-candy-studies.test.mjs
```

Uses the pinned Python packages documented for the baseline generator. The independent study suite passes 6/6 tests. Main candidates and coupon publish only after all checks pass; the report is copied last.
