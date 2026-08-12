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
  assert.match(html, /3D Singapore/i);
  assert.match(html.replaceAll("<!-- -->", ""), /68\s+objects/i);
  assert.match(html, /Community/i);
  assert.doesNotMatch(html, /One model at a time/i);
  assert.match(html, /Buildings gone/i);
  assert.match(html, /National Theatre/i);
  assert.match(html, /Lost Heritage/i);
  assert.match(html, /Move the globe/i);
  assert.match(html, /collection-globe-fallback/i);
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

test("keeps the movable globe in the right-hand hero column", async () => {
  const css = await readFile(path.join(siteRoot, "app", "globals.css"), "utf8");
  assert.match(css, /\.collection-intro\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.intro-side\s*\{[^}]*justify-items:\s*end/s);
  assert.match(css, /\.collection-globe\s*\{[^}]*cursor:\s*grab/s);
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

test("server-renders the CLI and terminal guide", async () => {
  const response = await render("/cli");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Command line \+ terminal/i);
  assert.match(html, /kampung-assets list --query heritage/i);
  assert.match(html, /game:lost-national-theatre/i);
  assert.match(html, /kampung-call-collection\.will-ai\.chatgpt\.site/i);
  assert.match(html, /npm run mcp/i);
});
