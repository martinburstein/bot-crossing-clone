# Mars vehicle assembly review

The eleven procedural vehicles retain their original silhouettes, ivory/orange palette and colony scale. This pass repaired assembly connections and moving-part clearances.

| Vehicle | Corrections |
| --- | --- |
| Eagle command shuttle | Moved detached tail fins onto the wings; fitted supported landing skids. |
| Defence sled | Connected the seat pedestal and four launch tubes to a supported equipment rack. |
| Recon Dropship | Added cargo-pod cross brackets and supported landing skids. |
| Recon drilling rover | Added axles/suspension and a rear drill bearing; separated the six tires. |
| Mining truck | Moved tires clear of the chassis; added axles and an elevated drill outrigger/pivot; moved the full drill sweep away from the tires. |
| Trike | Added axles and a rear fork; shortened the rear chassis and cargo pod to clear the rotating rear tire. |
| Astro Fighter | Connected the engine nacelles with spars; gave the instrument its own supported mast clear of the canopy; added landing skids. |
| Claw-Tank | Added a claw pivot and finger crosspiece; moved the arm clear of the canopy; separated rear tires from tracks, hull and cargo pods with a supported rear extension. |
| Armored Drilling Unit | Added six axles/suspension joints, separated tire treads and raised the drill boom clear of the cab. |
| Transport scout | Added supported landing skids; verified pod, engine and tail connections. |
| Scout bike | Shortened the belly/cockpit, added wheel axles, connected the roll cage, and moved the rotating tires clear of the canopy. |

All parked models are grounded from their actual lowest geometry point, including tire treads and landing feet. Cockpit control bars have solid pedestals; an open canopy is not treated as a solid volume that could support floating interior equipment.

## Numerical verification

`node --test test/magi-geometry.test.mjs` tests all eleven vehicles at five motion phases, including both arm-sweep extrema. The audit operates on the individual transformed meshes before render batching:

- Triangle surface contact plus solid containment builds a physical connection graph. All 55 samples form one connected assembly; no detached components remain.
- Wheels and articulated mechanisms are checked against other mechanisms and static bodywork. Only specifically marked axle/pivot joints are permitted to meet their own mechanism. All 55 samples have zero clearance failures.
- Contact tolerance is 0.025 scene units. Broad-phase bounding boxes accelerate the check; overlapping boxes alone do not establish contact.

These are sampled visual-assembly checks, not continuous collision detection or watertight CAD certification. Fixed structural joins intentionally meet/penetrate slightly, as do concentric hubs and tire tread pieces. The test targets detached features and unintended moving-part/body intersections rather than prohibiting necessary assembly joints.

`node tools/vehicle-geometry-audit.mjs` prints the parked-pose result for every vehicle; append a vehicle ID and time to inspect another pose. The browser inspection sheet at `/tools/visual-check/vehicles.html` provides front, rear, side and top views plus motion. The colony simulation at `/tools/visual-check/magi.html` checks rental and return behavior without protocol calls or browser preference saves.

## Hangar and layout

The compact three-bay hangar sits in the center near the original lander. Clicking its geometry opens the complete rental catalog. Bots board at the hangar, operate on its clear apron, then return and disembark. Three parked models occupy the bays; vehicle rentals never consume construction hexagons. The hangar walls and bays participate in navigation, and future construction avoids the building, apron and lander.

Each cluster's missing sixth tile points away from the colony center. The first persona in that cluster to earn expansion fills that gap; later expansion preserves previous allocations.

Screenshots: [fleet inspection sheet](vehicle-assemblies.jpg), [live standby colony](hangar-colony.jpg), and [returned rentals in the isolated simulation](hangar-returns-simulation.jpg).

## Full-size pilots and tread repair

The Eagle, Astro Fighter, Recon Dropship and transport scout now have shallow rounded nose fairings in place of the projecting cone. The Claw-Tank has wider track spacing, raised cargo supports, an outboard claw pivot, and separated instrument barrels clear of the canopy. Each track has 24 links that circulate around its two rollers; the production renderer instances those links without losing their individual animation.

All eleven vehicles reserve a recessed footwell through their hull blocks, with a floor and rear seat pad. Wheel half-shafts stop outside the pilot space. The armored cab retains sloped side panels around its recess; the scout bike's wheelbase was lengthened to clear its occupied canopy. Pilot scale stays at the colony's normal scale. The hangar catalog now shows the actual astronaut rig, backpack, helmet, and seated drive animation in every vehicle.

The browser inspection sheet CPU-skins the same rig and samples four drive-animation phases per vehicle. Every sampled body/equipment vertex clears the solid block and cylinder interiors, and the portion above the canopy rim fits within its ellipsoid. The saved [pilot fit results](pilot-fit-results.json) contain 44 samples with zero reported intrusions. This checks sampled vertices and the analytic canopy envelope, not continuous triangle-to-triangle collision against every decorative surface.

The assembly audit now includes circulating track links in its mechanism checks. All 55 assembly samples remain connected with zero mechanism clearance failures. A separate regression compares instanced and unbatched tread transforms, checks travel along both belts and exact loop closure, and checks reduced-motion behavior. The full suite passes 101 tests; the production build succeeds.

Updated views: [occupied fleet](vehicle-pilot-fit.jpg) and [Claw-Tank in the hangar](claw-tank-pilot.jpg).

## Cockpit surface repair

The recessed hull blocks originally exposed coincident interior faces, including differently colored hull/base walls and the seat pad. Those surfaces caused depth fighting. The structural cuts now sit 0.04 units behind a single cabin lining; the floor and backrest have their own separated visible surfaces. The vehicle exteriors, pilot scale, and seating positions are unchanged.

A regression casts 660 rays across the eleven interiors and checks that their first visible opaque surfaces do not coincide with another mesh. The original geometry failed this check. All 44 browser pilot-fit samples still report no intrusion, all 55 moving-assembly samples pass, and the full suite now passes 102 tests. The production build succeeds. Close-up orbit inspection confirmed clean surfaces; [updated hangar view](cockpit-interiors.jpg).

## Driving direction

The drilling rover's pilot, controls, seat back, and footwell now face its drill end. Its catalog camera opens from that end, and rentals park with the drill toward the hangar exit. The seat position and pilot heading follow the vehicle's rotation in the colony as well as in the preview.

The mining truck, trike, Claw-Tank rear wheels, armored drilling unit, and scout bike now roll toward their fronts. The drilling rover retains the opposite local wheel direction because its front is the drill end. Track rollers match the circulating links. Returning rentals reverse the accumulated wheel/track phase smoothly while backing into their bays.

Regression checks verify tire contact movement against the vehicle's forward direction, its reversal, and the rover's mounted seat transform and outbound/return behavior. All 104 tests pass, the build succeeds, and all 44 browser pilot-fit samples remain clear. [Rover facing the drill](rover-driving-direction.jpg).
