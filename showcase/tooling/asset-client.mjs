import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export class AssetClientError extends Error {
  constructor(message, { status = 0, code = "asset_client_error", details } = {}) {
    super(message);
    this.name = "AssetClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function normalizeReceipt(value) {
  const input = String(value ?? "").trim();
  if (!input) throw new AssetClientError("A recovery receipt is required", { code: "missing_receipt" });
  try {
    const url = new URL(input);
    const match = url.pathname.match(/\/receipt\/([^/]+)\/?$/);
    return decodeURIComponent(match?.[1] ?? input);
  } catch {
    const match = input.match(/(?:^|\/)receipt\/([^/?#]+)/);
    return decodeURIComponent(match?.[1] ?? input);
  }
}

export function safeFileName(value) {
  return String(value || "asset.glb").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset.glb";
}

async function uploadBlob(filePath) {
  const resolved = path.resolve(filePath);
  const fileStat = await stat(resolved).catch(() => null);
  if (!fileStat?.isFile()) throw new AssetClientError(`File not found: ${resolved}`, { code: "file_not_found" });
  if (!resolved.toLowerCase().endsWith(".glb")) throw new AssetClientError("Only .glb files can be uploaded", { code: "invalid_file_type" });
  if (fileStat.size > MAX_UPLOAD_BYTES) throw new AssetClientError("The GLB must be 20 MB or smaller", { code: "file_too_large" });
  const bytes = await readFile(resolved);
  return { blob: new Blob([bytes], { type: "model/gltf-binary" }), name: path.basename(resolved), size: fileStat.size };
}

function requiredMetadata(metadata) {
  const required = ["displayName", "contributorName", "description", "singaporeConnection", "sourceName"];
  const missing = required.filter((key) => !String(metadata?.[key] ?? "").trim());
  if (missing.length) {
    throw new AssetClientError(`Missing upload metadata: ${missing.join(", ")}`, { code: "invalid_metadata" });
  }
  if (metadata.rightsAttested !== true) {
    throw new AssetClientError("Upload requires an explicit rights attestation", { code: "rights_required" });
  }
}

export class AssetClient {
  constructor({ baseUrl = process.env.KAMPUNG_ASSET_API_URL || "http://localhost:3000", token = process.env.KAMPUNG_ASSET_API_TOKEN || "", fetchImpl = globalThis.fetch } = {}) {
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

  resolve(pathname) {
    return new URL(pathname, `${this.baseUrl}/`).href;
  }

  async requestJson(pathname, init = {}) {
    const response = await this.fetchImpl(this.resolve(pathname), { ...init, headers: this.headers(init.headers) });
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text.slice(0, 500) };
      }
    }
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

  async uploadAsset(filePath, metadata) {
    requiredMetadata(metadata);
    const file = await uploadBlob(filePath);
    const form = new FormData();
    form.set("model", file.blob, file.name);
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null) form.set(key, String(value));
    }
    form.set("rightsAttested", "true");
    form.set("allowDownload", String(metadata.allowDownload === true));
    form.set("website", "");
    const payload = await this.requestJson("/api/v1/assets", { method: "POST", body: form });
    return {
      ...payload,
      receiptUrl: payload.receiptUrl ? this.resolve(payload.receiptUrl) : null,
      uploadedFile: { path: path.resolve(filePath), name: file.name, size: file.size },
    };
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
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      throw new AssetClientError(text || `Download failed with HTTP ${response.status}`, {
        status: response.status,
        code: "download_failed",
      });
    }
    try {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: "wx" }));
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
    const downloaded = await stat(target);
    return { asset, path: target, bytes: downloaded.size };
  }

  async getSubmission(receipt) {
    return this.requestJson(`/api/v1/submissions/${encodeURIComponent(normalizeReceipt(receipt))}`);
  }

  async replaceSubmission(receipt, filePath) {
    const file = await uploadBlob(filePath);
    const form = new FormData();
    form.set("model", file.blob, file.name);
    const payload = await this.requestJson(`/api/v1/submissions/${encodeURIComponent(normalizeReceipt(receipt))}`, {
      method: "PUT",
      body: form,
    });
    return { ...payload, uploadedFile: { path: path.resolve(filePath), name: file.name, size: file.size } };
  }

  async withdrawSubmission(receipt) {
    return this.requestJson(`/api/v1/submissions/${encodeURIComponent(normalizeReceipt(receipt))}`, { method: "DELETE" });
  }
}
