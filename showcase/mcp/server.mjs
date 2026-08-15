#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod/v4";
import { AssetClient } from "../tooling/asset-client.mjs";
import { createPathPolicy } from "../tooling/path-policy.mjs";

function toolResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

export function buildMcpServer({ client = new AssetClient(), pathPolicyPromise = createPathPolicy() } = {}) {
  const server = new McpServer({ name: "kampung-call-assets", version: "0.2.0" });

  server.registerTool(
    "search_assets",
    {
      title: "Search 3D assets",
      description: "List or search the 73 manifested Kampung Call assets, including download permissions.",
      inputSchema: z.object({
        query: z.string().max(120).optional().describe("Free-text search across names, categories and descriptions"),
        collection: z.enum(["all", "game"]).default("all"),
        category: z.string().max(80).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, collection, category, limit, offset }) => toolResult(await client.listAssets({ query, collection, category, limit, offset })),
  );

  server.registerTool(
    "get_asset",
    {
      title: "Get 3D asset",
      description: "Get metadata, provenance, model checksum and download permission for one namespaced asset ID.",
      inputSchema: z.object({ assetId: z.string().min(1).describe("For example game:peranakan-house") }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ assetId }) => toolResult(await client.getAsset(assetId)),
  );

  server.registerTool(
    "download_asset",
    {
      title: "Download licensed asset",
      description: "Download one asset with a cleared Download Grant to a local path inside KAMPUNG_ASSET_ROOTS.",
      inputSchema: z.object({
        assetId: z.string().min(1),
        outputPath: z.string().min(1).describe("Local destination path for the licensed package"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ assetId, outputPath }) => {
      const policy = await pathPolicyPromise;
      return toolResult(await client.downloadAsset(assetId, await policy.writable(outputPath)));
    },
  );

  return server;
}

export function startStdioServer() {
  const handle = serveStdio(() => buildMcpServer(), {
    onerror: (error) => console.error(`kampung-call-assets MCP error: ${error.message}`),
  });
  console.error("kampung-call-assets MCP server listening on stdio");
  return handle;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) startStdioServer();
