import { env } from "cloudflare:workers";

export type ShowcaseBindings = {
  DB: D1Database;
  ASSET_BUCKET: R2Bucket;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
};

export function bindings() {
  return env as unknown as ShowcaseBindings;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    receipt_hash TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    contributor_name TEXT NOT NULL,
    linkedin_url TEXT,
    display_linkedin INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    singapore_connection TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    rights_attested INTEGER NOT NULL DEFAULT 0,
    download_allowed INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'Street Life & Nature',
    file_key TEXT NOT NULL,
    public_file_key TEXT,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    triangle_count INTEGER NOT NULL DEFAULT 0,
    material_count INTEGER NOT NULL DEFAULT 0,
    animation_count INTEGER NOT NULL DEFAULT 0,
    mesh_count INTEGER NOT NULL DEFAULT 0,
    validation_status TEXT NOT NULL,
    validation_checks TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    admin_notes TEXT NOT NULL DEFAULT '',
    featured INTEGER NOT NULL DEFAULT 0,
    submitter_fingerprint TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT,
    deletion_due_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_status_published ON submissions(status, published_at)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_fingerprint_created ON submissions(submitter_fingerprint, created_at)`,
  `CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    reporter_name TEXT NOT NULL DEFAULT 'Anonymous',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    resolved_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reports_submission_status ON reports(submission_id, status)`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_submission_created ON audit_events(submission_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS likes (
    asset_id TEXT NOT NULL,
    voter_fingerprint TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (asset_id, voter_fingerprint)
  )`,
  `PRAGMA optimize`,
];

let schemaReady: Promise<void> | null = null;

async function prepareSchema() {
  const { DB } = bindings();
  await DB.batch(schemaStatements.map((statement) => DB.prepare(statement)));
  const columns = await DB.prepare("PRAGMA table_info(submissions)").all<{ name: string }>();
  if (!(columns.results ?? []).some((column) => column.name === "download_allowed")) {
    await DB.prepare("ALTER TABLE submissions ADD COLUMN download_allowed INTEGER NOT NULL DEFAULT 0").run();
  }
  await DB.prepare("PRAGMA optimize").run();
}

export function ensureSchema() {
  schemaReady ??= prepareSchema();
  return schemaReady;
}

export async function sha256(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 54) || "singapore-object";
}

export async function addAudit(submissionId: string, action: string, detail = "") {
  const { DB } = bindings();
  await DB.prepare("INSERT INTO audit_events (id, submission_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), submissionId, action, detail, new Date().toISOString())
    .run();
}

export async function purgeExpiredModels() {
  const { DB, ASSET_BUCKET } = bindings();
  const now = new Date().toISOString();
  const expired = await DB.prepare(
    "SELECT id, file_key, public_file_key FROM submissions WHERE deletion_due_at IS NOT NULL AND deletion_due_at <= ? LIMIT 25",
  )
    .bind(now)
    .all<{ id: string; file_key: string; public_file_key: string | null }>();

  for (const row of expired.results ?? []) {
    await ASSET_BUCKET.delete(row.file_key);
    if (row.public_file_key) await ASSET_BUCKET.delete(row.public_file_key);
    await DB.prepare(
      "UPDATE submissions SET status = 'deleted', public_file_key = NULL, deletion_due_at = NULL, updated_at = ? WHERE id = ?",
    )
      .bind(now, row.id)
      .run();
    await addAudit(row.id, "model-auto-deleted", "Retention window expired");
  }
}

export type GlbInspection = {
  accepted: boolean;
  status: "safe" | "needs-review";
  checks: string[];
  triangles: number;
  materials: number;
  animations: number;
  meshes: number;
};

export function inspectGlb(buffer: ArrayBuffer): GlbInspection {
  const checks: string[] = [];
  if (buffer.byteLength < 20) throw new Error("The GLB file is incomplete.");
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("The file is not a valid binary GLB.");
  if (view.getUint32(4, true) !== 2) throw new Error("Only GLB version 2 is supported.");
  if (view.getUint32(8, true) !== buffer.byteLength) throw new Error("The GLB length header does not match the file.");
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > buffer.byteLength) throw new Error("The GLB JSON chunk is invalid.");
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)).trim());
  const accessors: Array<{ count?: number }> = json.accessors ?? [];
  let triangles = 0;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
      const count = accessors[accessorIndex]?.count ?? 0;
      triangles += Math.floor(count / 3);
    }
  }
  const materials = (json.materials ?? []).length;
  const animations = (json.animations ?? []).length;
  const meshes = (json.meshes ?? []).length;
  const externalBuffer = (json.buffers ?? []).some((item: { uri?: string }) => item.uri && !item.uri.startsWith("data:"));
  const externalImage = (json.images ?? []).some((item: { uri?: string; bufferView?: number }) => item.uri && !item.uri.startsWith("data:") && item.bufferView == null);
  if (externalBuffer || externalImage) throw new Error("Use a self-contained GLB with embedded textures and buffers.");
  if (!meshes) throw new Error("The GLB does not contain a mesh.");
  if (triangles > 1_000_000) throw new Error("The model exceeds the one-million-triangle safety limit.");
  checks.push("Valid self-contained GLB 2.0");
  checks.push(`${meshes.toLocaleString()} meshes · ${triangles.toLocaleString()} triangles`);
  checks.push(`${materials.toLocaleString()} materials · ${animations.toLocaleString()} animation clips`);
  const needsReview = triangles > 250_000 || materials > 50 || animations > 12;
  if (needsReview) checks.push("Heavy scene: performance review required");
  else checks.push("Browser performance profile passed");
  return { accepted: true, status: needsReview ? "needs-review" : "safe", checks, triangles, materials, animations, meshes };
}

const ADMIN_COOKIE = "kc_admin_session";

async function sessionSignature(expires: string) {
  const secret = bindings().ADMIN_SESSION_SECRET;
  if (!secret) return "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`kampung-admin|${expires}`));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function verifyAdminPassword(password: string) {
  const expected = bindings().ADMIN_PASSWORD;
  if (!expected) return false;
  return (await sha256(password)) === (await sha256(expected));
}

export async function adminCookie(request?: Request) {
  const expires = String(Date.now() + 8 * 60 * 60 * 1000);
  const signature = await sessionSignature(expires);
  const secure = !request || new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${expires}.${signature}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=28800`;
}

export function clearAdminCookie() {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function isAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie.split(/;\s*/).find((part) => part.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return signature === (await sessionSignature(expires));
}

export function privateNoStore(body: BodyInit | null, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store, private");
  headers.set("x-content-type-options", "nosniff");
  return new Response(body, { ...init, headers });
}
