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

From `showcase/`:

```bash
npm link
export KAMPUNG_ASSET_API_URL="https://your-collection.example"

kampung-assets list --query house
kampung-assets get game:peranakan-house
kampung-assets download game:peranakan-house -o ./models/peranakan-house.glb
```

Submit with the provided metadata template:

```bash
cp tooling/submission.example.json submission.json
kampung-assets upload ./model.glb --metadata ./submission.json --yes-rights
```

Add `--allow-download` only when the contributor explicitly wants the published GLB to be downloadable. The upload response contains the recovery receipt:

```bash
kampung-assets status RECEIPT
kampung-assets replace RECEIPT ./revised-model.glb
kampung-assets withdraw RECEIPT --yes
```

Every command accepts `--json`. `KAMPUNG_ASSET_API_TOKEN` is forwarded as a bearer token for deployments that place the public API behind an access gateway.

## MCP server

The server runs over stdio and exposes:

- `search_assets`
- `get_asset`
- `download_asset`
- `upload_asset`
- `get_submission`
- `replace_submission`
- `withdraw_submission`

Example MCP host configuration:

```json
{
  "mcpServers": {
    "kampung-call-assets": {
      "command": "node",
      "args": ["/absolute/path/to/showcase/mcp/server.mjs"],
      "env": {
        "KAMPUNG_ASSET_API_URL": "https://your-collection.example",
        "KAMPUNG_ASSET_ROOTS": "/absolute/path/to/allowed/assets"
      }
    }
  }
}
```

`KAMPUNG_ASSET_ROOTS` is a platform-delimited list of directories the MCP server may read uploads from or write downloads into. It defaults to the MCP process working directory. Standard output is reserved for MCP protocol messages; diagnostics go to standard error.

## Development verification

```bash
npm run test:tooling
npm run build
```

The tooling tests exercise multipart upload, atomic download, recovery operations and the official MCP client/server protocol in memory.
