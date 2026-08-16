import catalogueManifestJson from "./catalogue-manifest.json";

export const CATEGORIES = [
  "Lost Heritage",
  "Homes & Neighbourhoods",
  "Culture & Landmarks",
  "Transit & Movement",
  "Street Life & Nature",
  "Service Gear",
  "People",
] as const;

export type AssetCategory = (typeof CATEGORIES)[number];
export type ClearanceStatus = "pending" | "cleared" | "blocked" | "legal-review" | "permission-pending";
export type DownloadStatus = Exclude<ClearanceStatus, "pending">;

type CatalogueSource = {
  kind: "history" | "design-reference" | "image-reference" | "model-reference" | "rights";
  label: string;
  url: string;
};

type CatalogueAssetRecord = {
  id: string;
  slug: string;
  category: AssetCategory;
  curatedOrder: number;
  locale: {
    en: {
      name: string;
      intro: string;
      gameContext: string;
      singaporeContext: string;
      productionStory: string;
      inspiration: string | null;
    };
  };
  model: {
    file: string;
    sourcePath: string;
    publicPath: string;
    sha256: string;
    byteLength: number;
    contentType: "model/gltf-binary";
  };
  cardPreview: {
    status: "missing" | "legacy" | "ready";
    sourcePath: string | null;
    publicPath: string | null;
    sourceModelSha256: string;
    sha256: string | null;
    contentType: "image/png" | "image/avif" | "image/webp" | null;
  };
  creatorCredit: {
    status: "unverified" | "verified";
    name: string | null;
    url: string | null;
  };
  adapters: string[];
  productionMethod: string;
  provenance: {
    label: string;
    detail: string;
  };
  sources: CatalogueSource[];
  evidenceStatus: "unreviewed" | "not-applicable" | "source-confirmed" | "reasoned-inference" | "artistic-interpretation" | "mixed";
  metrics: {
    triangles: number;
    materials: number;
    meshCount: number;
    compressed: boolean;
    dimensions: { width: number; height: number; depth: number } | null;
  };
  publication: {
    status: "draft" | "published" | "withdrawn";
    lastReviewedAt: string | null;
  };
  rights: {
    subjectType: string;
    ownership: {
      status: string;
      copyrightOwner: string | null;
      basis: string | null;
      evidenceRefs: Array<{ id: string; hash: string }>;
    };
    sourceMedia: {
      status: string;
      evidenceRefs: Array<{ id: string; hash: string }>;
    };
    trademarkChecks: Array<Record<string, unknown>>;
    statutoryPermissions: Array<Record<string, unknown>>;
    personRelease: {
      required: boolean | null;
      status: string;
      scope: string | null;
      evidenceRefs: Array<{ id: string; hash: string }>;
    };
    display: {
      status: ClearanceStatus;
      basis: string | null;
      reviewedBy: string | null;
      reviewedAt: string | null;
      evidenceHash: string | null;
    };
    download: {
      status: DownloadStatus;
      license: string | null;
      scope: string | null;
      excludedThirdPartyRights: string[];
      reviewedBy: string | null;
      reviewedAt: string | null;
      evidenceHash: string | null;
    };
  };
  withdrawn: Record<string, unknown> | null;
};

export type CatalogueManifest = {
  schemaVersion: 1;
  release: {
    id: string;
    version: string;
    status: "draft" | "published" | "withdrawn";
    defaultLocale: "en";
    catalogueSize: 74;
    productionDomain: string | null;
    correctionsEmail: string | null;
    publishedAt: string | null;
    responsiblePublisher: {
      name: string;
      profileUrl: string;
    };
  };
  assets: CatalogueAssetRecord[];
};

export type CollectionAsset = {
  id: string;
  slug: string;
  name: string;
  file: string;
  modelUrl: string;
  cardPreviewUrl?: string;
  cardPreviewStatus?: CatalogueAssetRecord["cardPreview"]["status"];
  category: AssetCategory;
  curatedOrder?: number;
  intro: string;
  gameContext: string;
  singaporeContext: string;
  productionStory: string;
  inspiration?: string;
  historySource?: { label: string; url: string };
  provenance: string;
  provenanceDetail: string;
  collection: "game" | "community";
  creator?: string;
  linkedinUrl?: string;
  featured?: boolean;
  downloadAllowed?: boolean;
  downloadUrl?: string;
  modelSha256?: string;
  modelByteLength?: number;
  evidenceStatus?: CatalogueAssetRecord["evidenceStatus"];
  productionMethod?: string;
  responsiblePublisher?: CatalogueManifest["release"]["responsiblePublisher"];
  rights?: CatalogueAssetRecord["rights"];
  publication?: CatalogueAssetRecord["publication"];
  metrics: {
    triangles: number;
    materials: number;
    meshCount: number;
    compressed: boolean;
  };
};

export const CATALOGUE_MANIFEST = catalogueManifestJson as unknown as CatalogueManifest;

const categoryPriority: Record<AssetCategory, number> = {
  "Lost Heritage": 100,
  "Homes & Neighbourhoods": 200,
  "Culture & Landmarks": 300,
  "Transit & Movement": 400,
  "Street Life & Nature": 500,
  "Service Gear": 600,
  People: 1_000,
};

export function sortAssetsByIconicLevel(assets: CollectionAsset[]) {
  return [...assets].sort((left, right) => {
    const leftRank = left.curatedOrder ?? categoryPriority[left.category] + (left.featured ? -40 : 0);
    const rightRank = right.curatedOrder ?? categoryPriority[right.category] + (right.featured ? -40 : 0);
    return leftRank - rightRank || left.name.localeCompare(right.name);
  });
}

function collectionAsset(record: CatalogueAssetRecord): CollectionAsset {
  const english = record.locale.en;
  const historySource = record.sources.find((source) => source.kind === "history");
  const downloadAllowed = record.rights.download.status === "cleared";
  return {
    id: record.id,
    slug: record.slug,
    name: english.name,
    file: record.model.file,
    modelUrl: record.model.publicPath,
    cardPreviewUrl: record.cardPreview.publicPath ?? (record.cardPreview.sourcePath ? `/previews/${record.slug}.png` : undefined),
    cardPreviewStatus: record.cardPreview.status,
    category: record.category,
    curatedOrder: record.curatedOrder,
    intro: english.intro,
    gameContext: english.gameContext,
    singaporeContext: english.singaporeContext,
    productionStory: english.productionStory,
    inspiration: english.inspiration ?? undefined,
    historySource: historySource ? { label: historySource.label, url: historySource.url } : undefined,
    provenance: record.provenance.label,
    provenanceDetail: record.provenance.detail,
    collection: "game",
    creator: record.creatorCredit.status === "verified" ? record.creatorCredit.name ?? undefined : undefined,
    linkedinUrl: record.creatorCredit.status === "verified" ? record.creatorCredit.url ?? undefined : undefined,
    downloadAllowed,
    downloadUrl: downloadAllowed ? `/api/v1/assets/${encodeURIComponent(`game:${record.id}`)}/download` : undefined,
    modelSha256: record.model.sha256,
    modelByteLength: record.model.byteLength,
    evidenceStatus: record.evidenceStatus,
    productionMethod: record.productionMethod,
    responsiblePublisher: CATALOGUE_MANIFEST.release.responsiblePublisher,
    rights: record.rights,
    publication: record.publication,
    metrics: record.metrics,
  };
}

export const GAME_ASSETS = CATALOGUE_MANIFEST.assets.map(collectionAsset);
