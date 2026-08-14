import { assetApiError, findPublicAsset } from "../../../../../lib/asset-api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rawId = (await params).id;
    const asset = await findPublicAsset(request, rawId);
    if (!asset) return Response.json({ error: "Asset not found" }, { status: 404 });
    if (!asset.downloadAllowed) {
      return Response.json({ error: "This asset does not have a cleared Download Grant" }, { status: 403 });
    }
    return Response.redirect(asset.viewUrl, 307);
  } catch (error) {
    return assetApiError(error);
  }
}
