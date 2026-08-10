"use client";

import Link from "next/link";
import { useState } from "react";

export default function ReceiptLookup() {
  const [code, setCode] = useState("");
  return (
    <main className="receipt-page">
      <Link className="back-link" href="/">← The Collection</Link>
      <section className="receipt-lookup">
        <p className="eyebrow">Private submission receipt</p>
        <h1>Return to your model.</h1>
        <p>Paste the recovery code saved when you submitted. It is never shared publicly.</p>
        <form onSubmit={(event) => { event.preventDefault(); if (code.trim()) window.location.href = `/receipt/${encodeURIComponent(code.trim())}`; }}>
          <label>Recovery code<input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" /></label>
          <button type="submit">Open receipt →</button>
        </form>
      </section>
    </main>
  );
}
