"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "../data/game-assets";
import { ModelViewer } from "./ModelViewer";

type Draft = {
  displayName: string;
  contributorName: string;
  linkedinUrl: string;
  displayLinkedin: boolean;
  description: string;
  singaporeConnection: string;
  sourceName: string;
  sourceUrl: string;
  category: string;
};

const emptyDraft: Draft = {
  displayName: "",
  contributorName: "",
  linkedinUrl: "",
  displayLinkedin: false,
  description: "",
  singaporeConnection: "",
  sourceName: "Original work",
  sourceUrl: "",
  category: "Street Life & Nature",
};

export function SubmitExperience() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(() => {
    if (typeof window === "undefined") return emptyDraft;
    try {
      const stored = localStorage.getItem("kc-submission-draft");
      return stored ? { ...emptyDraft, ...JSON.parse(stored) } : emptyDraft;
    } catch {
      return emptyDraft;
    }
  });
  const [model, setModel] = useState<File | null>(null);
  const [modelUrl, setModelUrl] = useState("");
  const [rights, setRights] = useState(false);
  const [allowDownload, setAllowDownload] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ receiptUrl: string; recoveryCode: string; checks: string[] } | null>(null);

  useEffect(() => {
    localStorage.setItem("kc-submission-draft", JSON.stringify(draft));
  }, [draft]);

  const chooseModel = (nextModel: File | null) => {
    if (modelUrl) URL.revokeObjectURL(modelUrl);
    setModel(nextModel);
    setModelUrl(nextModel ? URL.createObjectURL(nextModel) : "");
  };

  const modelIssue = useMemo(() => {
    if (!model) return "Choose a GLB to begin.";
    if (!model.name.toLowerCase().endsWith(".glb")) return "The file must use the .glb format.";
    if (model.size > 20 * 1024 * 1024) return "The file must be 20 MB or smaller.";
    return "";
  }, [model]);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const next = () => {
    setError("");
    if (step === 1 && modelIssue) return setError(modelIssue);
    if (step === 2 && (!draft.displayName || !draft.contributorName || !draft.description || !draft.singaporeConnection || !draft.sourceName)) {
      return setError("Complete the required story and source fields.");
    }
    setStep((current) => Math.min(3, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!model || modelIssue || !rights) {
      setError(!rights ? "Confirm the rights statement before submitting." : modelIssue);
      return;
    }
    setState("sending");
    setError("");
    const form = new FormData();
    form.set("model", model);
    Object.entries(draft).forEach(([key, value]) => form.set(key, String(value)));
    form.set("rightsAttested", "true");
    form.set("allowDownload", String(allowDownload));
    form.set("website", "");
    try {
      const response = await fetch("/api/submissions", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The submission could not be saved.");
      setReceipt(payload);
      setState("success");
      localStorage.removeItem("kc-submission-draft");
    } catch (submissionError) {
      setState("error");
      setError(submissionError instanceof Error ? submissionError.message : "The submission could not be saved.");
    }
  };

  if (state === "success" && receipt) {
    const fullUrl = typeof window === "undefined" ? receipt.receiptUrl : `${window.location.origin}${receipt.receiptUrl}`;
    return (
      <main className="submit-success-page">
        <a className="back-link" href="/">← The Collection</a>
        <section className="success-card">
          <span className="success-mark">✓</span>
          <p className="eyebrow">Submission received</p>
          <h1>Your model is safely in review.</h1>
          <p>It remains private until an administrator approves it. Save both the link and recovery code—you do not need an account, but we cannot recover these for you.</p>
          <div className="receipt-box"><span>Private receipt link</span><code>{fullUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(fullUrl)}>Copy link</button></div>
          <div className="receipt-box"><span>Recovery code</span><code>{receipt.recoveryCode}</code><button type="button" onClick={() => void navigator.clipboard.writeText(receipt.recoveryCode)}>Copy code</button></div>
          <ul>{receipt.checks.map((check) => <li key={check}>{check}</li>)}</ul>
          <a className="primary-link" href={receipt.receiptUrl}>Open my receipt ↗</a>
        </section>
      </main>
    );
  }

  return (
    <div className="submission-page">
      <header className="submission-header">
        <a href="/">← The Collection</a>
        <span>Community collection · Open call</span>
      </header>
      <main className="submission-main">
        <section className="submission-intro">
          <p className="eyebrow">Community submission</p>
          <h1>Add your piece<br />of Singapore.</h1>
          <p>One self-contained GLB. One meaningful connection. Every accepted object receives a live 360° stage and creator credit.</p>
          <ol className="step-list">
            {["Model", "Story + source", "Review"].map((label, index) => (
              <li key={label} className={step === index + 1 ? "is-active" : step > index + 1 ? "is-complete" : ""}>
                <span>{String(index + 1).padStart(2, "0")}</span>{label}
              </li>
            ))}
          </ol>
        </section>

        <section className="submission-workspace">
          {step === 1 && (
            <div className="submit-step">
              <div className="step-heading"><span>01</span><div><h2>Choose your model</h2><p>GLB 2.0 · embedded textures · maximum 20 MB</p></div></div>
              <label className={`drop-zone ${model ? "has-file" : ""}`}>
                <input type="file" accept=".glb,model/gltf-binary" onChange={(event) => chooseModel(event.target.files?.[0] ?? null)} />
                {modelUrl ? <ModelViewer url={modelUrl} label={model?.name ?? "Uploaded model"} expanded eager /> : <><strong>Drop your GLB here</strong><span>or choose a file</span></>}
                {model && <small>{model.name} · {(model.size / 1024 / 1024).toFixed(2)} MB</small>}
              </label>
              <div className="validation-preview"><span className={modelIssue ? "dot" : "dot is-safe"} />{modelIssue || "Ready for full server-side inspection"}</div>
            </div>
          )}

          {step === 2 && (
            <div className="submit-step">
              <div className="step-heading"><span>02</span><div><h2>Tell its story</h2><p>Your name becomes the public creator credit.</p></div></div>
              <div className="form-grid">
                <label>Object name *<input value={draft.displayName} onChange={(event) => setField("displayName", event.target.value)} maxLength={80} placeholder="e.g. Tiong Bahru Letterbox" /></label>
                <label>Your name *<input value={draft.contributorName} onChange={(event) => setField("contributorName", event.target.value)} maxLength={80} placeholder="How you want to be credited" /></label>
                <label className="full">Short introduction *<textarea value={draft.description} onChange={(event) => setField("description", event.target.value)} rows={4} maxLength={800} placeholder="What are we looking at?" /></label>
                <label className="full">Singapore connection *<textarea value={draft.singaporeConnection} onChange={(event) => setField("singaporeConnection", event.target.value)} rows={4} maxLength={800} placeholder="What makes this subject or story meaningfully connected to Singapore?" /></label>
                <label>Creator / original source *<input value={draft.sourceName} onChange={(event) => setField("sourceName", event.target.value)} maxLength={160} /></label>
                <label>Source or licence link<input type="url" value={draft.sourceUrl} onChange={(event) => setField("sourceUrl", event.target.value)} placeholder="https://…" /></label>
                <label>Collection category<select value={draft.category} onChange={(event) => setField("category", event.target.value)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>LinkedIn profile <small>optional</small><input type="url" value={draft.linkedinUrl} onChange={(event) => setField("linkedinUrl", event.target.value)} placeholder="https://linkedin.com/in/…" /></label>
                {draft.linkedinUrl && <label className="check-label full"><input type="checkbox" checked={draft.displayLinkedin} onChange={(event) => setField("displayLinkedin", event.target.checked)} />Display my LinkedIn with my public creator credit</label>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="submit-step review-step">
              <div className="step-heading"><span>03</span><div><h2>Review + grant</h2><p>Nothing becomes public before administrator approval.</p></div></div>
              <div className="review-summary">
                <div><span>Object</span><strong>{draft.displayName}</strong><p>{model?.name} · {model ? (model.size / 1024 / 1024).toFixed(2) : "0"} MB</p></div>
                <div><span>Creator</span><strong>{draft.contributorName}</strong><p>{draft.displayLinkedin ? "LinkedIn will be public" : "LinkedIn remains private"}</p></div>
                <div><span>Story</span><strong>{draft.category}</strong><p>{draft.singaporeConnection}</p></div>
              </div>
              <label className="rights-grant"><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} /><span><strong>I own this model or have permission to submit it.</strong>I grant the 3D Singapore Collection a revocable, non-exclusive right to store, render, resize, promote and display it. Ownership stays with me. The gallery will not offer a download button without separate permission, but any web-rendered model must be delivered to visitors’ browsers and cannot be made copy-proof.</span></label>
              <label className="rights-grant"><input type="checkbox" checked={allowDownload} onChange={(event) => setAllowDownload(event.target.checked)} /><span><strong>Allow individual GLB downloads.</strong>This optional grant lets visitors, the CLI and the MCP server download the published model. It does not grant redistribution or resale rights beyond the licence you provide.</span></label>
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="step-actions">
            {step > 1 && <button type="button" className="secondary-button" onClick={() => { setStep(step - 1); setError(""); }}>Back</button>}
            {step < 3 ? <button type="button" className="primary-button" onClick={next}>Continue <span>→</span></button> : <button type="button" className="primary-button" onClick={() => void submit()} disabled={state === "sending"}>{state === "sending" ? "Submitting…" : "Submit for review"}</button>}
          </div>
        </section>
      </main>
    </div>
  );
}
