"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssetCategory } from "../data/game-assets";
import { rememberCollectionPosition } from "./CollectionBackLink";
import { ModelViewer } from "./ModelViewer";

type CatalogueSort = "curated" | "alphabetical";

export type CatalogueCardAsset = {
  id: string;
  slug: string;
  name: string;
  category: AssetCategory;
  curatedOrder: number;
  intro: string;
  modelUrl: string;
  cardPreviewUrl?: string;
};

function formatCategory(category: string) {
  return category.replace(" & ", " + ");
}

function catalogueQuery(category: string, query: string, sort: CatalogueSort) {
  const params = new URLSearchParams();
  if (category !== "All objects") params.set("category", category);
  if (query.trim()) params.set("q", query.trim());
  if (sort !== "curated") params.set("sort", sort);
  return params;
}

function AssetCard({
  asset,
  href,
  eager,
}: {
  asset: CatalogueCardAsset;
  href: string;
  eager: boolean;
}) {
  return (
    <article className="asset-card" data-category={asset.category} id={`asset-${asset.slug}`}>
      <a className="asset-stage" href={href} onClick={rememberCollectionPosition} aria-label={`View ${asset.name} details`}>
        <ModelViewer
          url={asset.modelUrl}
          label={asset.name}
          posterUrl={asset.cardPreviewUrl}
          eager={eager}
        />
        <span className="provenance-badge">{asset.category === "Lost Heritage" ? "Lost Heritage" : "Game Asset"}</span>
        <span className="stage-open"><span>Open 360°</span></span>
      </a>
      <div className="asset-card-footer">
        <a className="asset-card-copy" href={href} onClick={rememberCollectionPosition}>
          <span className="asset-index">{String(asset.curatedOrder ?? 0).padStart(2, "0")}</span>
          <span>
            <strong>{asset.name}</strong>
            <small>{formatCategory(asset.category)}</small>
          </span>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

function HeroAssetMarquee({ assets }: { assets: readonly CatalogueCardAsset[] }) {
  const previewAssets = assets.filter((asset) => asset.cardPreviewUrl).slice(0, 10);

  const renderSequence = (duplicate = false) => (
    <div className="hero-asset-sequence" aria-hidden={duplicate || undefined}>
      {previewAssets.map((asset) => (
        <a
          className="hero-asset-tile"
          data-category={asset.category}
          href={`/asset/${asset.slug}`}
          key={`${duplicate ? "duplicate-" : ""}${asset.id}`}
          tabIndex={duplicate ? -1 : undefined}
          aria-label={duplicate ? undefined : `View ${asset.name}`}
        >
          <span className="hero-stamp-kicker" aria-hidden="true">Singapore · 3D</span>
          <span className="hero-stamp-art">
            <img
              src={asset.cardPreviewUrl}
              alt=""
              loading="eager"
              decoding="async"
              onError={(event) => { event.currentTarget.hidden = true; }}
            />
            <span className="hero-stamp-copy">
              <span>{String(asset.curatedOrder).padStart(2, "0")}</span>
              <strong>{asset.name}</strong>
            </span>
          </span>
        </a>
      ))}
    </div>
  );

  return (
    <div className="hero-assets" aria-label="A moving selection from the collection" aria-roledescription="carousel">
      <div className="hero-assets-heading">
        <span>Selected objects</span>
        <a href="#catalogue">Explore all {assets.length} ↓</a>
      </div>
      <div className="hero-assets-window">
        <div className="hero-assets-track">
          {renderSequence()}
          {renderSequence(true)}
        </div>
      </div>
    </div>
  );
}

export function CollectionApp({
  assets,
  categories,
  initialCategory = "All objects",
  initialQuery = "",
  initialSort = "curated",
}: {
  assets: readonly CatalogueCardAsset[];
  categories: readonly AssetCategory[];
  initialCategory?: string;
  initialQuery?: string;
  initialSort?: CatalogueSort;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<CatalogueSort>(initialSort);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matching = assets.filter((asset) => {
      const categoryMatch = category === "All objects" || asset.category === category;
      const queryMatch = !normalized || `${asset.name} ${asset.category} ${asset.intro}`.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
    if (sort === "alphabetical") return [...matching].sort((left, right) => left.name.localeCompare(right.name));
    return [...matching].sort((left, right) => left.curatedOrder - right.curatedOrder || left.name.localeCompare(right.name));
  }, [assets, category, query, sort]);

  useEffect(() => {
    const params = catalogueQuery(category, query, sort);
    const nextUrl = params.size ? `/?${params}` : "/";
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [category, query, sort]);

  const currentQuery = catalogueQuery(category, query, sort);

  return (
    <div className="collection-page">
      <header className="site-header">
        <a href="/" className="wordmark"><span>3D</span><strong>Kampung 3D Collection</strong></a>
        <nav aria-label="Primary navigation">
          <a className="cli-link" href="/cli">CLI + MCP guide</a>
          <a className="play-link" href="https://kampung-call.vercel.app" target="_blank" rel="noreferrer">Play Kampung Call ↗</a>
        </nav>
      </header>

      <main>
        <section className="collection-intro" aria-labelledby="collection-title">
          <div>
            <p className="eyebrow">Read-only digital catalogue · Singapore</p>
            <h1 id="collection-title">Kampung 3D<br /><em>Collection</em></h1>
          </div>
          <div className="intro-side">
            <HeroAssetMarquee assets={assets} />
            <div className="intro-note">
              <strong>{assets.length}</strong>
              <p>Curated objects, places and people from Singapore, each with a stable record and inspectable story.</p>
            </div>
          </div>
        </section>

        <p className="provenance-note" role="note">
          Draft preview: creator, source-media, landmark and display rights remain under review. This independent project is not
          sponsored, endorsed or affiliated with the organisations or landmark owners referenced in the catalogue.
        </p>

        <section className="catalogue-controls" id="catalogue" aria-label="Collection controls">
          <div className="catalogue-toolbar">
            <label className="search-box">
              <span>Search</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an object…" />
            </label>
            <label className="sort-box">
              <span>Order</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as CatalogueSort)}>
                <option value="curated">Curated</option>
                <option value="alphabetical">A–Z</option>
              </select>
            </label>
          </div>
          <div className="category-row" aria-label="Filter by category">
            {["All objects", ...categories].map((item) => (
              <button key={item} type="button" className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>
        </section>

        <section className="results-line" aria-live="polite">
          <span>{filtered.length} {filtered.length === 1 ? "object" : "objects"}</span>
          <span>{sort === "curated" ? "Responsible Publisher’s curated order" : "Alphabetical order"} · Live 360° previews</span>
        </section>

        {filtered.length ? (
          <section className="asset-grid" aria-label="3D asset collection">
            {filtered.map((asset, index) => {
              const detailParams = new URLSearchParams(currentQuery);
              return (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  eager={index < 3}
                  href={`/asset/${asset.slug}${detailParams.size ? `?${detailParams}` : ""}`}
                />
              );
            })}
          </section>
        ) : (
          <section className="no-results"><h2>No objects found.</h2><button type="button" onClick={() => { setQuery(""); setCategory("All objects"); }}>Clear filters</button></section>
        )}

        <section className="collection-cta">
          <p className="eyebrow">The world beyond the catalogue</p>
          <h2>Meet these objects where they belong.</h2>
          <a href="https://kampung-call.vercel.app" target="_blank" rel="noreferrer">Play Kampung Call <span>↗</span></a>
        </section>
      </main>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Kampung 3D Collection</span>
        <p>Catalogue records are published separately from creator credit, source provenance and download permission.</p>
        <a href="https://www.linkedin.com/in/ruiqian-liu/" target="_blank" rel="noreferrer">Publisher ↗</a>
      </footer>
    </div>
  );
}
