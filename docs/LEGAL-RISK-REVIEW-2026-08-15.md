# Legal risk review — Kampung Call and Kampung 3D Collection

Date: 15 August 2026

Branch: `legal-review-2026-08-15`

Status: **HOLD for public/commercial release**

This is a practical product and repository risk review, not legal advice. It cannot establish ownership or permission where supporting contracts, releases, licences, source files, and legal opinions are absent. Singapore-qualified counsel should approve the release package.

## Result

The repository cannot presently support a “no legal concerns” conclusion:

- all 68 catalogue records are drafts;
- all Creator Credits and Production Methods are unverified;
- ownership, source-media, subject-type, and person-release reviews are incomplete;
- all Display Clearances are pending and all Download Grants are blocked;
- recognisable modern landmarks, protected symbols, organisation names, portraits, audio, and an explicitly acknowledged game inspiration lack sufficient clearance evidence.

The accompanying code changes fail closed for production builds, remove an unauthorised direct-download affordance, retire visitor fingerprinting for likes, mark draft pages `noindex`, distribute direct dependency notices, and require documented Singapore Tourism Board permission before either display or download clearance for the Merlion-resembling asset.

## Material findings

### Critical — Merlion-resembling Harbour Statue

The model is expressly and recognisably inspired by the Merlion. Singapore Tourism Board states that the Merlion Symbol and resembling representations have statutory protection and provides a permission process. No documented STB permission is present.

Keep the model out of public and commercial builds until written permission covers game and collection display, or replace it with a clearly non-resembling original sculpture. Download and redistribution require separate express scope.

- [STB Brand Assets — The Merlion Symbol](https://www.stb.gov.sg/about-stb/stb-brand-assets)
- [Singapore Tourism Board Act 1963](https://sso.agc.gov.sg/Act/STBA1963)
- [STB Terms of Use](https://www.stb.gov.sg/terms-of-use/)

### High — public display has no completed rights clearance

Every model is available to the draft viewer while every Display Clearance is pending. The new release gate prevents `npm run build` in both the game and collection until release validation passes; `build:preview` remains available for local review and CI. The gate must not be bypassed merely to deploy.

### High — 3D landmark models need subject-specific analysis

The collection includes recognisable or named modern subjects such as Marina Bay Sands, Gardens by the Bay/Supertrees, Esplanade, Singapore Flyer, Changi-related architecture, universities, Sultan Mosque, Singtel Comcentre, and demolished buildings. Copyright Act section 265 permits specified 2D depictions and film uses of buildings and certain public artistic works; it does not plainly grant a general right to create and distribute faithful 3D models. Section 269 should not be assumed to authorise downloadable digital models.

Obtain a Singapore IP opinion or owner permission for each recognisable subject covering interactive display, promotional media, commercial game use, and downloadable files. Review source photographs and plans independently.

- [Copyright Act 2021](https://sso.agc.gov.sg/Act/CA2021?ProvIds=P15-)
- [IPOS information note on designs and copyright](https://www.ipos.gov.sg/docs/default-source/resources-library/design/guidelines-and-useful-information/information-note-on-the-interface-between-registered-designs-and-copyright57c21a77c2d0635fa1cdff0000abd271.pdf)

### High — blocked downloads were bypassed by the page UI

The API denied uncleared downloads, but detail pages linked directly to the viewer GLB as “Download GLB.” This contradicted the manifest. Fixed: no link is shown unless the asset-specific grant is cleared, and permitted downloads route through the API. Any model sent to a browser can still be extracted; models without display/distribution rights must not be publicly served.

### High — authorship and source provenance are not evidenced

No repository evidence establishes the complete author, employer/commission ownership, licence, or source-media chain for the 55 game assets, 13 Lost Heritage models, portraits, audio, and previews. Commit history and “AI-built” do not establish commercial rights. Required evidence includes creator/assignment records, generation method and applicable tool terms, editable sources and source-media inventory, licences/attribution, person releases, and composition/performance/master rights for audio.

### High — Abeto Messenger “homage”

The title screen calls the project “an AI-built homage to messenger.abeto.co.” Similar ideas and mechanics are not themselves copied expression, but copied audiovisual style, layout, UI, characters, music, text, or code may create derivative-work or trade-dress risk. Obtain written permission or retain a clean-room comparison demonstrating independent code/assets and sufficiently distinct expression. “Homage” is not a licence.

### Medium — organisation names and trade marks

The project references Singtel, universities, and attractions. Avoid logos, brand livery, affiliation claims, and marketing that implies endorsement. Complete trade-mark searches and counsel review. The added non-affiliation notice does not cure infringement or passing off.

- [IPOS — Managing Trade Marks](https://www.ipos.gov.sg/about-ip/trade-marks/managing-trade-marks/managing-trade-marks-overview/)

### Medium — visitor fingerprinting lacked a privacy notice

The likes API hashed IP address plus user agent and stored the persistent hash with timestamps, without a privacy notice, purpose/retention statement, or rights route. Hashing is pseudonymisation, not necessarily anonymisation. Fixed: likes are removed and the endpoint is retired without fingerprinting. Existing hosted `likes` rows should be purged under an approved hosted-data change; this review did not mutate hosted data.

- [PDPC advisory guidelines](https://www.pdpc.gov.sg/-/media/files/pdpc/pdf-files/advisory-guidelines/ag-on-selected-topics/advisory-guidelines-on-pdpa-for-selected-topics-310322.ashx)

### Medium — dependency notices and training claims

Production builds now distribute licences for directly shipped three.js (MIT) and Draco (Apache-2.0). Generate a full production SBOM/notice report before release. The field-service scenarios also require named SME approval, safety/escalation rules, and clarification that the simulation is not a substitute for employer procedures or live-network authorisation.

## Positive controls

- Community mutation endpoints are retired/read-only.
- Download Grants default to blocked and the permission-aware API fails closed.
- Licensed threejsassets files are segregated and standalone redistribution is prohibited.
- Lost Heritage records disclose inference and approximation.
- The game stores only a local best score; no game telemetry or learner identity collection was found.

## Release checklist

1. Resolve the Merlion asset through written STB permission or non-resembling redesign.
2. Complete per-asset ownership, source-media, subject, trade-mark, statutory-permission, person-release, Display Clearance, and Download Grant records with evidence hashes.
3. Obtain legal review for recognisable landmarks and Lost Heritage reconstructions.
4. Establish provenance and commercial rights for portraits, audio, previews, dialogue, and 3D source files.
5. Resolve the Abeto Messenger homage through permission or documented independent redesign.
6. Purge legacy visitor fingerprints from hosted storage under an approved change.
7. Publish terms, privacy information, IP/corrections contact, takedown process, and accurate rights statements.
8. Generate and review a complete production dependency notice/SBOM.
9. Obtain SME approval for training and safety content.
10. Obtain Singapore-qualified counsel sign-off before setting clearances to `cleared` and running `npm run build`.

Draft builds use `npm run build:preview` in either project. Production `npm run build` fails until legal release validation passes. A passing validator confirms record completeness; it is not a legal opinion.
