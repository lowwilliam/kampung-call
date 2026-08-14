import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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
  assert.match(html, /Kampung 3D/i);
  assert.match(html.replaceAll("<!-- -->", ""), /68\s+objects/i);
  assert.doesNotMatch(html, /Community collection/i);
  assert.doesNotMatch(html, /Submit your model/i);
  assert.match(html, /asset-like-button/i);
  assert.equal((html.match(/class="model-viewer(?:\s|")/g) ?? []).length, 68);
  assert.doesNotMatch(html, /One model at a time/i);
  assert.doesNotMatch(html, /Buildings gone/i);
  assert.match(html, /Lost Heritage/i);
  assert.doesNotMatch(html, /Catalogue edition 01/i);
  assert.match(html, /collection-globe-fallback/i);
  assert.match(html, /Live 360° previews/i);
  assert.doesNotMatch(html, /three\.module-/i);
  assert.doesNotMatch(html, /Download all/i);
  assert.doesNotMatch(html, /\/downloads\//i);
  assert.doesNotMatch(html, /asset-download-button/i);
  assert.match(html, /Peranakan House/i);
  assert.ok(html.indexOf("Peranakan House") < html.indexOf("Field Engineer"));
  const categories = [...html.matchAll(/data-category="([^"]+)"/g)].map((match) => match[1]);
  const firstPerson = categories.indexOf("People");
  assert.ok(firstPerson > 0, "people should appear after non-people assets");
  assert.ok(categories.slice(firstPerson).every((item) => item === "People"), "people should remain at the back of the collection");
  assert.doesNotMatch(html, /Your site is taking shape/i);
});

test("uses the shared Kampung Call globe and lazy 3D viewers", async () => {
  const css = await readFile(path.join(siteRoot, "app", "globals.css"), "utf8");
  const source = await readFile(path.join(siteRoot, "app", "components", "CollectionApp.tsx"), "utf8");
  assert.match(css, /\.collection-intro\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.intro-side\s*\{[^}]*justify-items:\s*end/s);
  assert.match(source, /CollectionGlobe/);
  assert.match(source, /ModelViewer/);
  assert.match(source, /posterUrl=\{asset\.cardPreviewUrl\}/);
});

test("server-renders one standalone detail viewer with canonical asset metadata", async () => {
  const response = await render("/asset/peranakan-house?category=Homes%20%26%20Neighbourhoods&sort=alphabetical");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Peranakan House · Kampung 3D Collection<\/title>/i);
  assert.match(html, /rel="canonical" href="http:\/\/localhost:3000\/asset\/peranakan-house"/i);
  assert.equal((html.match(/class="model-viewer(?:\s|")/g) ?? []).length, 1);
  assert.match(html, /model-viewer-poster/i);
  assert.doesNotMatch(html, /class="asset-grid"/i);
  assert.match(html, /href="\/\?category=Homes\+%26\+Neighbourhoods&amp;sort=alphabetical#asset-peranakan-house"/i);
  assert.match(html, /class="asset-download-link"/i);
  assert.match(html, /Download GLB/i);
  assert.match(html, /detail-like-button/i);
  assert.doesNotMatch(html, /Download all/i);
  await access(path.join(siteRoot, "public", "models", "peranakan-house-v2.glb"));
});

test("server-renders a closed submission notice while preserving private admin recovery", async () => {
  const [submit, admin] = await Promise.all([render("/submit"), render("/admin")]);
  assert.equal(submit.status, 200);
  assert.equal(admin.status, 200);
  assert.match(await submit.text(), /Submissions are closed/i);
  assert.match(await admin.text(), /Opening the private inventory/i);
});

test("unknown asset slugs return a real 404", async () => {
  const response = await render("/asset/not-a-real-catalogue-asset");
  assert.equal(response.status, 404);
});

test("server-renders the CLI and terminal guide", async () => {
  const response = await render("/cli");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Command line \+ terminal/i);
  assert.match(html, /kampung-assets list --query heritage/i);
  assert.match(html, /game:lost-national-theatre/i);
  assert.match(html, /kampung-call-collection\.will-ai\.chatgpt\.site/i);
  assert.match(html, /npm run mcp/i);
  assert.doesNotMatch(html, /kampung-assets upload|replace_submission|withdraw_submission/i);
});
