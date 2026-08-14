"use client";

import { useEffect, useState } from "react";

export function AssetLikeButton({ assetId, assetName }: { assetId: string; assetName: string }) {
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/likes", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { counts: {}, liked: [] }))
      .then((payload) => {
        if (!active) return;
        setCount(payload.counts?.[assetId] ?? 0);
        setLiked((payload.liked ?? []).includes(assetId));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [assetId]);

  const toggle = async () => {
    if (pending) return;
    const previous = { count, liked };
    setPending(true);
    setLiked(!liked);
    setCount(Math.max(0, count + (liked ? -1 : 1)));
    try {
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save like");
      setLiked(Boolean(payload.liked));
      setCount(payload.count ?? 0);
    } catch {
      setLiked(previous.liked);
      setCount(previous.count);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      className={`detail-like-button ${liked ? "is-liked" : ""}`}
      type="button"
      aria-pressed={liked}
      aria-label={`${liked ? "Unlike" : "Like"} ${assetName}. ${count} likes`}
      disabled={pending}
      onClick={() => void toggle()}
    >
      <span aria-hidden="true">♥</span>
      {liked ? "Liked" : "Like this model"}
      <strong>{count.toLocaleString()}</strong>
    </button>
  );
}
