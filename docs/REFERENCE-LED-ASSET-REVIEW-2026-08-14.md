# Reference-Led Asset Review — Round 1

Date: 2026-08-14
Branch: `codex/asset-reference-rebuild`

## Review rule

The existing automated audit proves that a GLB loads, stays within its budget, and has no missing runtime reference. It does not prove that a Singapore landmark looks correct. This round therefore treats technical PASS and visual/reference PASS as separate gates.

Every revised asset must now have:

1. an admitted reference set with a clear view and traceable source;
2. a written identity/detail inventory before modelling;
3. front, rear, left, right and three-quarter review views;
4. no detached facade detail, empty hero side, accidental roof intersection or unexplained rear mass;
5. a regenerated GLB, checksum-bound catalogue record and a passing runtime audit.

## Completed in round 1

### Peranakan House

Reference basis:

- [URA — Understanding the Shophouse](https://www.ura.gov.sg/conservation/conservation-resources/understanding-the-shophouse/)
- [Roots.sg — Singapore Shophouses](https://www.roots.gov.sg/en/stories-landing/stories/singapore-shophouses/story)

Original failures: upper shutters floated away from the facade; the windows did not read as paired French-window assemblies; the five-footway was blocked; the side was almost blank; roof and airwell logic were unresolved.

Rebuild: attached paired louvred shutters, coloured rectangular fanlights, balustrades and floral tile panels; restored a clear five-footway and residential entry; added side casements, rear service openings, drain stacks and a real airwell split in the roof.

Result: visual/reference PASS and technical PASS.

### Harbour Statue / Merlion

Reference basis:

- [Visit Singapore — Merlion Park](https://www.visitsingapore.com/neighbourhood/featured-neighbourhood/marina-bay/merlion-park/)
- [Roots.sg — The Merlion](https://www.roots.gov.sg/places/places-landing/Places/landmarks/public-art-walking-trail/the-merlion)
- [Wikimedia Commons — Merlion side view, CC0](https://commons.wikimedia.org/wiki/File:Merlion_Side_View_at_Night.JPG)

Original failures: mascot-like head, no convincing fish-to-lion transition, button-like scales, a generic blue drum and no real fountain-mouth construction.

Rebuild: tapered fish body with surface-following overlapping scales, pectoral/tail fins, a projected muzzle with separate open jaws, layered side mane, a mouth-connected water arc and a layered mosaic-wave pedestal.

Result: visual/reference PASS for the project's low-poly style and technical PASS. A future refinement may further sharpen the lion facial planes, but the asset now reads unambiguously as a Merlion rather than a generic animal statue.

### Amber Mansions

Reference basis:

- [BiblioAsia — Mansion Blocks of Singapore](https://biblioasia.nlb.gov.sg/all-sections/vol-17-issue-2-jul-sep-2021-swan-and-maclaren-apartment-living/)
- [BiblioAsia — Over Orchard](https://biblioasia.nlb.gov.sg/all-sections/vol-10-issue-3-oct-dec-2014-singapore-orchard-road-history/)
- [National Archives of Singapore — Amber Mansions, 1983](https://www.nas.gov.sg/archivesonline/photographs/record-details/84b3144e-1162-11e3-83d5-0050568939ad)

Original failures: an oversized solid quarter-cylinder created the broken side/back shown in review; the two roofs were centred on the wrong axes; the courtyard elevation was confused with the street elevation; key corner arches and the name gable were missing.

Rebuild: a true two-wing L-plan, shallow faceted bowed corner, correctly oriented terracotta roofs with a hipped junction, continuous street arcades, repeated Cape Dutch gables, stacked corner arches, `AMBER MANSIONS` name panel, dark shopfront recesses, and restrained inferred courtyard/service elevations.

Result: visual/reference PASS and technical PASS. Hidden courtyard dimensions remain explicitly approximate.

## Next one-by-one visual queue

These are visual-review candidates from the current 68-asset contact sheet. They are not marked failed until their references are admitted and compared.

1. `lost-beauty-world-market` — check the blank street-facing mass against the market-lane and cinema references.
2. `lost-tang-dynasty-city` — review roof intersections, hierarchy and the gate-to-palace silhouette.
3. `overheadbridge` — verify stairs, landings, lift/access logic and side silhouette.
4. `controltower` — replace the generic tower reading with reference-specific cab, glazing and service-base cues.
5. `skypark` — audit tower curvature, rear glazing and the SkyPark hull from side and rear.
6. `mrt` — confirm that the service-side mass is plausible and that the entrance reads from every catalogue angle.
7. `hdb`, `hdbHero`, `nationalSchool` and `landed` — inspect blank end/rear walls and add only evidence-supported service detail.

The complete current contact sheet is `review-shots/reference-led-round-1-contact-sheet.png`.

## Verification recorded

- strict `img2threejs` specification validation: PASS for Peranakan House and Merlion;
- catalogue integrity and all 68 draft records: PASS;
- project validation, world audit, performance budget, unit tests and format checks: PASS;
- production Vite build and headless visibility/footprint audit: PASS;
- showcase production build and 24 tests: PASS.
