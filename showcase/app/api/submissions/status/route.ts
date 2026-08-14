import { communityRetiredResponse } from "../../../lib/community-retired";

async function findByReceipt(receipt: string) {
  if (!receipt) return null;
  const { bindings, sha256 } = await import("../../../lib/platform");
  const { DB } = bindings();
  return DB.prepare(
    `SELECT id, display_name, contributor_name, status, admin_notes, validation_status,
      validation_checks, file_key, public_file_key, file_name, file_size, download_allowed, created_at,
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
    downloadAllowed: Boolean(row.download_allowed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export async function GET(request: Request) {
  const receipt = new URL(request.url).searchParams.get("receipt") ?? "";
  const row = await findByReceipt(receipt);
  if (!row) return Response.json({ error: "Receipt not found." }, { status: 404 });
  return Response.json({ submission: publicStatus(row) }, { headers: { "cache-control": "no-store, private" } });
}

export function POST() {
  return communityRetiredResponse();
}

export function DELETE() {
  return communityRetiredResponse();
}
