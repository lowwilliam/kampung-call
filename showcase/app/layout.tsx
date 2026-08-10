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
    title: "The Kampung Call Collection",
    description: "Explore 55 objects, places and people behind Kampung Call in interactive 360°.",
    openGraph: {
      title: "The Kampung Call Collection",
      description: "55 objects. One hand-built world.",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "The Kampung Call Collection" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "The Kampung Call Collection",
      description: "55 objects. One hand-built world.",
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
