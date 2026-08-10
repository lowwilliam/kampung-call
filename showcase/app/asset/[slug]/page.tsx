import { CollectionApp } from "../../components/CollectionApp";

export default async function AssetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CollectionApp initialSlug={slug} />;
}
