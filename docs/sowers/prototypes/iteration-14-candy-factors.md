# Iteration 14 — Canopy candy controlled factors

## Purpose

This 2 × 2 geometry experiment isolates two changes: crown stripe relief absent/present, and nominal outerwall draft 0°/2°. The iteration 13 authored front contour and face details are the control. The outline is explicitly normalized to one common 24 × 30 mm XY envelope; the blank back contour is shared by all four variants. Each final STL includes relief within a 6 mm total depth envelope.

## Factors and construction

- **Stripe:** absent or a shallow raised rounded geometric crown stripe. The relief rises 0.24 mm and narrows toward its top; it is mesh geometry, not a color patch.
- **Outerwall draft:** 0° or 2° through the 5.45 mm body wall depth along +Z. The shared back control contour is at z = 0. At the front body station, the drafted contour is an inward parallel normal offset of `5.45 × tan(2°) = 0.190318 mm`. Corresponding offset polygons are lofted; no XY scaling is used.
- **Common front features:** 0.72 mm face recess, twin open arches rising 0.78 mm from the recess floor, and a seed rising 0.55 mm above the front body station. The back is flat and blank.
- **Envelope:** 24 × 30 × 6 mm (W × H × D), including relief. The 30 mm character height lies in XY; the draft run is the 5.45 mm slab depth. Here “loft height” means the +Z wall depth.

The four final-STL volumes were recomputed after export. Each STL has finite vertices, one connected component, watertight topology, exactly two incident faces per edge, consistent winding, Euler number 2, positive volume, and the target envelope.

| Crown stripe | Draft | Volume (mm³) | Faces | SHA-256 |
|---|---:|---:|---:|---|
| Absent | 0° | 3079.506744 | 2,356 | `8432fd5a1501a824c90542898fb16c1fa654b6670fad68d4f741104bbdb95d99` |
| Absent | 2° | 3030.308282 | 2,356 | `2d118c112455c755ca9220f6af0473b668737f28e4852161bc357be3f4dcc78b` |
| Present | 0° | 3083.783804 | 2,548 | `6da3f319e0870e6afa9674684b763abbee501d1daf9d9011e7c097819f85cb84` |
| Present | 2° | 3034.585342 | 2,548 | `f6f02de70cd1f91c5e7f8b60da5c064a25be23fec272b60c596b52400304ee20` |

## Section evidence

The generator serializes the two loft rings from the iteration 13 control contour. The final STL is separately intersected by horizontal triangle planes at five z stations. For each section, the largest outer polygon is compared with the expected constant normal-offset polygon; the table reports its area and the Hausdorff distance between outer boundary loops. The 2° angle is recovered from the two serialized end stations by `atan(0.190318 / 5.45) = 2.000°`. The triangle intersections are the independent export check; the serialized loft data is generator evidence, not a measured STL section.

| Draft | z (mm) | Expected inset (mm) | Measured section area (mm²) | Expected area (mm²) | Outer-boundary Hausdorff error (mm) |
|---:|---:|---:|---:|---:|---:|
| 0° | 0.05 | 0.00000 | 571.6318 | 571.6318 | <0.000002 |
| 0° | 1 | 0.00000 | 571.6318 | 571.6318 | <0.000002 |
| 0° | 2.725 | 0.00000 | 571.6318 | 571.6318 | <0.000002 |
| 0° | 4.5 | 0.00000 | 571.6318 | 571.6318 | <0.000002 |
| 0° | 5.35 | 0.00000 | 508.0353 | 571.6318 | <0.000002 |
| 2° | 0.05 | 0.00175 | 571.4670 | 571.4670 | <0.000002 |
| 2° | 1 | 0.03492 | 568.3318 | 568.3318 | <0.000002 |
| 2° | 2.725 | 0.09516 | 562.6166 | 562.6166 | <0.000002 |
| 2° | 4.5 | 0.15714 | 556.7055 | 556.7055 | <0.000002 |
| 2° | 5.35 | 0.18683 | 490.2675 | 553.8640 | <0.000002 |
| 0° | 0.05 | 0.00000 | 571.6318 | 571.6318 | <0.000002 |
| 0° | 1 | 0.00000 | 571.6318 | 571.6318 | <0.000002 |
| 0° | 2.725 | 0.00000 | 571.6318 | 571.6318 | <0.000002 |
| 0° | 4.5 | 0.00000 | 571.6318 | 571.6318 | <0.000002 |
| 0° | 5.35 | 0.00000 | 508.0353 | 571.6318 | <0.000002 |
| 2° | 0.05 | 0.00175 | 571.4670 | 571.4670 | <0.000002 |
| 2° | 1 | 0.03492 | 568.3318 | 568.3318 | <0.000002 |
| 2° | 2.725 | 0.09516 | 562.6166 | 562.6166 | <0.000002 |
| 2° | 4.5 | 0.15714 | 556.7055 | 556.7055 | <0.000002 |
| 2° | 5.35 | 0.18683 | 490.2675 | 553.8640 | <0.000002 |

At z = 5.35 mm the face recess removes interior area, which explains the lower measured section area; its exterior loop still matches the draft contour. The contour is polygonal and sampled, so the evidence establishes this loft’s offset law and angle, not analytic fillets, tooling behavior, or release performance.

## Artifacts

- Generator: [`tools/sowers-canopy-factors.py`](../../../tools/sowers-canopy-factors.py)
- Canonical offset/loft helper imported read-only: [`tools/sowers-candy-form.py`](../../../tools/sowers-candy-form.py)
- Four exported solids and recomputed geometry evidence: [`public/sowers/prototypes/canopy-factors/`](../../../public/sowers/prototypes/canopy-factors/)
- Orthographic comparison sheet rendered from the four final STL meshes: [`factor-comparison.png`](../../../public/sowers/prototypes/canopy-factors/factor-comparison.png)
- Interactive viewer: [`sowers/prototype-candy-factors/index.html`](../../../sowers/prototype-candy-factors/index.html)
- Full machine-readable evidence, including per-variant section measurements and source pins: [`iteration-14-candy-factors.json`](./iteration-14-candy-factors.json)

## Source pins and limits

Exact source pins:

- `tools/sowers-canopy-blockout.py` — `3cd88f8aa3a1df6c43600f59b9187bfa25da2fe1bf05568a6dcacf0b8a021897`
- `docs/sowers/prototypes/iteration-13-candy-solid.json` — `c055e36acd03c680f1b9403ad3b41ae39d4008540159bd5fdb69ebf8ccbba88f`
- `tools/sowers-canopy-factors.py` — `c724741f029eb651df69b829a9711c33068a38a6241eedb2ace984ba465c3eca`
- `tools/sowers-candy-form.py` — `4ef0a7734123dc5504b4d5c960cfb603cd87e1a53f3e7a4bdc130e3d692b0a0d`
- `sowers/prototype-candy-factors/index.html` — `950eca31249227ba4a4b776804e87f5dc702d0844e6b18e9ba622a33887f7d62`
- `sowers/prototype-candy-factors/main.js` — `61ca080a56592cb1d7b7015ae4a5cf38e105642d48719c2fdf6d06348c69c739`
- `sowers/prototype-candy-factors/style.css` — `194f96d3745ca05b75669c9e919f2590a07a90d0ad7432528ce4c6ddbc5720bd`
- `sowers/prototype-candy-factors/render-sheet.html` — `18250336193b587cb79ae7e5a6579e79adb4715b27a2534a4d2b5284d04365e9`
- `sowers/prototype-candy-factors/render-sheet.js` — `a0cfb15d3bcf45b30ca3b99714f6b7b2f145cba3396eae4003df428462ec6574`

Each STL hash is recorded above and in the JSON report. The iteration 13 source contour is normalized explicitly to the common 24 × 30 mm envelope; this is the only contour normalization. The study makes no mold-release, food-contact, manufacturing, tooling, supplier, tolerance, or shrink approval. No physical sample was built or assessed.
