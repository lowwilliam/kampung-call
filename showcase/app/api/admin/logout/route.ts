import { clearAdminCookie } from "../../../lib/platform";

export async function POST() {
  const response = Response.json({ authenticated: false });
  response.headers.set("set-cookie", clearAdminCookie());
  response.headers.set("cache-control", "no-store");
  return response;
}
