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
  const server = new McpServer({ name: "kampung-call-assets", version: "0.1.0" });

  server.registerTool(
    "search_assets",
    {
      title: "Search 3D assets",
      description: "List or search published Kampung Call and community 3D assets, including download permissions.",
      inputSchema: z.object({
        query: z.string().max(120).optional().describe("Free-text search across names, categories, descriptions and creators"),
        collection: z.enum(["all", "game", "community"]).default("all"),
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
      description: "Get metadata, provenance, model URL and download permission for one namespaced asset ID.",
      inputSchema: z.object({ assetId: z.string().min(1).describe("For example game:peranakan-house or community:<uuid>") }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ assetId }) => toolResult(await client.getAsset(assetId)),
  );

  server.registerTool(
    "download_asset",
    {
      title: "Download 3D asset",
      description: "Download one permitted GLB to a local path inside KAMPUNG_ASSET_ROOTS. View-only community assets are rejected.",
      inputSchema: z.object({
        assetId: z.string().min(1),
        outputPath: z.string().min(1).describe("Local destination path, including the .glb filename"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ assetId, outputPath }) => {
      const policy = await pathPolicyPromise;
      return toolResult(await client.downloadAsset(assetId, await policy.writable(outputPath)));
    },
  );

  server.registerTool(
    "upload_asset",
    {
      title: "Upload 3D asset",
      description: "Submit one local self-contained GLB for review. Returns the private recovery receipt used for later status, replacement or withdrawal.",
      inputSchema: z.object({
        filePath: z.string().min(1),
        displayName: z.string().min(1).max(80),
        contributorName: z.string().min(1).max(80),
        description: z.string().min(1).max(800),
        singaporeConnection: z.string().min(1).max(800),
        sourceName: z.string().min(1).max(160),
        sourceUrl: z.string().url().max(500).optional(),
        category: z.string().max(80).default("Street Life & Nature"),
        linkedinUrl: z.string().url().max(300).optional(),
        displayLinkedin: z.boolean().default(false),
        allowDownload: z.boolean().default(false).describe("Explicitly allow individual downloads after publication"),
        confirmRights: z.literal(true).describe("Must be true to attest ownership or permission to submit"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ filePath, confirmRights, ...metadata }) => {
      const policy = await pathPolicyPromise;
      return toolResult(await client.uploadAsset(await policy.readable(filePath), { ...metadata, rightsAttested: confirmRights }));
    },
  );

  server.registerTool(
    "get_submission",
    {
      title: "Get submission status",
      description: "Use a private recovery receipt to inspect moderation and validation status.",
      inputSchema: z.object({ receipt: z.string().min(1) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ receipt }) => toolResult(await client.getSubmission(receipt)),
  );

  server.registerTool(
    "replace_submission",
    {
      title: "Replace submitted GLB",
      description: "Replace the GLB attached to a recoverable submission and return it to review.",
      inputSchema: z.object({ receipt: z.string().min(1), filePath: z.string().min(1) }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ receipt, filePath }) => {
      const policy = await pathPolicyPromise;
      return toolResult(await client.replaceSubmission(receipt, await policy.readable(filePath)));
    },
  );

  server.registerTool(
    "withdraw_submission",
    {
      title: "Withdraw submission",
      description: "Unpublish or reject a submission and schedule its stored model for deletion. Requires explicit confirmation.",
      inputSchema: z.object({ receipt: z.string().min(1), confirm: z.literal(true) }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ receipt }) => toolResult(await client.withdrawSubmission(receipt)),
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
