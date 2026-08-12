"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "../data/game-assets";
import { ModelViewer } from "./ModelViewer";

type AdminSubmission = {
  id: string;
  display_name: string;
  contributor_name: string;
  linkedin_url: string | null;
  display_linkedin: number;
  description: string;
  singapore_connection: string;
  source_name: string;
  source_url: string | null;
  category: string;
  file_name: string;
  file_size: number;
  triangle_count: number;
  material_count: number;
  animation_count: number;
  mesh_count: number;
  validation_status: string;
  validation_checks: string[];
  status: string;
  admin_notes: string;
  featured: number;
  download_allowed: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  open_reports: number;
  modelUrl: string;
};

function AdminCard({ item, onUpdated }: { item: AdminSubmission; onUpdated: () => Promise<void> }) {
  const [draft, setDraft] = useState({
    displayName: item.display_name,
    description: item.description,
    singaporeConnection: item.singapore_connection,
    sourceName: item.source_name,
    sourceUrl: item.source_url ?? "",
    category: item.category,
    adminNotes: item.admin_notes,
    featured: Boolean(item.featured),
  });
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  const update = async (action: string) => {
    setWorking(action);
    setError("");
    try {
      const response = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, action, ...draft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Update failed");
      await onUpdated();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Update failed");
    } finally {
      setWorking("");
    }
  };

  return (
    <article className="admin-review-card">
      <div className="admin-model-stage">
        <ModelViewer url={item.modelUrl} label={item.display_name} expanded eager />
        <span className={`review-pill ${item.validation_status === "safe" ? "is-safe" : "is-warning"}`}>{item.validation_status === "safe" ? "Auto safe" : "Needs review"}</span>
      </div>
      <div className="admin-review-copy">
        <div className="admin-card-heading">
          <div><p className="eyebrow">{item.status.replaceAll("-", " ")}</p><h2>{item.display_name}</h2><span>{item.contributor_name} · {new Date(item.created_at).toLocaleString()}</span></div>
          {item.open_reports > 0 && <strong className="report-count">{item.open_reports} open {item.open_reports === 1 ? "report" : "reports"}</strong>}
        </div>
        <div className="technical-strip">
          <span>{(item.file_size / 1024 / 1024).toFixed(2)} MB</span><span>{item.triangle_count.toLocaleString()} tris</span><span>{item.material_count} materials</span><span>{item.animation_count} clips</span><span>{item.download_allowed ? "Downloads granted" : "View only"}</span>
        </div>
        <ul className="admin-checks">{item.validation_checks.map((check) => <li key={check}>{check}</li>)}</ul>
        <details className="admin-edit" open={item.status !== "published"}>
          <summary>Public copy + provenance</summary>
          <div className="admin-form-grid">
            <label>Display name<input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
            <label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="full">Introduction<textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <label className="full">Singapore connection<textarea rows={3} value={draft.singaporeConnection} onChange={(event) => setDraft({ ...draft, singaporeConnection: event.target.value })} /></label>
            <label>Source<input value={draft.sourceName} onChange={(event) => setDraft({ ...draft, sourceName: event.target.value })} /></label>
            <label>Source URL<input value={draft.sourceUrl} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} /></label>
            <label className="full">Private review note<textarea rows={3} value={draft.adminNotes} onChange={(event) => setDraft({ ...draft, adminNotes: event.target.value })} placeholder="Visible on the contributor’s private receipt" /></label>
            <label className="check-label full"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} />Feature ahead of newly published community models</label>
          </div>
        </details>
        <div className="admin-card-actions">
          {item.status !== "published" && <button type="button" className="approve" onClick={() => void update("publish")} disabled={Boolean(working)}>{working === "publish" ? "Publishing…" : "Publish"}</button>}
          {item.status === "published" && <button type="button" onClick={() => void update("metadata-updated")} disabled={Boolean(working)}>Save changes</button>}
          {item.status === "published" && <button type="button" onClick={() => void update("unpublish")} disabled={Boolean(working)}>Unpublish</button>}
          {!["published", "rejected"].includes(item.status) && <button type="button" onClick={() => void update("request-changes")} disabled={Boolean(working)}>Request changes</button>}
          {item.status !== "rejected" && <button type="button" className="danger" onClick={() => void update("reject")} disabled={Boolean(working)}>Reject</button>}
          {item.status === "rejected" && <button type="button" className="danger" onClick={() => void update("delete-model")} disabled={Boolean(working)}>Remove model now</button>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </article>
  );
}

export function AdminPortal() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [filter, setFilter] = useState("review");
  const [loginError, setLoginError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/submissions", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    const payload = await response.json();
    setSubmissions(payload.submissions ?? []);
    setAuthenticated(true);
  }, []);

  useEffect(() => {
    void fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => payload.authenticated ? load() : setAuthenticated(false))
      .catch(() => setAuthenticated(false));
  }, [load]);

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: form.get("password") }),
    });
    const payload = await response.json();
    if (!response.ok) return setLoginError(payload.error || "Could not sign in.");
    await load();
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setSubmissions([]);
  };

  const visible = useMemo(() => submissions.filter((item) => {
    if (filter === "all") return true;
    if (filter === "review") return ["submitted", "needs-review", "changes-requested"].includes(item.status);
    return item.status === filter;
  }), [submissions, filter]);

  if (authenticated === null) return <main className="admin-login-page"><div className="receipt-loading">Opening the review room…</div></main>;
  if (!authenticated) return (
    <main className="admin-login-page">
      <Link className="back-link" href="/">← Public collection</Link>
      <section className="admin-login-card">
        <span className="admin-seal">KC</span>
        <p className="eyebrow">Collection administration</p>
        <h1>Enter the review room.</h1>
        <p>Submissions, quarantined models and publication controls are private.</p>
        <form onSubmit={login}><label>Administrator password<input type="password" name="password" autoComplete="current-password" required /></label><button type="submit">Unlock admin →</button></form>
        {loginError && <p className="form-error" role="alert">{loginError}</p>}
      </section>
    </main>
  );

  const reviewCount = submissions.filter((item) => ["submitted", "needs-review", "changes-requested"].includes(item.status)).length;
  return (
    <div className="admin-page">
      <header className="admin-header"><Link href="/">KC / The Collection</Link><div><span>Password-protected review room</span><button type="button" onClick={() => void logout()}>Lock</button></div></header>
      <main className="admin-main">
        <section className="admin-intro"><div><p className="eyebrow">Administrator</p><h1>Review with care.<br />Publish with confidence.</h1></div><div className="queue-count"><strong>{reviewCount}</strong><span>waiting for review</span></div></section>
        <nav className="admin-filters" aria-label="Submission states">
          {[{ id: "review", label: "To review" }, { id: "published", label: "Published" }, { id: "rejected", label: "Rejected" }, { id: "unpublished", label: "Unpublished" }, { id: "all", label: "All" }].map((item) => <button key={item.id} type="button" className={filter === item.id ? "is-active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}
        </nav>
        <section className="admin-queue">
          {visible.length ? visible.map((item) => <AdminCard key={item.id} item={item} onUpdated={load} />) : <div className="admin-empty"><span>✓</span><h2>Nothing in this queue.</h2><p>The collection is steady.</p></div>}
        </section>
      </main>
    </div>
  );
}
