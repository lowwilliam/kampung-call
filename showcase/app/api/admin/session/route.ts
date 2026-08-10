import { isAdmin } from "../../../lib/platform";

export async function GET(request: Request) {
  return Response.json({ authenticated: await isAdmin(request) }, { headers: { "cache-control": "no-store" } });
}
