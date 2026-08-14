import { GAME_ASSETS } from "../../data/game-assets";
import { bindings, clientFingerprint, ensureSchema, privateNoStore } from "../../lib/platform";

type CountRow = { asset_id: string; count: number };
type LikedRow = { asset_id: string };

const publishedAssetIds = new Set(GAME_ASSETS.map((asset) => asset.id));

export async function GET(request: Request) {
  await ensureSchema();
  const { DB } = bindings();
  const fingerprint = await clientFingerprint(request);
  const [countsResult, likedResult] = await Promise.all([
    DB.prepare("SELECT asset_id, COUNT(*) AS count FROM likes GROUP BY asset_id").all<CountRow>(),
    DB.prepare("SELECT asset_id FROM likes WHERE voter_fingerprint = ?").bind(fingerprint).all<LikedRow>(),
  ]);
  const counts = Object.fromEntries((countsResult.results ?? []).map((row) => [row.asset_id, row.count]));
  const liked = (likedResult.results ?? []).map((row) => row.asset_id);
  return privateNoStore(JSON.stringify({ counts, liked }), {
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request) {
  await ensureSchema();
  let assetId = "";
  try {
    const payload = (await request.json()) as { assetId?: unknown };
    assetId = typeof payload.assetId === "string" ? payload.assetId.trim() : "";
  } catch {
    return Response.json({ error: "Use a valid like request." }, { status: 400 });
  }
  if (!assetId || assetId.length > 100 || !publishedAssetIds.has(assetId)) {
    return Response.json({ error: "That collection item is not available." }, { status: 404 });
  }

  const { DB } = bindings();
  const fingerprint = await clientFingerprint(request);
  const existing = await DB.prepare("SELECT 1 AS liked FROM likes WHERE asset_id = ? AND voter_fingerprint = ?")
    .bind(assetId, fingerprint)
    .first<{ liked: number }>();
  const liked = !existing;
  if (liked) {
    await DB.prepare("INSERT OR IGNORE INTO likes (asset_id, voter_fingerprint, created_at) VALUES (?, ?, ?)")
      .bind(assetId, fingerprint, new Date().toISOString())
      .run();
  } else {
    await DB.prepare("DELETE FROM likes WHERE asset_id = ? AND voter_fingerprint = ?")
      .bind(assetId, fingerprint)
      .run();
  }
  const row = await DB.prepare("SELECT COUNT(*) AS count FROM likes WHERE asset_id = ?")
    .bind(assetId)
    .first<{ count: number }>();
  return privateNoStore(JSON.stringify({ assetId, liked, count: row?.count ?? 0 }), {
    headers: { "content-type": "application/json" },
  });
}
