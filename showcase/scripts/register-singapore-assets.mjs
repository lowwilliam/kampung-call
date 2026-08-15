import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameRoot = path.resolve(siteRoot, "..");
const manifestPath = path.join(siteRoot, "app", "data", "catalogue-manifest.json");
const metricsPath = path.join(gameRoot, "research", "img2threejs", "singapore-assets", "reviews", "final-metrics.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const metrics = JSON.parse(await readFile(metricsPath, "utf8"));

const definitions = [
  {
    id: "smooth-coated-otter",
    name: "Smooth-coated Otter",
    category: "Street Life & Nature",
    intro: "A sleek river otter with webbed paws, buff throat and a long flattened tail.",
    gameContext: "Adds a recognisable waterside wildlife encounter to canals, reservoirs and park connectors.",
    singaporeContext: "Smooth-coated otters are native Singapore residents now often seen along urban waterways and coastal habitats.",
    inspiration: "Singapore's smooth-coated otters",
    source: { label: "NParks — Smooth-coated Otter", url: "https://biodiversitysg.nparks.gov.sg/our-biodiversity/mammals/other-mammals/smooth-coated-otter/" },
    disclosure: "The far-side anatomy, underside and exact tail cross-section were inferred from limited photographic views.",
  },
  {
    id: "red-junglefowl",
    name: "Red Junglefowl",
    category: "Street Life & Nature",
    intro: "A vivid wild rooster with orange hackles, white ear patch and green-black sickle tail.",
    gameContext: "Brings movement and familiar dawn-call character to forest edges and neighbourhood greens.",
    singaporeContext: "The native red junglefowl can be distinguished from many domestic hybrids by traits including slate-grey legs and a white ear patch.",
    inspiration: "Singapore's native red junglefowl",
    source: { label: "NParks — What is that red bird?", url: "https://www.nparks.gov.sg/publications-resources/articles/what-is-that-red-bird" },
    disclosure: "This is a stylised male; exact feather count, far-side layering and individual plumage variation are inferred.",
  },
  {
    id: "oriental-pied-hornbill",
    name: "Oriental Pied Hornbill",
    category: "Street Life & Nature",
    intro: "A black-and-white hornbill defined by its pale bill and prominent black-tipped casque.",
    gameContext: "Creates a bold canopy silhouette and an unmistakable Singapore wildlife landmark at readable game scale.",
    singaporeContext: "The Oriental Pied Hornbill is Singapore's most commonly encountered hornbill and a notable urban biodiversity recovery story.",
    inspiration: "Singapore's Oriental Pied Hornbill",
    source: { label: "NParks — Oriental Pied Hornbill", url: "https://biodiversitysg.nparks.gov.sg/our-biodiversity/birds/other-birds/oriental-pied-hornbill/" },
    disclosure: "The dorsal plumage, rear casque curvature and exact tail-feather overlap are inferred from the available views.",
  },
  {
    id: "clouded-monitor",
    name: "Clouded Monitor",
    category: "Street Life & Nature",
    intro: "A sturdy grey-brown monitor lizard with yellow cloud-like spots, splayed feet and tapering tail.",
    gameContext: "Adds ground-level wildlife to forest paths, drains and park-edge scenes without an excessive triangle budget.",
    singaporeContext: "Clouded monitors occur in Singapore's wooded habitats and are distinguished by yellow spotting and a rounder tail than the Malayan water monitor.",
    inspiration: "Singapore's clouded monitor",
    source: { label: "NParks — Clouded Monitor", url: "https://biodiversitysg.nparks.gov.sg/our-biodiversity/reptiles/lizards/clouded-monitor/" },
    disclosure: "The full tail tip, underside scale pattern and far-side limb pose are inferred; raised spots are a stylised game-readable treatment.",
  },
  {
    id: "singapore-cable-car-skyorb",
    name: "Singapore Cable Car SkyOrb",
    category: "Transit & Movement",
    intro: "A chrome spherical cable-car cabin with circular glazing, glass floor and illuminated window ring.",
    gameContext: "Supplies a distinctive aerial-transit landmark for Mount Faber and Sentosa-facing scenes.",
    singaporeContext: "The SkyOrb joined the Singapore Cable Car fleet in 2024 as a chrome-finished spherical cabin with a glass floor and lighted window rings.",
    inspiration: "Mount Faber Leisure Group's SkyOrb cabin",
    source: { label: "Mount Faber Leisure Group — SkyOrb Cable Car Cabin", url: "https://mountfaberleisure.com/attraction/skyorb-cable-car-cabin/" },
    disclosure: "This is an unbranded stylised reconstruction; rear-door geometry, underside hardware and inaccessible dimensions remain approximate.",
    industrialDesign: true,
  },
];

async function integrity(filePath) {
  const bytes = await readFile(filePath);
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: (await stat(filePath)).size,
  };
}

function pendingRights(industrialDesign = false) {
  return {
    subjectType: industrialDesign ? "branded-industrial-design" : "natural-world",
    ownership: { status: "unreviewed", copyrightOwner: null, basis: null, evidenceRefs: [] },
    sourceMedia: { status: "reference-only-unreviewed", evidenceRefs: [] },
    trademarkChecks: industrialDesign ? [{ subject: "SkyOrb", status: "legal-review" }] : [],
    statutoryPermissions: [],
    personRelease: { required: false, status: "not-required", scope: null, evidenceRefs: [] },
    display: {
      status: industrialDesign ? "legal-review" : "pending",
      basis: null,
      reviewedBy: null,
      reviewedAt: null,
      evidenceHash: null,
    },
    download: {
      status: "blocked",
      license: null,
      scope: null,
      excludedThirdPartyRights: industrialDesign ? ["SkyOrb name and cabin industrial design"] : [],
      reviewedBy: null,
      reviewedAt: null,
      evidenceHash: null,
    },
  };
}

manifest.assets = manifest.assets.filter((asset) => !definitions.some((definition) => definition.id === asset.id));
for (const definition of definitions) {
  const modelFile = `${definition.id}-v1.glb`;
  const modelSourcePath = `assets/${modelFile}`;
  const previewSourcePath = `assets/previews/${definition.id}-v1.png`;
  const modelIntegrity = await integrity(path.join(gameRoot, modelSourcePath));
  const previewIntegrity = await integrity(path.join(gameRoot, previewSourcePath));
  const assetMetrics = metrics[definition.id];
  if (!assetMetrics) throw new Error(`Missing final metrics for ${definition.id}`);
  const order = manifest.assets.length + 1;
  manifest.assets.push({
    id: definition.id,
    slug: definition.id,
    category: definition.category,
    curatedOrder: order,
    locale: {
      en: {
        name: definition.name,
        intro: definition.intro,
        gameContext: definition.gameContext,
        singaporeContext: definition.singaporeContext,
        productionStory: `Reference-led procedural Three.js construction with Blender CLI mesh repair and refinement. ${assetMetrics.meshes} named meshes, ${assetMetrics.materials} materials and ${assetMetrics.triangles.toLocaleString("en-US")} triangles. ${definition.disclosure}`,
        inspiration: definition.inspiration,
      },
    },
    model: {
      file: modelFile,
      sourcePath: modelSourcePath,
      publicPath: `/models/${modelFile}`,
      sha256: modelIntegrity.sha256,
      byteLength: modelIntegrity.byteLength,
      contentType: "model/gltf-binary",
    },
    cardPreview: {
      status: "ready",
      sourcePath: previewSourcePath,
      publicPath: `/previews/${definition.id}.png`,
      sourceModelSha256: modelIntegrity.sha256,
      sha256: previewIntegrity.sha256,
      contentType: "image/png",
    },
    creatorCredit: { status: "unverified", name: null, url: null },
    adapters: [],
    productionMethod: "Reference-led procedural Three.js with Blender CLI refinement",
    provenance: {
      label: "Made for Kampung Call",
      detail: `Built from an admitted primary reference, documented species or product cues, strict img2threejs sculpt specification and eight-angle Blender review. ${definition.disclosure}`,
    },
    sources: [{ kind: "model-reference", ...definition.source }],
    evidenceStatus: "mixed",
    metrics: {
      triangles: assetMetrics.triangles,
      materials: assetMetrics.materials,
      meshCount: assetMetrics.meshes,
      compressed: true,
      dimensions: assetMetrics.dimensions,
    },
    publication: { status: "draft", lastReviewedAt: "2026-08-15T02:46:00.000Z" },
    rights: pendingRights(definition.industrialDesign),
    withdrawn: null,
  });
}

const registeredIds = new Set(definitions.map((definition) => definition.id));
const registered = new Map(manifest.assets.filter((asset) => registeredIds.has(asset.id)).map((asset) => [asset.id, asset]));
const ordered = manifest.assets.filter((asset) => !registeredIds.has(asset.id));
const transitIndex = ordered.findIndex((asset) => asset.id === "service-van");
ordered.splice(transitIndex + 1, 0, registered.get("singapore-cable-car-skyorb"));
const natureIndex = ordered.findIndex((asset) => asset.id === "palm");
ordered.splice(
  natureIndex + 1,
  0,
  registered.get("smooth-coated-otter"),
  registered.get("red-junglefowl"),
  registered.get("oriental-pied-hornbill"),
  registered.get("clouded-monitor"),
);
manifest.assets = ordered;
manifest.assets.forEach((asset, index) => { asset.curatedOrder = index + 1; });
manifest.release.catalogueSize = manifest.assets.length;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[catalogue] registered ${definitions.length} Singapore nature/transit assets; total ${manifest.assets.length}`);
