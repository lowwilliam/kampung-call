import { createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const DEFAULT_SITE_URL = "https://kampung-call-collection.will-ai.chatgpt.site";

export class AssetClientError extends Error {
  constructor(message, { status = 0, code = "asset_client_error", details } = {}) {
    super(message);
    this.name = "AssetClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function safeFileName(value) {
  return String(value || "asset.glb").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset.glb";
}

export class AssetClient {
  constructor({ baseUrl = process.env.KAMPUNG_ASSET_API_URL || DEFAULT_SITE_URL, token = process.env.KAMPUNG_ASSET_API_TOKEN || "", fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== "function") throw new AssetClientError("This runtime does not provide fetch", { code: "missing_fetch" });
    this.baseUrl = new URL(baseUrl).href.replace(/\/$/, "");
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  headers(extra = {}) {
    const headers = new Headers(extra);
    headers.set("accept", "application/json");
    if (this.token) headers.set("authorization", `Bearer ${this.token}`);
    return headers;
  }

  async requestJson(pathname) {
    const response = await this.fetchImpl(new URL(pathname, `${this.baseUrl}/`), { headers: this.headers() });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AssetClientError(payload?.error || `Asset API returned HTTP ${response.status}`, {
        status: response.status,
        code: "api_error",
        details: payload,
      });
    }
    return payload;
  }

  async listAssets({ query = "", collection = "all", category = "", limit = 50, offset = 0 } = {}) {
    const search = new URLSearchParams({ collection, limit: String(limit), offset: String(offset) });
    if (query) search.set("q", query);
    if (category) search.set("category", category);
    return this.requestJson(`/api/v1/assets?${search}`);
  }

  async getAsset(id) {
    const payload = await this.requestJson(`/api/v1/assets/${encodeURIComponent(id)}`);
    return payload.asset;
  }

  async downloadAsset(id, outputPath = "") {
    const asset = await this.getAsset(id);
    if (!asset.downloadAllowed || !asset.downloadUrl) {
      throw new AssetClientError("This asset is view-only; its creator has not granted download permission", {
        status: 403,
        code: "download_not_allowed",
      });
    }
    const target = path.resolve(outputPath || safeFileName(asset.fileName));
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
    const response = await this.fetchImpl(asset.downloadUrl, { headers: this.headers({ accept: "model/gltf-binary" }), redirect: "follow" });
    if (!response.ok || !response.body) throw new AssetClientError(`Download failed with HTTP ${response.status}`, { status: response.status, code: "download_failed" });
    try {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: "wx" }));
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
    return { asset, path: target, bytes: (await stat(target)).size };
  }
}
