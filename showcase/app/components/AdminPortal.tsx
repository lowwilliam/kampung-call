"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

function AdminCard({ item }: { item: AdminSubmission }) {
  return (
    <article className="admin-review-card">
      <div className="admin-model-stage">
        <div className="inventory-object-mark" aria-hidden="true">
          <strong>{item.file_name.split(".").at(0)?.slice(0, 2).toUpperCase() || "3D"}</strong>
          <span>Retained object</span>
        </div>
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
        <dl className="inventory-facts">
          <div><dt>Category</dt><dd>{item.category}</dd></div>
          <div><dt>Contributor</dt><dd>{item.contributor_name}</dd></div>
          <div><dt>LinkedIn</dt><dd>{item.linkedin_url ? <a href={item.linkedin_url} target="_blank" rel="noreferrer">Open profile ↗</a> : "Not recorded"}</dd></div>
          <div><dt>Source</dt><dd>{item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_name} ↗</a> : item.source_name}</dd></div>
          <div className="full"><dt>Description</dt><dd>{item.description}</dd></div>
          <div className="full"><dt>Singapore connection</dt><dd>{item.singapore_connection}</dd></div>
          <div className="full"><dt>Private note</dt><dd>{item.admin_notes || "None recorded"}</dd></div>
        </dl>
        <div className="inventory-actions">
          <a href={item.modelUrl} target="_blank" rel="noreferrer">Inspect retained GLB ↗</a>
          <span>No publish, edit, moderation or deletion actions are available.</span>
        </div>
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

  if (authenticated === null) return <main className="admin-login-page"><div className="receipt-loading">Opening the private inventory…</div></main>;
  if (!authenticated) return (
    <main className="admin-login-page">
      <a className="back-link" href="/">← Public collection</a>
      <section className="admin-login-card">
        <span className="admin-seal">KC</span>
        <p className="eyebrow">Historical data inventory</p>
        <h1>Enter the private inventory.</h1>
        <p>Inspect retained Community records and quarantined models without changing or deleting them.</p>
        <form onSubmit={login}><label>Administrator password<input type="password" name="password" autoComplete="current-password" required /></label><button type="submit">Unlock admin →</button></form>
        {loginError && <p className="form-error" role="alert">{loginError}</p>}
      </section>
    </main>
  );

  return (
    <div className="admin-page">
      <header className="admin-header"><a href="/">KC / The Collection</a><div><span>Password-protected inventory</span><button type="button" onClick={() => void logout()}>Lock</button></div></header>
      <main className="admin-main">
        <section className="admin-intro"><div><p className="eyebrow">Inventory-only recovery</p><h1>Inspect history.<br />Mutate nothing.</h1></div><div className="queue-count"><strong>{submissions.length}</strong><span>records retained</span></div></section>
        <p className="inventory-lock-note">This view performs no automatic purge and exposes no content-changing actions. Hosted D1/R2 records remain untouched until the inventory is completed.</p>
        <nav className="admin-filters" aria-label="Submission states">
          {[{ id: "review", label: "To review" }, { id: "published", label: "Published" }, { id: "rejected", label: "Rejected" }, { id: "unpublished", label: "Unpublished" }, { id: "all", label: "All" }].map((item) => <button key={item.id} type="button" className={filter === item.id ? "is-active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}
        </nav>
        <section className="admin-queue">
          {visible.length ? visible.map((item) => <AdminCard key={item.id} item={item} />) : <div className="admin-empty"><span>✓</span><h2>Nothing in this state.</h2><p>No retained records match this filter.</p></div>}
        </section>
      </main>
    </div>
  );
}
