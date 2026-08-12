import { assetApiError, findPublicAsset, getCommunityDownload, safeDownloadName } from "../../../../../lib/asset-api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rawId = (await params).id;
    const asset = await findPublicAsset(request, rawId);
    if (!asset) return Response.json({ error: "Asset not found" }, { status: 404 });
    if (!asset.downloadAllowed) {
      return Response.json({ error: "The creator has not granted download permission for this asset" }, { status: 403 });
    }
    if (asset.collection === "game") return Response.redirect(asset.viewUrl, 307);

    const row = await getCommunityDownload(rawId);
    if (!row?.download_allowed || !row.public_file_key) {
      return Response.json({ error: "The creator has not granted download permission for this asset" }, { status: 403 });
    }
    const { bindings } = await import("../../../../../lib/platform");
    const object = await bindings().ASSET_BUCKET.get(row.public_file_key);
    if (!object) return Response.json({ error: "Asset file not found" }, { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("content-type", "model/gltf-binary");
    headers.set("content-disposition", `attachment; filename="${safeDownloadName(row.file_name)}"`);
    headers.set("cache-control", "private, max-age=0, must-revalidate");
    headers.set("etag", object.httpEtag);
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    return assetApiError(error);
  }
}
