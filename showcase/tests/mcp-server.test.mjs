import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { buildMcpServer } from "../mcp/server.mjs";

test("MCP server exposes asset discovery and transfer tools over the official protocol", async (context) => {
  const fakeClient = {
    async getAsset(assetId) {
      return { id: assetId, name: "Peranakan House", downloadAllowed: true };
    },
    async listAssets() {
      return { assets: [], pagination: { total: 0, limit: 50, offset: 0, nextOffset: null } };
    },
  };
  const server = buildMcpServer({ client: fakeClient, pathPolicyPromise: Promise.resolve({}) });
  const client = new Client({ name: "asset-tooling-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  context.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const listed = await client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name).sort(),
    ["download_asset", "get_asset", "get_submission", "replace_submission", "search_assets", "upload_asset", "withdraw_submission"],
  );
  const result = await client.callTool({ name: "get_asset", arguments: { assetId: "game:peranakan-house" } });
  assert.equal(result.structuredContent.id, "game:peranakan-house");
});
