import { addAudit, adminCookie, bindings, clientFingerprint, ensureSchema, privateNoStore, verifyAdminPassword } from "../../../lib/platform";

export async function POST(request: Request) {
  await ensureSchema();
  const fingerprint = await clientFingerprint(request);
  const auditIdentity = `admin:${fingerprint}`;
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const recentFailures = await bindings().DB.prepare(
    "SELECT COUNT(*) AS count FROM audit_events WHERE submission_id = ? AND action = 'login-failed' AND created_at >= ?",
  )
    .bind(auditIdentity, cutoff)
    .first<{ count: number }>();
  if (Number(recentFailures?.count ?? 0) >= 5) {
    return privateNoStore(JSON.stringify({ error: "Too many attempts. Try again in 15 minutes." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "900" },
    });
  }
  const payload = (await request.json()) as { password?: string };
  if (!(await verifyAdminPassword(payload.password ?? ""))) {
    await addAudit(auditIdentity, "login-failed", "Password rejected");
    return privateNoStore(JSON.stringify({ error: "Incorrect password." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  await addAudit(auditIdentity, "login-succeeded");
  const response = Response.json({ authenticated: true });
  response.headers.set("set-cookie", await adminCookie(request));
  response.headers.set("cache-control", "no-store");
  return response;
}
