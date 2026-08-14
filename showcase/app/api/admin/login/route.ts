import { adminCookie, privateNoStore, verifyAdminPassword } from "../../../lib/platform";

export async function POST(request: Request) {
  const payload = (await request.json()) as { password?: string };
  if (!(await verifyAdminPassword(payload.password ?? ""))) {
    return privateNoStore(JSON.stringify({ error: "Incorrect password." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const response = Response.json({ authenticated: true });
  response.headers.set("set-cookie", await adminCookie(request));
  response.headers.set("cache-control", "no-store");
  return response;
}
