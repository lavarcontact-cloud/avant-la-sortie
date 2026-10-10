import type { MetadataRoute } from "next";
import { getArtists, getProjects } from "@/lib/content";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages = ["", "/flux", "/artistes", "/projets", "/photo", "/a-propos", "/prestations", "/devis", "/contact", "/mentions-legales", "/confidentialite", "/cookies", "/cgv"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.6 })),
    ...getProjects().map((p) => ({ url: `${base}/projets/${p.slug}`, changeFrequency: "yearly" as const, priority: 0.8 })),
    ...getArtists().map((a) => ({ url: `${base}/artistes/${a.slug}`, changeFrequency: "yearly" as const, priority: 0.5 })),
  ];
}
