import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const downloadsRoot = path.join(siteRoot, "public", "downloads");
const modelsRoot = path.join(siteRoot, "public", "models");

test("keeps every manifested model available without publishing a mass-download archive", async () => {
  const manifest = JSON.parse(await readFile(path.join(siteRoot, "app", "data", "catalogue-manifest.json"), "utf8"));
  const modelFiles = manifest.assets.map((asset) => asset.model.file);
  assert.equal(modelFiles.length, 68);
  assert.equal(new Set(modelFiles).size, 68);
  await Promise.all(modelFiles.map((name) => access(path.join(modelsRoot, name))));
  await assert.rejects(access(downloadsRoot));
});
