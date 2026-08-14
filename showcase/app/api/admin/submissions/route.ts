import { communityInventoryReadOnlyResponse } from "../../../lib/community-retired";
import { bindings, isAdmin, privateNoStore } from "../../../lib/platform";

type AdminRow = Record<string, string | number | null>;

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return privateNoStore(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  const { DB } = bindings();
  const submissions = await DB.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM reports r WHERE r.submission_id = s.id AND r.status = 'open') AS open_reports
     FROM submissions s ORDER BY CASE s.status WHEN 'needs-review' THEN 0 WHEN 'submitted' THEN 1 WHEN 'changes-requested' THEN 2 ELSE 3 END, s.created_at DESC LIMIT 200`,
  ).all<AdminRow>();
  const items = (submissions.results ?? []).map((row) => ({
    ...row,
    validation_checks: JSON.parse(String(row.validation_checks || "[]")),
    modelUrl: `/api/admin/model?id=${row.id}`,
  }));
  return privateNoStore(JSON.stringify({ submissions: items }), { headers: { "content-type": "application/json" } });
}

export async function PATCH(request: Request) {
  if (!(await isAdmin(request))) return privateNoStore(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  return communityInventoryReadOnlyResponse();
}
