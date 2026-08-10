import assert from "node:assert/strict";
import test from "node:test";

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
  assert.match(html, /The Kampung Call Collection/i);
  assert.match(html, /55 objects/i);
  assert.match(html, /Made in Singapore/i);
  assert.doesNotMatch(html, /Your site is taking shape/i);
});

test("server-renders submission and admin entry points", async () => {
  const [submit, admin] = await Promise.all([render("/submit"), render("/admin")]);
  assert.equal(submit.status, 200);
  assert.equal(admin.status, 200);
  assert.match(await submit.text(), /Add your piece(?:<br\/>)?of Singapore/i);
  assert.match(await admin.text(), /Opening the review room/i);
});
