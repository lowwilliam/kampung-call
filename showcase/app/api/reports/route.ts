import { bindings, clientFingerprint, ensureSchema } from "../../lib/platform";

export async function POST(request: Request) {
  await ensureSchema();
  const payload = (await request.json()) as { assetId?: string; reason?: string; details?: string };
  const assetId = payload.assetId?.trim() ?? "";
  const reason = payload.reason?.trim().slice(0, 80) ?? "";
  const details = payload.details?.trim().slice(0, 1000) ?? "";
  if (!assetId || !reason || !details) return Response.json({ error: "Complete the report." }, { status: 400 });
  const { DB } = bindings();
  const exists = await DB.prepare("SELECT id FROM submissions WHERE id = ? AND status = 'published'").bind(assetId).first();
  if (!exists) return Response.json({ error: "Asset not found." }, { status: 404 });
  const fingerprint = await clientFingerprint(request);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await DB.prepare("SELECT COUNT(*) AS count FROM reports WHERE reporter_name = ? AND created_at >= ?")
    .bind(fingerprint, since)
    .first<{ count: number }>();
  if ((recent?.count ?? 0) >= 5) return Response.json({ error: "Report limit reached." }, { status: 429 });
  await DB.prepare("INSERT INTO reports (id, submission_id, reason, details, reporter_name, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)")
    .bind(crypto.randomUUID(), assetId, reason, details, fingerprint, new Date().toISOString())
    .run();
  return Response.json({ received: true }, { status: 201 });
}
