import { addAudit, bindings, ensureSchema, inspectGlb, sha256 } from "../../../lib/platform";

async function findByReceipt(receipt: string) {
  if (!receipt) return null;
  const { DB } = bindings();
  return DB.prepare(
    `SELECT id, display_name, contributor_name, status, admin_notes, validation_status,
      validation_checks, file_key, public_file_key, file_name, file_size, created_at,
      updated_at, published_at FROM submissions WHERE receipt_hash = ?`,
  )
    .bind(await sha256(receipt))
    .first<Record<string, string | number | null>>();
}

function publicStatus(row: Record<string, string | number | null>) {
  return {
    id: row.id,
    displayName: row.display_name,
    contributorName: row.contributor_name,
    status: row.status,
    adminNotes: row.admin_notes,
    validationStatus: row.validation_status,
    validationChecks: JSON.parse(String(row.validation_checks || "[]")),
    fileName: row.file_name,
    fileSize: row.file_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export async function GET(request: Request) {
  await ensureSchema();
  const receipt = new URL(request.url).searchParams.get("receipt") ?? "";
  const row = await findByReceipt(receipt);
  if (!row) return Response.json({ error: "Receipt not found." }, { status: 404 });
  return Response.json({ submission: publicStatus(row) }, { headers: { "cache-control": "no-store, private" } });
}

export async function POST(request: Request) {
  await ensureSchema();
  const form = await request.formData();
  const receipt = String(form.get("receipt") ?? "");
  const file = form.get("model");
  const row = await findByReceipt(receipt);
  if (!row) return Response.json({ error: "Receipt not found." }, { status: 404 });
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".glb")) return Response.json({ error: "Choose a GLB file." }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return Response.json({ error: "The GLB must be 20 MB or smaller." }, { status: 413 });
  const bytes = await file.arrayBuffer();
  let inspection;
  try {
    inspection = inspectGlb(bytes);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The GLB could not be validated." }, { status: 400 });
  }
  const { DB, ASSET_BUCKET } = bindings();
  const id = String(row.id);
  if (row.public_file_key) await ASSET_BUCKET.delete(String(row.public_file_key));
  await ASSET_BUCKET.put(String(row.file_key), bytes, { httpMetadata: { contentType: "model/gltf-binary" } });
  const now = new Date().toISOString();
  const status = inspection.status === "needs-review" ? "needs-review" : "submitted";
  await DB.prepare(
    `UPDATE submissions SET file_name = ?, file_size = ?, triangle_count = ?, material_count = ?,
      animation_count = ?, mesh_count = ?, validation_status = ?, validation_checks = ?, status = ?,
      public_file_key = NULL, admin_notes = '', updated_at = ?, deletion_due_at = NULL WHERE id = ?`,
  )
    .bind(file.name, file.size, inspection.triangles, inspection.materials, inspection.animations, inspection.meshes, inspection.status, JSON.stringify(inspection.checks), status, now, id)
    .run();
  await addAudit(id, "revision-submitted", inspection.checks.join(" · "));
  return Response.json({ submission: { ...publicStatus(row), status, updatedAt: now }, checks: inspection.checks });
}

export async function DELETE(request: Request) {
  await ensureSchema();
  const receipt = new URL(request.url).searchParams.get("receipt") ?? "";
  const row = await findByReceipt(receipt);
  if (!row) return Response.json({ error: "Receipt not found." }, { status: 404 });
  const { DB, ASSET_BUCKET } = bindings();
  if (row.public_file_key) await ASSET_BUCKET.delete(String(row.public_file_key));
  const status = row.status === "published" ? "unpublished" : "rejected";
  const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await DB.prepare("UPDATE submissions SET status = ?, public_file_key = NULL, deletion_due_at = ?, updated_at = ? WHERE id = ?")
    .bind(status, due, new Date().toISOString(), row.id)
    .run();
  await addAudit(String(row.id), "withdrawn-by-contributor", `Model deletion due ${due}`);
  return Response.json({ withdrawn: true, status, deletionDueAt: due });
}
