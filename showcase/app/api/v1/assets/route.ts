import { assetApiError, listPublicAssets } from "../../../lib/asset-api";

export async function GET(request: Request) {
  try {
    return Response.json(await listPublicAssets(request), {
      headers: { "cache-control": "public, max-age=60", "x-api-version": "1" },
    });
  } catch (error) {
    return assetApiError(error);
  }
}

export async function POST(request: Request) {
  const submission = await import("../../submissions/route");
  return submission.POST(request);
}
