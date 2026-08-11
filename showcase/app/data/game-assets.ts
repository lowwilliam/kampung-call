import metricsJson from "./asset-metrics.json";

export const CATEGORIES = [
  "People",
  "Homes & Neighbourhoods",
  "Culture & Landmarks",
  "Transit & Movement",
  "Street Life & Nature",
  "Service Gear",
] as const;

export type AssetCategory = (typeof CATEGORIES)[number];

export type CollectionAsset = {
  id: string;
  slug: string;
  name: string;
  file: string;
  modelUrl: string;
  category: AssetCategory;
  intro: string;
  gameContext: string;
  singaporeContext: string;
  productionStory: string;
  inspiration?: string;
  historySource?: { label: string; url: string };
  provenance: string;
  provenanceDetail: string;
  collection: "game" | "community";
  creator?: string;
  linkedinUrl?: string;
  featured?: boolean;
  metrics: {
    triangles: number;
    materials: number;
    meshCount: number;
    compressed: boolean;
  };
};

const ICONIC_ASSET_IDS = [
  "peranakan-house",
  "harbour-statue",
  "skypark-hotel",
  "supertree",
  "sultan-mosque",
  "concert-hall",
  "singapore-flyer",
  "hdb-void-deck",
  "shophouse",
  "wet-market",
  "kopitiam",
  "kampong-house",
  "mrt",
  "airport-terminal",
  "hawker",
  "mama-shop",
  "bumboat",
] as const;

const categoryPriority: Record<AssetCategory, number> = {
  "Homes & Neighbourhoods": 200,
  "Culture & Landmarks": 300,
  "Transit & Movement": 400,
  "Street Life & Nature": 500,
  "Service Gear": 600,
  People: 1_000,
};

export function sortAssetsByIconicLevel(assets: CollectionAsset[]) {
  const iconicRank = new Map<string, number>(ICONIC_ASSET_IDS.map((id, index) => [id, index]));
  return [...assets].sort((left, right) => {
    const leftRank = iconicRank.get(left.id) ?? categoryPriority[left.category] + (left.featured ? -40 : 0);
    const rightRank = iconicRank.get(right.id) ?? categoryPriority[right.category] + (right.featured ? -40 : 0);
    return leftRank - rightRank || left.name.localeCompare(right.name);
  });
}

type MetricsMap = Record<
  string,
  {
    triangles: number;
    materials: number;
    meshCount: number;
    compressed: boolean;
  }
>;

const metrics = metricsJson as MetricsMap;

const SOURCES = {
  hdb: {
    label: "Housing & Development Board — Our Story",
    url: "https://www.hdb.gov.sg/about-us/our-story",
  },
  transport: {
    label: "Land Transport Authority — The LTA Story",
    url: "https://www.lta.gov.sg/content/ltagov/en/who_we_are/our_organisation/the_lta_story.html",
  },
  hawker: {
    label: "National Heritage Board — Singapore’s Hawker Culture",
    url: "https://www.roots.gov.sg/stories-landing/stories/Hawker-Culture",
  },
  sultanMosque: {
    label: "National Heritage Board — Sultan Mosque",
    url: "https://www.roots.gov.sg/places/places-landing/Places/national-monuments/sultan-mosque",
  },
  merlion: {
    label: "National Heritage Board — The Merlion",
    url: "https://www.roots.gov.sg/places/places-landing/Places/landmarks/public-art-walking-trail/the-merlion",
  },
} as const;

type AssetSeed = {
  id: string;
  name: string;
  file: string;
  category: AssetCategory;
  intro: string;
  gameContext: string;
  singaporeContext: string;
  inspiration?: string;
  historySource?: { label: string; url: string };
};

function buildAsset(seed: AssetSeed): CollectionAsset {
  const key = `assets/${seed.file}`;
  const itemMetrics = metrics[key] ?? {
    triangles: 0,
    materials: 0,
    meshCount: 0,
    compressed: true,
  };
  const slug = seed.id.replace(/:/g, "-");
  return {
    ...seed,
    slug,
    modelUrl: `/models/${seed.file}`,
    collection: "game",
    provenance: "Made for Kampung Call",
    provenanceDetail:
      "Shipped with the game’s canonical GLB collection. Planned vendor-library replacements are excluded until their licensed files are present.",
    productionStory: `${itemMetrics.meshCount.toLocaleString()} mesh${itemMetrics.meshCount === 1 ? "" : "es"}, ${itemMetrics.materials.toLocaleString()} material${itemMetrics.materials === 1 ? "" : "s"}, and ${itemMetrics.triangles.toLocaleString()} triangles. ${itemMetrics.compressed ? "Draco-compressed for the browser." : "Prepared for browser delivery."}`,
    metrics: itemMetrics,
  };
}

const seeds: AssetSeed[] = [
  { id: "engineer", name: "Field Engineer", file: "courier.glb", category: "People", intro: "The player character: compact, readable and ready for the next call.", gameContext: "Walks the neighbourhood, drives the service van and performs every diagnosis.", singaporeContext: "A tribute to the technicians whose invisible work keeps homes and communities connected." },
  { id: "engineer-legacy", name: "Legacy Engineer", file: "engineer-v2.glb", category: "People", intro: "An earlier silhouette retained as a record of the character’s evolution.", gameContext: "Shows how the field engineer moved from a static prototype to the animated final character.", singaporeContext: "Its safety-first workwear grounds the fantasy in familiar field-service practice." },
  { id: "resident-uncle-lim", name: "Uncle Lim", file: "residents/uncle-lim.glb", category: "People", intro: "A warm kampung host with a stubborn optical fault and plenty to say.", gameContext: "Guides the optical-loss call and rewards careful escalation.", singaporeContext: "His easy porch conversation evokes the neighbourly shorthand of older residential communities." },
  { id: "resident-auntie-rosnah", name: "Auntie Rosnah", file: "residents/auntie-rosnah.glb", category: "People", intro: "A sharp-eyed resident who knows exactly where the connection drops.", gameContext: "Anchors one of the game’s household troubleshooting stories.", singaporeContext: "Written around the everyday expertise residents bring to their own homes." },
  { id: "resident-devi", name: "Devi", file: "residents/devi.glb", category: "People", intro: "Calm, observant and never short of a useful clue.", gameContext: "Turns a technical service call into a conversation about listening well.", singaporeContext: "Part of the multi-generational cast that gives the neighbourhood its social texture." },
  { id: "resident-mr-tan", name: "Mr Tan", file: "residents/mr-tan.glb", category: "People", intro: "Patient—but only while the intermittent line behaves.", gameContext: "Hosts the point-block fault scenario and its elusive symptoms.", singaporeContext: "His setting draws on the shared thresholds and chance encounters of public housing." },
  { id: "resident-kai", name: "Kai", file: "residents/kai.glb", category: "People", intro: "A digitally fluent customer waiting on a clean router installation.", gameContext: "Introduces the new-router call and its validation steps.", singaporeContext: "A contemporary voice in a neighbourhood spanning several generations." },
  { id: "resident-sofia", name: "Sofia", file: "residents/sofia.glb", category: "People", intro: "A sky-garden resident determined to erase every Wi-Fi dead zone.", gameContext: "Leads the mesh-deployment story across a tall condo home.", singaporeContext: "Her home reflects dense vertical living and the connectivity expectations that come with it." },

  { id: "kopitiam", name: "Kopitiam Dispatch", file: "kopitiam-v2.glb", category: "Homes & Neighbourhoods", intro: "Three stalls, shared tables and the informal heart of the shift.", gameContext: "The engineer’s dispatch hub and a social anchor for the game world.", singaporeContext: "Traditional kopitiams pair affordable drinks with open, sociable seating and a material culture all their own.", historySource: SOURCES.hawker },
  { id: "hdb-skyline", name: "HDB Skyline", file: "hdb-bg-v2.glb", category: "Homes & Neighbourhoods", intro: "A simplified residential block designed to read clearly across the city.", gameContext: "Builds the dense public-housing horizon without overwhelming the hero locations.", singaporeContext: "Public housing is a defining part of Singapore’s urban and social story.", historySource: SOURCES.hdb },
  { id: "hdb-call", name: "HDB Service Call", file: "hdb-call-v2.glb", category: "Homes & Neighbourhoods", intro: "A task-ready corridor and unit frontage shaped around a service visit.", gameContext: "Concentrates fibre, access and address details where the player needs them.", singaporeContext: "The corridor becomes both circulation space and the threshold of domestic life.", historySource: SOURCES.hdb },
  { id: "shophouse", name: "Corner Shophouse", file: "shophouse-v2.glb", category: "Homes & Neighbourhoods", intro: "A narrow, colourful street building with deep shade and a strong silhouette.", gameContext: "Adds rhythm, shelter and local scale to the commercial streets.", singaporeContext: "Its five-foot-way proportions and layered façade draw on Singapore’s conserved shophouse tradition." },
  { id: "condo", name: "Garden Condominium", file: "condo-bg-v2.glb", category: "Homes & Neighbourhoods", intro: "A tall residential backdrop softened by balconies and tropical planting.", gameContext: "Establishes the modern private-housing districts at a readable game scale.", singaporeContext: "Vertical homes, shared amenities and planted terraces are familiar parts of the city’s residential mix." },
  { id: "condo-marina", name: "Marina Riser Call", file: "condo-marina-v2.glb", category: "Homes & Neighbourhoods", intro: "A vertical service kit built around riser access and a broken Ethernet link.", gameContext: "Turns a high-rise lobby into a three-step diagnostic stage.", singaporeContext: "The model foregrounds the hidden service infrastructure that makes dense buildings work." },
  { id: "condo-holland", name: "Sky Garden Mesh Call", file: "condo-holland-v2.glb", category: "Homes & Neighbourhoods", intro: "Terraced greenery wrapped around a home that needs better mesh coverage.", gameContext: "Places three connectivity nodes across a visually legible vertical route.", singaporeContext: "The planted terraces echo Singapore’s long-running ambition to weave landscape into high-density architecture." },
  { id: "kampung-call", name: "Kampung Fibre Call", file: "kampung-call-v2.glb", category: "Homes & Neighbourhoods", intro: "A timber home, veranda and visible fibre path built for Uncle Lim’s call.", gameContext: "Makes the optical fault readable through cables, drop points and porch access.", singaporeContext: "The raised house and communal veranda recall forms associated with kampong life, interpreted here as game-world homage." },
  { id: "pointblock-call", name: "Point Block Line Call", file: "pointblock-call-v2.glb", category: "Homes & Neighbourhoods", intro: "A tall point-block silhouette with a fault loop hidden at human scale.", gameContext: "Hosts the intermittent-line scenario and its line-test pedestal.", singaporeContext: "Point blocks punctuate many Singapore housing estates with compact towers and shared ground-level life.", historySource: SOURCES.hdb },
  { id: "landed-bg", name: "Landed Home", file: "landed-bg-v2.glb", category: "Homes & Neighbourhoods", intro: "A low-rise home that broadens the residential mix beyond towers.", gameContext: "Populates quieter streets while reserving hero detail for active calls.", singaporeContext: "Deep eaves and sheltered frontage respond to tropical sun and rain." },
  { id: "landed-call", name: "Router Installation Home", file: "landed-v2.glb", category: "Homes & Neighbourhoods", intro: "A welcoming porch and installation zone prepared for Kai’s new router.", gameContext: "Frames the first call around placement, power and final validation.", singaporeContext: "The porch acts as a soft boundary between street, household and visiting technician." },
  { id: "wet-market", name: "Wet Market", file: "wetmarket-v2.glb", category: "Homes & Neighbourhoods", intro: "An open-sided market hall designed for air, shade and busy sightlines.", gameContext: "Adds an instantly legible food-and-provisions landmark to the neighbourhood.", singaporeContext: "Markets and hawker centres gather daily routines, fresh food and community exchange under one roof.", historySource: SOURCES.hawker },
  { id: "mama-shop", name: "Mama Shop", file: "mamashop-v2.glb", category: "Homes & Neighbourhoods", intro: "A tiny provision shop packed into a generous neighbourhood memory.", gameContext: "Adds colour and a human-scale pause between larger buildings.", singaporeContext: "The neighbourhood convenience shop is remembered for everyday essentials, informal credit and familiar faces." },
  { id: "peranakan-house", name: "Peranakan House", file: "peranakan-house-v2.glb", category: "Homes & Neighbourhoods", intro: "A jewel-box façade of shutters, tiles and layered ornament.", gameContext: "Brings fine-grained heritage detail into the streetscape without losing the game’s bold silhouette.", singaporeContext: "Its palette and decorative density are inspired by Peranakan domestic architecture and Singapore’s historic terrace houses.", inspiration: "Peranakan terrace-house traditions" },
  { id: "kampong-house", name: "Kampong House", file: "kampong-house-v2.glb", category: "Homes & Neighbourhoods", intro: "A compact timber dwelling lifted lightly above the ground.", gameContext: "Creates a quieter domestic counterpoint to the dense city districts.", singaporeContext: "Raised floors, shaded verandas and lightweight timber construction speak to tropical vernacular responses." },
  { id: "hdb-void-deck", name: "Void Deck", file: "hdb-voiddeck-v2.glb", category: "Homes & Neighbourhoods", intro: "An open ground floor made for movement, waiting and spontaneous gathering.", gameContext: "Offers a sheltered civic room beneath the residential block.", singaporeContext: "Void decks support circulation and many forms of communal use, from casual meetings to social functions.", historySource: SOURCES.hdb },
  { id: "kampong-props", name: "Kampong Details", file: "kampong-props-v2.glb", category: "Homes & Neighbourhoods", intro: "Small domestic details that make the timber neighbourhood feel inhabited.", gameContext: "Clusters story-rich props near the player rather than spending detail on distant surfaces.", singaporeContext: "Containers, plants and everyday repairs are treated as evidence of hands, weather and time." },

  { id: "airport-terminal", name: "Airport Terminal", file: "airport-terminal-v2.glb", category: "Culture & Landmarks", intro: "A sweeping terminal silhouette built to signal arrival from across the map.", gameContext: "Closes the eastern skyline with a major civic gateway.", singaporeContext: "Inspired by Singapore’s identity as a highly connected regional air hub.", inspiration: "Singapore’s airport architecture" },
  { id: "national-university", name: "National University", file: "national-university-v2.glb", category: "Culture & Landmarks", intro: "A campus landmark combining tropical shade with an academic silhouette.", gameContext: "Gives the education district a distinct western anchor.", singaporeContext: "A fictional campus inspired by Singapore’s long investment in tertiary education.", inspiration: "National University of Singapore" },
  { id: "technological-university", name: "Technological University", file: "technological-university-v2.glb", category: "Culture & Landmarks", intro: "A broad technology campus shaped around movement and greenery.", gameContext: "Creates a recognisable academic destination beyond the housing districts.", singaporeContext: "A fictional interpretation of a large, landscape-led Singapore campus.", inspiration: "Nanyang Technological University" },
  { id: "management-university", name: "Management University", file: "management-university-v2.glb", category: "Culture & Landmarks", intro: "An urban campus building that sits directly in the city’s flow.", gameContext: "Bridges the civic and commercial districts with a compact academic form.", singaporeContext: "Inspired by the idea of a university embedded in the city centre.", inspiration: "Singapore Management University" },
  { id: "design-university", name: "Design University", file: "design-university-v2.glb", category: "Culture & Landmarks", intro: "A crisp, contemporary campus assembled around collaborative space.", gameContext: "Adds a future-facing silhouette to the education collection.", singaporeContext: "A fictional design-and-technology campus inspired by Singapore’s interdisciplinary institutions.", inspiration: "Singapore University of Technology and Design" },
  { id: "national-school", name: "National School", file: "national-school-v2.glb", category: "Culture & Landmarks", intro: "A bright neighbourhood school with a simple, welcoming profile.", gameContext: "Places everyday learning infrastructure close to homes and transit.", singaporeContext: "Schools are treated as neighbourhood anchors rather than isolated compounds." },
  { id: "harbour-statue", name: "Harbour Statue", file: "harbour-statue-v2.glb", category: "Culture & Landmarks", intro: "A compact waterfront guardian with an unmistakable profile.", gameContext: "Provides a playful orientation point along the harbour edge.", singaporeContext: "Inspired by the Merlion, a lion-headed, fish-bodied icon conceived for Singapore and realised as a public sculpture in 1972.", inspiration: "The Merlion", historySource: SOURCES.merlion },
  { id: "skypark-hotel", name: "Skypark Hotel", file: "skypark-hotel-v2.glb", category: "Culture & Landmarks", intro: "Three towers joined by a dramatic horizontal crown.", gameContext: "Cuts a bold silhouette into the central skyline.", singaporeContext: "A fictionalised nod to the architecture around Marina Bay.", inspiration: "Marina Bay Sands" },
  { id: "singapore-flyer", name: "City Flyer", file: "flyer-v2.glb", category: "Culture & Landmarks", intro: "A giant observation wheel reduced to a clear, toy-like rhythm.", gameContext: "Adds scale and motion to the waterfront district.", singaporeContext: "Inspired by Singapore’s waterfront observation wheel.", inspiration: "Singapore Flyer" },
  { id: "supertree", name: "Supertree", file: "supertree-v2.glb", category: "Culture & Landmarks", intro: "A branching vertical garden that reads equally as tree and structure.", gameContext: "Carries the game’s tropical-futurist idea into the skyline.", singaporeContext: "Inspired by the Supertree Grove’s fusion of horticulture, infrastructure and spectacle.", inspiration: "Gardens by the Bay" },
  { id: "concert-hall", name: "Waterfront Concert Hall", file: "concert-hall-v2.glb", category: "Culture & Landmarks", intro: "A spiked, low-slung performing-arts form beside the water.", gameContext: "Gives the civic waterfront a textured silhouette distinct from offices and hotels.", singaporeContext: "A fictionalised homage to Singapore’s best-known waterfront performing-arts architecture.", inspiration: "Esplanade — Theatres on the Bay" },
  { id: "sultan-mosque", name: "Sultan Mosque", file: "sultan-mosque-v2.glb", category: "Culture & Landmarks", intro: "A golden-domed monument rendered with restraint and respect.", gameContext: "Anchors the heritage district with a strong, legible silhouette.", singaporeContext: "The national monument traces its roots to the royal mosque associated with Sultan Hussein Shah and the historic Muslim community of Kampong Gelam.", inspiration: "Sultan Mosque", historySource: SOURCES.sultanMosque },
  { id: "temple", name: "Neighbourhood Temple", file: "temple-v2.glb", category: "Culture & Landmarks", intro: "A layered roofline, lantern rhythm and ceremonial threshold.", gameContext: "Adds spiritual and architectural variety to the heritage streets.", singaporeContext: "A fictional composite that acknowledges the many temple traditions visible across Singapore without claiming to reproduce one site." },
  { id: "control-tower", name: "Control Tower", file: "controltower-v2.glb", category: "Culture & Landmarks", intro: "A slender aviation marker with a wide-eyed top.", gameContext: "Pairs with the terminal to make the airport district readable at a glance.", singaporeContext: "Its form celebrates the systems of coordination behind Singapore’s global connections." },

  { id: "mrt", name: "Kampung Central MRT", file: "mrt-v2.glb", category: "Transit & Movement", intro: "An enterable station pocket world with concourse, platform and train.", gameContext: "Lets players step out of the street world, ride below grade and return upstairs.", singaporeContext: "Singapore’s rail network grew from the 1980s into an integrated backbone connecting homes, work and public life.", historySource: SOURCES.transport },
  { id: "service-van", name: "Service Van", file: "service-van-v2.glb", category: "Transit & Movement", intro: "A compact workhorse built for quick movement between calls.", gameContext: "The player can enter, drive and park it across the neighbourhood.", singaporeContext: "It represents the mobile infrastructure of field service rather than a specific commercial fleet." },
  { id: "bus-stop", name: "Bus Stop", file: "busstop-v2.glb", category: "Transit & Movement", intro: "A familiar shelter reduced to roof, bench and route-facing edge.", gameContext: "Marks transit corridors and gives pedestrians a readable pause point.", singaporeContext: "Bus shelters belong to an integrated network that connects estates with rail and town centres.", historySource: SOURCES.transport },
  { id: "overhead-bridge", name: "Overhead Bridge", file: "overheadbridge-v2.glb", category: "Transit & Movement", intro: "A slim pedestrian crossing lifted above the traffic stream.", gameContext: "Clarifies road hierarchy and adds vertical movement to the streetscape.", singaporeContext: "A familiar piece of everyday pedestrian infrastructure, interpreted at miniature scale.", historySource: SOURCES.transport },
  { id: "bicycle", name: "Neighbourhood Bicycle", file: "bicycle-v2.glb", category: "Transit & Movement", intro: "Two wheels, one strong silhouette and just enough mechanical detail.", gameContext: "Adds quiet motion and human scale to shared streets.", singaporeContext: "Cycling appears here as an everyday link between home, transit and nearby amenities." },
  { id: "bumboat", name: "Bumboat", file: "bumboat-v2.glb", category: "Transit & Movement", intro: "A low wooden passenger boat with a bright, purposeful profile.", gameContext: "Moves across the harbour and keeps the waterfront from feeling static.", singaporeContext: "Its form nods to the workboats and passenger craft associated with Singapore’s river and offshore connections." },

  { id: "raintree", name: "Rain Tree", file: "raintree-v2.glb", category: "Street Life & Nature", intro: "A broad, flattened canopy made from clustered tropical greens.", gameContext: "Shapes shade, routes and landmarks while preserving the player silhouette.", singaporeContext: "The generous canopy is part of the visual memory of many Singapore roads and parks." },
  { id: "postbox", name: "Neighbourhood Postbox", file: "postbox-v2.glb", category: "Street Life & Nature", intro: "A bright civic object with an outsized role in wayfinding.", gameContext: "Used as a repeatable landmark near homes and public paths.", singaporeContext: "A small reminder of the communication systems that predate—and coexist with—the digital network." },
  { id: "bench", name: "Planter Bench", file: "bench-v2.glb", category: "Street Life & Nature", intro: "Seating and planting joined into one compact street object.", gameContext: "Creates rest points without cluttering movement space.", singaporeContext: "Combining greenery with everyday amenities reflects the city’s habit of making landscape infrastructural." },
  { id: "hawker", name: "Hawker Stall", file: "hawker-v2.glb", category: "Street Life & Nature", intro: "A compact food stall built around counter, canopy and human exchange.", gameContext: "Adds appetite, colour and social energy to the streets.", singaporeContext: "Hawker culture brings diverse food traditions and communal dining into accessible public settings.", historySource: SOURCES.hawker },
  { id: "palm", name: "Royal Palm", file: "palm-v2.glb", category: "Street Life & Nature", intro: "A tall tropical accent with a deliberately irregular crown.", gameContext: "Breaks the skyline and signals warmer waterfront spaces.", singaporeContext: "Used as a stylised landscape marker rather than a botanical specimen." },
  { id: "cat", name: "Community Cat", file: "cat-v2.glb", category: "Street Life & Nature", intro: "A tiny resident with enough attitude to stop the whole grid.", gameContext: "Adds surprise and tenderness at pavement level.", singaporeContext: "A playful nod to the cats encountered around many estates and shared spaces." },
  { id: "birdcage", name: "Birdcage", file: "birdcage-v2.glb", category: "Street Life & Nature", intro: "A delicate hanging object simplified into an ink-readable outline.", gameContext: "Rewards close looking around quieter corners of the neighbourhood.", singaporeContext: "Included as an observational detail, not a claim about any single community or period." },

  { id: "router-kit", name: "Router Kit", file: "router-kit-v2.glb", category: "Service Gear", intro: "Router, power and placement cues arranged as a readable task kit.", gameContext: "Supports the installation call and its final connection checks.", singaporeContext: "The domestic endpoint of a much larger national communications network." },
  { id: "fibre-kit", name: "Fibre Kit", file: "fibre-kit-v2.glb", category: "Service Gear", intro: "Drop cable, termination and test details made intentionally visible.", gameContext: "Turns an otherwise invisible optical fault into something the player can inspect.", singaporeContext: "A miniature study of the last metres that connect high-capacity networks to individual homes." },
  { id: "wifi-kit", name: "Wi-Fi Mesh Kit", file: "wifi-kit-v2.glb", category: "Service Gear", intro: "Three compact nodes designed for placement, range and line-of-sight decisions.", gameContext: "Forms the physical vocabulary of the mesh-deployment scenario.", singaporeContext: "Represents the indoor layer of connectivity shaped by walls, layouts and dense vertical living." },
];

export const GAME_ASSETS = sortAssetsByIconicLevel(seeds.map(buildAsset));
