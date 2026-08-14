import type { Metadata } from "next";
import { CATALOGUE_MANIFEST } from "./data/game-assets";
import "./globals.css";

const origin = CATALOGUE_MANIFEST.release.productionDomain ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: "3D Singapore Collection",
  description: "Explore 68 curated Singapore-connected 3D assets through a read-only public catalogue.",
  openGraph: {
    title: "3D Singapore Collection",
    description: "Singapore, modelled one carefully sourced object at a time.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "3D Singapore Collection" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "3D Singapore Collection",
    description: "Singapore, modelled one carefully sourced object at a time.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
