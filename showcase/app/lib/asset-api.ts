import { GAME_ASSETS, type CollectionAsset } from "../data/game-assets";

export type AssetCollection = "game" | "community";

export type PublicAsset = {
  id: string;
  slug: string;
  name: string;
  collection: AssetCollection;
  category: string;
  description: string;
  singaporeConnection: string;
  creator: string;
  sourceName: string;
  sourceUrl: string | null;
  fileName: string;
  fileSize: number | null;
  contentType: "model/gltf-binary";
  viewUrl: string;
  downloadAllowed: boolean;
  downloadUrl: string | null;
  metrics: {
    triangles: number;
    materials: number;
    meshes: number;
    animations: number;
    compressed: boolean;
  };
  publishedAt: string | null;
};

type CommunityRow = {
  id: string;
  slug: string;
  display_name: string;
  contributor_name: string;
  description: string;
  singapore_connection: string;
  source_name: string;
  source_url: string | null;
  category: string;
  file_name: string;
  file_size: number;
  triangle_count: number;
  material_count: number;
  animation_count: number;
  mesh_count: number;
  download_allowed: number;
  public_file_key: string | null;
  published_at: string | null;
};

function absolute(request: Request, pathname: string) {
  return new URL(pathname, request.url).href;
}

function apiDownloadPath(id: string) {
  return `/api/v1/assets/${encodeURIComponent(id)}/download`;
}

function originalAsset(request: Request, asset: CollectionAsset): PublicAsset {
  const id = `game:${asset.id}`;
  return {
    id,
    slug: asset.slug,
    name: asset.name,
    collection: "game",
    category: asset.category,
    description: asset.intro,
    singaporeConnection: asset.singaporeContext,
    creator: "Kampung Call",
    sourceName: asset.provenance,
    sourceUrl: asset.historySource?.url ?? null,
    fileName: asset.file.split("/").at(-1) ?? `${asset.slug}.glb`,
    fileSize: null,
    contentType: "model/gltf-binary",
    viewUrl: absolute(request, asset.modelUrl),
    downloadAllowed: true,
    downloadUrl: absolute(request, apiDownloadPath(id)),
    metrics: {
      triangles: asset.metrics.triangles,
      materials: asset.metrics.materials,
      meshes: asset.metrics.meshCount,
      animations: 0,
      compressed: asset.metrics.compressed,
    },
    publishedAt: null,
  };
}

function communityAsset(request: Request, row: CommunityRow): PublicAsset {
  const id = `community:${row.id}`;
  const downloadAllowed = Boolean(row.download_allowed && row.public_file_key);
  return {
    id,
    slug: row.slug,
    name: row.display_name,
    collection: "community",
    category: row.category,
    description: row.description,
    singaporeConnection: row.singapore_connection,
    creator: row.contributor_name,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    fileName: row.file_name,
    fileSize: row.file_size,
    contentType: "model/gltf-binary",
    viewUrl: absolute(request, `/api/models/${row.id}`),
    downloadAllowed,
    downloadUrl: downloadAllowed ? absolute(request, apiDownloadPath(id)) : null,
    metrics: {
      triangles: row.triangle_count,
      materials: row.material_count,
      meshes: row.mesh_count,
      animations: row.animation_count,
      compressed: false,
    },
    publishedAt: row.published_at,
  };
}

const communitySelect = `SELECT id, slug, display_name, contributor_name, description,
  singapore_connection, source_name, source_url, category, file_name, file_size,
  triangle_count, material_count, animation_count, mesh_count, download_allowed,
  public_file_key, published_at FROM submissions WHERE status = 'published'`;

async function database() {
  const { bindings, ensureSchema } = await import("./platform");
  await ensureSchema();
  return bindings().DB;
}

async function communityAssets(request: Request) {
  const DB = await database();
  const result = await DB.prepare(`${communitySelect} ORDER BY featured DESC, published_at DESC`).all<CommunityRow>();
  return (result.results ?? []).map((row) => communityAsset(request, row));
}

function matches(asset: PublicAsset, query: string, category: string) {
  if (category && asset.category.toLowerCase() !== category.toLowerCase()) return false;
  if (!query) return true;
  return `${asset.name} ${asset.slug} ${asset.category} ${asset.description} ${asset.creator}`.toLowerCase().includes(query);
}

export async function listPublicAssets(request: Request) {
  const url = new URL(request.url);
  const collection = url.searchParams.get("collection") ?? "all";
  if (!new Set(["all", "game", "community"]).has(collection)) {
    throw new AssetApiError(400, "collection must be one of: all, game, community");
  }
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 120);
  const category = (url.searchParams.get("category") ?? "").trim().slice(0, 80);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const originals = collection === "community" ? [] : GAME_ASSETS.map((asset) => originalAsset(request, asset));
  const community = collection === "game" ? [] : await communityAssets(request);
  const filtered = [...originals, ...community].filter((asset) => matches(asset, query, category));
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
  if (!localId || !new Set(["game", "community"]).has(collection)) return null;
  if (collection === "game") {
    const asset = GAME_ASSETS.find((item) => item.id === localId || item.slug === localId);
    return asset ? originalAsset(request, asset) : null;
  }

  const DB = await database();
  const row = await DB.prepare(`${communitySelect} AND (id = ? OR slug = ?) LIMIT 1`)
    .bind(localId, localId)
    .first<CommunityRow>();
  return row ? communityAsset(request, row) : null;
}

export async function getCommunityDownload(rawId: string) {
  const id = decodeURIComponent(rawId);
  const [collection, localId] = id.split(":", 2);
  if (collection !== "community" || !localId) return null;
  const DB = await database();
  return DB.prepare(
    "SELECT id, file_name, public_file_key, download_allowed FROM submissions WHERE id = ? AND status = 'published' LIMIT 1",
  )
    .bind(localId)
    .first<{ id: string; file_name: string; public_file_key: string | null; download_allowed: number }>();
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
