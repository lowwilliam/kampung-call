import type { Metadata } from "next";
import { CATALOGUE_MANIFEST } from "./data/game-assets";
import "./globals.css";

const origin = CATALOGUE_MANIFEST.release.productionDomain ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: "Kampung 3D Collection",
  description: "Explore 68 curated Singapore-connected 3D assets through a read-only public catalogue.",
  openGraph: {
    title: "Kampung 3D Collection",
    description: "Singapore, modelled one carefully sourced object at a time.",
    images: [{ url: "/og-kampung-3d.png", width: 1536, height: 1024, alt: "Kampung 3D Collection" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kampung 3D Collection",
    description: "Singapore, modelled one carefully sourced object at a time.",
    images: ["/og-kampung-3d.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
