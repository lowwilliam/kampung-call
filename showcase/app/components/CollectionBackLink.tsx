"use client";

import type { MouseEvent } from "react";

const COLLECTION_RETURN_KEY = "kampung-3d-collection-return";
const RETURN_MAX_AGE = 30 * 60 * 1000;

type CollectionReturnState = {
  url: string;
  savedAt: number;
};

export function rememberCollectionPosition() {
  const state: CollectionReturnState = {
    url: `${window.location.pathname}${window.location.search}`,
    savedAt: Date.now(),
  };
  window.sessionStorage.setItem(COLLECTION_RETURN_KEY, JSON.stringify(state));
}

export function CollectionBackLink({ href }: { href: string }) {
  const goBack = (event: MouseEvent<HTMLAnchorElement>) => {
    try {
      const raw = window.sessionStorage.getItem(COLLECTION_RETURN_KEY);
      const state = raw ? JSON.parse(raw) as CollectionReturnState : null;
      const returnUrl = new URL(href, window.location.href);
      const storedUrl = state ? new URL(state.url, window.location.href) : null;
      const isRecent = Boolean(state && Date.now() - state.savedAt < RETURN_MAX_AGE);
      const isSameCollection = Boolean(storedUrl && storedUrl.pathname === returnUrl.pathname && storedUrl.search === returnUrl.search);
      if (isRecent && isSameCollection && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    } catch {
      // The normal href remains a complete, anchor-based fallback.
    }
  };

  return <a className="icon-button" href={href} onClick={goBack} aria-label="Back to collection">←</a>;
}
