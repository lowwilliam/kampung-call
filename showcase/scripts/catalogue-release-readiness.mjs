import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(siteRoot, "app", "data", "catalogue-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const asJson = process.argv.includes("--json");

const categories = new Map();
function add(code, owner, description, assetId = null) {
  const item = categories.get(code) ?? { code, owner, description, assets: [] };
  if (assetId) item.assets.push(assetId);
  categories.set(code, item);
}
function validDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
function validHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
function validHttps(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
function unresolvedStatus(value) {
  return typeof value !== "string" || /(?:^|[-_])(unreviewed|pending|unknown)(?:$|[-_])/i.test(value);
}
function evidenceRefsComplete(value) {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => entry?.id && validHash(entry?.hash));
}

for (const asset of manifest.assets ?? []) {
  if (asset.cardPreview?.status !== "ready" || !asset.cardPreview?.publicPath || !validHash(asset.cardPreview?.sha256)) {
    add("card-preview", "engineering", "Generate, visually review, and checksum-bind the current model preview.", asset.id);
  }
  if (asset.creatorCredit?.status !== "verified" || !asset.creatorCredit?.name) {
    add("creator-credit", "publisher", "Verify the actual creator identity and supporting evidence.", asset.id);
  }
  if (!asset.productionMethod || asset.productionMethod === "unverified") {
    add("production-method", "publisher", "Verify how the shipped model was produced from source records.", asset.id);
  }
  if (asset.evidenceStatus === "unreviewed") {
    add("editorial-evidence", "editorial-review", "Review factual and reconstruction claims against cited sources.", asset.id);
  }
  if (asset.publication?.status !== "published" || !validDate(asset.publication?.lastReviewedAt)) {
    add("publication-review", "publisher", "Approve the record and enter its actual review date.", asset.id);
  }
  if (unresolvedStatus(asset.rights?.ownership?.status) || !evidenceRefsComplete(asset.rights?.ownership?.evidenceRefs)) {
    add("ownership", "rights-review", "Establish ownership or licence from evidence outside the repository.", asset.id);
  }
  if (unresolvedStatus(asset.rights?.sourceMedia?.status) || !evidenceRefsComplete(asset.rights?.sourceMedia?.evidenceRefs)) {
    add("source-media", "rights-review", "Review the rights for photographs, plans, textures, and other source media.", asset.id);
  }
  if (unresolvedStatus(asset.rights?.subjectType)) {
    add("subject-classification", "rights-review", "Classify the depicted subject and applicable permissions.", asset.id);
  }
  if (asset.rights?.personRelease?.required === null || unresolvedStatus(asset.rights?.personRelease?.status) ||
      (asset.rights?.personRelease?.required === true && !evidenceRefsComplete(asset.rights?.personRelease?.evidenceRefs))) {
    add("person-release", "rights-review", "Decide whether a release is required and record evidence when it is.", asset.id);
  }
  if (asset.rights?.display?.status !== "cleared") {
    add("display-clearance", "rights-review", "Obtain asset-specific public display clearance.", asset.id);
  }
  if (!asset.rights?.display?.reviewedBy || !validDate(asset.rights?.display?.reviewedAt) || !validHash(asset.rights?.display?.evidenceHash)) {
    add("display-evidence", "rights-review", "Record reviewer, date, and private evidence-store hash.", asset.id);
  }
}

if (manifest.release?.status !== "published" || !validDate(manifest.release?.publishedAt)) {
  add("release-approval", "publisher", "Approve the final immutable release and enter its actual publication date.");
}
if (!validHttps(manifest.release?.productionDomain)) {
  add("production-domain", "publisher", "Confirm the real HTTPS production domain.");
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(manifest.release?.correctionsEmail ?? "")) {
  add("corrections-email", "publisher", "Create and verify the dedicated corrections address.");
}

const blockers = [...categories.values()].map((item) => ({
  ...item,
  count: item.assets.length || 1,
  assets: item.assets.sort(),
}));
const report = {
  schemaVersion: 1,
  manifestSha256: createHash("sha256").update(await readFile(manifestPath)).digest("hex"),
  releaseId: manifest.release?.id ?? null,
  ready: blockers.length === 0,
  blockerCategories: blockers.length,
  affectedChecks: blockers.reduce((sum, item) => sum + item.count, 0),
  blockers,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else if (report.ready) {
  console.log("[catalogue] Release readiness checks passed.");
} else {
  console.error(`[catalogue] Release blocked in ${report.blockerCategories} categories (${report.affectedChecks} affected checks).`);
  for (const blocker of blockers) {
    console.error(`- ${blocker.code}: ${blocker.count} (${blocker.owner}) — ${blocker.description}`);
  }
  console.error("Run `npm run catalogue:readiness -- --json` for the complete asset lists.");
}

if (!report.ready) process.exitCode = 1;
