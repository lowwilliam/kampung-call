import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameRoot = path.resolve(siteRoot, "..");
const auditPath = path.join(gameRoot, "world", "asset-audit.json");
const outputRoot = path.join(siteRoot, "public", "models");
const dataRoot = path.join(siteRoot, "app", "data");
const dracoSource = path.join(siteRoot, "node_modules", "three", "examples", "jsm", "libs", "draco");
const dracoOutput = path.join(siteRoot, "public", "draco");
const downloadOutput = path.join(siteRoot, "public", "downloads");

const ARCHIVE_ROOT = "kampung-call-3d-assets";
const ARCHIVE_NAME = "kampung-call-3d-assets.zip";
const ZIP_TIME = 0;
const ZIP_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function assertArchivePath(name) {
  const normalized = name.replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe archive path: ${name}`);
  }
  return normalized;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(assertArchivePath(entry.name));
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const checksum = Number(crc32(data)) >>> 0;
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(ZIP_TIME, 10);
    localHeader.writeUInt16LE(ZIP_DATE, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(ZIP_TIME, 12);
    centralHeader.writeUInt16LE(ZIP_DATE, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

await access(auditPath);
const audit = JSON.parse(await readFile(auditPath, "utf8"));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await rm(downloadOutput, { recursive: true, force: true });
await mkdir(downloadOutput, { recursive: true });

const metrics = {};
const downloadableAssets = [];
const archiveModels = [];
for (const item of audit.manifest) {
  const relative = item.url.replace(/^assets\//, "");
  const source = path.join(gameRoot, item.url);
  const destination = path.join(outputRoot, relative);
  const model = await readFile(source);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, model);
  metrics[item.url] = {
    triangles: item.triangles,
    materials: item.materials,
    meshCount: item.meshCount,
    compressed: item.compressed,
    dimensions: item.dimensions,
  };
  downloadableAssets.push({
    id: item.name,
    file: relative,
    archivePath: `${ARCHIVE_ROOT}/models/${relative}`,
    bytes: model.length,
    triangles: item.triangles,
    materials: item.materials,
    meshCount: item.meshCount,
    compressed: item.compressed,
    source: "Made for Kampung Call",
  });
  archiveModels.push({ name: `${ARCHIVE_ROOT}/models/${relative}`, data: model });
}

const downloadManifest = {
  schemaVersion: 1,
  collection: "The Kampung Call Collection",
  scope: "Canonical 3D assets shipped with Kampung Call",
  assetCount: downloadableAssets.length,
  totalModelBytes: downloadableAssets.reduce((sum, item) => sum + item.bytes, 0),
  format: "GLB",
  provenance: "Made for Kampung Call",
  rights: "Files are provided for personal evaluation and project review. Downloading does not grant permission to redistribute, resell or reuse them in another project.",
  exclusions: [
    "Community submissions, whose contributor agreement currently grants display rights but not redistribution rights.",
    "Optional third-party vendor-library assets, which are excluded unless licensed files are present in the canonical shipping manifest.",
  ],
  assets: downloadableAssets,
};
const manifestText = `${JSON.stringify(downloadManifest, null, 2)}\n`;
const readmeText = `THE KAMPUNG CALL COLLECTION — 3D ASSET DOWNLOAD\n\nThis archive contains all ${downloadableAssets.length} canonical GLB assets shipped with Kampung Call, plus a machine-readable manifest.\n\nPROVENANCE\nMade for Kampung Call. Optional third-party vendor-library placeholders are not included because licensed vendor files are not present in the canonical shipping manifest. Community submissions are not included because their current contributor agreement grants display rights, not redistribution rights.\n\nRIGHTS\nThese files are provided for personal evaluation and project review. Downloading does not grant permission to redistribute, resell or reuse them in another project.\n\nCONTENTS\n- models/ — ${downloadableAssets.length} GLB files\n- manifest.json — filenames, byte sizes, geometry metrics and provenance\n`;
const archive = createStoredZip([
  { name: `${ARCHIVE_ROOT}/README.txt`, data: readmeText },
  { name: `${ARCHIVE_ROOT}/manifest.json`, data: manifestText },
  ...archiveModels,
]);
await writeFile(path.join(downloadOutput, ARCHIVE_NAME), archive);
await writeFile(path.join(downloadOutput, "kampung-call-3d-assets-manifest.json"), manifestText);

await rm(dracoOutput, { recursive: true, force: true });
await cp(dracoSource, dracoOutput, { recursive: true });
await mkdir(dataRoot, { recursive: true });
await writeFile(
  path.join(dataRoot, "asset-metrics.json"),
  `${JSON.stringify(metrics, null, 2)}\n`,
);

console.log(`Synced ${audit.manifest.length} canonical GLB assets and built ${ARCHIVE_NAME} for the showcase.`);
