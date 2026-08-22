const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2025-11-25", "2025-06-18", "2025-03-26"]);

const tools = [
  {
    name: "search_assets",
    title: "Search Kampung 3D Collection",
    description: "Search the public Kampung 3D catalogue and inspect each result's download permission.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 120, description: "Words from an asset name, category or description" },
        collection: { type: "string", enum: ["all", "game"], default: "all" },
        category: { type: "string", maxLength: 80 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "get_asset",
    title: "Get a Kampung 3D asset",
    description: "Read one public asset record, including provenance, checksum and Download Grant status.",
    inputSchema: {
      type: "object",
      properties: { assetId: { type: "string", minLength: 1, description: "Namespaced ID such as game:peranakan-house" } },
      required: ["assetId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "download_asset",
    title: "Get a licensed 3D asset download",
    description: "Return a download URL only when the asset has a cleared Download Grant.",
    inputSchema: {
      type: "object",
      properties: { assetId: { type: "string", minLength: 1, description: "Namespaced asset ID" } },
      required: ["assetId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

function jsonRpcResult(id, result) {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: { "cache-control": "no-store" } });
}

function jsonRpcError(id, code, message) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { headers: { "cache-control": "no-store" } });
}

function toolResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value };
}

function validateString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

async function requestJson(fetchImpl, origin, pathname) {
  const response = await fetchImpl(new URL(pathname, `${origin}/`), { headers: { accept: "application/json" } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Asset API returned HTTP ${response.status}`);
  return payload;
}

async function callTool(fetchImpl, origin, name, args = {}) {
  if (name === "search_assets") {
    const search = new URLSearchParams({
      collection: ["all", "game"].includes(args.collection) ? args.collection : "all",
      limit: String(Math.min(100, Math.max(1, Number(args.limit) || 50))),
      offset: String(Math.max(0, Number(args.offset) || 0)),
    });
    if (typeof args.query === "string" && args.query.trim()) search.set("q", args.query.trim().slice(0, 120));
    if (typeof args.category === "string" && args.category.trim()) search.set("category", args.category.trim().slice(0, 80));
    return requestJson(fetchImpl, origin, `/api/v1/assets?${search}`);
  }

  if (name === "get_asset" || name === "download_asset") {
    const assetId = validateString(args.assetId, "assetId");
    const payload = await requestJson(fetchImpl, origin, `/api/v1/assets/${encodeURIComponent(assetId)}`);
    if (name === "get_asset") return payload.asset;
    const asset = payload.asset;
    if (!asset.downloadAllowed || !asset.downloadUrl) {
      throw new Error("This asset is view-only; its creator has not granted download permission");
    }
    return {
      assetId: asset.id,
      name: asset.name,
      fileName: asset.fileName,
      contentType: asset.contentType,
      bytes: asset.fileSize,
      sha256: asset.modelSha256,
      downloadUrl: asset.downloadUrl,
    };
  }
  throw new Error(`Unknown tool: ${name}`);
}

export function createHostedMcpHandler({ fetchImpl = globalThis.fetch } = {}) {
  return {
    async fetch(request) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { allow: "POST, OPTIONS" } });
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST, OPTIONS" } });

      let message;
      try {
        message = await request.json();
      } catch {
        return jsonRpcError(null, -32700, "Parse error");
      }
      if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") return jsonRpcError(message?.id, -32600, "Invalid request");
      if (message.method === "server/discover") return new Response("Retry with initialize", { status: 404 });
      if (message.method === "notifications/initialized" || message.method.startsWith("notifications/")) return new Response(null, { status: 202 });

      if (message.method === "initialize") {
        const requested = message.params?.protocolVersion;
        return jsonRpcResult(message.id, {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.has(requested) ? requested : "2025-11-25",
          capabilities: { tools: {} },
          serverInfo: { name: "kampung-3d-collection", version: "1.0.0" },
          instructions: "Use search_assets to discover assets, then get_asset for a full record. download_asset returns a URL only when the catalogue has a cleared Download Grant.",
        });
      }
      if (message.method === "tools/list") return jsonRpcResult(message.id, { tools });
      if (message.method === "tools/call") {
        try {
          const value = await callTool(fetchImpl, new URL(request.url).origin, message.params?.name, message.params?.arguments);
          return jsonRpcResult(message.id, toolResult(value));
        } catch (error) {
          return jsonRpcResult(message.id, { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true });
        }
      }
      return jsonRpcError(message.id, -32601, `Method not found: ${message.method}`);
    },
    async close() {},
  };
}
