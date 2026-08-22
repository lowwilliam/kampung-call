import { createHostedMcpHandler } from "../../../mcp/remote-server.mjs";

const hostedMcp = createHostedMcpHandler();

export async function POST(request: Request) {
  return hostedMcp.fetch(request);
}

export async function GET(request: Request) {
  return hostedMcp.fetch(request);
}

export async function OPTIONS(request: Request) {
  return hostedMcp.fetch(request);
}
