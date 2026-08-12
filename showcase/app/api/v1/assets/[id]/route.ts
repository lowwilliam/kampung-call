import { assetApiError, findPublicAsset } from "../../../../lib/asset-api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const asset = await findPublicAsset(request, (await params).id);
    if (!asset) return Response.json({ error: "Asset not found" }, { status: 404 });
    return Response.json({ asset }, { headers: { "cache-control": "public, max-age=60", "x-api-version": "1" } });
  } catch (error) {
    return assetApiError(error);
  }
}
