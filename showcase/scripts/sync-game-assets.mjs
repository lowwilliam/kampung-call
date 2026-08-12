import { access, copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameRoot = path.resolve(siteRoot, "..");
const auditPath = path.join(gameRoot, "world", "asset-audit.json");
const outputRoot = path.join(siteRoot, "public", "models");
const dataRoot = path.join(siteRoot, "app", "data");
const dracoSource = path.join(siteRoot, "node_modules", "three", "examples", "jsm", "libs", "draco");
const dracoOutput = path.join(siteRoot, "public", "draco");
const downloadOutput = path.join(siteRoot, "public", "downloads");

await access(auditPath);
const audit = JSON.parse(await readFile(auditPath, "utf8"));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await rm(downloadOutput, { recursive: true, force: true });

const metrics = {};
await Promise.all(audit.manifest.map(async (item) => {
  const relative = item.url.replace(/^assets\//, "");
  const source = path.join(gameRoot, item.url);
  const destination = path.join(outputRoot, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  metrics[item.url] = {
    triangles: item.triangles,
    materials: item.materials,
    meshCount: item.meshCount,
    compressed: item.compressed,
    dimensions: item.dimensions,
  };
}));

await rm(dracoOutput, { recursive: true, force: true });
await cp(dracoSource, dracoOutput, { recursive: true });
await mkdir(dataRoot, { recursive: true });
await writeFile(
  path.join(dataRoot, "asset-metrics.json"),
  `${JSON.stringify(metrics, null, 2)}\n`,
);

console.log(`Synced ${audit.manifest.length} canonical GLB assets for individual detail-page downloads.`);
