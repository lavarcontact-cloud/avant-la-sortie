// Fournisseurs de recherche pour la veille. Architecture ouverte : ajouter un fournisseur
// = implémenter SearchProvider. Aucun fournisseur ne simule de résultats.
import type { SearchResult } from "./core";

export interface SearchProvider {
  id: string;
  label: string;
  configured: boolean;
  search(query: string, opts?: { limit?: number; recentDays?: number }): Promise<SearchResult[]>;
}

/** Firecrawl Search API (https://firecrawl.dev) — nécessite FIRECRAWL_API_KEY. */
export function firecrawlProvider(fetchImpl: typeof fetch = fetch): SearchProvider {
  const key = process.env.FIRECRAWL_API_KEY;
  return {
    id: "firecrawl",
    label: "Firecrawl Search",
    configured: Boolean(key),
    async search(query, opts = {}) {
      if (!key) throw new Error("FIRECRAWL_API_KEY manquant");
      const body: Record<string, unknown> = { query, limit: Math.min(20, opts.limit ?? 10), location: "France" };
      if (opts.recentDays) body.tbs = opts.recentDays <= 7 ? "qdr:w" : opts.recentDays <= 31 ? "qdr:m" : "qdr:y";
      const res = await fetchImpl("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json: any = await res.json();
      // v2 : { data: { web: [...] } } — v1 : { data: [...] }
      const items: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json?.data?.web) ? json.data.web : [];
      return items
        .filter((x) => typeof x?.url === "string")
        .map((x) => ({ url: x.url, title: String(x.title ?? ""), snippet: String(x.description ?? x.snippet ?? x.markdown?.slice?.(0, 400) ?? ""), date: x.date ?? null }));
    },
  };
}

export function getProvider(): SearchProvider | null {
  const p = firecrawlProvider();
  return p.configured ? p : null;
}

/**
 * Import manuel : résultats collés depuis vos propres recherches.
 * Une ligne = URL ; titre ; extrait (séparateur « ; » ou tabulation). Le titre et l'extrait sont facultatifs.
 */
export function parseManualResults(text: string): SearchResult[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/\t|\s*;\s*/);
    const url = parts[0];
    return { url, title: parts[1] ?? "", snippet: parts.slice(2).join(" ; ") };
  }).filter((r) => /^https?:\/\/\S+\.\S+/i.test(r.url));
}
