import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archivePath = path.join(siteRoot, "public", "downloads", "kampung-call-3d-assets.zip");
const modelsRoot = path.join(siteRoot, "public", "models");

async function listFiles(root, prefix = "") {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, relative)));
    else files.push(relative);
  }
  return files;
}

function readArchiveEntries(archive) {
  let endOffset = archive.length - 22;
  while (endOffset >= Math.max(0, archive.length - 65_557) && archive.readUInt32LE(endOffset) !== 0x06054b50) {
    endOffset -= 1;
  }
  assert.ok(endOffset >= 0, "ZIP end-of-central-directory record is present");
  const entryCount = archive.readUInt16LE(endOffset + 10);
  let offset = archive.readUInt32LE(endOffset + 16);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(archive.readUInt32LE(offset), 0x02014b50, `central header ${index + 1} is valid`);
    const method = archive.readUInt16LE(offset + 10);
    const checksum = archive.readUInt32LE(offset + 16);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const size = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    assert.ok(!name.startsWith("/") && !name.split("/").includes(".."), `safe path: ${name}`);
    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50, `local header exists for ${name}`);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const data = archive.subarray(dataOffset, dataOffset + compressedSize);
    assert.equal(method, 0, `${name} uses the deterministic stored ZIP method`);
    assert.equal(compressedSize, size, `${name} has a complete byte count`);
    assert.equal(Number(crc32(data)) >>> 0, checksum, `${name} passes its CRC check`);
    entries.push({ name, data });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

test("download archive contains every canonical model and no unexpected assets", async () => {
  const archive = await readFile(archivePath);
  const entries = readArchiveEntries(archive);
  const prefix = "kampung-call-3d-assets/";
  const zippedModels = entries
    .filter((entry) => entry.name.endsWith(".glb"))
    .map((entry) => entry.name.slice(`${prefix}models/`.length))
    .sort();
  const publicModels = (await listFiles(modelsRoot)).filter((name) => name.endsWith(".glb")).sort();

  assert.equal(zippedModels.length, 55);
  assert.deepEqual(zippedModels, publicModels);
  assert.ok(zippedModels.every((name) => !name.includes("vendor") && !name.includes("threejsassets")));

  const manifestEntry = entries.find((entry) => entry.name === `${prefix}manifest.json`);
  assert.ok(manifestEntry, "archive includes a manifest");
  const manifest = JSON.parse(manifestEntry.data.toString("utf8"));
  assert.equal(manifest.assetCount, 55);
  assert.equal(manifest.assets.length, 55);
  assert.equal(new Set(manifest.assets.map((asset) => asset.file)).size, 55);
  assert.ok(manifest.assets.every((asset) => asset.source === "Made for Kampung Call"));
  assert.ok(manifest.exclusions.some((item) => /Community submissions/i.test(item)));
  assert.ok(manifest.exclusions.some((item) => /third-party/i.test(item)));
});
