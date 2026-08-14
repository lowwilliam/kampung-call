"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { AssetCategory } from "../data/game-assets";

type CatalogueSort = "curated" | "alphabetical";

export type CatalogueCardAsset = {
  id: string;
  slug: string;
  name: string;
  category: AssetCategory;
  curatedOrder: number;
  intro: string;
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
    <a className="asset-card" data-category={asset.category} href={href} aria-label={`View ${asset.name} details`}>
      <div className="asset-stage">
        {asset.cardPreviewUrl ? (
          <Image
            className="asset-card-preview"
            src={asset.cardPreviewUrl}
            alt=""
            fill
            priority={eager}
            sizes="(max-width: 680px) 100vw, (max-width: 980px) 50vw, 33vw"
          />
        ) : (
          <div className="asset-card-placeholder" aria-hidden="true">
            <strong>{String(asset.curatedOrder ?? 0).padStart(2, "0")}</strong>
            <span>Preview in production</span>
          </div>
        )}
        <span className="provenance-badge">
          {asset.category === "Lost Heritage" ? "Lost Heritage" : "Game Asset"}
        </span>
        <span className="stage-open"><span>View detail</span></span>
      </div>
      <div className="asset-card-footer">
        <span className="asset-card-copy">
          <span className="asset-index">{String(asset.curatedOrder ?? 0).padStart(2, "0")}</span>
          <span>
            <strong>{asset.name}</strong>
            <small>{formatCategory(asset.category)}</small>
          </span>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </span>
      </div>
    </a>
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

  const lostHeritageCount = useMemo(() => assets.filter((asset) => asset.category === "Lost Heritage").length, [assets]);

  useEffect(() => {
    const params = catalogueQuery(category, query, sort);
    const nextUrl = params.size ? `/?${params}` : "/";
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [category, query, sort]);

  const currentQuery = catalogueQuery(category, query, sort);

  return (
    <div className="collection-page">
      <header className="site-header">
        <a href="/" className="wordmark"><span>3D</span><strong>Singapore Collection</strong></a>
        <nav aria-label="Primary navigation">
          <a className="play-link" href="https://kampung-call.vercel.app" target="_blank" rel="noreferrer">Play Kampung Call ↗</a>
        </nav>
      </header>

      <main>
        <section className="collection-intro" aria-labelledby="collection-title">
          <div>
            <p className="eyebrow">Read-only digital catalogue · Singapore</p>
            <h1 id="collection-title">3D Singapore<br /><em>Collection</em></h1>
          </div>
          <div className="intro-side">
            <div className="collection-globe-wrap" aria-hidden="true">
              <div className="collection-globe is-static">
                <div className="collection-globe-fallback">
                  <span className="fallback-orbit" />
                  <span className="fallback-planet"><i /><i /><i /></span>
                  <span className="fallback-water" />
                  <span className="fallback-base" />
                </div>
              </div>
              <span>Catalogue edition 01</span>
            </div>
            <div className="intro-note">
              <strong>{assets.length}</strong>
              <p>Curated objects, places and people from Singapore, each with a stable record and inspectable story.</p>
            </div>
          </div>
        </section>

        <section className="heritage-feature" aria-labelledby="heritage-feature-title">
          <div>
            <p className="eyebrow">Lost Singapore · {lostHeritageCount} reconstructions</p>
            <h2 id="heritage-feature-title">Buildings gone.<br />Stories still here.</h2>
            <p>Explore research-led 3D reconstructions of demolished landmarks, from the National Theatre to Pearl Bank Apartments.</p>
          </div>
          <button type="button" onClick={() => { setCategory("Lost Heritage"); setQuery(""); setSort("curated"); }}>
            Explore lost heritage <span>{lostHeritageCount} ↘</span>
          </button>
        </section>

        <section className="catalogue-controls" aria-label="Collection controls">
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
          <span>{sort === "curated" ? "Responsible Publisher’s curated order" : "Alphabetical order"} · Static previews</span>
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
        <span>© {new Date().getFullYear()} 3D Singapore Collection</span>
        <p>Catalogue records are published separately from creator credit, source provenance and download permission.</p>
        <a href="https://www.linkedin.com/in/ruiqian-liu/" target="_blank" rel="noreferrer">Publisher ↗</a>
      </footer>
    </div>
  );
}
