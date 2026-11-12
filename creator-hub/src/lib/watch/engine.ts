// Exécution de la veille : requêtes → résultats → déduplication → signaux → score → base.
import { q, one } from "../db";
import { checkEthics } from "../ethics";
import { todayParis } from "../dates";
import { getSetting, setSetting } from "../settings";
import {
  type SearchResult, type QueryPlan, normalizeDomain, rootDomain, normalizeName, normalizeUrl, nameFromDomain, isNonBrandDomain,
  parseProfileResult, detectSignals, signalsToOpportunities, guessSector, scoreOpportunity, contactQuality, planBrandQueries, planContactQueries, roleMatch,
} from "./core";
import { getProvider, type SearchProvider } from "./providers";

export interface WatchSettings { enabled: boolean; hour: number; max_queries: number; contact_searches: number; min_score_for_contacts: number }
export const DEFAULT_WATCH: WatchSettings = { enabled: true, hour: 8, max_queries: 12, contact_searches: 4, min_score_for_contacts: 35 };

interface Ctx {
  sectors: { id: number; name: string; keywords: string[] }[];
  brandsByDomain: Map<string, number>;
  brandsByName: Map<string, number>;
  runId: number;
  provider: string;
  stats: { results: number; new_brands: number; new_contacts: number; updated: number; known: number };
}

async function loadCtx(runId: number, provider: string): Promise<Ctx> {
  const sectors = await q<{ id: number; name: string; keywords: string[] }>(`select id, name, keywords from sectors where archived=false`);
  const brands = await q<{ id: number; name: string; website: string | null }>(`select id, name, website from brands`);
  const brandsByDomain = new Map<string, number>(), brandsByName = new Map<string, number>();
  for (const b of brands) {
    const d = normalizeDomain(b.website); if (d) brandsByDomain.set(rootDomain(d), b.id);
    brandsByName.set(normalizeName(b.name), b.id);
  }
  return { sectors, brandsByDomain, brandsByName, runId, provider, stats: { results: 0, new_brands: 0, new_contacts: 0, updated: 0, known: 0 } };
}

/** Intègre un résultat. Renvoie l'id du candidat créé/mis à jour (ou null si ignoré). */
async function ingest(ctx: Ctx, r: SearchResult, plan: QueryPlan, parentId: number | null): Promise<number | null> {
  ctx.stats.results++;
  const domain = normalizeDomain(r.url);
  if (!domain) return null;
  const text = `${r.title}\n${r.snippet}`;
  const ethics = checkEthics(text);
  if (!ethics.ok) return null; // secteurs exclus : jamais proposés
  const signals = detectSignals(text);
  const recentDays = r.date && !Number.isNaN(Date.parse(r.date)) ? Math.max(0, Math.round((Date.now() - Date.parse(r.date)) / 86400000)) : null;

  const profile = parseProfileResult(r);
  if (profile) {
    // Interlocuteur : seulement si une fonction cible apparaît dans le résultat public.
    if (!roleMatch(profile.person_role) && !roleMatch(text)) return null;
    const key = `contact:${normalizeUrl(profile.profileUrl)}`;
    const quality = contactQuality(profile.person_role, Boolean(profile.person_name));
    const company = profile.company ?? plan.brandName ?? null;
    const existing = await one<{ id: number; person_role: string | null; company: string | null; title: string | null }>(`select id, person_role, company, title from watch_candidates where dedup_key=$1`, [key]);
    if (existing) {
      const changed = (existing.person_role ?? "") !== (profile.person_role ?? "") || (existing.company ?? "") !== (company ?? "");
      await q(`update watch_candidates set last_seen_at=now(), seen_count=seen_count+1, last_run_id=$2, title=$3, snippet=$4,
        person_role=$5, company=$6, ${changed ? "previous=jsonb_build_object('person_role',person_role,'company',company), changed_at=now()," : ""} contact_quality=$7 where id=$1`,
        [existing.id, ctx.runId, r.title, r.snippet, profile.person_role, company, quality]);
      if (changed) ctx.stats.updated++; else ctx.stats.known++;
      return existing.id;
    }
    const brandId = company ? ctx.brandsByName.get(normalizeName(company)) ?? null : null;
    const row = await one<{ id: number }>(`insert into watch_candidates (kind, dedup_key, status, first_run_id, last_run_id, brand_id, parent_id, url, title, snippet,
      person_name, person_role, company, platform, signals, contact_quality, source_query, source_provider, domain)
      values ('contact',$1,'new',$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id`,
      [key, ctx.runId, brandId, parentId, profile.profileUrl, r.title, r.snippet, profile.person_name, profile.person_role, company, profile.platform, signals, quality, plan.query, ctx.provider, domain]);
    ctx.stats.new_contacts++;
    return row!.id;
  }

  if (isNonBrandDomain(domain)) return null;
  const root = rootDomain(domain);
  const key = `brand:${root}`;
  const sectorId = plan.sectorId ?? guessSector(text, ctx.sectors);
  const sector = ctx.sectors.find((s) => s.id === sectorId);
  const keywordHits = sector ? sector.keywords.filter((k) => normalizeName(text).includes(normalizeName(k))).length : 0;
  const knownBrandId = ctx.brandsByDomain.get(root) ?? null;
  const existing = await one<{ id: number; signals: string[]; status: string }>(`select id, signals, status from watch_candidates where dedup_key=$1`, [key]);
  const mergedSignals = [...new Set([...(existing?.signals ?? []), ...signals])] as typeof signals;
  const { score, lines } = scoreOpportunity({
    sectorMatched: Boolean(sector), keywordHits, signals: mergedSignals, recentDays,
    hasContactPage: /contact|presse|press|partenariat|partner/i.test(r.url), isProductBrand: Boolean(sector && /Tech|Fashion|Sport|Food/i.test(sector.name)),
  });
  if (existing) {
    // Déjà vue : jamais re-présentée comme nouvelle découverte.
    await q(`update watch_candidates set last_seen_at=now(), seen_count=seen_count+1, last_run_id=$2, signals=$3, opportunities=$4,
      score=greatest(coalesce(score,0),$5), score_breakdown=case when $5 >= coalesce(score,0) then $6::jsonb else score_breakdown end where id=$1`,
      [existing.id, ctx.runId, mergedSignals, signalsToOpportunities(mergedSignals), score, JSON.stringify(lines)]);
    ctx.stats.known++;
    return existing.id;
  }
  const name = (r.title.split(/\s+[|–—-]\s+/).find((p) => normalizeName(p).includes(normalizeName(nameFromDomain(root)))) ?? nameFromDomain(root)).trim().slice(0, 120);
  const row = await one<{ id: number }>(`insert into watch_candidates (kind, dedup_key, status, first_run_id, last_run_id, brand_id, sector_id, name, domain, url, title, snippet,
    signals, opportunities, score, score_breakdown, source_query, source_provider) values ('brand',$1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id`,
    [key, knownBrandId ? "known" : "new", ctx.runId, knownBrandId, sectorId, name, root, r.url, r.title, r.snippet, signals, signalsToOpportunities(signals), score, JSON.stringify(lines), plan.query, ctx.provider]);
  if (knownBrandId) ctx.stats.known++; else ctx.stats.new_brands++;
  return row!.id;
}

async function finish(ctx: Ctx, status: "done" | "failed", queries: string[], error?: string) {
  await q(`update watch_runs set status=$2, finished_at=now(), queries=$3, results=$4, new_brands=$5, new_contacts=$6, updated=$7, known=$8, error=$9 where id=$1`,
    [ctx.runId, status, JSON.stringify(queries), ctx.stats.results, ctx.stats.new_brands, ctx.stats.new_contacts, ctx.stats.updated, ctx.stats.known, error ?? null]);
  // Les interlocuteurs rattachés : améliore le score de la marque (pertinence du contact).
  await rescoreBrandsWithContacts();
}

export async function rescoreBrandsWithContacts() {
  const rows = await q<{ id: number; score_breakdown: any; best: string | null }>(`select b.id, b.score_breakdown,
    (select c.contact_quality from watch_candidates c where c.kind='contact' and (c.parent_id=b.id or (c.company is not null and lower(c.company)=lower(b.name)))
      order by case c.contact_quality when 'excellent' then 1 when 'bon' then 2 when 'générique' then 3 else 4 end limit 1) as best
    from watch_candidates b where b.kind='brand' and b.score_breakdown is not null`);
  for (const r of rows) {
    if (!r.best) continue;
    const lines = (r.score_breakdown as any[]).map((l) => l.key === "contact" ? { ...l, points: { excellent: 10, bon: 7, générique: 3, aucun: 0 }[r.best as "bon"] ?? 0, reason: `Interlocuteur trouvé (${r.best})` } : l);
    await q(`update watch_candidates set score_breakdown=$2, score=$3, contact_quality=$4 where id=$1`, [r.id, JSON.stringify(lines), lines.reduce((s: number, l: any) => s + l.points, 0), r.best]);
  }
}

/** Import de résultats collés manuellement (vos propres recherches). Même pipeline que la veille automatique. */
export async function importManual(results: SearchResult[], sectorId: number | null, brandName?: string) {
  const run = await one<{ id: number }>(`insert into watch_runs (provider, trigger) values ('manual','manual') returning id`);
  const ctx = await loadCtx(run!.id, "manual");
  const plan: QueryPlan = { query: "import manuel", sectorId, purpose: brandName ? "contacts" : "brands", brandName };
  const parent = brandName ? (await one<{ id: number }>(`select id from watch_candidates where kind='brand' and lower(name)=lower($1) limit 1`, [brandName]))?.id ?? null : null;
  for (const r of results) await ingest(ctx, r, plan, parent);
  await finish(ctx, "done", ["import manuel"]);
  return { runId: run!.id, ...ctx.stats };
}

/** Veille automatique. Ne fait rien (statut « skipped ») si aucun fournisseur n'est configuré. */
export async function runWatch(trigger: "manual" | "cron", providerOverride?: SearchProvider) {
  const provider = providerOverride ?? getProvider();
  if (!provider) {
    const r = await one<{ id: number }>(`insert into watch_runs (provider, trigger, status, finished_at, error) values ('aucun',$1,'skipped',now(),$2) returning id`,
      [trigger, "Aucun fournisseur de recherche configuré (FIRECRAWL_API_KEY). Utilisez l'import manuel."]);
    return { runId: r!.id, status: "skipped" as const };
  }
  const settings = await getSetting("watch", DEFAULT_WATCH);
  const run = await one<{ id: number }>(`insert into watch_runs (provider, trigger) values ($1,$2) returning id`, [provider.id, trigger]);
  const ctx = await loadCtx(run!.id, provider.id);
  const dayIndex = Math.floor(Date.parse(todayParis()) / 86400000);
  const plans = planBrandQueries(ctx.sectors.filter((s) => s.keywords.length), dayIndex, settings.max_queries);
  const done: string[] = [];
  try {
    for (const p of plans) {
      const results = await provider.search(p.query, { limit: 10, recentDays: 31 });
      done.push(p.query);
      for (const r of results) await ingest(ctx, r, p, null);
    }
    // Recherche d'interlocuteurs pour les meilleures nouvelles marques sans contact.
    const targets = await q<{ id: number; name: string }>(`select id, name from watch_candidates b where kind='brand' and status='new' and score >= $1
      and not exists (select 1 from watch_candidates c where c.kind='contact' and c.parent_id=b.id) order by score desc limit $2`,
      [settings.min_score_for_contacts, settings.contact_searches]);
    for (const t of targets) for (const p of planContactQueries(t.name)) {
      const results = await provider.search(p.query, { limit: 5 });
      done.push(p.query);
      for (const r of results) await ingest(ctx, r, p, t.id);
    }
    await finish(ctx, "done", done);
    await setSetting("watch_last_run", { date: todayParis(), runId: run!.id });
    return { runId: run!.id, status: "done" as const, ...ctx.stats };
  } catch (e) {
    await finish(ctx, "failed", done, e instanceof Error ? e.message : String(e));
    return { runId: run!.id, status: "failed" as const, error: String(e) };
  }
}
