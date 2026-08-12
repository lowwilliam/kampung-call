import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("publishes the approved revised GLB bytes", async () => {
  const [releaseHashes, heritageHashes] = await Promise.all([
    readFile(path.join(siteRoot, "app", "data", "release-model-hashes.json"), "utf8"),
    readFile(path.join(siteRoot, "app", "data", "heritage-model-hashes.json"), "utf8"),
  ]);
  const expected = { ...JSON.parse(releaseHashes), ...JSON.parse(heritageHashes) };

  for (const [fileName, expectedHash] of Object.entries(expected)) {
    const bytes = await readFile(path.join(siteRoot, "public", "models", fileName));
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    assert.equal(actualHash, expectedHash, `${fileName} must be the approved revised asset`);
  }
});
