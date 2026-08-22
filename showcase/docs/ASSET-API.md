# Asset API, CLI and MCP server

The Kampung Call Collection exposes the same asset workflow through a versioned HTTP API, a local CLI and a local stdio MCP server. The website, CLI and MCP server all use the same validation, D1 metadata and R2 objects.

## Permission model

- Published Kampung Call originals allow individual GLB downloads.
- Community submissions are view-only by default.
- A community contributor must explicitly set `allowDownload: true` before the API, CLI or MCP server exposes an individual download.
- Upload returns a private recovery receipt. Possession of that receipt authorizes status checks, model replacement and withdrawal for that submission.
- Uploads remain limited to one self-contained GLB 2.0 file of at most 20 MB and enter the existing moderation queue.

## HTTP API v1

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/assets` | List and search published assets |
| `POST` | `/api/v1/assets` | Submit a GLB as multipart form data |
| `GET` | `/api/v1/assets/:id` | Read one asset |
| `GET` | `/api/v1/assets/:id/download` | Download one permitted GLB |
| `GET` | `/api/v1/submissions/:receipt` | Read private submission status |
| `PUT` | `/api/v1/submissions/:receipt` | Replace the submitted GLB |
| `DELETE` | `/api/v1/submissions/:receipt` | Withdraw the submission |

Asset IDs are namespaced: `game:peranakan-house` and `community:<uuid>`. List filters are `q`, `collection`, `category`, `limit` and `offset`.

## CLI

Install the CLI directly from the ChatGPT-hosted collection:

```bash
npm install --global "https://kampung-call-collection.will-ai.chatgpt.site/downloads/kampung-assets-0.2.0.tgz"

kampung-assets list --query house
kampung-assets get game:peranakan-house
kampung-assets download game:peranakan-house -o ./models/peranakan-house.glb
```

Every command accepts `--json`. `KAMPUNG_ASSET_API_TOKEN` is forwarded as a bearer token for deployments that place the public API behind an access gateway.

## MCP server

The server runs over stdio and exposes:

- `search_assets`
- `get_asset`
- `download_asset`

The production Streamable HTTP endpoint is:

```text
https://kampung-call-collection.will-ai.chatgpt.site/mcp
```

The repository also retains a local stdio server for development. The public endpoint returns licensed download URLs instead of attempting to write to a remote user's filesystem.

## Development verification

```bash
npm run test:tooling
npm run build
```

The tooling tests exercise multipart upload, atomic download, recovery operations and the official MCP client/server protocol in memory.
