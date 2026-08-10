import { addAudit, bindings, ensureSchema, isAdmin, privateNoStore, purgeExpiredModels } from "../../../lib/platform";

type AdminRow = Record<string, string | number | null>;

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return privateNoStore(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  await ensureSchema();
  await purgeExpiredModels();
  const { DB } = bindings();
  const submissions = await DB.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM reports r WHERE r.submission_id = s.id AND r.status = 'open') AS open_reports
     FROM submissions s ORDER BY CASE s.status WHEN 'needs-review' THEN 0 WHEN 'submitted' THEN 1 WHEN 'changes-requested' THEN 2 ELSE 3 END, s.created_at DESC LIMIT 200`,
  ).all<AdminRow>();
  const items = (submissions.results ?? []).map((row) => ({
    ...row,
    validation_checks: JSON.parse(String(row.validation_checks || "[]")),
    modelUrl: `/api/admin/model?id=${row.id}`,
  }));
  return privateNoStore(JSON.stringify({ submissions: items }), { headers: { "content-type": "application/json" } });
}

export async function PATCH(request: Request) {
  if (!(await isAdmin(request))) return privateNoStore(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  await ensureSchema();
  const payload = (await request.json()) as {
    id?: string;
    action?: string;
    displayName?: string;
    description?: string;
    singaporeConnection?: string;
    sourceName?: string;
    sourceUrl?: string;
    category?: string;
    adminNotes?: string;
    featured?: boolean;
  };
  const id = payload.id ?? "";
  const action = payload.action ?? "";
  const { DB, ASSET_BUCKET } = bindings();
  const row = await DB.prepare("SELECT * FROM submissions WHERE id = ?").bind(id).first<AdminRow>();
  if (!row) return privateNoStore(JSON.stringify({ error: "Submission not found" }), { status: 404, headers: { "content-type": "application/json" } });

  const now = new Date().toISOString();
  const displayName = payload.displayName?.trim() || String(row.display_name);
  const description = payload.description?.trim() || String(row.description);
  const singaporeConnection = payload.singaporeConnection?.trim() || String(row.singapore_connection);
  const sourceName = payload.sourceName?.trim() || String(row.source_name);
  const sourceUrl = payload.sourceUrl?.trim() || row.source_url;
  const category = payload.category?.trim() || String(row.category);
  const adminNotes = payload.adminNotes?.trim() ?? String(row.admin_notes ?? "");

  await DB.prepare(
    "UPDATE submissions SET display_name = ?, description = ?, singapore_connection = ?, source_name = ?, source_url = ?, category = ?, admin_notes = ?, featured = ?, updated_at = ? WHERE id = ?",
  )
    .bind(displayName, description, singaporeConnection, sourceName, sourceUrl, category, adminNotes, payload.featured ? 1 : 0, now, id)
    .run();

  let nextStatus = String(row.status);
  if (action === "publish" || action === "restore") {
    const source = await ASSET_BUCKET.get(String(row.file_key));
    if (!source) return privateNoStore(JSON.stringify({ error: "Quarantined model is missing" }), { status: 409, headers: { "content-type": "application/json" } });
    const publicKey = `published/${id}.glb`;
    await ASSET_BUCKET.put(publicKey, source.body, { httpMetadata: { contentType: "model/gltf-binary" } });
    await DB.prepare("UPDATE submissions SET status = 'published', public_file_key = ?, published_at = ?, deletion_due_at = NULL, updated_at = ? WHERE id = ?")
      .bind(publicKey, now, now, id)
      .run();
    nextStatus = "published";
  } else if (action === "request-changes") {
    nextStatus = "changes-requested";
    await DB.prepare("UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?").bind(nextStatus, now, id).run();
  } else if (action === "reject") {
    if (row.public_file_key) await ASSET_BUCKET.delete(String(row.public_file_key));
    const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    nextStatus = "rejected";
    await DB.prepare("UPDATE submissions SET status = ?, public_file_key = NULL, deletion_due_at = ?, updated_at = ? WHERE id = ?")
      .bind(nextStatus, due, now, id)
      .run();
  } else if (action === "unpublish") {
    if (row.public_file_key) await ASSET_BUCKET.delete(String(row.public_file_key));
    nextStatus = "unpublished";
    await DB.prepare("UPDATE submissions SET status = ?, public_file_key = NULL, updated_at = ? WHERE id = ?").bind(nextStatus, now, id).run();
  } else if (action === "delete-model") {
    await ASSET_BUCKET.delete(String(row.file_key));
    if (row.public_file_key) await ASSET_BUCKET.delete(String(row.public_file_key));
    nextStatus = "rejected";
    await DB.prepare("UPDATE submissions SET status = ?, public_file_key = NULL, deletion_due_at = ?, updated_at = ? WHERE id = ?")
      .bind(nextStatus, now, now, id)
      .run();
  }

  await addAudit(id, action || "metadata-updated", adminNotes);
  return privateNoStore(JSON.stringify({ updated: true, status: nextStatus }), { headers: { "content-type": "application/json" } });
}
