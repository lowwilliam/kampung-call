import assert from "node:assert/strict";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const downloadsRoot = path.join(siteRoot, "public", "downloads");
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

test("keeps individual models available without publishing a mass-download archive", async () => {
  const modelFiles = (await listFiles(modelsRoot)).filter((name) => name.endsWith(".glb"));
  assert.equal(modelFiles.length, 55);
  await Promise.all(modelFiles.map((name) => access(path.join(modelsRoot, name))));
  await assert.rejects(access(downloadsRoot));
});
