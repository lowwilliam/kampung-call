import { bindings, isAdmin, privateNoStore } from "../../../lib/platform";

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return privateNoStore("Unauthorized", { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const { DB, ASSET_BUCKET } = bindings();
  const row = await DB.prepare("SELECT file_key FROM submissions WHERE id = ?").bind(id).first<{ file_key: string }>();
  if (!row) return privateNoStore("Not found", { status: 404 });
  const object = await ASSET_BUCKET.get(row.file_key);
  if (!object) return privateNoStore("Not found", { status: 404 });
  return privateNoStore(object.body, { headers: { "content-type": "model/gltf-binary" } });
}
