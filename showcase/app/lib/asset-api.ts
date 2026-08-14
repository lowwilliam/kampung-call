import { GAME_ASSETS, type CollectionAsset } from "../data/game-assets";

export type AssetCollection = "game";

export type PublicAsset = {
  id: string;
  slug: string;
  name: string;
  collection: AssetCollection;
  category: string;
  description: string;
  singaporeConnection: string;
  creator: string | null;
  responsiblePublisher: { name: string; profileUrl: string } | null;
  sourceName: string;
  sourceUrl: string | null;
  fileName: string;
  fileSize: number | null;
  contentType: "model/gltf-binary";
  viewUrl: string;
  downloadAllowed: boolean;
  downloadUrl: string | null;
  modelSha256: string | null;
  displayClearance: string | null;
  downloadStatus: string | null;
  downloadLicense: string | null;
  metrics: {
    triangles: number;
    materials: number;
    meshes: number;
    animations: number;
    compressed: boolean;
  };
  publishedAt: string | null;
};

function absolute(request: Request, pathname: string) {
  return new URL(pathname, request.url).href;
}

function apiDownloadPath(id: string) {
  return `/api/v1/assets/${encodeURIComponent(id)}/download`;
}

function catalogueAsset(request: Request, asset: CollectionAsset): PublicAsset {
  const id = `game:${asset.id}`;
  return {
    id,
    slug: asset.slug,
    name: asset.name,
    collection: "game",
    category: asset.category,
    description: asset.intro,
    singaporeConnection: asset.singaporeContext,
    creator: asset.creator ?? null,
    responsiblePublisher: asset.responsiblePublisher ?? null,
    sourceName: asset.provenance,
    sourceUrl: asset.historySource?.url ?? null,
    fileName: asset.file.split("/").at(-1) ?? `${asset.slug}.glb`,
    fileSize: asset.modelByteLength ?? null,
    contentType: "model/gltf-binary",
    viewUrl: absolute(request, asset.modelUrl),
    downloadAllowed: Boolean(asset.downloadAllowed),
    downloadUrl: asset.downloadAllowed ? absolute(request, apiDownloadPath(id)) : null,
    modelSha256: asset.modelSha256 ?? null,
    displayClearance: asset.rights?.display.status ?? null,
    downloadStatus: asset.rights?.download.status ?? null,
    downloadLicense: asset.rights?.download.license ?? null,
    metrics: {
      triangles: asset.metrics.triangles,
      materials: asset.metrics.materials,
      meshes: asset.metrics.meshCount,
      animations: 0,
      compressed: asset.metrics.compressed,
    },
    publishedAt: asset.publication?.status === "published" ? asset.publication.lastReviewedAt : null,
  };
}

function matches(asset: PublicAsset, query: string, category: string) {
  if (category && asset.category.toLowerCase() !== category.toLowerCase()) return false;
  if (!query) return true;
  return `${asset.name} ${asset.slug} ${asset.category} ${asset.description} ${asset.creator ?? ""}`.toLowerCase().includes(query);
}

export async function listPublicAssets(request: Request) {
  const url = new URL(request.url);
  const collection = url.searchParams.get("collection") ?? "all";
  if (!new Set(["all", "game"]).has(collection)) {
    throw new AssetApiError(400, "collection must be one of: all, game");
  }
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 120);
  const category = (url.searchParams.get("category") ?? "").trim().slice(0, 80);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const filtered = GAME_ASSETS.map((asset) => catalogueAsset(request, asset)).filter((asset) => matches(asset, query, category));
  const assets = filtered.slice(offset, offset + limit);
  return {
    assets,
    pagination: {
      total: filtered.length,
      limit,
      offset,
      nextOffset: offset + assets.length < filtered.length ? offset + assets.length : null,
    },
  };
}

export async function findPublicAsset(request: Request, rawId: string) {
  const id = decodeURIComponent(rawId);
  const [collection, localId] = id.split(":", 2);
  if (collection !== "game" || !localId) return null;
  const asset = GAME_ASSETS.find((item) => item.id === localId || item.slug === localId);
  return asset ? catalogueAsset(request, asset) : null;
}

export class AssetApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function assetApiError(error: unknown) {
  const status = error instanceof AssetApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Asset API request failed";
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export function safeDownloadName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset.glb";
}
