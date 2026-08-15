export const metadata = {
  title: "Submissions closed · Kampung 3D Collection",
  description: "Kampung 3D Collection is now a read-only catalogue.",
  robots: { index: false, follow: false },
};

export default function SubmitPage() {
  return (
    <main className="receipt-page">
      <a className="back-link" href="/">← The Collection</a>
      <section className="receipt-lookup">
        <p className="eyebrow">Read-only catalogue</p>
        <h1>Submissions are closed.</h1>
        <p>The Community programme has been retired. The public Collection now documents 73 curated Game Assets through one versioned Catalogue Manifest.</p>
        <a className="primary-link" href="/">Browse the catalogue →</a>
      </section>
    </main>
  );
}
