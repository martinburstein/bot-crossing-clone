# Sowers: tiny colleagues with soft edges

The target feeling is a handful of desk toys who have taken their responsibilities surprisingly seriously. They should be recognizable by silhouette before the viewer can read a name. The large helmet, bean belly, short boots and loosely hanging mittens make a useful worker feel approachable. A sprout on the bib gives Sowers an original motif: these are people tending something together.

The reference is the relaxed, playful social energy of Wobbly Life. RubberBandGames describes its game as an open-world physics sandbox with quirky jobs and character customization ([official studio](https://www.rubberbandgames.com/), [official publisher page](https://curvegames.com/our-games/wobbly-life/)). Those sources establish the reference's broad spirit; the body, emblem, materials and motions here are original procedural geometry. There are no copied models, textures, branded costumes, character names or imported animation clips. Sowers uses authored motion rather than a physics solver.

## Silhouette and construction

The helmet has nearly the width of the torso plus shoulders. The body narrows toward short, widely set legs; the boot toes point forward so orientation remains readable from above. The belly, bib, cuffs and backpack use overlapping smooth volumes. This is deliberate toy construction: there are no sharp knuckles, articulated fingers or realistic anatomical details.

Assigned identity color covers the suit and backpack pods. Warm cream creates a face-adjacent collar, mittens, bib and boots; a restrained charcoal sole keeps the feet legible against a pale floor. The lighter trim is derived from the assigned color so all characters belong to one family. Names and live task state remain the viewer's responsibility. Suit color does not change to impersonate a different worker or state.

The backpack and pressed sprout are secondary rewards at closer zoom. The sprout uses two leaves and a stem, not text or a tiny logo that would collapse into noise. The bib's button and shoulder fasteners give light something to catch without requiring textures. Standard rough materials support a soft studio light and do not require environment maps or external assets.

## Motion direction

Every character has a deterministic phase derived from its seed. Their breathing, glances and greetings are asynchronous. This is a crowd of little colleagues, not a synchronized exercise class.

Motion is intentionally layered. The hips create the walk; the shoulders swing loosely; the body rolls a little; the helmet counters the torso. A small vertical bounce and an exaggerated torso stretch give each stride a soft toy quality. The feet retain a broad, useful contact silhouette. The walk does not simulate terrain, foot locking, collisions or a physically correct ragdoll.

At rest, the body breathes, the head looks a short distance sideways, and the shoulders drift. A short greeting arrives periodically. These gestures should be read as personality, not evidence that a real task has executed. Status poses blend with damped weights and yield to walking so that a character does not march with a hand permanently covering its face.

| Display state | Pose intent | Practical reading |
| --- | --- | --- |
| `idle` | Gentle sway, head glance, occasional small wave | Present and available |
| `working` | Small forward lean, hands gathered in front, wrist movement | Focused activity |
| `review` | Head tilt and a hand raised toward the chin | Thinking about the result |
| `waiting` | Searching glance and restrained raised-hand motion | Ready for a reply |
| `complete` | Both mittens lifted, small buoyant pulses | A cheerful finish |
| `error` | Head tipped and one mitten near the helmet | A recoverable puzzle |

Error is a puzzled scratch, never a collapse or a distressed character. Complete is a modest celebration; it does not launch particles or interrupt the scene. Selecting a character slightly brightens the sprout. The viewer can add its own floor marker and focus treatment.

## Integration contract

`sowers/avatar.js` exports `createSower({ color = 0xf5823a, seed = 0, helmetFactory } = {})` and returns a `THREE.Group`. The root is controlled by the viewer; the rig never moves that root, selects targets, writes task state or imports a protocol API. Feet sit at `y = 0` in the neutral construction pose, front is `+Z`, and the fallback helmet reaches roughly 1.86 units. Idle sway and step bounce vary the animated bounds slightly.

The viewer calls `group.userData.animate(elapsedSeconds, deltaSeconds, { status, moving, selected })` each frame. Delta is bounded to prevent a restored browser tab from snapping every blend instantly. Invalid elapsed or delta inputs have finite fallbacks. The callback changes only the rig's local transforms and its own badge material. Use a stable numeric seed per character.

The optional `helmetFactory({color, seed})` supplies the entire head. It must return a `THREE.Object3D`, usually a group, centered on the local origin and facing `+Z`. The head anchor is at approximately world `y = 1.45`, with torso motion inherited. A helmet around 0.86 units wide and 0.8 units high suits the proportions. The rig adds no face on top of a supplied helmet. If the helmet exposes `userData.animate`, the body forwards the current animation inputs after moving its joints. A simple procedural helmet is available when no valid factory result is supplied.

This separate experience intentionally does not replace the existing crew model or change the office animation catalogue. It owns no animation scheduler. The working pose is an impression of activity; the existing task API remains the authority.

## Review targets

At room zoom, inspect the outline first: boots must separate, mittens must sit outside the belly, and the helmet must dominate without obscuring the entire body. At character zoom, inspect the supplied face and the chin gesture together. A larger replacement helmet may require moving the review or error hand so it does not pass through the visor.

Numeric checks sample every state, both motion flags and both selection flags, confirm finite transforms, verify the factory arguments and validate the neutral ground plane. They establish the rig contract, not visual collision freedom. Browser review should check the side view of backpack, arm clearance, floor shadows, and the wave from both close and distant camera positions. All joints remain procedural and editable.

The geometry is small and texture-free but currently uses individual mesh draw calls. A large population should share geometries/materials or introduce instancing after measurement. Avoid making the body mechanically rigid just to reduce draw calls: the independently swinging mittens and counter-moving helmet are central to its character.

## Campfire review record

The first integrated review used `createHelmet` from `sowers/helmet.js`. Its factory signature, front direction and head origin match the body contract. Numerical sampling exposed an inward shoulder rotation in the raised-hand poses: complete/error mittens entered the helmet shell. The raise signs were corrected to send the hands outward, the scratch pose elevation was adjusted, and idle greetings now fade away during the other state gestures so their rotations cannot add into an overextended pose.

After the correction, 600 frames per state across all six states produced zero sampled mitten surface vertices inside either the supplied ivory pressure shell or charcoal face. This test treats those head meshes as transformed ellipsoids; it does not establish continuous collision freedom or test every accessory. The broader rig check passed 8,640 state/motion/selection combinations with finite transforms. The neutral precise bounds are `[-0.575, 0, -0.48]` through `[0.575, 1.855, 0.421]` with the fallback head; minimum sampled animated body height remained above the rig ground plane. The clearing in the integrated viewer sits slightly above that plane, so the viewer should offset the avatar root to its surface height.

The coordinator owns final browser review of the integrated close view, room silhouette and the enlarged base door. These numerical findings must not be mistaken for a completed visual review.
