# Lost Singapore: demolished buildings

This branch documents and procedurally reconstructs 13 culturally or architecturally significant Singapore places that no longer survive. “Heritage” is used in the broad historical sense; inclusion does not imply that a building was gazetted or conserved.

The browser experience is [`/lost-heritage.html`](../../lost-heritage.html). It presents one lightweight, animation-ready Three.js study per subject with orbit controls, four camera views, named selectable parts and a parent-aware exploded view.

## Collection

| Subject | Opened | Removed | Location | References | Evidence confidence |
| --- | --- | --- | --- | ---: | ---: |
| Singtel Comcentre | 1979 | 2024–2025 | 31 Exeter Road | 4 | 94% |
| National Theatre | 1963 | 1986 | Clemenceau Avenue / River Valley Road | 4 | 97% |
| National Library at Stamford Road | 1960 | 2005 | 91 Stamford Road | 4 | 98% |
| Van Kleef Aquarium | 1955 | 1998 | Clemenceau Avenue / River Valley Road | 5 | 91% |
| Former National Stadium | 1973 | 2010–2011 | Kallang | 4 | 98% |
| Pearl Bank Apartments | 1976 | 2020 | 1 Pearl Bank | 4 | 97% |
| Tanglin Shopping Centre | 1972 | 2024 | 19 Tanglin Road | 4 | 95% |
| Amber Mansions | 1922 | 1984 | Orchard Road / Penang Lane | 4 | 93% |
| Eu Court | 1925 | 1992 | Hill Street / Stamford Road | 3 | 91% |
| Alkaff Arcade (The Arcade) | 1909 | 1978 | Collyer Quay to Raffles Place | 4 | 88% |
| Beauty World Market and Town | 1947; 1962 extension | 1984 | Upper Bukit Timah / Jalan Jurong Kechil / Chun Tin Road | 4 | 84% |
| Tang Dynasty City (Tang Dynasty Village) | 1992 | 2008–2009 | Jalan Ahmad Ibrahim / Yuan Ching Road | 4 | 88% |
| Tank Road Railway Station | 1907 | After its 1932 closure | Tank Road / River Valley Road | 4 | 87% |

## The three additions clarified

- **Beauty World** means the former open-air market and town, not today's Beauty World Centre. The Roots account dates the named market to 1947, describes more than 160 stalls by 1976, and records its 1983 closure and 1984 demolition. The model is a representative porous compound because no complete surveyed stall plan was found.
- **The old Tang garden** is treated as Tang Dynasty City/Village. It stood beside Jurong Lake at Jalan Ahmad Ibrahim and Yuan Ching Road—not within Chinese Garden itself. The model concentrates the photographed gate, wall, courtyard hall, bridge and pagoda into a legible entrance compound. Sources disagree slightly on whether clearance finished in 2008 or 2009, so the record preserves the range.
- **The old station** means the demolished 1907 Tank Road passenger terminus. Tanjong Pagar and Bukit Timah stations were excluded because their buildings still stand. Captions can conflate the 1903 Singapore Station, the 1907 terminus and the later goods yard; the model targets the recognisable low hipped-roof station, clock tower, platform and a compact rail-yard slice.

## Evidence and rights

[`collection.json`](collection.json) is the source-of-truth catalogue. It records 52 image references—three to five per subject—with the image URL, source page, credit, reuse note and intended viewpoint. Sources favour the National Heritage Board/Roots, National Library Board/BiblioAsia, public archives and first-party project records; secondary photographs are used only where they add a needed elevation or detail.

Downloaded images and generated contact sheets are deliberately ignored by Git. They are research references, not redistributable application assets. The viewer contains no copied source photography and does not project photographs onto geometry. Run `node fetch-references.mjs`, `node admit-references.mjs` and `node make-contact-sheets.mjs` from this directory to reproduce the local evidence set. [`reference-admission.json`](reference-admission.json) preserves every machine admission or rejection without relaxing thresholds after inspection.

## Reconstruction method

The work follows the local `img2threejs` forge:

1. Analyse silhouettes, massing, facade rhythm and uncertainty across multiple views.
2. Record a per-subject [`assessment`](assessments/) and [`detail inventory`](detail-inventories/).
3. Generate and strictly validate one [`ObjectSculptSpec`](specs/) per subject.
4. Build distinct procedural Three.js component hierarchies in [`models.js`](../../src/lost-heritage/models.js).
5. Inspect front, three-quarter and side browser renders, then record the blockout comparison and sequential structural, form, material, surface, lighting, interaction and optimization audits in each spec.

These are interpretive real-time studies, not measured BIM or archaeological reconstructions. Hidden elevations, exact dimensions, interiors and compound plans are simplified or inferred. Each model exposes `root.userData.sculptRuntime`, named nodes, selection colliders, destruction groups, sockets, `setExplode()` and `resetPose()` so the geometry can be animated or extended later.

## Run

From the repository root:

```sh
npm run dev
```

Then open the Vite URL ending in `/lost-heritage.html`.

## Core historical sources

- [Former Beauty World, Roots](https://www.roots.gov.sg/places/places-landing/Places/landmarks/Bukit-Timah-Heritage-Trail-WWII-Legacy-Trail/Former-Beauty-World)
- [Tang Dynasty City photograph, Roots](https://www.roots.gov.sg/Collection-Landing/listing/1184277)
- [“An Ancient Chinese City in Jurong”, BiblioAsia](https://biblioasia.nlb.gov.sg/all-sections/vol-22-issue-2-jul-sep-2026-an-ancient-chinese-city-in-jurong-/)
- [Tank Road Railway Station photograph, Roots](https://www.roots.gov.sg/Collection-Landing/listing/1115403)
- [Former Tanjong Pagar Railway Station, Roots](https://www.roots.gov.sg/places/places-landing/Places/national-monuments/former-tanjong-pagar-railway-station)

All remaining subject-level sources are linked in `collection.json` and surfaced directly in the browser research panel.
