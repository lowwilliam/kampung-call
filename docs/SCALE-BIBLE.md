# Kampung Call scale bible

Gate A establishes the world measurement standard. It is the source of truth
for the later asset, footprint, layout, and traversal gates.

## Core standard

**1 world unit = 1 metre.** This is literal and non-negotiable for anything the
player touches.

The planet radius is **R = 78**. The previous R = 26 value is retained only as
the audit baseline. The new radius is the operational value in
[`world/scale.json`](../world/scale.json), and runtime code must read it from
that file rather than retyping it.

## Two scale bands

| Band | Rule |
| --- | --- |
| Human and street scale | Literal 1:1. Characters, vehicles, props, doors, railings, kerbs, ground-floor storey heights, road widths, and bench seat heights use real metres. A door is 2.1 u and a kerb is 0.15 u. If a player can walk up to it, it is real size. |
| Building mass | Vertically compressed. The ground floor remains 3.0 u so entrances read correctly against a 1.75 u character. Every storey above the ground floor is a stylised 1.6 u storey. |

## Height ladder

Values are targets; later gates must measure the exported assets and land within
±10% of their target. Dimensions listed as width, depth, length, or span are
also in world units/metres.

### Human and street scale

| Tier | Object | Target |
| --- | --- | ---: |
| Human | Player, residents | 1.75 u |
| Human | Cat | 0.30 u |
| Human | Bench | 0.85 u; seat 0.45 u |
| Human | Postbox | 1.20 u |
| Human | Bicycle | 1.10 u high × 1.80 u long |
| Human | Service kits (router/fibre/wifi) | 0.90 u |
| Human | Door | 2.10 u |
| Human | Kerb | 0.15 u |
| Human | Service van | 2.30 u high × 5.40 u long × 2.00 u wide |
| Human | Bus | 3.20 u high × 11.0 u long |
| Human | Bus stop shelter | 2.90 u high × 6.0 u long |
| Human | Streetlamp | 5.00 u |
| Human | Overhead bridge | 5.20 u deck clearance; 24.0 u span |

### Nature

| Tier | Object | Target |
| --- | --- | ---: |
| Nature | Palm | 9.0 u |
| Nature | Rain tree | 12.0 u; 14 u canopy width |

### Low-rise mass

| Tier | Object | Target |
| --- | --- | ---: |
| Low-rise | Mama shop | 4.6 u |
| Low-rise | Kopitiam | 5.4 u |
| Low-rise | Kampong house on stilts | 6.0 u |
| Low-rise | Hawker centre | 6.2 u; 34 × 22 u footprint |
| Low-rise | Shophouse / Peranakan | 6.2 u |
| Low-rise | Wet market | 6.8 u; 28 × 20 u footprint |
| Low-rise | Landed house | 7.6 u |
| Low-rise | School | 8.0 u |
| Low-rise | MRT station | 9.0 u |
| Low-rise | Temple | 10.0 u |

### Mid-rise mass

| Tier | Object | Target |
| --- | --- | ---: |
| Mid-rise | Esplanade | 12.0 u |
| Mid-rise | NUS | 12.0 u |
| Mid-rise | NTU | 14.0 u |
| Mid-rise | SMU | 16.0 u |
| Mid-rise | SUTD | 13.0 u |
| Mid-rise | Civic | 14.0 u |
| Mid-rise | Airport terminal | 14.0 u; 90 × 45 u footprint |
| Mid-rise | Hospital | 16.0 u |
| Mid-rise | Sultan Mosque | 18.0 u dome; 24.0 u minaret |
| Mid-rise | HDB slab / Blk 65 void-deck block | 20.6 u; 12 storeys; 55 × 12 u footprint |

### High mass

| Tier | Object | Target |
| --- | --- | ---: |
| High | Supertree | 26.0 u |
| High | CBD towers | 26–38 u, spread across the district |
| High | Control tower | 28.0 u |
| High | Marina and Holland condos | 30.0 u; 18 storeys |
| High | Point block | 34.0 u; 22 storeys; 22 × 22 u footprint |
| High | Singapore Flyer | 34.0 u |

### Cap and silhouette order

Nothing may exceed **40.0 u**, approximately half the planet radius. Marina Bay
Sands is capped at **40.0 u** and must remain the single tallest object on the
island.

The silhouette ranking is:

**Marina Bay Sands > CBD tallest > Singapore Flyer ≥ point block > condo >
control tower > supertree > HDB > hospital > campus > everything else.**

## Traversal budget

Surface speed is independent of planet radius, so increasing R increases the
length of every journey. The targets are:

| Motion | Target |
| --- | ---: |
| Walk | 5.5 u/s |
| Van | 20 u/s |
| NPC | 1.4 u/s |
| NPC wander radius | 9.0 u |
| NPC look radius | 6.0 u |
| Longest call-to-call walk | ≤ 40 s on foot |

The walk speed must not be raised above 6.0 u/s to compensate for a longer
route. The longest call-to-call walk is a later measured acceptance check; if it
exceeds 40 s, the depot or van access must move.

## Proportional scene targets

The radius change from 26 u to 78 u is a factor of 3. Scene-scale values that
are explicitly proportional to the old world therefore have these Gate A
targets for later runtime wiring:

| Runtime value | Target at R = 78 |
| --- | ---: |
| Fog near / far | 108 / 372 u |
| Shadow camera left / right / top / bottom | −72 / 72 / 72 / −72 u |
| Shadow camera near / far | 30 / 510 u |
| Camera far plane | 1500 u |

Road widths, building setbacks, minimum verges, major visual buffers, and
terrain amplitude must use the same ×3 world-scale conversion in the later
implementation gates. No runtime source changes are part of Gate A.

## Data contract

[`world/scale.json`](../world/scale.json) mirrors the standard above through
the required `unit`, `planetRadius`, `groundStorey`, `stylisedStorey`,
`heightLadder`, `speeds`, and `caps` fields. All dimensions and rates are
world-unit values unless a field name explicitly says `seconds`, `storeys`, or
`width/depth/length/span`.
