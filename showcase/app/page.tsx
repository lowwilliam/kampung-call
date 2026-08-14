import { CollectionApp, type CatalogueCardAsset } from "./components/CollectionApp";
import { CATEGORIES, GAME_ASSETS } from "./data/game-assets";

const CARD_ASSETS = GAME_ASSETS.map((asset): CatalogueCardAsset => ({
  id: asset.id,
  slug: asset.slug,
  name: asset.name,
  category: asset.category,
  curatedOrder: asset.curatedOrder ?? 0,
  intro: asset.intro,
  cardPreviewUrl: asset.cardPreviewUrl,
}));

function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : "";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedCategory = value(params.category);
  const initialCategory = CATEGORIES.includes(requestedCategory as (typeof CATEGORIES)[number]) ? requestedCategory : "All objects";
  const initialQuery = value(params.q).slice(0, 120);
  const initialSort = value(params.sort) === "alphabetical" ? "alphabetical" : "curated";
  return (
    <CollectionApp
      assets={CARD_ASSETS}
      categories={CATEGORIES}
      initialCategory={initialCategory}
      initialQuery={initialQuery}
      initialSort={initialSort}
    />
  );
}
