import assert from "node:assert/strict";
import test from "node:test";

async function request(pathname, init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("asset-api-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { ...init, headers: { accept: "application/json", ...init.headers } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("Asset API v1 lists namespaced catalogue assets and fails closed on downloads", async () => {
  const response = await request("/api/v1/assets?collection=game&limit=2");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-api-version"), "1");
  const payload = await response.json();
  assert.equal(payload.assets.length, 2);
  assert.equal(payload.pagination.total, 68);
  assert.match(payload.assets[0].id, /^game:/);
  assert.equal(payload.assets[0].downloadAllowed, false);
  assert.equal(payload.assets[0].downloadUrl, null);
  assert.match(payload.assets[0].modelSha256, /^[a-f0-9]{64}$/);
  assert.equal(payload.assets[0].downloadStatus, "blocked");
  assert.deepEqual(payload.assets[0].responsiblePublisher, {
    name: "William Liu",
    profileUrl: "https://www.linkedin.com/in/ruiqian-liu/",
  });
});

test("Asset API v1 publishes the Lost Heritage reconstructions", async () => {
  const detail = await request("/api/v1/assets/game%3Alost-national-theatre");
  assert.equal(detail.status, 200);
  const payload = await detail.json();
  assert.equal(payload.asset.name, "National Theatre");
  assert.equal(payload.asset.category, "Lost Heritage");
  assert.equal(payload.asset.fileName, "national-theatre.glb");
});

test("Asset API v1 resolves one asset and denies its uncleared download", async () => {
  const detail = await request("/api/v1/assets/game%3Aperanakan-house");
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).asset.fileName, "peranakan-house-v2.glb");

  const download = await request("/api/v1/assets/game%3Aperanakan-house/download");
  assert.equal(download.status, 403);
  assert.deepEqual(await download.json(), { error: "This asset does not have a cleared Download Grant" });
});

test("public Community submission endpoints are retired without touching storage", async () => {
  const responses = await Promise.all([
    request("/api/assets"),
    request("/api/models/legacy-id"),
    request("/api/reports", { method: "POST" }),
    request("/api/submissions", { method: "POST" }),
    request("/api/submissions/status", { method: "POST" }),
  ]);
  assert.ok(responses.every((response) => response.status === 410));
  for (const response of responses) {
    assert.match((await response.json()).error, /read-only/i);
  }

  const legacyCollection = await request("/api/v1/assets?collection=community");
  assert.equal(legacyCollection.status, 400);
  assert.deepEqual(await legacyCollection.json(), { error: "collection must be one of: all, game" });
});
