import { bindings, ensureSchema } from "../../../lib/platform";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const { DB, ASSET_BUCKET } = bindings();
  const row = await DB.prepare("SELECT public_file_key FROM submissions WHERE id = ? AND status = 'published'")
    .bind(id)
    .first<{ public_file_key: string | null }>();
  if (!row?.public_file_key) return new Response("Not found", { status: 404 });
  const object = await ASSET_BUCKET.get(row.public_file_key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", "model/gltf-binary");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", object.httpEtag);
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
