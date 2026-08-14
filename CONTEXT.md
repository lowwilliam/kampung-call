# Kampung Call Showcase

The language of the standalone, public digital catalogue for discovering Singapore-connected 3D objects and their stories through Kampung Call.

## Language

**Visitor**:
A mobile-first member of the public, student, or visitor exploring Singapore-connected 3D objects and their stories; cultural and educational institutions are a secondary audience.
_Avoid_: Client, stakeholder, buyer, creator account

**Showcase**:
A standalone, authoritative digital catalogue for discovering, inspecting, and sharing Singapore-connected 3D assets and their sourced stories, separate from the playable game.
_Avoid_: Game homepage, in-game gallery, community platform

**Asset Provenance**:
The origin and attribution context of the exact asset version a Visitor sees, including its creator, source, licence, and whether it is a first-party work or a third-party variant.
_Avoid_: Ownership

**Source Variant**:
One of the mutually exclusive renderable forms of a game component, such as a licensed third-party model or Kampung Call's first-party fallback. Credit and reuse terms follow the variant actually delivered, not the slot it occupies.
_Avoid_: Asset duplicate, invisible dependency

**Scenery Component**:
A first- or third-party model used to compose the game environment without becoming one of the 68 curated Game Assets. It appears in game credits and provenance records, not as a Collection Asset.
_Avoid_: Game Asset, Collection Asset

**Collection Asset**:
A publicly visible Game Asset with Display Clearance in the current Catalogue Release.
_Avoid_: Scenery Component, source file, planned asset

**Game Asset**:
One of the 68 production GLB models used by Kampung Call and available for interactive viewing in the Showcase. Planned vendor models without viewable files are not Game Assets.
_Avoid_: Scenery Component, every repository file

**Asset Card**:
The primary browsing unit in the Showcase, presenting one Collection Asset through a lightweight preview and opening its Detail View for inspection.
_Avoid_: Map marker, island location

**Collection**:
The card-first presentation of all Collection Assets, without an island, world map, or spatial navigation metaphor.
_Avoid_: Island atlas, world map

**Curated Order**:
The Responsible Publisher's disclosed editorial sequence for browsing the Collection. It is not a popularity, quality, or historical-importance ranking.
_Avoid_: Iconic score, popularity rank

**Display Name**:
The fictional in-game name used as a Collection Asset's primary title. A recognisable real-world inspiration may appear secondarily when it is clearly labelled and sourced.
_Avoid_: Official name, replica name

**Card Preview**:
A checksum-bound AVIF or WebP poster generated from the published GLB for use within an Asset Card. It does not load an interactive 3D scene.
_Avoid_: Live Preview, interactive viewer

**Detail View**:
The expanded presentation of a selected Collection Asset, including its single interactive 360-degree viewer and complete Asset Story.
_Avoid_: Modal, product checkout, game scene

**Responsible Publisher**:
The named person or institution accountable for the accuracy and publication of a Game Asset's catalogue record. A public LinkedIn profile or official institutional website identifies the responsible party but does not replace creator credit or Asset Provenance.
_Avoid_: Creator Credit, model owner, uploader

**Creator Credit**:
The person or organisation credited with creating a model, kept distinct from later adapters and the Responsible Publisher.
_Avoid_: Publisher, source website

**Production Method**:
The disclosed way a model was produced, including original modelling, procedural generation, AI assistance, reference-led reconstruction, or adaptation of third-party work.
_Avoid_: Asset Provenance, software list

**Evidence Status**:
The editorial confidence attached to a historical or visual statement: `Source-confirmed`, `Reasoned inference`, or `Artistic interpretation`.
_Avoid_: Truth score, publication status

**Correction Notice**:
A Visitor's email identifying a possible factual, source, credit, or licence error against a stable Game Asset ID. It is received outside the read-only catalogue and does not itself change the published record.
_Avoid_: Community report, automatic correction

**Download Grant**:
The explicit licence terms under which a Visitor may download and reuse a Game Asset. A Download Grant is asset-specific and must identify the creator, source, licence, and any attribution or redistribution conditions.
_Avoid_: Display Grant, implied permission, source link

**Rights Clearance**:
The evidence-backed determination that the project may display or redistribute a specific asset version, including its model, underlying subject, source photographs or plans, textures, trademarks, likenesses, and third-party components.
_Avoid_: Source citation, disclaimer, repository ownership

**Display Clearance**:
The asset-specific Rights Clearance permitting the exact published model version to be rendered and communicated through the Showcase or game. It does not imply a right to redistribute the file.
_Avoid_: Download Grant, disclaimer

**Memory District**:
A dedicated, lazily loaded game space where Visitors follow a demolition-era timeline through 13 Lost Heritage reconstructions explicitly framed as memories rather than a geographic reconstruction.
_Avoid_: Present-day district, asset dump, modern island extension

**Withdrawn Asset**:
A formerly published Game Asset whose tombstone and version history remain visible while its model, interactive viewer, and download are no longer distributed because provenance, rights, or factual confidence failed.
_Avoid_: Deleted asset, hidden record

**Catalogue Release**:
An immutable, traceable publication of a validated Catalogue Manifest and its matching models, previews, stories, rights records, downloads, and metadata.
_Avoid_: Database state, deployment folder, latest edit

**Studio Stage**:
The warm, editorial display surface that isolates a Collection Asset for close inspection while retaining Kampung Call's chalk, ink, teal, and terracotta identity.
_Avoid_: Island scene, dark technical viewport

## Story Layers

**Singapore Connection**:
A sourced relationship between a Game Asset's subject or story and Singapore.
_Avoid_: Creator nationality, download location

**Singapore Context**:
Sourced cultural or historical context connecting a Collection Asset to Singapore.
_Avoid_: Lore, flavour text

**Game Context**:
The role a Collection Asset plays in the world or narrative of Kampung Call.
_Avoid_: Real-world history

**Production Story**:
How and why a Collection Asset was made or adapted, including its Asset Provenance and art-direction choices.
_Avoid_: Singapore Context

**Asset Story**:
The complete editorial treatment of a Collection Asset. Its depth follows the asset's nature: cultural assets receive Singapore Context, residents receive biographies, and everyday props receive concise observational and production stories.
_Avoid_: Uniform article, invented history
