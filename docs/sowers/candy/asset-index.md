# Candy-first Sowers review assets

The live candidate is Scout. Seed and Bud remain alternatives, not market-tested winners. Open `/sowers/design/` to compare the colored character with the actual monochrome master, or `/sowers/studio/` for the shared live rig. Append `?shape=seed` or `?shape=bud` to the studio; add `&shape=seed` to the mission design preview to see an alternative in the base scene.

- Actual digital candidate: [studio](../candy-character-preview.png), [mission](../candy-mission-preview.png).
- Built-in ImageGen concept references: [three directions](../../../public/sowers/candy/concept-directions-v1.png), [Scout surface target](../../../public/sowers/candy/scout-refinement-v2.png). These are conceptual images, not manufactured samples or exact renderer captures. Prompts and tool mode are saved in [imagegen-prompts.md](imagegen-prompts.md).
- Reusable code-derived vector marks: `public/sowers/marks/{scout,seed,bud}-{color,ink,silhouette}.svg`; native-size comparison in `readability-sheet.svg`. Ink graphics use negative space on white, not candy relief. Regenerate with `node tools/export-sowers-marks.mjs` after a canonical path change.
- Actual positive masters and dimensional SVGs: `public/sowers/candy-form/`; coordinates interpreted as millimetres. The renderer validates the selected STL against its report before showing it.
- Rejected initial geometry: [shape review](rejected-v1-shapes.png), [physical review](rejected-v1-physical.png), source-pinned positive-master archive under `public/sowers/candy-form/v1/`.

The actual model remains a shallow candy-oriented solid; it is not the fuller toy sculpture in the generated concept. All physical candidates remain subject to release, coating and supplier proof. No consumer recognition test is implied by a small-size graphic check.

Current v3 selects the exact broad-moderate eye paths and surface depths. The previous v2 source/mesh evidence is retained in `public/sowers/candy-form/v2/`. Controlled moderate/strong/rounded-top STL/light comparisons and the negative coupon are indexed in `docs/sowers/candy-relief-options.md`; pinned screenshots and JSON manifests are under this folder. The renderer captures are actual geometry; the ImageGen boards remain conceptual references.
