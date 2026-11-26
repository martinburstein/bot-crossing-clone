# Candy geometry review

These are **positive master previews**, not mould cavities or approved food-contact tools. They translate the same original Scout, Seed and Bud rounded silhouettes used by the visual character into a nominal 30 mm, one-piece flat-back relief. They preserve the body outline rather than substituting a generic round gummy.

## Supplier evidence

Reviewed 25 November 2026. [Baker Perkins](https://www.bakerperkins.com/confectionery/products/jelly-gummies/) describes depositing gummy syrup into silicone or metal moulds and producing both 2D and 3D shapes. This supports a moulded-character route, but supplies no numerical minimum web, radius, draft or relief rule for this design.

[TCI Culinary](https://www.tci-culinary.com/starchless-gummy-depositing-moulds.html) asks for tray dimensions, nozzle pitch, row spacing, deposit weight, temperature, setting and demoulding conditions. Its custom-shape guidance says it checks whether detail is deep and wide enough to read at gummy size. It recommends a proof cavity/tray and adjustment of volume, depth or release following trials. Sanding affects the cavity surface finish. These are supplier-confirmed process dependencies; the numerical targets below are our unvalidated design assumptions.

## Geometry and assumptions

| Feature | Current preview | Status |
| --- | --- | --- |
| Height | 30 mm measured across rounded contour | Nominal review size; no shrink compensation |
| Width | ~23.6–24.6 mm, variant-dependent | Measured from canonical silhouette |
| Overall depth | 6 mm | Chosen geometry-review slab |
| Back | Plane z = 0 | No decoration or loose inserts |
| Outer wall | Straight extrusion, zero draft | No geometric undercut; positive draft still to resolve |
| Mask | 0.65 mm recess, rounded XY corners | Assumption to test after sanding |
| Happy-eye arches | 1 mm wide stroke, 0.4 mm deeper than mask | Assumption to test after sanding |
| Remaining material under eyes | 4.95 mm | Measured construction dimension |
| Web/appendage target | 3 mm | Heuristic, not supplier minimum or global width guarantee |
| Outline curvature target | 0.6 mm radius | Heuristic; sampled analytic checks identify misses below |
| Relief depth transitions | Sharp 90° transitions | Prototype simplification; fillets and draft unresolved |

The rendered avatar uses a bevelled body and separate visual materials. The physical preview uses a flat front and actual recessed monochrome details. It shares the rounded XY outline and mask position/size; the digital avatar's total depth is not a tooling specification. Quadratic outline segments are sampled at eight intervals per corner, then uniformly scaled to exactly 30 mm actual height. The nominal corner-cut distance is not a guaranteed circular radius.

## Exported evidence

The binary STLs have no embedded unit standard: interpret every coordinate as **millimetres**. Do not treat a downstream program's default units as evidence of scale. The dimensional SVGs are explicitly labelled in mm.

| Variant | Width mm | Volume mm³ | Minimum sampled quadratic radius mm | Face-to-edge clearance mm |
| --- | ---: | ---: | ---: | ---: |
| scout | 24.59 | 2990.8 | 0.061 | 1.65 |
| seed | 23.60 | 2766.2 | 0.627 | 1.47 |
| bud | 23.79 | 3019.2 | 0.498 | 1.88 |

Each exported STL is reloaded from disk and checked for a closed surface, consistent winding, positive volume, exactly one connected component, two incident faces per edge, and Euler number 2. An independent Node test parses the binary STL and repeats the edge-orientation, connectivity, dimension, signed-volume and downward-surface checks. Every downward-facing triangle lies on the back plane; the front consists of upward-facing floors and vertical walls. This verifies this straight-pull geometric construction, not demoulding success.

The contour eroded by 1.5 mm remains one component for all three variants. This is a neck diagnostic: it does **not** establish a 3 mm minimum at every tapered tip or prove tear resistance. **Scout (0.061 mm) and Bud (0.498 mm) miss the assumed 0.6 mm outline-radius target. These v1 forms need crown/leaf-tip revision before a supplier proof; they are retained as partial engineering evidence.** Seed clears this single target, which is insufficient for manufacturing approval. Radius estimates use the analytic quadratic derivative sampled at 101 positions per corner; the actual STL is faceted. Sour sanding may obscure the 1 mm eye arches and shallow mask, which needs a physical proof.

[Geometry report](../../public/sowers/candy-form/geometry-report.json) records dimensions, topology, source SHA-256 and STL hashes. Each variant has a `positive-mm.stl`, `dimensions.svg` and `positive-preview.svg` file in [the export directory](../../public/sowers/candy-form/).

## Reproduce and review

Use a local Python environment; no paid service or supplier contact is needed:

~~~sh
python3 -m venv --system-site-packages /tmp/sowers-candy-form-venv
/tmp/sowers-candy-form-venv/bin/python -m pip install numpy==2.0.2 shapely==2.0.7 trimesh==4.11.0 manifold3d==3.3.2 mapbox-earcut==2.0.0
/tmp/sowers-candy-form-venv/bin/python tools/sowers-candy-form.py
node --test test/sowers-candy-form.test.mjs
~~~

Python 3.9.6 / the pinned packages above generated the retained files. Node is used only to read the canonical JavaScript outline. Regenerate after any silhouette source change: provenance checks deliberately reject stale exports. No external mesh assets are used.

Next geometry decisions are positive draft, all relief fillets, crown/leaf-tip radii, coating readability, and actual cavity volume/deposit target. Supplier proof work must determine process-specific extraction and dimensional compensation. Recipe development, ingredient claims, materials qualification, manufacturing approval and vendor outreach are outside this geometry review.
