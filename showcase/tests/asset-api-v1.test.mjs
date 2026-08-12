import assert from "node:assert/strict";
import test from "node:test";

async function request(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("asset-api-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "application/json" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("Asset API v1 lists namespaced game assets with permission-aware download URLs", async () => {
  const response = await request("/api/v1/assets?collection=game&limit=2");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-api-version"), "1");
  const payload = await response.json();
  assert.equal(payload.assets.length, 2);
  assert.equal(payload.pagination.total, 68);
  assert.match(payload.assets[0].id, /^game:/);
  assert.equal(payload.assets[0].downloadAllowed, true);
  assert.match(payload.assets[0].downloadUrl, /^http:\/\/localhost\/api\/v1\/assets\/game%3A.+\/download$/);
});

test("Asset API v1 publishes the Lost Heritage reconstructions", async () => {
  const detail = await request("/api/v1/assets/game%3Alost-national-theatre");
  assert.equal(detail.status, 200);
  const payload = await detail.json();
  assert.equal(payload.asset.name, "National Theatre");
  assert.equal(payload.asset.category, "Lost Heritage");
  assert.equal(payload.asset.fileName, "national-theatre.glb");
});

test("Asset API v1 resolves one asset and redirects its permitted download", async () => {
  const detail = await request("/api/v1/assets/game%3Aperanakan-house");
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).asset.fileName, "peranakan-house-v2.glb");

  const download = await request("/api/v1/assets/game%3Aperanakan-house/download");
  assert.equal(download.status, 307);
  assert.equal(download.headers.get("location"), "http://localhost/models/peranakan-house-v2.glb");
});
