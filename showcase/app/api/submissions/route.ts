import {
  addAudit,
  bindings,
  clientFingerprint,
  ensureSchema,
  inspectGlb,
  randomToken,
  sha256,
  slugify,
} from "../../lib/platform";

const MAX_BYTES = 20 * 1024 * 1024;

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function validLinkedIn(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)linkedin\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  await ensureSchema();
  const form = await request.formData();
  if (text(form, "website")) return Response.json({ received: true }, { status: 202 });

  const displayName = text(form, "displayName").slice(0, 80);
  const contributorName = text(form, "contributorName").slice(0, 80);
  const linkedinUrl = text(form, "linkedinUrl").slice(0, 300);
  const description = text(form, "description").slice(0, 800);
  const singaporeConnection = text(form, "singaporeConnection").slice(0, 800);
  const sourceName = text(form, "sourceName").slice(0, 160);
  const sourceUrl = text(form, "sourceUrl").slice(0, 500);
  const category = text(form, "category").slice(0, 80) || "Street Life & Nature";
  const rightsAttested = text(form, "rightsAttested") === "true";
  const displayLinkedin = text(form, "displayLinkedin") === "true";
  const file = form.get("model");

  if (!displayName || !contributorName || !description || !singaporeConnection || !sourceName || !rightsAttested) {
    return Response.json({ error: "Complete every required story and rights field." }, { status: 400 });
  }
  if (!validLinkedIn(linkedinUrl)) return Response.json({ error: "Use a valid LinkedIn profile URL." }, { status: 400 });
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".glb")) {
    return Response.json({ error: "Choose one self-contained .glb file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "The GLB must be 20 MB or smaller." }, { status: 413 });

  const fingerprint = await clientFingerprint(request);
  const { DB, ASSET_BUCKET } = bindings();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await DB.prepare("SELECT COUNT(*) AS count FROM submissions WHERE submitter_fingerprint = ? AND created_at >= ?")
    .bind(fingerprint, since)
    .first<{ count: number }>();
  if ((recent?.count ?? 0) >= 3) return Response.json({ error: "Submission limit reached. Try again in an hour." }, { status: 429 });

  const bytes = await file.arrayBuffer();
  let inspection;
  try {
    inspection = inspectGlb(bytes);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The GLB could not be validated." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const receipt = randomToken(32);
  const receiptHash = await sha256(receipt);
  const slug = `${slugify(displayName)}-${id.slice(0, 6)}`;
  const fileKey = `quarantine/${id}.glb`;
  const now = new Date().toISOString();
  const status = inspection.status === "needs-review" ? "needs-review" : "submitted";

  await ASSET_BUCKET.put(fileKey, bytes, {
    httpMetadata: { contentType: "model/gltf-binary" },
    customMetadata: { submissionId: id, originalName: file.name },
  });
  await DB.prepare(
    `INSERT INTO submissions (
      id, receipt_hash, slug, display_name, contributor_name, linkedin_url, display_linkedin,
      description, singapore_connection, source_name, source_url, rights_attested, category,
      file_key, file_name, file_size, triangle_count, material_count, animation_count, mesh_count,
      validation_status, validation_checks, status, submitter_fingerprint, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id, receiptHash, slug, displayName, contributorName, linkedinUrl || null, displayLinkedin ? 1 : 0,
      description, singaporeConnection, sourceName, sourceUrl || null, 1, category,
      fileKey, file.name, file.size, inspection.triangles, inspection.materials, inspection.animations, inspection.meshes,
      inspection.status, JSON.stringify(inspection.checks), status, fingerprint, now, now,
    )
    .run();
  await addAudit(id, "submitted", inspection.checks.join(" · "));

  return Response.json(
    {
      receiptUrl: `/receipt/${receipt}`,
      recoveryCode: receipt,
      status,
      checks: inspection.checks,
    },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}
