import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: "3D Singapore Collection",
    description: "Explore original and community-made Singapore objects, places and people in interactive 360°.",
    openGraph: {
      title: "3D Singapore Collection",
      description: "Singapore, modelled one icon at a time.",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "3D Singapore Collection" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "3D Singapore Collection",
      description: "Singapore, modelled one icon at a time.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
