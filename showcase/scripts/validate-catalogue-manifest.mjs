import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameRoot = path.resolve(siteRoot, "..");
const manifestPath = path.join(siteRoot, "app", "data", "catalogue-manifest.json");
const releaseMode = process.argv.includes("--release");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const errors = [];
const categories = new Set([
  "Lost Heritage",
  "Homes & Neighbourhoods",
  "Culture & Landmarks",
  "Transit & Movement",
  "Street Life & Nature",
  "Service Gear",
  "People",
]);
const displayStatuses = new Set(["pending", "cleared", "blocked", "legal-review", "permission-pending"]);
const downloadStatuses = new Set(["cleared", "blocked", "legal-review", "permission-pending"]);

function fail(message) {
  errors.push(message);
}

function validUrl(value, protocols = ["https:"]) {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function evidenceHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

if (manifest.schemaVersion !== 1) fail("schemaVersion must be 1");
if (manifest.release?.catalogueSize !== 68) fail("release.catalogueSize must be 68");
if (manifest.release?.catalogueSize !== manifest.assets?.length) fail("release.catalogueSize must match assets.length");
if (!Array.isArray(manifest.assets) || manifest.assets.length !== 68) {
  fail(`assets must contain exactly 68 records; found ${manifest.assets?.length ?? "none"}`);
}

const seenIds = new Set();
const seenSlugs = new Set();
const seenFiles = new Set();
const seenOrders = new Set();

for (const [index, asset] of (manifest.assets ?? []).entries()) {
  const ref = asset.id || `asset[${index}]`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.id ?? "")) fail(`${ref}: invalid id`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.slug ?? "")) fail(`${ref}: invalid slug`);
  if (seenIds.has(asset.id)) fail(`${ref}: duplicate id`);
  if (seenSlugs.has(asset.slug)) fail(`${ref}: duplicate slug`);
  if (seenFiles.has(asset.model?.file)) fail(`${ref}: duplicate model file`);
  if (seenOrders.has(asset.curatedOrder)) fail(`${ref}: duplicate curatedOrder`);
  seenIds.add(asset.id);
  seenSlugs.add(asset.slug);
  seenFiles.add(asset.model?.file);
  seenOrders.add(asset.curatedOrder);

  if (asset.curatedOrder !== index + 1) fail(`${ref}: curatedOrder must match manifest order`);
  if (!categories.has(asset.category)) fail(`${ref}: invalid category`);
  if (!asset.locale?.en?.name || !asset.locale?.en?.intro) fail(`${ref}: English name and intro are required`);
  if (!asset.model?.sourcePath?.startsWith("assets/") || !asset.model?.publicPath?.startsWith("/models/")) {
    fail(`${ref}: invalid model paths`);
  }
  if (!evidenceHash(asset.model?.sha256)) fail(`${ref}: invalid model sha256`);
  if (asset.model?.sourcePath !== `assets/${asset.model?.file}` || asset.model?.publicPath !== `/models/${asset.model?.file}`) {
    fail(`${ref}: model file, sourcePath and publicPath must identify the same GLB`);
  }
  if (asset.cardPreview?.sourceModelSha256 !== asset.model?.sha256) {
    fail(`${ref}: Card Preview is not tied to the current model checksum`);
  }

  try {
    const modelPath = path.join(gameRoot, asset.model.sourcePath);
    const bytes = await readFile(modelPath);
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    const modelStat = await stat(modelPath);
    if (actualHash !== asset.model.sha256) fail(`${ref}: model checksum drift`);
    if (modelStat.size !== asset.model.byteLength) fail(`${ref}: model byteLength drift`);
  } catch (error) {
    fail(`${ref}: model file unavailable (${error.message})`);
  }

  if (asset.cardPreview?.sourcePath) {
    try {
      const previewBytes = await readFile(path.join(gameRoot, asset.cardPreview.sourcePath));
      const actualPreviewHash = createHash("sha256").update(previewBytes).digest("hex");
      if (actualPreviewHash !== asset.cardPreview.sha256) fail(`${ref}: Card Preview checksum drift`);
    } catch (error) {
      fail(`${ref}: Card Preview unavailable (${error.message})`);
    }
  } else if (asset.cardPreview?.sha256 !== null) {
    fail(`${ref}: Card Preview hash exists without a sourcePath`);
  }
  if (asset.cardPreview?.status === "ready" && !asset.cardPreview?.publicPath) {
    fail(`${ref}: ready Card Preview requires a publicPath`);
  }

  for (const source of asset.sources ?? []) {
    if (!source.label || !validUrl(source.url)) fail(`${ref}: source must have a label and HTTPS URL`);
  }

  if (!displayStatuses.has(asset.rights?.display?.status)) fail(`${ref}: invalid Display Clearance status`);
  if (!downloadStatuses.has(asset.rights?.download?.status)) fail(`${ref}: invalid Download Grant status`);

  if (releaseMode) {
    if (asset.cardPreview?.status !== "ready") fail(`${ref}: release requires a ready Card Preview`);
    if (!asset.cardPreview?.publicPath || !evidenceHash(asset.cardPreview?.sha256)) {
      fail(`${ref}: release Card Preview path/hash missing`);
    }
    if (asset.creatorCredit?.status !== "verified" || !asset.creatorCredit?.name) {
      fail(`${ref}: release requires verified Creator Credit`);
    }
    if (!asset.productionMethod || asset.productionMethod === "unverified") {
      fail(`${ref}: release requires a verified Production Method`);
    }
    if (asset.evidenceStatus === "unreviewed") fail(`${ref}: Evidence Status is unreviewed`);
    if (asset.publication?.status !== "published" || !validDate(asset.publication?.lastReviewedAt)) {
      fail(`${ref}: release requires published status and last review date`);
    }
    if (asset.rights?.ownership?.status === "unreviewed") fail(`${ref}: ownership is unreviewed`);
    if (asset.rights?.sourceMedia?.status === "unreviewed") fail(`${ref}: source-media rights are unreviewed`);
    if (asset.rights?.subjectType === "unreviewed") fail(`${ref}: subject type is unreviewed`);
    if (asset.rights?.display?.status !== "cleared") fail(`${ref}: Display Clearance is not cleared`);
    if (!asset.rights?.display?.reviewedBy || !validDate(asset.rights?.display?.reviewedAt) || !evidenceHash(asset.rights?.display?.evidenceHash)) {
      fail(`${ref}: Display Clearance evidence is incomplete`);
    }
    if (asset.rights?.download?.status === "cleared") {
      const download = asset.rights.download;
      if (!download.license || !download.scope || !download.reviewedBy || !validDate(download.reviewedAt) || !evidenceHash(download.evidenceHash)) {
        fail(`${ref}: cleared Download Grant is incomplete`);
      }
    }
    if (asset.id === "harbour-statue" && (asset.rights?.display?.status === "cleared" || asset.rights?.download?.status === "cleared")) {
      const stbPermission = (asset.rights.statutoryPermissions ?? []).some((item) => item.authority === "Singapore Tourism Board" && item.status === "cleared");
      if (!stbPermission) fail(`${ref}: documented STB permission is required before display or download clearance`);
    }
  }
}

if (manifest.release?.responsiblePublisher?.name !== "William Liu") {
  fail("release.responsiblePublisher.name must be William Liu");
}
if (manifest.release?.responsiblePublisher?.profileUrl !== "https://www.linkedin.com/in/ruiqian-liu/") {
  fail("release.responsiblePublisher.profileUrl is not the approved profile");
}

if (releaseMode) {
  if (manifest.release?.status !== "published") fail("release.status must be published in --release mode");
  if (!validDate(manifest.release?.publishedAt)) fail("release.publishedAt is required in --release mode");
  if (!validUrl(manifest.release?.productionDomain)) fail("a real HTTPS productionDomain is required in --release mode");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(manifest.release?.correctionsEmail ?? "")) {
    fail("a dedicated correctionsEmail is required in --release mode");
  }
}

if (errors.length) {
  console.error(`[catalogue] ${errors.length} validation error${errors.length === 1 ? "" : "s"}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`[catalogue] ${manifest.assets.length} draft records validated${releaseMode ? " for release" : ""}.`);
}
