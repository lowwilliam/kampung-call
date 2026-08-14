const collectionUrl = "https://kampung-call-collection.will-ai.chatgpt.site";

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
        <span>3D Singapore Collection · Developer guide</span>
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
              <div><h3>Install locally</h3><p>From this repository, install the collection tooling and expose the command on your machine.</p></div>
              <Terminal label="Terminal">{`cd showcase
npm install
npm link`}</Terminal>
            </article>

            <article className="guide-step">
              <span>02</span>
              <div><h3>Choose the collection</h3><p>Point the CLI at the hosted archive once, or pass <code>--base-url</code> to an individual command.</p></div>
              <Terminal label="Terminal">{`export KAMPUNG_ASSET_API_URL="${collectionUrl}"
kampung-assets list --category "Lost Heritage"`}</Terminal>
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
            <p>Run the included local stdio server, then add it to any MCP-compatible client. It exposes only search, detail and grant-controlled downloads.</p>
          </div>
          <Terminal label="MCP server">{`cd showcase
KAMPUNG_ASSET_API_URL="${collectionUrl}" npm run mcp`}</Terminal>
        </section>

        <section className="cli-reference" aria-label="Command reference">
          <h2>Command reference</h2>
          <div>
            <code>list</code><span>Search and filter assets</span>
            <code>get</code><span>Read one asset record</span>
            <code>download</code><span>Save one permitted GLB</span>
          </div>
          <a href="/">Browse the live collection ↗</a>
        </section>
      </main>
    </div>
  );
}
