import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

/** Tant que SITE_INDEXABLE n'est pas "true", le site demande à ne pas être indexé (préproduction). */
export default function robots(): MetadataRoute.Robots {
  const indexable = process.env.SITE_INDEXABLE === "true";
  return {
    rules: indexable ? [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/paiement"] }] : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
