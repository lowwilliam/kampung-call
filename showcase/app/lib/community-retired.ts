export function communityRetiredResponse() {
  return Response.json(
    {
      error: "Community submissions and interactions are retired. The public catalogue is read-only.",
      catalogue: "/api/v1/assets?collection=game",
    },
    {
      status: 410,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

export function communityInventoryReadOnlyResponse() {
  return Response.json(
    {
      error: "Historical Community records are inventory-only. Publishing, editing, moderation and deletion are disabled.",
    },
    {
      status: 410,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
