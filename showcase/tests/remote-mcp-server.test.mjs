import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createHostedMcpHandler } from "../mcp/remote-server.mjs";

test("the hosted Streamable HTTP MCP endpoint exposes the public catalogue tools", async (context) => {
  const asset = {
    id: "game:peranakan-house",
    name: "Peranakan House",
    downloadAllowed: false,
    downloadUrl: null,
  };
  const apiFetch = async (input) => {
    const url = new URL(input);
    if (url.pathname === "/api/v1/assets") {
      return Response.json({ assets: [asset], pagination: { total: 1, limit: 50, offset: 0, nextOffset: null } });
    }
    if (decodeURIComponent(url.pathname) === "/api/v1/assets/game:peranakan-house") {
      return Response.json({ asset });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  };
  const hostedMcp = createHostedMcpHandler({ fetchImpl: apiFetch });
  const transport = new StreamableHTTPClientTransport(new URL("https://collection.example/mcp"), {
    fetch: (input, init) => hostedMcp.fetch(new Request(input, init)),
  });
  const client = new Client({ name: "hosted-mcp-test", version: "1.0.0" });
  context.after(async () => {
    await client.close();
    await hostedMcp.close();
  });

  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), ["download_asset", "get_asset", "search_assets"]);
  assert.ok(listed.tools.every((tool) => tool.annotations?.readOnlyHint === true));

  const result = await client.callTool({ name: "get_asset", arguments: { assetId: asset.id } });
  assert.equal(result.structuredContent.id, asset.id);
});
