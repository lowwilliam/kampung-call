import { access, copyFile, cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameRoot = path.resolve(siteRoot, "..");
const manifestPath = path.join(siteRoot, "app", "data", "catalogue-manifest.json");
const publicRoot = path.resolve(process.env.CATALOGUE_SYNC_PUBLIC_ROOT ?? path.join(siteRoot, "public"));
if ([path.parse(publicRoot).root, siteRoot, gameRoot].includes(publicRoot)) throw new Error("Refusing unsafe Catalogue sync root");
const outputRoot = path.join(publicRoot, "models");
const previewOutput = path.join(publicRoot, "previews");
const dracoSource = path.join(siteRoot, "node_modules", "three", "examples", "jsm", "libs", "draco");
const dracoOutput = path.join(publicRoot, "draco");
const downloadOutput = path.join(publicRoot, "downloads");
const licenseOutput = path.join(publicRoot, "licenses");

await access(manifestPath);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.assets?.length !== 68) throw new Error(`Expected 68 manifested assets, found ${manifest.assets?.length ?? 0}`);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await rm(previewOutput, { recursive: true, force: true });
await mkdir(previewOutput, { recursive: true });
await rm(downloadOutput, { recursive: true, force: true });

let previewCount = 0;
await Promise.all(manifest.assets.map(async (asset) => {
  const modelSource = path.resolve(gameRoot, asset.model.sourcePath);
  const modelDestination = path.resolve(outputRoot, asset.model.file);
  if (!modelSource.startsWith(`${path.resolve(gameRoot, "assets")}${path.sep}`)) throw new Error(`${asset.id}: unsafe model source`);
  if (!modelDestination.startsWith(`${outputRoot}${path.sep}`)) throw new Error(`${asset.id}: unsafe model destination`);
  await mkdir(path.dirname(modelDestination), { recursive: true });
  await copyFile(modelSource, modelDestination);

  if (asset.cardPreview.sourcePath) {
    const previewSource = path.resolve(gameRoot, asset.cardPreview.sourcePath);
    const previewDestination = path.join(previewOutput, `${asset.slug}.png`);
    if (!previewSource.startsWith(`${path.resolve(gameRoot, "assets", "previews")}${path.sep}`)) {
      throw new Error(`${asset.id}: unsafe Card Preview source`);
    }
    await copyFile(previewSource, previewDestination);
    previewCount += 1;
  }
}));

await rm(dracoOutput, { recursive: true, force: true });
await cp(dracoSource, dracoOutput, { recursive: true });
await rm(licenseOutput, { recursive: true, force: true });
await mkdir(licenseOutput, { recursive: true });
await copyFile(path.join(gameRoot, "THIRD_PARTY_NOTICES.md"), path.join(licenseOutput, "THIRD_PARTY_NOTICES.md"));
await copyFile(path.join(siteRoot, "node_modules", "three", "LICENSE"), path.join(licenseOutput, "three-MIT.txt"));
await copyFile(path.join(gameRoot, "node_modules", "@pkgjs", "parseargs", "LICENSE"), path.join(licenseOutput, "draco-Apache-2.0.txt"));

console.log(`Synced ${manifest.assets.length} manifested GLBs and ${previewCount} checksum-bound Card Previews.`);
