# Blender refinement review

The eight reference photographs establish a 1963 Alfa Romeo Giulia Spider with a black lacquer body, oxblood cabin, right-hand-drive controls, pressed-steel wheels, and bright chrome trim.

## Corrections from the first procedural model

- Replace ellipsoid “pod” fenders with open arch surfaces whose crowns flow into the bonnet and rear quarters.
- Flatten and lengthen the bonnet; retain only a restrained centre crown and chrome spear.
- Lower the windshield and rake it aft; keep the centre divider and twin wipers.
- Taper the rear deck toward a short tail instead of using an overfull dome.
- Shape doors to the beltline rather than using rounded slabs.
- Rebuild wheel faces with ten punched apertures, chrome lips, and domed hubcaps.
- Rebuild the right-hand-drive cabin with three gauges, thin-rim steering wheel, pleated bucket seats, rear squab, and oxblood door cards.
- Keep the shield grille, horizontal side intakes, large upright headlamps, vertical rear lamps, bumper overriders, and left exhaust as separate named parts.

## Confidence and limits

Exterior silhouette and visible cabin features are high-confidence because they are covered by multiple angles. The underside, engine bay, trunk interior, folded soft-top mechanism, exact tire tread, and obscured left-side controls remain inferred and simplified.

## Accepted CLI render

The accepted pass uses continuous quad fender crowns and curved outer skins with the wheel opening authored into their lower boundary. The nose and tail returns taper into the fascia instead of ending as vertical slabs. It also adds integrated headlamp buckets, smaller road wheels with restrained tread grooves, a lower split windshield, a flatter bonnet/deck profile, rounded bucket-seat forms, and a recessed rear bolster.

The organization and material pass was checked against the Khronos Car Concept and Toy Car sample assets: parts have useful names and parent systems, transforms are clean, lacquer uses glTF clearcoat, transparent elements use transmission, and the fixed review cameras expose both major silhouettes. No third-party mesh or texture is included.

This remains a stylized real-time reconstruction rather than coachwork-grade reverse engineering. The fender-to-body blend is still fuller than the photographed Pininfarina surface, the upholstery is simplified, and exact lamp optics, emblems, panel gaps, and plate typography are not reproduced.
