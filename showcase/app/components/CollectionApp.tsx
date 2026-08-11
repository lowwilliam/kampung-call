"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, CollectionAsset, GAME_ASSETS } from "../data/game-assets";
import { ModelViewer } from "./ModelViewer";

type CollectionTab = "game" | "community" | "all";

const tabs: { id: CollectionTab; label: string }[] = [
  { id: "game", label: "From Kampung Call" },
  { id: "community", label: "Made in Singapore" },
  { id: "all", label: "All" },
];

const collectionDownload = {
  archiveUrl: "/downloads/kampung-call-3d-assets.zip",
  manifestUrl: "/downloads/kampung-call-3d-assets-manifest.json",
};

function formatCategory(category: string) {
  return category.replace(" & ", " + ");
}

function downloadFileName(asset: CollectionAsset) {
  return asset.file.split("/").at(-1) ?? `${asset.slug}.glb`;
}

function AssetCard({ asset, onOpen, eager }: { asset: CollectionAsset; onOpen: () => void; eager: boolean }) {
  return (
    <article className="asset-card" data-category={asset.category}>
      <div className="asset-stage">
        <ModelViewer url={asset.modelUrl} label={asset.name} eager={eager} />
        <span className={`provenance-badge ${asset.collection === "community" ? "is-community" : ""}`}>
          {asset.collection === "community" ? "Community made" : "Kampung Call original"}
        </span>
        <button className="stage-open" type="button" onClick={onOpen} aria-label={`Open ${asset.name} details`}>
          <span>Open 360°</span>
        </button>
      </div>
      <div className="asset-card-footer">
        <button className="asset-card-copy" type="button" onClick={onOpen}>
          <span className="asset-index">{asset.collection === "game" ? String(GAME_ASSETS.indexOf(asset) + 1).padStart(2, "0") : "SG"}</span>
          <span>
            <strong>{asset.name}</strong>
            <small>{formatCategory(asset.category)}</small>
          </span>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </button>
        {asset.collection === "game" && (
          <a className="asset-download-button" href={asset.modelUrl} download={downloadFileName(asset)} aria-label={`Download ${asset.name} as a GLB file`} title={`Download ${asset.name}`}>
            <span aria-hidden="true">↓</span>
            <span className="sr-only">Download GLB</span>
          </a>
        )}
      </div>
    </article>
  );
}

function DetailOverlay({ asset, onClose }: { asset: CollectionAsset; onClose: () => void }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const sendReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setReportState("sending");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          reason: form.get("reason"),
          details: form.get("details"),
        }),
      });
      if (!response.ok) throw new Error("Unable to report");
      setReportState("sent");
    } catch {
      setReportState("error");
    }
  };

  return (
    <div className="detail-shell" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <header className="detail-bar">
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close asset details">←</button>
        <span>{asset.collection === "game" ? "From Kampung Call" : "Made in Singapore"}</span>
        <a href="https://kampung-call.vercel.app" target="_blank" rel="noreferrer">Play Kampung Call ↗</a>
      </header>
      <main className="detail-grid">
        <section className="detail-stage-wrap">
          <ModelViewer url={asset.modelUrl} label={asset.name} expanded eager />
          <div className="detail-stage-note">Drag to rotate · Pinch or scroll to zoom</div>
        </section>
        <section className="detail-copy">
          <p className="eyebrow">{asset.category}</p>
          <h1 id="detail-title">{asset.name}</h1>
          {asset.inspiration && <p className="inspiration">Inspired by <strong>{asset.inspiration}</strong></p>}
          <p className="detail-lede">{asset.intro}</p>

          <div className="story-block">
            <span>01 · In Kampung Call</span>
            <p>{asset.gameContext}</p>
          </div>
          <div className="story-block">
            <span>02 · In Singapore</span>
            <p>{asset.singaporeContext}</p>
            {asset.historySource && <a href={asset.historySource.url} target="_blank" rel="noreferrer">Read the source ↗</a>}
          </div>
          <div className="story-block">
            <span>03 · Making the model</span>
            <p>{asset.productionStory}</p>
          </div>

          <dl className="asset-facts">
            <div><dt>Source</dt><dd>{asset.provenance}</dd></div>
            {asset.creator && <div><dt>Creator</dt><dd>{asset.linkedinUrl ? <a href={asset.linkedinUrl} target="_blank" rel="noreferrer">{asset.creator} ↗</a> : asset.creator}</dd></div>}
            <div><dt>Triangles</dt><dd>{asset.metrics.triangles.toLocaleString()}</dd></div>
            <div><dt>Materials</dt><dd>{asset.metrics.materials}</dd></div>
            <div><dt>Format</dt><dd>GLB · {asset.metrics.compressed ? "Draco" : "Web ready"}</dd></div>
          </dl>
          <p className="provenance-note">{asset.provenanceDetail}</p>

          <div className="download-panel">
            {asset.collection === "game" ? (
              <>
                <a className="asset-download-link" href={asset.modelUrl} download={downloadFileName(asset)}>
                  <span>Download GLB</span>
                  <small>{downloadFileName(asset)} · ↓</small>
                </a>
                <p>For personal evaluation and project review. Downloading does not grant redistribution, resale or reuse rights.</p>
              </>
            ) : (
              <p>Community models do not receive a download button unless their creator grants it. Like any web-rendered 3D file, model data must still be delivered to the visitor’s browser for viewing.</p>
            )}
          </div>

          {asset.collection === "community" && (
            <div className="report-area">
              {!reportOpen ? (
                <button type="button" className="text-button" onClick={() => setReportOpen(true)}>Report this asset</button>
              ) : reportState === "sent" ? (
                <p className="form-success">Report received. Thank you for helping us curate responsibly.</p>
              ) : (
                <form onSubmit={sendReport} className="report-form">
                  <label>Reason<select name="reason" required><option value="attribution">Incorrect attribution</option><option value="rights">Rights concern</option><option value="content">Inappropriate content</option><option value="other">Something else</option></select></label>
                  <label>Details<textarea name="details" rows={3} required /></label>
                  <button type="submit" disabled={reportState === "sending"}>{reportState === "sending" ? "Sending…" : "Send report"}</button>
                  {reportState === "error" && <p role="alert">Could not send the report. Please try again.</p>}
                </form>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export function CollectionApp({ initialSlug }: { initialSlug?: string }) {
  const [tab, setTab] = useState<CollectionTab>("game");
  const [category, setCategory] = useState<string>("All objects");
  const [query, setQuery] = useState("");
  const [community, setCommunity] = useState<CollectionAsset[]>([]);
  const [activeSlug, setActiveSlug] = useState(initialSlug ?? "");

  useEffect(() => {
    void fetch("/api/assets")
      .then((response) => (response.ok ? response.json() : { assets: [] }))
      .then((payload) => setCommunity(payload.assets ?? []))
      .catch(() => setCommunity([]));
  }, []);

  useEffect(() => {
    const onPop = () => {
      const match = window.location.pathname.match(/^\/asset\/([^/]+)/);
      setActiveSlug(match?.[1] ?? "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const allAssets = useMemo(() => [...GAME_ASSETS, ...community], [community]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allAssets.filter((asset) => {
      const collectionMatch = tab === "all" || asset.collection === tab;
      const categoryMatch = category === "All objects" || asset.category === category;
      const queryMatch = !normalized || `${asset.name} ${asset.category} ${asset.intro} ${asset.creator ?? ""}`.toLowerCase().includes(normalized);
      return collectionMatch && categoryMatch && queryMatch;
    });
  }, [allAssets, tab, category, query]);

  const activeAsset = allAssets.find((asset) => asset.slug === activeSlug);

  const openAsset = (asset: CollectionAsset) => {
    setActiveSlug(asset.slug);
    window.history.pushState({}, "", `/asset/${asset.slug}`);
  };

  const closeAsset = () => {
    setActiveSlug("");
    window.history.pushState({}, "", "/");
  };

  return (
    <div className="collection-page">
      <header className="site-header">
        <Link href="/" className="wordmark"><span>KC</span><strong>The Collection</strong></Link>
        <nav aria-label="Primary navigation">
          <Link href="/submit">Submit a model</Link>
          <a className="play-link" href="https://kampung-call.vercel.app" target="_blank" rel="noreferrer">Play Kampung Call ↗</a>
        </nav>
      </header>

      <main>
        <section className="collection-intro" aria-labelledby="collection-title">
          <div>
            <p className="eyebrow">Interactive 3D archive · Singapore</p>
            <h1 id="collection-title">The Kampung Call<br /><em>Collection</em></h1>
          </div>
          <div className="intro-note">
            <strong>{GAME_ASSETS.length}</strong>
            <p>Objects, places and people behind the game—made to turn, inspect and remember.</p>
          </div>
        </section>

        <section className="download-band" aria-labelledby="download-title">
          <div>
            <p className="eyebrow">Complete asset archive</p>
            <h2 id="download-title">Take all 55 models.</h2>
            <p>One ZIP with every canonical Kampung Call GLB, its provenance and a machine-readable manifest.</p>
          </div>
          <div className="download-band-actions">
            <a className="download-all-link" href={collectionDownload.archiveUrl} download="kampung-call-3d-assets.zip">
              <span>Download all {GAME_ASSETS.length}</span>
              <small>ZIP · GLB + manifest ↓</small>
            </a>
            <a className="manifest-link" href={collectionDownload.manifestUrl} target="_blank" rel="noreferrer">Inspect the manifest ↗</a>
          </div>
        </section>

        <section className="catalogue-controls" aria-label="Collection controls">
          <div className="collection-tabs" role="tablist" aria-label="Collections">
            {tabs.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>
                {item.label}<sup>{item.id === "game" ? GAME_ASSETS.length : item.id === "community" ? community.length : allAssets.length}</sup>
              </button>
            ))}
          </div>
          <label className="search-box">
            <span>Search</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an object…" />
          </label>
          <div className="category-row" aria-label="Filter by category">
            {["All objects", ...CATEGORIES].map((item) => (
              <button key={item} type="button" className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>
        </section>

        <section className="results-line" aria-live="polite">
          <span>{filtered.length} {filtered.length === 1 ? "object" : "objects"}</span>
          <span>Each model rotates automatically</span>
        </section>

        {filtered.length ? (
          <section className="asset-grid" aria-label="3D asset collection">
            {filtered.map((asset, index) => <AssetCard key={`${asset.collection}-${asset.id}`} asset={asset} eager={index < 3} onOpen={() => openAsset(asset)} />)}
          </section>
        ) : tab === "community" && !query ? (
          <section className="empty-community">
            <span>Made in Singapore · Open call</span>
            <h2>The first community object could be yours.</h2>
            <p>Submit a self-contained GLB with a meaningful Singapore connection. Every accepted model receives the same 360° stage and creator credit.</p>
            <Link href="/submit">Submit a model ↗</Link>
          </section>
        ) : (
          <section className="no-results"><h2>No objects found.</h2><button type="button" onClick={() => { setQuery(""); setCategory("All objects"); }}>Clear filters</button></section>
        )}

        <section className="collection-cta">
          <p className="eyebrow">The world beyond the cards</p>
          <h2>Meet these objects where they belong.</h2>
          <a href="https://kampung-call.vercel.app" target="_blank" rel="noreferrer">Play Kampung Call <span>↗</span></a>
        </section>
      </main>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Kampung Call</span>
        <p>Canonical shipped models only. Third-party placeholders are excluded until licensed files are present.</p>
        <Link href="/admin">Admin</Link>
      </footer>

      {activeAsset && <DetailOverlay asset={activeAsset} onClose={closeAsset} />}
    </div>
  );
}
