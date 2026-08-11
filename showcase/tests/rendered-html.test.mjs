import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the public collection", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /3D Singapore/i);
  assert.match(html, /55 objects/i);
  assert.match(html, /Community/i);
  assert.match(html, /One model at a time/i);
  assert.doesNotMatch(html, /Download all/i);
  assert.doesNotMatch(html, /\/downloads\//i);
  assert.doesNotMatch(html, /asset-download-button/i);
  assert.match(html, /Peranakan House/i);
  assert.ok(html.indexOf("Peranakan House") < html.indexOf("Field Engineer"));
  assert.doesNotMatch(html, /Your site is taking shape/i);
});

test("offers an individual download only inside an original model detail page", async () => {
  const response = await render("/asset/peranakan-house");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /class="asset-download-link"/i);
  assert.match(html, /peranakan-house-v2\.glb/i);
  assert.doesNotMatch(html, /Download all/i);
  await access(path.join(siteRoot, "public", "models", "peranakan-house-v2.glb"));
});

test("server-renders submission and admin entry points", async () => {
  const [submit, admin] = await Promise.all([render("/submit"), render("/admin")]);
  assert.equal(submit.status, 200);
  assert.equal(admin.status, 200);
  assert.match(await submit.text(), /Add your piece(?:<br\/>)?of Singapore/i);
  assert.match(await admin.text(), /Opening the review room/i);
});
