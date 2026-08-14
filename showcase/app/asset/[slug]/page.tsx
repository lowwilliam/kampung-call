import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATALOGUE_MANIFEST, CATEGORIES, GAME_ASSETS, type CollectionAsset } from "../../data/game-assets";
import { ModelViewer } from "../../components/ModelViewer";

function assetForSlug(slug: string) {
  return GAME_ASSETS.find((asset) => asset.slug === slug);
}

function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : "";
}

function collectionReturnUrl(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  const category = value(params.category);
  const search = value(params.q).slice(0, 120);
  const sort = value(params.sort);
  if (CATEGORIES.includes(category as (typeof CATEGORIES)[number])) query.set("category", category);
  if (search) query.set("q", search);
  if (sort === "alphabetical") query.set("sort", sort);
  return query.size ? `/?${query}` : "/";
}

function evidenceLabel(asset: CollectionAsset) {
  if (asset.evidenceStatus === "source-confirmed") return "Source-confirmed";
  if (asset.evidenceStatus === "reasoned-inference") return "Reasoned inference";
  if (asset.evidenceStatus === "artistic-interpretation") return "Artistic interpretation";
  if (asset.evidenceStatus === "mixed") return "Mixed evidence";
  if (asset.evidenceStatus === "not-applicable") return "Not applicable";
  return "Editorial review pending";
}

export function generateStaticParams() {
  return GAME_ASSETS.map((asset) => ({ slug: asset.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const asset = assetForSlug(slug);
  if (!asset) return { title: "Asset not found · 3D Singapore Collection" };
  const title = `${asset.name} · 3D Singapore Collection`;
  return {
    title,
    description: asset.intro,
    alternates: { canonical: `/asset/${asset.slug}` },
    robots: asset.publication?.status === "withdrawn" ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description: asset.intro,
      type: "article",
      images: asset.cardPreviewUrl ? [{ url: asset.cardPreviewUrl, alt: asset.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: asset.intro,
      images: asset.cardPreviewUrl ? [asset.cardPreviewUrl] : undefined,
    },
  };
}

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const asset = assetForSlug(slug);
  if (!asset) notFound();
  const returnUrl = collectionReturnUrl(await searchParams);
  const publisher = asset.responsiblePublisher ?? CATALOGUE_MANIFEST.release.responsiblePublisher;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: asset.name,
    description: asset.intro,
    url: `/asset/${asset.slug}`,
    genre: asset.category,
    publisher: { "@type": "Person", name: publisher.name, sameAs: publisher.profileUrl },
  };

  return (
    <div className="detail-shell detail-page">
      <header className="detail-bar">
        <a className="icon-button" href={returnUrl} aria-label="Back to collection">←</a>
        <span>{asset.category}</span>
        <a href="https://kampung-call.vercel.app" target="_blank" rel="noreferrer">Play Kampung Call ↗</a>
      </header>
      <main className="detail-grid">
        <section className="detail-stage-wrap" aria-label={`${asset.name} interactive 3D viewer`}>
          {!asset.cardPreviewUrl && (
            <div className="detail-static-placeholder" aria-hidden="true">
              <strong>{String(asset.curatedOrder ?? 0).padStart(2, "0")}</strong>
              <span>{asset.name}</span>
            </div>
          )}
          <ModelViewer url={asset.modelUrl} label={asset.name} posterUrl={asset.cardPreviewUrl} expanded eager />
          <div className="detail-stage-note">Drag to rotate · Pinch or scroll to zoom</div>
        </section>
        <article className="detail-copy">
          <p className="eyebrow">{asset.category} · Asset {String(asset.curatedOrder ?? 0).padStart(2, "0")}</p>
          <h1>{asset.name}</h1>
          {asset.inspiration && (
            <p className="inspiration">
              {asset.category === "Lost Heritage" ? <strong>{asset.inspiration}</strong> : <>Inspired by <strong>{asset.inspiration}</strong></>}
            </p>
          )}
          <p className="detail-lede">{asset.intro}</p>

          <div className="story-block">
            <span>01 · {asset.category === "Lost Heritage" ? "In the collection" : "In Kampung Call"}</span>
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
            <div><dt>Provenance</dt><dd>{asset.provenance}</dd></div>
            <div><dt>Evidence</dt><dd>{evidenceLabel(asset)}</dd></div>
            {asset.creator && <div><dt>Creator</dt><dd>{asset.linkedinUrl ? <a href={asset.linkedinUrl} target="_blank" rel="noreferrer">{asset.creator} ↗</a> : asset.creator}</dd></div>}
            <div><dt>Publisher</dt><dd><a href={publisher.profileUrl} target="_blank" rel="noreferrer">{publisher.name} ↗</a></dd></div>
            <div><dt>Triangles</dt><dd>{asset.metrics.triangles.toLocaleString()}</dd></div>
            <div><dt>Materials</dt><dd>{asset.metrics.materials}</dd></div>
            <div><dt>Format</dt><dd>GLB · {asset.metrics.compressed ? "Draco" : "Web ready"}</dd></div>
            <div><dt>Display clearance</dt><dd>{asset.rights?.display.status ?? "pending"}</dd></div>
          </dl>
          <p className="provenance-note">{asset.provenanceDetail}</p>

          <div className="download-panel">
            {asset.downloadAllowed && asset.downloadUrl ? (
              <>
                <a className="asset-download-link" href={asset.downloadUrl}>
                  <span>Download licensed package</span>
                  <small>{asset.rights?.download.license ?? "Asset-specific licence"} · ↓</small>
                </a>
                <p>The package licence and excluded third-party rights govern reuse.</p>
              </>
            ) : (
              <p>This model remains view-only until its asset-specific Download Grant is cleared. Browser rendering does not grant reuse or redistribution rights.</p>
            )}
          </div>
        </article>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} />
    </div>
  );
}
