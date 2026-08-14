import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("app/data/catalogue-manifest.json", siteRoot), "utf8"));

test("Catalogue Manifest is the ordered authority for exactly 68 assets", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.release.catalogueSize, 68);
  assert.equal(manifest.assets.length, 68);
  assert.equal(new Set(manifest.assets.map((asset) => asset.id)).size, 68);
  assert.equal(new Set(manifest.assets.map((asset) => asset.slug)).size, 68);
  assert.deepEqual(manifest.assets.map((asset) => asset.curatedOrder), Array.from({ length: 68 }, (_, index) => index + 1));
});

test("draft downloads fail closed until each Download Grant is cleared", () => {
  for (const asset of manifest.assets) {
    assert.notEqual(asset.rights.download.status, "cleared", `${asset.id} must not claim an unreviewed Download Grant`);
    assert.equal(asset.rights.download.license, null);
    assert.equal(asset.rights.download.evidenceHash, null);
  }
});

test("Responsible Publisher identity is explicit and separate from Creator Credit", () => {
  assert.deepEqual(manifest.release.responsiblePublisher, {
    name: "William Liu",
    profileUrl: "https://www.linkedin.com/in/ruiqian-liu/",
  });
  assert.ok(manifest.assets.every((asset) => asset.creatorCredit.status === "unverified"));
});

test("catalogue validator accepts the checked-in draft without integrity drift", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-catalogue-manifest.mjs"], {
    cwd: new URL(siteRoot).pathname,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /68 draft records validated/);
});

test("runtime catalogue is derived from the Manifest instead of parallel seed arrays", async () => {
  const source = await readFile(new URL("app/data/game-assets.ts", siteRoot), "utf8");
  const collectionSource = await readFile(new URL("app/components/CollectionApp.tsx", siteRoot), "utf8");
  const syncSource = await readFile(new URL("scripts/sync-game-assets.mjs", siteRoot), "utf8");
  assert.match(source, /import catalogueManifestJson from "\.\/catalogue-manifest\.json"/);
  assert.doesNotMatch(source, /lostHeritageSeeds|const gameAssetSeeds|const GAME_ASSETS\s*=\s*\[/);
  assert.doesNotMatch(collectionSource, /ModelViewer|CollectionGlobe|\/api\/likes|\/api\/assets/);
  assert.doesNotMatch(collectionSource, /GAME_ASSETS|CATALOGUE_MANIFEST|catalogue-manifest\.json/);
  assert.match(syncSource, /catalogue-manifest\.json/);
  assert.doesNotMatch(syncSource, /asset-audit\.json/);
});

test("historical Community inventory cannot mutate or purge stored records", async () => {
  const [adminRoute, adminPortal, loginRoute, modelRoute, receiptRoute] = await Promise.all([
    readFile(new URL("app/api/admin/submissions/route.ts", siteRoot), "utf8"),
    readFile(new URL("app/components/AdminPortal.tsx", siteRoot), "utf8"),
    readFile(new URL("app/api/admin/login/route.ts", siteRoot), "utf8"),
    readFile(new URL("app/api/admin/model/route.ts", siteRoot), "utf8"),
    readFile(new URL("app/api/submissions/status/route.ts", siteRoot), "utf8"),
  ]);
  assert.match(adminRoute, /communityInventoryReadOnlyResponse/);
  assert.doesNotMatch(adminRoute, /purgeExpiredModels|ensureSchema|ASSET_BUCKET\.(?:put|delete)|\bUPDATE\s+submissions\b|\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(adminPortal, /method:\s*["']PATCH["']|\bconst\s+update\s*=|void\s+update\s*\(/);
  assert.doesNotMatch(loginRoute, /ensureSchema|addAudit|bindings\(\)|DB\.prepare/);
  assert.doesNotMatch(modelRoute, /ensureSchema|ASSET_BUCKET\.(?:put|delete)/);
  assert.doesNotMatch(receiptRoute, /ensureSchema|DB\.prepare\(\s*["'`](?:INSERT|UPDATE|DELETE)\b/i);
});

test("threejsassets scenery slots are separate, source-variant-aware records", async () => {
  const registry = JSON.parse(await readFile(new URL("../world/vendor-assets.json", siteRoot), "utf8"));
  const components = Object.values(registry.assets);
  assert.equal(registry.recordType, "scenery-component-registry");
  assert.equal(registry.collectionAsset, false);
  assert.equal(components.length, 20);
  assert.equal(new Set(components.map((component) => `${component.pack}/${component.file}`)).size, 20);
  assert.ok(components.every((component) => component.displayName && component.fallbackImplementation));
  assert.equal(registry.sourceVariants["threejsassets-licensed-glb"].standaloneRedistributionAllowed, false);
});
