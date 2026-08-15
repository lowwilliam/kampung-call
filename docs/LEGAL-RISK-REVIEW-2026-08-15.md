# Legal risk review — Kampung Call and Kampung 3D Collection

Date: 15 August 2026  
Branch: `legal-review-2026-08-15`  
Status: **HOLD for public/commercial release**

This is a practical product and repository risk review, not legal advice. It cannot establish ownership or permission where the supporting contracts, releases, licences, source files, and legal opinions are not in the repository. Singapore-qualified counsel should approve the release package.

## Scope and result

Reviewed the browser game, Lost Heritage experience, current 73-record collection manifest, public collection/API/download behaviour, community/like endpoints, runtime media, declared vendor assets, dependency licences, and existing commercial-readiness/rights decisions.

The repository cannot presently support a “no legal concerns” conclusion:

- all 73 catalogue records are drafts;
- all 73 Creator Credits are unverified, and Production Method remains unverified for the pre-existing 68 records;
- all 73 ownership and Display Clearance reviews are incomplete;
- 72 Display Clearances are pending and the Singapore Cable Car SkyOrb record is marked for legal review;
- all 73 Download Grants are blocked;
- recognisable modern landmarks, protected symbols, organisation names, portraits, audio, and an explicitly acknowledged game inspiration lack repository evidence sufficient for clearance.

The code changes made with this review now fail closed for production builds, remove an unauthorised direct-download affordance, retire visitor fingerprinting for likes, mark draft pages `noindex`, distribute direct dependency notices, and require documented Singapore Tourism Board permission before either display or download clearance for the Merlion-resembling asset.

## Findings

### Critical — Merlion-resembling Harbour Statue

The manifest and production notes say the model is unambiguously inspired by the Merlion. Singapore Tourism Board states that the Merlion Symbol and resembling representations have statutory protection, and provides a permission process. The current record contains no documented STB permission.

Required action: keep the model out of public and commercial builds until written permission is recorded, or replace it with a clearly non-resembling original sculpture. Permission must cover the game display and collection display; download/redistribution requires separate express scope.

Sources:

- [STB Brand Assets — The Merlion Symbol](https://www.stb.gov.sg/about-stb/stb-brand-assets)
- [Singapore Tourism Board Act 1963, current Act](https://sso.agc.gov.sg/Act/STBA1963)
- [STB Terms of Use](https://www.stb.gov.sg/terms-of-use/)

### High — public display has no completed rights clearance

Every model is available to the draft viewer while every Display Clearance is `pending`. Production deployment is therefore inappropriate. The new release gate prevents `npm run build` in both the game and collection until the manifest passes release validation; `build:preview` remains available for local review and CI.

This gate is procedural, not proof of clearance. It must not be bypassed merely to deploy.

### High — 3D landmark models need subject-specific analysis

The collection includes recognisable or named modern subjects such as Marina Bay Sands, Gardens by the Bay/Supertrees, Esplanade, Singapore Flyer, Changi-related architecture, universities, Sultan Mosque, Singtel Comcentre, Singapore Cable Car SkyOrb, and a series of demolished buildings. Singapore Copyright Act section 265 permits specified 2D depictions and film uses of buildings and certain public artistic works; it does not plainly grant a general right to create and distribute faithful 3D models. Section 269 concerns reconstruction of buildings, but its application to downloadable digital models should not be assumed.

Required action for each recognisable subject: obtain a Singapore IP opinion or owner permission addressing the 3D model, public interactive display, promotional screenshots/video, commercial game use, and any downloadable file. Record the conclusion and evidence hash per asset. Also review source photographs/plans independently; a right to depict a building does not automatically grant rights in a reference photograph or drawing.

Sources:

- [Copyright Act 2021, section 265](https://sso.agc.gov.sg/Act/CA2021?ProvIds=P15-)
- [Copyright Act 2021, artistic-work rights](https://sso.agc.gov.sg/Act/CA2021?ProvIds=P111-)
- [IPOS information note on designs and copyright](https://www.ipos.gov.sg/docs/default-source/resources-library/design/guidelines-and-useful-information/information-note-on-the-interface-between-registered-designs-and-copyright57c21a77c2d0635fa1cdff0000abd271.pdf)

### High — blocked downloads were bypassed by the page UI

The API correctly denied all uncleared downloads, but each detail page linked directly to the public viewer GLB and labelled it “Download GLB.” That contradicted the manifest and made the Download Grant ineffective at the user-interface level.

Fixed: the page now shows no download link unless the asset-specific grant is cleared and routes allowed downloads through the permission-aware API. Note that any model sent to a browser can still be extracted; models without distribution rights should not be publicly served at all.

### High — authorship and source provenance are not evidenced

No repository evidence establishes the author, employer/commission ownership, licence, or complete source-media chain for the 60 game/wildlife/transit assets, 13 Lost Heritage models, six portraits, seven audio files, and associated preview images. Commit history and the label “AI-built” do not establish commercial rights. AI assistance also does not cure copied source expression or guarantee protectable ownership.

Required evidence:

- creator identity and employment/commission assignment for every authored work;
- generation method and tool terms applicable on the creation date;
- prompts, editable sources, and source-media inventory where relevant;
- licence/permission and attribution terms for every external reference actually copied or adapted;
- model/person releases where a portrait represents a real or recognisable person;
- audio composition, performance, master-recording, and sound-effect rights.

### High — explicit “homage” to Abeto's Messenger needs permission or redesign evidence

The title screen calls the project “an AI-built homage to messenger.abeto.co.” Similar high-level ideas and mechanics are not themselves the same as copied expression, but that acknowledgement plus any copied audiovisual style, world layout, UI, characters, music, text, or code creates derivative-work/trade-dress risk. No permission or clean-room comparison is present.

Required action: obtain written permission, or conduct and retain a side-by-side clean-room review demonstrating independently created code/assets and sufficiently distinct protectable expression. Do not rely on the word “homage” as a licence.

### Medium — organisation names and trade marks

The game and records use or reference organisation/venue names including Singtel and multiple universities and attractions. Editorial identification may be defensible in context, but no trade-mark searches, permission records, or launch counsel review are present. Avoid logos, brand livery, claims of affiliation, and marketing use that suggests endorsement. The draft now displays a non-affiliation notice; that notice does not cure infringement or passing off.

Source: [IPOS — Managing Trade Marks](https://www.ipos.gov.sg/about-ip/trade-marks/managing-trade-marks/managing-trade-marks-overview/)

### Medium — visitor fingerprinting lacked a privacy notice

The likes API hashed IP address plus user agent and stored the persistent hash with timestamps. Hashing is pseudonymisation, not necessarily anonymisation, and the site had no privacy notice, purpose/retention statement, access/deletion route, or data-protection contact. PDPC guidance notes that IP-linked online data can be personal data depending on identifiability and accumulated data.

Fixed: likes are removed from the UI and the endpoint now returns the retired-interaction response without fingerprinting. Existing production `likes` rows should be purged under an approved retention/deletion change; this review did not mutate hosted data.

Source: [PDPC advisory guidelines on selected topics](https://www.pdpc.gov.sg/-/media/files/pdpc/pdf-files/advisory-guidelines/ag-on-selected-topics/advisory-guidelines-on-pdpa-for-selected-topics-310322.ashx)

### Medium — direct dependency notices were absent

The browser bundles directly distribute three.js under MIT and the Draco decoder under Apache-2.0. Production builds now include their notices and complete licence texts under `licenses/`. Before release, generate a complete production SBOM/notice report for the actual client and server bundles and review all transitive licences; lockfile metadata alone is not a final notice file.

### Medium — training and safety claims

The connectivity scenarios are presented as field-service training but lack named subject-matter-expert approval, versioned safety rules, an escalation owner, and evidence that the procedures match a specific employer/network. Keep the prototype label. Before training use, obtain written SME sign-off and clarify that the simulation is not a substitute for employer procedures, safety rules, or live-network authorisation.

## Positive controls already present

- Community submission and moderation mutation endpoints are retired/read-only.
- All Download Grants default to blocked and the permission-aware API fails closed.
- Licensed threejsassets files are segregated and their standalone redistribution is prohibited.
- Lost Heritage records disclose inference and approximation.
- The manifest separates Publisher identity from unverified Creator Credit.
- The game stores only a local best score; no game telemetry or learner identity collection was found.

## Release checklist

A public/commercial release should remain blocked until all of the following are complete:

1. Resolve the Merlion asset through written STB permission or a non-resembling redesign.
2. Complete per-asset ownership, source-media, subject, trade-mark, statutory-permission, person-release, Display Clearance, and Download Grant records with evidence hashes.
3. Obtain legal review for recognisable modern/religious/institutional landmark models and Lost Heritage reconstructions.
4. Establish provenance and commercial rights for portraits, audio, preview images, dialogue, and all 3D source files.
5. Resolve the Abeto Messenger homage through permission or documented independent redesign/clean-room review.
6. Purge legacy visitor fingerprints from hosted storage under an approved change and document completion.
7. Publish terms, privacy information (even if confirming no analytics), IP/corrections contact, takedown process, and an accurate licence/rights statement.
8. Generate and review a complete production dependency notice/SBOM.
9. Obtain SME approval for training content and safety/escalation language.
10. Have Singapore-qualified counsel sign the release record; only then set manifest clearance fields to `cleared` and run `npm run build`.

## Build behaviour after this review

- Game draft preview: `npm run build:preview`
- Game production release: `npm run build` (fails until legal release validation passes)
- Collection draft preview: `npm run build:preview` from `showcase/`
- Collection production release: `npm run build` from `showcase/` (fails until legal release validation passes)

The release validator checks evidence completeness and status consistency. A passing validator confirms that records are populated; it is not a legal opinion on whether the underlying conclusions are correct.
