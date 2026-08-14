import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameRoot = path.resolve(siteRoot, "..");
const manifestPath = path.join(siteRoot, "app", "data", "catalogue-manifest.json");
const write = process.argv.includes("--write");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const changes = [];

async function integrity(filePath) {
  const bytes = await readFile(filePath);
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: (await stat(filePath)).size,
  };
}

for (const asset of manifest.assets) {
  const model = await integrity(path.join(gameRoot, asset.model.sourcePath));
  const modelChanged = model.sha256 !== asset.model.sha256 || model.byteLength !== asset.model.byteLength;
  if (modelChanged) {
    changes.push(`${asset.id}: model integrity changed`);
    asset.model.sha256 = model.sha256;
    asset.model.byteLength = model.byteLength;
    asset.publication.status = "draft";
    asset.publication.lastReviewedAt = null;
    asset.rights.display.status = "pending";
    asset.rights.display.reviewedBy = null;
    asset.rights.display.reviewedAt = null;
    asset.rights.display.evidenceHash = null;
    asset.rights.download.status = "blocked";
    asset.rights.download.reviewedBy = null;
    asset.rights.download.reviewedAt = null;
    asset.rights.download.evidenceHash = null;

  }

  if (asset.cardPreview.sourceModelSha256 !== asset.model.sha256) {
    changes.push(`${asset.id}: Card Preview invalidated by model integrity change`);
    asset.cardPreview.status = "missing";
    asset.cardPreview.sourcePath = null;
    asset.cardPreview.publicPath = null;
    asset.cardPreview.sourceModelSha256 = asset.model.sha256;
    asset.cardPreview.sha256 = null;
    asset.cardPreview.contentType = null;
  }

  if (asset.cardPreview.sourcePath) {
    const preview = await integrity(path.join(gameRoot, asset.cardPreview.sourcePath));
    if (preview.sha256 !== asset.cardPreview.sha256) {
      changes.push(`${asset.id}: Card Preview integrity changed`);
      asset.cardPreview.sha256 = preview.sha256;
      if (asset.cardPreview.status === "ready") asset.cardPreview.status = "legacy";
      asset.cardPreview.publicPath = null;
    }
  }
}

if (!changes.length) {
  console.log("[catalogue] Model and Card Preview integrity values are current.");
} else if (!write) {
  console.error("[catalogue] Integrity drift found; no files were changed:");
  for (const change of changes) console.error(`- ${change}`);
  console.error("Run `npm run catalogue:refresh-integrity -- --write` to update the draft and re-run review gates.");
  process.exitCode = 1;
} else {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[catalogue] Updated ${changes.length} integrity field${changes.length === 1 ? "" : "s"}; affected records were returned to draft review.`);
}
