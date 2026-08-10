import { bindings, ensureSchema, purgeExpiredModels } from "../../lib/platform";

type PublishedRow = {
  id: string;
  slug: string;
  display_name: string;
  contributor_name: string;
  linkedin_url: string | null;
  display_linkedin: number;
  description: string;
  singapore_connection: string;
  source_name: string;
  source_url: string | null;
  category: string;
  triangle_count: number;
  material_count: number;
  animation_count: number;
  mesh_count: number;
  featured: number;
};

export async function GET() {
  await ensureSchema();
  await purgeExpiredModels();
  const { DB } = bindings();
  const result = await DB.prepare(
    `SELECT id, slug, display_name, contributor_name, linkedin_url, display_linkedin,
      description, singapore_connection, source_name, source_url, category,
      triangle_count, material_count, animation_count, mesh_count, featured
     FROM submissions WHERE status = 'published'
     ORDER BY featured DESC, published_at DESC`,
  ).all<PublishedRow>();

  const assets = (result.results ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.display_name,
    file: `${row.slug}.glb`,
    modelUrl: `/api/models/${row.id}`,
    category: row.category,
    intro: row.description,
    gameContext: "Published in the Made in Singapore collection; community work remains distinct from the assets shipped in Kampung Call.",
    singaporeContext: row.singapore_connection,
    productionStory: `${row.mesh_count.toLocaleString()} meshes, ${row.material_count.toLocaleString()} materials, ${row.triangle_count.toLocaleString()} triangles and ${row.animation_count.toLocaleString()} animation clips.`,
    provenance: row.source_name || "Community submission",
    provenanceDetail: row.source_url ? `Original source: ${row.source_url}` : "Published with the contributor’s rights attestation and administrator approval.",
    collection: "community",
    creator: row.contributor_name,
    linkedinUrl: row.display_linkedin ? row.linkedin_url : undefined,
    featured: Boolean(row.featured),
    metrics: {
      triangles: row.triangle_count,
      materials: row.material_count,
      meshCount: row.mesh_count,
      compressed: false,
    },
  }));

  return Response.json({ assets }, { headers: { "cache-control": "public, max-age=60" } });
}
