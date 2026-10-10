import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, Space_Mono } from "next/font/google";
import { Dock, Footer, TopBar } from "@/components/chrome";
import { ConsentProvider } from "@/components/consent";
import { Telemetry } from "@/components/telemetry";
import { site } from "@/lib/content";
import { siteUrl } from "@/lib/env";
import "./globals.css";

// next/font auto-héberge les fichiers au build : aucune requête vers Google
// depuis le navigateur des visiteurs (pas de transfert d'IP à un tiers).
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono-space", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${site.name}, réalisateur et photographe`, template: `%s · ${site.name}` },
  description: site.baseline,
  openGraph: { type: "website", locale: "fr_FR", siteName: site.name },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  // Préproduction : pas d'indexation tant que contenus et droits ne sont pas validés.
  robots: process.env.SITE_INDEXABLE === "true" ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${bricolage.variable} ${inter.variable} ${mono.variable}`}>
      <body>
        <a href="#contenu" className="sr-only-focusable fixed left-3 top-3 z-[80] rounded-full bg-[var(--color-fg)] px-4 py-2 text-[var(--color-ink)]">
          Aller au contenu
        </a>
        <ConsentProvider>
          <TopBar />
          <main id="contenu">{children}</main>
          <Footer />
          <Dock />
          <Telemetry />
        </ConsentProvider>
        <div className="grain" aria-hidden />
      </body>
    </html>
  );
}
