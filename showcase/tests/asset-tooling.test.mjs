import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AssetClient, AssetClientError, normalizeReceipt } from "../tooling/asset-client.mjs";
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
    } else if (request.method === "POST" && url.pathname === "/api/v1/assets") {
      response.statusCode = 201;
      response.end(JSON.stringify({ submissionId: "sub-1", assetId: "community:sub-1", receiptUrl: "/receipt/secret", recoveryCode: "secret", status: "submitted", checks: [] }));
    } else if (request.method === "GET" && decodedPath === "/api/v1/submissions/secret") {
      response.end(JSON.stringify({ submission: { id: "sub-1", status: "submitted" } }));
    } else if (request.method === "PUT" && decodedPath === "/api/v1/submissions/secret") {
      response.end(JSON.stringify({ submission: { id: "sub-1", status: "submitted" }, checks: [] }));
    } else if (request.method === "DELETE" && decodedPath === "/api/v1/submissions/secret") {
      response.end(JSON.stringify({ withdrawn: true, status: "rejected" }));
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

test("AssetClient uploads, checks, replaces and withdraws with a recovery receipt", async (context) => {
  const api = await mockApi();
  context.after(api.close);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "kampung-assets-upload-"));
  const model = path.join(temporary, "model.glb");
  await writeFile(model, "glTF-test");
  const client = new AssetClient({ baseUrl: api.baseUrl });
  const uploaded = await client.uploadAsset(model, {
    displayName: "Test Model",
    contributorName: "Test Creator",
    description: "A model for tests",
    singaporeConnection: "Created in Singapore",
    sourceName: "Original work",
    allowDownload: true,
    rightsAttested: true,
  });
  assert.equal(uploaded.receiptUrl, `${api.baseUrl}/receipt/secret`);
  assert.match(api.requests.find((item) => item.method === "POST").headers["content-type"], /^multipart\/form-data; boundary=/);
  assert.match(api.requests.find((item) => item.method === "POST").body.toString(), /allowDownload[\s\S]*true/);
  assert.equal((await client.getSubmission("https://example.com/receipt/secret")).submission.status, "submitted");
  assert.equal((await client.replaceSubmission("secret", model)).submission.status, "submitted");
  assert.equal((await client.withdrawSubmission("secret")).withdrawn, true);
});

test("AssetClient rejects uploads without explicit rights", async () => {
  const client = new AssetClient({ baseUrl: "http://localhost:1", fetchImpl: () => assert.fail("fetch should not run") });
  await assert.rejects(
    client.uploadAsset("missing.glb", { displayName: "x" }),
    (error) => error instanceof AssetClientError && error.code === "invalid_metadata",
  );
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
  assert.equal(normalizeReceipt("https://assets.example/receipt/a%2Fb"), "a/b");
});
