# Sowers reference recovery

Research date: 2026-11-25. Sowers is a separate visual experience. Its original masked field scout takes the warm white / amber / charcoal / orange readiness of the Mars Mission astronaut, with soft proportions and playful follow-through. It does not replace the established Bot Crossing astronaut or Waypoint robot.

## Recovered repository evidence

The search covered all 19 local branches and `origin` remote-tracking refs using `git ls-tree -r`, plus all-ref commit subjects for Waypoint, Mars, helmet and visor. Filename search terms: `waypoint`, `mars.?mission`, `visor`, `wobbly`, `balaclava`, `minifig`. This is a search of locally available refs, not proof about every deleted/unfetched GitHub branch.

The strongest recovered design source is [Waypoint README at 1008873](https://github.com/martinburstein/bot-crossing-clone/blob/1008873f3c81acb73bd4922ed9b0238184170a16/docs/concepts/waypoint/README.md). Its historical brief explicitly blends Bot Crossing 36%, Wobbly Life 33%, and Mars Mission 31%, and links the astronaut with helmet/balaclava listing and BrickLink mm002 inventory. The [five-page concept book](https://github.com/martinburstein/bot-crossing-clone/blob/1008873f3c81acb73bd4922ed9b0238184170a16/docs/concepts/waypoint/Waypoint-Concept-Art-Book.pdf) was recovered into temporary research storage and its cover inspected. It shows a wide ivory helmet, sealed copper visor, graphite collar, orange chest diagonal and teal boots. The original direction is faceless; this is a genuine archive recovery, not a newly discovered photograph of the exact toy.

The [visor-up archive at 45ad517](https://github.com/martinburstein/bot-crossing-clone/tree/45ad517fd37a8f59c44ddc8a16b893af93ccf8c1/docs/concepts/waypoint/archive/visor-up-studies) contains two recovered PNGs, both visually inspected and retained here:

- [Pace and Brace](references/waypoint-pace-and-brace.png): slimmer clay figures, round-square / oval faces, ivory pressure shells and raised copper visors.
- [Reach and Skip](references/waypoint-reach-and-skip.png): long / heart-shaped faces and the same warm clay palette.

The archive README explicitly retires these human-face explorations. The [surface-scout revision at 7f84a1d](https://github.com/martinburstein/bot-crossing-clone/tree/7f84a1d7d4be02d137f44193990cb7f5d3571da1/docs/concepts/waypoint/surface-scout) instead specifies a five-to-five-and-a-half-head-tall humanoid robot with a plain oval head, two recessed optical lights, no face, no side disks and a standard battery pack. Its book's chassis turnaround was rendered and visually inspected. Neither the retired faces nor that robot specification silently becomes Sowers canon.

A separate genuine [Mars Mission archive from dabb971](https://github.com/martinburstein/bot-crossing-clone/tree/dabb9712de970312db78ffac20a255e222d7774e/references/mars-mission) exists on the 15-3A, financial-office, vehicle-missions and related branches. Its manifest records collection on 2026-10-03, eight 2007 sets, original set context and official instruction sources; cropped vehicle images are reference studies, not game textures. [Recovered 7693 cover](references/mars-mission-7693-archive.jpg) is byte-identical to the archive SHA-256 `eac5b79fb0cd1a809e80b2c9e84f209e80828f87b69d3afd681381d3882f5193`. The cover shows the white helmet / dark eye area, but is not an isolated high-resolution photograph of mm002. The 7690 cover was also inspected temporarily.

## Primary online verification and limitations

The [official LEGO 7693 instructions](https://www.lego.com/cdn/product-assets/product.bi.core.pdf/4523183.pdf) were retrieved directly. Printed page 3 was rendered and inspected: it shows a white astronaut helmet, hinged amber visor, yellow head with a black eye graphic, and orange markings on a white torso. [Local page-3 rendering](references/lego-7693-official-page3.png) is retained as source evidence only. This is direct primary evidence for the color and visor language; it does not establish the exact mm002 balaclava variant.

The historically linked [BrickLink mm002 inventory](https://www.bricklink.com/catalogItemInv.asp?M=mm002) and supplied [catalog item 72926](https://www.bricklink.com/v2/catalog/catalogitem.page?id=72926) identify the intended likely match. The latter redirected to BrickLink maintenance during this session; it could not independently verify the exact variant. The historical [Choose-a-Brick astronaut with helmet and balaclava](https://www.choose-a-brick.com/en-global/products/mars-mission-astronaut-with-helmet-and-balaclava) URL was inaccessible through the web tool. Do not describe either inaccessible page as newly recovered visual evidence.

[RubberBandGames' official Wobbly Life page](https://www.rubberbandgames.com/wobbly-life/) was checked. Sowers borrows broad physical comedy, soft silhouettes and job-oriented playfulness, not the game's character meshes or branding.

GitHub connector searches for Mars/minifigure/Wobbly had returned no hits, so authenticated `gh` tree queries were used. Filename checks in additional connected archives found no further Waypoint/Mars Mission/balaclava/minifigure match. Unrelated design material was not imported. This scope does not exhaust historical commits in those other repositories.

## Original implementation contract

`sowers/helmet.js` exports `createHelmet({ color = 0xf5823a, seed = 0 } = {})`, returning a self-contained `THREE.Group` with origin at head centre and front +Z. Mount at avatar local Y 1.42. Its ivory shell is .86 wide by .78 tall; the temple fittings make overall width approximately 1.00, the neck seal extends minimum Y to -.41, and the layered face reaches Z .482. It uses opaque sculpted forms so its charcoal covered lower face and warm eye slit remain legible without transparent-glass sorting. Amber brow/rim, ivory chin and small orange fittings are original geometry with no logos, minifigure connectors or copied mesh.

Optional `animateHelmet(helmet, elapsedSeconds)` provides a deterministic quiet blink. The module has no protocol imports, task-state changes or network calls. A direct Node/Three import, finite-transform check and bounding-box inspection passed. Final appearance and framing still require integration visual review in the Sowers scene.

Recovered generated plates have SHA-256 `00b6a602c01e73d872e8e6b3c8788a276ebdfdcdcc2def5430079e7ad60140c2` (Pace and Brace) and `d9b2f362114ee24a78499bcfc94f0c03fd4d73a3508493006dddfaf424567df9` (Reach and Skip). LEGO imagery remains reference material and is not used as a runtime texture.

## Coordinator follow-up search

A subsequent authenticated tree sweep covered seven extant branches in an additional art archive, with no further relevant filename match. GitHub's code search for “Mars Mission” under the account also returned no results. The connector transport closed during this follow-up, so the authenticated GitHub CLI supplied the tree evidence. These negative filename/index results do not establish absence from image contents, unlabeled assets, deleted branches or unindexed historical text. Repository-specific private search details are retained locally in ignored work notes. The exact masked-toy photo remains unlocated in GitHub; the recovered Bot Crossing Mars Mission archive and the historically linked mm002 reference are the positive findings.

An additional online image search found an accessible [United Brick Co mm002 listing](https://atlbrick.com/products/mars-mission-astronaut-with-helmet-and-balaclava-mm002-1). Its product photograph was visually inspected: a white shell and suit, raised amber visor, a gray printed balaclava with dark edging around the yellow eye opening, and orange torso harness. This independently corroborates the visual match named by the old README, while remaining a newly consulted retail reference rather than a photograph recovered from the user's GitHub. A related mm013 balaclava variant also appears in that retailer's catalog; mm002 is the variant explicitly linked by the historical brief.
