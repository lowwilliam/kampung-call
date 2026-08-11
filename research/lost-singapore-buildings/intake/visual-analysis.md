# Lost Singapore reference analysis

This intake follows the img2threejs visual-analysis and reference-admission workflow. The source photographs are study evidence only: no photograph is projected onto the models or redistributed in the viewer. Dimensions, hidden elevations, interiors and late-life alterations are treated as inference unless a source explicitly establishes them.

## Collection-level quality contract

- Target: stylised real-time architectural props for a browser gallery, not measured BIM or archaeological reconstructions.
- Each model must read correctly in silhouette, primary massing, major roof profile and facade rhythm before micro-detail is attempted.
- Every model must be assembled from named, pickable Three.js parts and expose `root.userData.sculptRuntime` with a non-uniform, parent-aware explode layout.
- The evidence floor is three useful visual references per subject. Machine-rejected images may inform context but are not treated as comparison ground truth.
- Building heights and site extents are proportional approximations. Hidden/rear elevations are inferred from typology and visible repetition.
- Beauty World and Tang Dynasty City are representative compound reconstructions; they do not claim complete site plans.

## 1. Singtel Comcentre

- Primary reference: `comcentre/tower-portrait.jpg`; supporting views establish the low equipment podium and opposite service elevations.
- Observed: extremely tall, narrow office slab; opaque side cores; dense horizontal glazing bands; white perimeter frame; rooftop telecommunications crown; low equipment buildings at the base.
- Must-read details: tower-to-podium height contrast, repetitive window ribbons, blank side cores, rooftop dish/crown cluster.
- Uncertainty: the surviving late-life views do not consistently show the original microwave-dish arrangement. Dish count and exact roof plant are approximate; podium-to-tower connections are simplified.

## 2. National Theatre

- Primary reference: `national-theatre/front.jpg`; three additional front-oblique postcards are contextual because automatic segmentation rejected their full-frame tonal fields.
- Observed: five tall pointed facade bays; red infill planes; dramatic deep cantilevered roof; crescent fountain; low side colonnades and terraced public forecourt.
- Must-read details: five-point facade rhythm, roof wedge, red-and-concrete palette, crescent fountain.
- Uncertainty: the rear auditorium and backstage depth are not visible. They are modeled as a simplified open hall under the known roof rather than a documented interior.

## 3. National Library at Stamford Road

- Primary reference: `national-library-stamford/front.jpg`; porch and courtyard photographs establish useful secondary spaces.
- Observed: red-brick T-shaped modernist mass; deep square window reveals; long horizontal bands; broad flat porch on brick piers; brick lattice/end screen; shaded courtyard with fountain.
- Must-read details: red masonry mass, entrance canopy, deep reveals, courtyard void and screen panel.
- Uncertainty: exact T-plan proportions and service elevations are inferred from photographs; the late courtyard fit-out is treated as a secondary layer.

## 4. Van Kleef Aquarium

- Primary reference: `van-kleef-aquarium/timeout-front.jpg`, the only view that passed automatic foreground admission; four postcards remain contextual evidence.
- Observed: low asymmetric modernist composition against Fort Canning; long perforated/louvered left wing; taller entrance block with four recessed piers; broad stairs and lawn; late-life clock-tower alteration in one view.
- Must-read details: low horizontal wing, pink-white entrance block, recessed colonnade, entrance steps, perforated wall texture.
- Uncertainty: the model targets the best-documented earlier exterior and excludes the later clock-tower remodelling. Aquarium interiors and tank layouts are not reconstructed.

## 5. Former National Stadium

- Primary reference: `former-national-stadium/aerial.jpg`; exterior views establish rakers, stairs, canopy rhythm and floodlights.
- Observed: elliptical open bowl; running track and rectangular pitch; exposed concrete raker frame; west grandstand canopy with repeated scalloped roof; four tall floodlight pylons.
- Must-read details: elliptical tiered bowl, open field, exposed ribs, west canopy and four floodlights.
- Uncertainty: seat counts, concourse rooms and structural bay spacing are reduced to a performance-safe repeated system.

## 6. Pearl Bank Apartments

- Primary reference: `pearl-bank-apartments/aerial.jpg`; inner-court and street views establish the broken-cylinder section and facade bands.
- Observed: tall horseshoe/broken-cylinder tower; narrow inner courtyard; strong vertical party-wall fins; alternating balcony/window ribbons; separate solid service spine; podium/sky-garden bands.
- Must-read details: open horseshoe plan, curved facade ribbons, vertical blades, strong height and podium.
- Uncertainty: exact apartment interlocks, facade alterations and car-park plan are outside scope. Repetition conveys density without reproducing every unit.

## 7. Tanglin Shopping Centre

- Primary reference: `tanglin-shopping-centre/street-overall.jpg`; the early artist's impression separates the original podium from later additions.
- Observed: long retail podium; recessed shaded ground arcade; shallow square windows in framed facade bays; deep horizontal ledges; taller pale office slab and stepped additions.
- Must-read details: podium-and-slab hierarchy, sheltered retail strip, repetitive square openings, long green wordmark.
- Uncertainty: the model represents the mature pre-demolition complex. Additions are simplified and not assigned exact construction phases.

## 8. Amber Mansions

- Primary reference: `amber-mansions/corner-midcentury.jpg`; demolition-era oblique shows the long Penang Road wing and roof profile.
- Observed: three-storey street block turning a bowed corner; large Cape Dutch corner gable; smaller repeated Dutch gables; red tiled pitched roof; broad flattened five-footway arches; restrained white plaster.
- Must-read details: curved corner, large named gable, repeating roof gables, street arcade and long two-wing footprint.
- Uncertainty: rear courtyard and exact shop-bay depths are inferred. Period signs are represented generically rather than copied as photographic texture.

## 9. Eu Court

- Primary reference: `eu-court/corner-1984.png`; two National Archives views establish the long wings and demolition-era plan depth.
- Observed: three-storey L-shaped apartment block; vertically proportioned grouped windows; ground arcade; flat/parapeted roof; projecting Chinese-style corner pavilion with broad eaves.
- Must-read details: L plan, corner tower/pavilion, regular bays, open ground arcade and restrained white facade.
- Uncertainty: the 1930 image reproduced in BiblioAsia is used as documentary support but not as a standalone comparison image. Courtyard/service ranges remain schematic.

## 10. Alkaff Arcade

- Primary reference: `alkaff-arcade/waterfront-front.jpg`; a drawn elevation, waterfront postcard and interior passage establish facade and depth.
- Observed: narrow, tall waterfront front with paired onion domes; dense horseshoe-arch tiers; long covered shopping passage; two gallery levels and glazed/roof-lit central spine.
- Must-read details: paired domes, Moorish arch rhythm, slender facade, long interior passage and shop bays.
- Uncertainty: exact passage length and Raffles Place rear elevation are inferred. The postcard supplies urban scale but limited facade detail.

## 11. Beauty World Market and Town

- Primary reference: `beauty-world-market/market-1970s.jpg`; lane and shop photographs establish roof and stall construction. The annotated Tiong Hwa image duplicates one lane view but identifies the cinema anchor.
- Observed: dense irregular market roofscape; one- and two-storey timber/masonry stalls; corrugated zinc and canvas; narrow shaded lanes; hand-painted signs; cinema and performance anchors.
- Must-read details: porous lanes, irregular roofs, layered awnings, modular stalls and a legible cinema block.
- Uncertainty: this is a representative compound. Exact stall count, site plan and 1940s amusement-park structures are not recoverable from the available photographs.

## 12. Tang Dynasty City

- Primary reference: `tang-dynasty-city/formal-entrance.jpg`; courtyard, bridge and street photographs establish the internal architectural language.
- Observed: grey-brick crenellated city wall; arched gate with layered dark-tile roof; white-and-dark-timber courtyard halls; ceremonial axial spaces; pond and arched bridge; pagoda/watchtower accents.
- Must-read details: monumental gate-wall silhouette, upturned tiled eaves, axial court, bridge and vertical pagoda marker.
- Uncertainty: the 12-hectare park contained unfinished elements. The model is a curated entrance compound, not the complete Chang'an replica. Sources differ between 2008 and 2009 for completed clearance.

## 13. Tank Road Railway Station

- Primary reference: `tank-road-railway-station/roots-front.jpg`; postcard, platform and yard views give the strongest multi-angle set in the collection.
- Observed: long low timber station range; hipped tile roofs; central square clock tower; street picket fence and jinrickshaw forecourt; covered platform, tracks, sidings and footbridge.
- Must-read details: clock tower, low roofline, street/platform dual frontage, canopy and parallel rails.
- Uncertainty: archival captions sometimes conflate the 1903 Singapore Station, the 1907 Tank Road passenger terminus and later goods facilities. The model targets the recognisable 1907 passenger building and treats the yard as a compact representative slice.

## Semantic admission notes

- `beauty-world-market/roots-street.jpg` is contextual-only because it is an annotated near-duplicate of the first lane view.
- `van-kleef-aquarium/timeout-front.jpg` supplies the machine-admitted comparison view; the postcard set remains visually consistent context despite segmentation rejection.
- Comcentre's broad horizontal Singtel complex view is contextual evidence for telecommunications architecture and secondary masses, not a claim that every visible block belonged to the Exeter Road tower.
- All machine rejections and image technical warnings are preserved in `reference-admission.json`; no threshold was relaxed after inspection.
