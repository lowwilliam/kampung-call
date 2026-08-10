"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SubmissionStatus = {
  displayName: string;
  contributorName: string;
  status: string;
  adminNotes: string;
  validationStatus: string;
  validationChecks: string[];
  fileName: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
};

const statusCopy: Record<string, { label: string; note: string }> = {
  submitted: { label: "Submitted", note: "Your model passed its first checks and is waiting for an administrator." },
  "needs-review": { label: "Needs review", note: "The model is safe in quarantine, with one or more technical checks for the administrator." },
  "changes-requested": { label: "Changes requested", note: "Read the note below, revise your GLB and send a replacement through this receipt." },
  published: { label: "Published", note: "Your model is live in Made in Singapore." },
  rejected: { label: "Rejected", note: "This submission will not be published. The quarantined model is scheduled for removal." },
  unpublished: { label: "Unpublished", note: "The model is no longer visible in the public collection." },
};

export function ReceiptPortal({ token }: { token: string }) {
  const [submission, setSubmission] = useState<SubmissionStatus | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "updating">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/submissions/status?receipt=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setSubmission(payload.submission);
      setState("ready");
    } catch {
      setState("missing");
    }
  }, [token]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const replaceModel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("updating");
    setMessage("");
    const form = new FormData(event.currentTarget);
    form.set("receipt", token);
    try {
      const response = await fetch("/api/submissions/status", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not replace the model.");
      setMessage("Revision received. Your model is back in the review queue.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not replace the model.");
      setState("ready");
    }
  };

  const withdraw = async () => {
    if (!window.confirm("Withdraw this submission and schedule its model for deletion?")) return;
    setState("updating");
    const response = await fetch(`/api/submissions/status?receipt=${encodeURIComponent(token)}`, { method: "DELETE" });
    if (response.ok) {
      setMessage("The submission has been withdrawn. Its model is scheduled for deletion after seven days.");
      await load();
    } else {
      setMessage("The submission could not be withdrawn.");
      setState("ready");
    }
  };

  if (state === "loading") return <main className="receipt-page"><div className="receipt-loading">Opening your private receipt…</div></main>;
  if (state === "missing") return <main className="receipt-page"><Link className="back-link" href="/">← The Collection</Link><section className="receipt-lookup"><p className="eyebrow">Receipt not found</p><h1>This private link is incomplete or invalid.</h1><Link className="primary-link" href="/receipt">Enter a recovery code →</Link></section></main>;
  if (!submission) return null;

  const status = statusCopy[submission.status] ?? { label: submission.status, note: "This submission is being reviewed." };
  const canRevise = ["changes-requested", "rejected", "unpublished"].includes(submission.status);
  const canWithdraw = !["rejected", "unpublished"].includes(submission.status);

  return (
    <main className="receipt-page">
      <Link className="back-link" href="/">← The Collection</Link>
      <section className="receipt-card">
        <div className="receipt-heading">
          <div><p className="eyebrow">Private receipt</p><h1>{submission.displayName}</h1><p>Submitted by {submission.contributorName}</p></div>
          <span className={`review-state state-${submission.status}`}>{status.label}</span>
        </div>
        <div className="receipt-status-note"><strong>{status.label}</strong><p>{status.note}</p></div>
        {submission.adminNotes && <div className="admin-note"><span>Administrator note</span><p>{submission.adminNotes}</p></div>}
        <div className="receipt-columns">
          <div><span>File</span><strong>{submission.fileName}</strong><small>{(submission.fileSize / 1024 / 1024).toFixed(2)} MB</small></div>
          <div><span>Submitted</span><strong>{new Date(submission.createdAt).toLocaleDateString()}</strong><small>Updated {new Date(submission.updatedAt).toLocaleDateString()}</small></div>
        </div>
        <ul className="check-list">{submission.validationChecks.map((check) => <li key={check}><span>✓</span>{check}</li>)}</ul>
        {canRevise && (
          <form className="revision-form" onSubmit={replaceModel}>
            <label>Replace the GLB<input type="file" name="model" accept=".glb,model/gltf-binary" required /></label>
            <button type="submit" disabled={state === "updating"}>Submit revision</button>
          </form>
        )}
        {message && <p className="receipt-message" role="status">{message}</p>}
        <div className="receipt-actions">
          {submission.status === "published" && <Link href="/?collection=community">View Made in Singapore ↗</Link>}
          {canWithdraw && <button type="button" onClick={() => void withdraw()} disabled={state === "updating"}>Withdraw submission</button>}
        </div>
      </section>
    </main>
  );
}
