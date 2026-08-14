import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AssetClient, AssetClientError } from "../tooling/asset-client.mjs";
import { main, parseArgs } from "../bin/kampung-assets.mjs";

const sampleAsset = {
  id: "game:test-model",
  slug: "test-model",
  name: "Test Model",
  collection: "game",
  category: "Service Gear",
  fileName: "test-model.glb",
  downloadAllowed: true,
};

async function mockApi() {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const body = Buffer.concat(await Array.fromAsync(request));
    requests.push({ method: request.method, url: request.url, headers: request.headers, body });
    const origin = `http://${request.headers.host}`;
    const url = new URL(request.url, origin);
    const decodedPath = decodeURIComponent(url.pathname);
    response.setHeader("content-type", "application/json");

    if (request.method === "GET" && url.pathname === "/api/v1/assets") {
      response.end(JSON.stringify({ assets: [{ ...sampleAsset, downloadUrl: `${origin}/files/test-model.glb` }], pagination: { total: 1, limit: 50, offset: 0, nextOffset: null } }));
    } else if (request.method === "GET" && decodedPath === "/api/v1/assets/game:test-model") {
      response.end(JSON.stringify({ asset: { ...sampleAsset, downloadUrl: `${origin}/files/test-model.glb` } }));
    } else if (request.method === "GET" && url.pathname === "/files/test-model.glb") {
      response.setHeader("content-type", "model/gltf-binary");
      response.end(Buffer.from("glTF-test"));
    } else {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "not found" }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("AssetClient lists, resolves and atomically downloads permitted assets", async (context) => {
  const api = await mockApi();
  context.after(api.close);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "kampung-assets-"));
  const client = new AssetClient({ baseUrl: api.baseUrl });
  const listed = await client.listAssets({ query: "test" });
  assert.equal(listed.assets[0].id, sampleAsset.id);
  const target = path.join(temporary, "nested", "download.glb");
  const result = await client.downloadAsset(sampleAsset.id, target);
  assert.equal(result.path, target);
  assert.equal(await readFile(target, "utf8"), "glTF-test");
});

test("AssetClient exposes no Community write or receipt-recovery methods", () => {
  const client = new AssetClient({ baseUrl: "http://localhost:1", fetchImpl: () => assert.fail("fetch should not run") });
  for (const method of ["uploadAsset", "getSubmission", "replaceSubmission", "withdrawSubmission"]) {
    assert.equal(client[method], undefined, `${method} must not be part of the public client`);
  }
});

test("CLI parsing and dispatch preserve namespaced asset IDs", async () => {
  assert.deepEqual(parseArgs(["download", "game:test", "-o", "model.glb", "--json"]), {
    flags: { output: "model.glb", json: true },
    positionals: ["download", "game:test"],
  });
  let call;
  const client = {
    async getAsset(assetId) {
      call = assetId;
      return sampleAsset;
    },
  };
  const originalWrite = process.stdout.write;
  process.stdout.write = () => true;
  try {
    await main(["get", "game:test-model", "--json"], { client });
  } finally {
    process.stdout.write = originalWrite;
  }
  assert.equal(call, "game:test-model");
});

test("CLI no longer exposes Community write commands", async () => {
  await assert.rejects(
    main(["upload", "model.glb"], { client: {} }),
    (error) => error instanceof AssetClientError && error.code === "usage_error" && /Unknown command/.test(error.message),
  );
});
