import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameRoot = path.resolve(siteRoot, "..");
const manifestPath = path.join(siteRoot, "app", "data", "catalogue-manifest.json");
const auditPath = path.join(gameRoot, "review-shots", "satellite-final-audit", "audit.json");
const modelPath = path.join(gameRoot, "assets", "satellite-station-v2.glb");
const previewPath = path.join(gameRoot, "assets", "previews", "satellite-station-v2.png");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const audit = JSON.parse(await readFile(auditPath, "utf8")).assets
  .find((entry) => entry.path === "assets/satellite-station-v2.glb");
if (!audit?.runtimeReady || !audit?.componentReady) {
  throw new Error("Satellite Station must pass runtime and component audits before registration");
}

const hash = async (filePath) => createHash("sha256").update(await readFile(filePath)).digest("hex");
const modelHash = await hash(modelPath);
const previewHash = await hash(previewPath);
const [width, depth, height] = audit.stats.dimensions;
const template = manifest.assets.find((asset) => asset.id === "control-tower");
if (!template) throw new Error("Missing control-tower rights template");

const record = {
  id: "satellite-station",
  slug: "satellite-station",
  category: "Culture & Landmarks",
  curatedOrder: 0,
  locale: {
    en: {
      name: "Satellite Earth Station",
      intro: "A complete communications compound with two tracking dishes, equipment hut, masts and a permanent site slab.",
      gameContext: "Promotes the satellite district from an embedded world vignette to a reusable, inspectable building asset.",
      singaporeContext: "A stylised celebration of the satellite earth stations and international telecommunications infrastructure that connected Singapore globally.",
      productionStory: `${audit.stats.meshes} named meshes, ${audit.stats.materials} palette material and ${audit.stats.triangles.toLocaleString("en-US")} triangles. Rebuilt in Blender from the existing in-world dish and equipment-hut ensemble, grounded, Draco-compressed and verified from four angles.`,
      inspiration: "Singapore telecommunications earth-station infrastructure",
    },
  },
  model: {
    file: "satellite-station-v2.glb",
    sourcePath: "assets/satellite-station-v2.glb",
    publicPath: "/models/satellite-station-v2.glb",
    sha256: modelHash,
    byteLength: (await stat(modelPath)).size,
    contentType: "model/gltf-binary",
  },
  cardPreview: {
    status: "ready",
    sourcePath: "assets/previews/satellite-station-v2.png",
    publicPath: "/previews/satellite-station.png",
    sourceModelSha256: modelHash,
    sha256: previewHash,
    contentType: "image/png",
  },
  creatorCredit: { status: "unverified", name: null, url: null },
  adapters: [],
  productionMethod: "Procedural Blender reconstruction from the shipped Three.js world ensemble",
  provenance: {
    label: "Made for Kampung Call",
    detail: "Promoted from the existing satellite-district world geometry into a grounded, named-part standalone asset.",
  },
  sources: [],
  evidenceStatus: "artistic-interpretation",
  metrics: {
    triangles: audit.stats.triangles,
    materials: audit.stats.materials,
    meshCount: audit.stats.meshes,
    compressed: true,
    dimensions: { width, height, depth },
  },
  publication: { status: "draft", lastReviewedAt: null },
  rights: structuredClone(template.rights),
  withdrawn: null,
};

manifest.assets = manifest.assets.filter((asset) => asset.id !== record.id);
const controlTowerIndex = manifest.assets.findIndex((asset) => asset.id === "control-tower");
manifest.assets.splice(controlTowerIndex + 1, 0, record);
manifest.assets.forEach((asset, index) => { asset.curatedOrder = index + 1; });
manifest.release.catalogueSize = manifest.assets.length;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[catalogue] registered Satellite Earth Station; total ${manifest.assets.length}`);
