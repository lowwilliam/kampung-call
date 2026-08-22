import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameRoot = path.resolve(siteRoot, "..");
const manifestPath = path.join(siteRoot, "app", "data", "catalogue-manifest.json");
const previewRoot = path.join(gameRoot, "assets", "previews", "catalogue");
const write = process.argv.includes("--write");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.assets?.length !== 74) {
  throw new Error(`Expected 74 catalogue assets, found ${manifest.assets?.length ?? 0}`);
}

const accepted = [];
for (const asset of manifest.assets) {
  const fileName = `${asset.slug}.webp`;
  const absolutePath = path.join(previewRoot, fileName);
  const bytes = await readFile(absolutePath);
  const details = await stat(absolutePath);
  if (!details.isFile() || details.size < 1_024) {
    throw new Error(`${asset.id}: generated Card Preview is missing or unexpectedly small`);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  accepted.push({ asset, fileName, sha256 });
}

if (!write) {
  console.log(`[catalogue] ${accepted.length} generated Card Previews are complete and ready to accept.`);
  console.log("Run `npm run catalogue:accept-previews -- --write` after visual review.");
  process.exit(0);
}

for (const { asset, fileName, sha256 } of accepted) {
  asset.cardPreview = {
    status: "ready",
    sourcePath: `assets/previews/catalogue/${fileName}`,
    publicPath: `/previews/${asset.slug}.png`,
    sourceModelSha256: asset.model.sha256,
    sha256,
    contentType: "image/webp",
  };
  asset.publication.status = "draft";
  asset.publication.lastReviewedAt = null;
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[catalogue] Accepted ${accepted.length} checksum-bound Card Previews; publication records remain in draft review.`);
