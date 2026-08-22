const collectionUrl = "https://kampung-call-collection.will-ai.chatgpt.site";
const cliPackageUrl = `${collectionUrl}/downloads/kampung-assets-0.2.0.tgz`;
const mcpUrl = `${collectionUrl}/mcp`;

function Terminal({ label, children }: { label: string; children: string }) {
  return (
    <div className="terminal-window">
      <div className="terminal-bar">
        <span aria-hidden="true"><i /><i /><i /></span>
        <strong>{label}</strong>
      </div>
      <pre><code>{children}</code></pre>
    </div>
  );
}

export default function CliPage() {
  return (
    <div className="cli-page">
      <header className="cli-header">
        <a href="/" className="back-link">← Collection</a>
        <span>Kampung 3D Collection · Developer guide</span>
        <a className="play-link" href="https://kampung-call.vercel.app" target="_blank" rel="noreferrer">Play Kampung Call ↗</a>
      </header>

      <main>
        <section className="cli-hero" aria-labelledby="cli-title">
          <div>
            <p className="eyebrow">Command line + terminal</p>
            <h1 id="cli-title">Take the collection<br /><em>into your tools.</em></h1>
            <p>Search the authoritative catalogue, inspect provenance and download only assets with a cleared Download Grant.</p>
          </div>
          <Terminal label="01 · First search">{`$ kampung-assets list --query heritage

ID                              NAME
game:lost-national-theatre      National Theatre
game:lost-pearl-bank-apartments Pearl Bank Apartments`}</Terminal>
        </section>

        <section className="cli-guide" aria-labelledby="cli-guide-title">
          <div className="cli-guide-intro">
            <p className="eyebrow">Four short steps</p>
            <h2 id="cli-guide-title">From setup to verified record.</h2>
            <p>The CLI talks to the same permission-aware Asset API used by the collection. Downloads appear only when an item allows them.</p>
          </div>

          <div className="guide-grid">
            <article className="guide-step">
              <span>01</span>
              <div><h3>Install the public CLI</h3><p>Install the signed release package directly from this ChatGPT-hosted collection.</p></div>
              <Terminal label="Terminal">{`npm install --global "${cliPackageUrl}"`}</Terminal>
            </article>

            <article className="guide-step">
              <span>02</span>
              <div><h3>Search immediately</h3><p>The public CLI already points to this ChatGPT-hosted collection. No environment setup is required.</p></div>
              <Terminal label="Terminal">{`kampung-assets list --category "Lost Heritage"
kampung-assets list --query heritage --json`}</Terminal>
            </article>

            <article className="guide-step">
              <span>03</span>
              <div><h3>Inspect and download</h3><p>Asset IDs are namespaced. A download is always one explicit, permission-checked model.</p></div>
              <Terminal label="Terminal">{`kampung-assets get game:lost-national-theatre
kampung-assets download game:lost-national-theatre \
  -o ./national-theatre.glb`}</Terminal>
            </article>

            <article className="guide-step">
              <span>04</span>
              <div><h3>Use machine-readable metadata</h3><p>JSON output preserves checksums, provenance, publisher identity and the same fail-closed download decision as the website.</p></div>
              <Terminal label="Terminal">{`kampung-assets get game:peranakan-house --json
kampung-assets list --category "Service Gear" --json`}</Terminal>
            </article>
          </div>
        </section>

        <section className="mcp-callout" aria-labelledby="mcp-title">
          <div>
            <p className="eyebrow">For agent-enabled terminals</p>
            <h2 id="mcp-title">Use the same collection through MCP.</h2>
            <p>Connect ChatGPT, Codex or another MCP client to the public Streamable HTTP endpoint. It exposes only search, detail and grant-controlled download links.</p>
          </div>
          <Terminal label="Remote MCP endpoint">{mcpUrl}</Terminal>
        </section>

        <section className="cli-reference" aria-label="Command reference">
          <h2>Command reference</h2>
          <div>
            <code>list</code><span>Search and filter assets</span>
            <code>get</code><span>Read one asset record</span>
            <code>download</code><span>Save one permitted GLB</span>
          </div>
          <a href={cliPackageUrl}>Download the CLI package ↗</a>
        </section>
      </main>
    </div>
  );
}
