import {
  DELETE as deleteSubmission,
  GET as getSubmission,
  POST as replaceSubmission,
} from "../../../submissions/status/route";

function statusUrl(request: Request, receipt: string) {
  const url = new URL("/api/submissions/status", request.url);
  url.searchParams.set("receipt", receipt);
  return url;
}

export async function GET(request: Request, { params }: { params: Promise<{ receipt: string }> }) {
  const { receipt } = await params;
  return getSubmission(new Request(statusUrl(request, receipt), { headers: request.headers }));
}

export async function POST(request: Request, { params }: { params: Promise<{ receipt: string }> }) {
  const { receipt } = await params;
  const form = await request.formData();
  form.set("receipt", receipt);
  return replaceSubmission(new Request(statusUrl(request, receipt), { method: "POST", body: form }));
}

export const PUT = POST;

export async function DELETE(request: Request, { params }: { params: Promise<{ receipt: string }> }) {
  const { receipt } = await params;
  return deleteSubmission(new Request(statusUrl(request, receipt), { method: "DELETE", headers: request.headers }));
}
