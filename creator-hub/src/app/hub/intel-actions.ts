"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkEthics } from "@/lib/ethics";
import { setSetting } from "@/lib/settings";
import { todayParis } from "@/lib/dates";
import { runWatch, importManual, DEFAULT_WATCH, type WatchSettings } from "@/lib/watch/engine";
import { parseManualResults } from "@/lib/watch/providers";
import { snapshotForecasts, getForecastSettings } from "@/lib/forecast/service";
import { DEFAULT_FORECAST } from "@/lib/forecast/business";
import { PLATFORMS } from "@/lib/forecast/audience";
import type { ActionState } from "./actions";

const s = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const int = (v: FormDataEntryValue | null) => { const x = s(v).replace(/\s/g, ""); return x === "" ? null : Number.isFinite(Number(x)) ? Math.round(Number(x)) : NaN; };

// ------------------------------------------------------------- Veille

export async function runWatchNow(_: ActionState, __: FormData): Promise<ActionState> {
  await requireAuth();
  const r = await runWatch("manual");
  await audit("watch.run", "watch_run", r.runId, { status: r.status });
  revalidatePath("/hub/watch");
  if (r.status === "skipped") return { error: "Aucun fournisseur de recherche configuré (FIRECRAWL_API_KEY). Utilisez l'import manuel ci-dessous en attendant." };
  if (r.status === "failed") return { error: `La veille a échoué : ${"error" in r ? r.error : ""}` };
  return { ok: `Veille terminée : ${(r as any).new_brands} nouvelle(s) marque(s), ${(r as any).new_contacts} interlocuteur(s), ${(r as any).known} déjà connue(s).` };
}

export async function importWatchResults(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const results = parseManualResults(s(fd.get("results")));
  if (!results.length) return { error: "Aucune URL valide. Une ligne par résultat : URL ; titre ; extrait" };
  if (results.length > 200) return { error: "200 lignes maximum par import." };
  const sectorId = int(fd.get("sector_id"));
  const r = await importManual(results, Number.isNaN(sectorId) ? null : sectorId, s(fd.get("brand_name")) || undefined);
  await audit("watch.import", "watch_run", r.runId, { lines: results.length });
  revalidatePath("/hub/watch");
  return { ok: `${results.length} résultat(s) analysé(s) : ${r.new_brands} nouvelle(s) marque(s), ${r.new_contacts} interlocuteur(s), ${r.known} déjà connu(s), ${r.updated} mis à jour.` };
}

export async function dismissCandidates(fd: FormData) {
  await requireAuth();
  const ids = fd.getAll("ids").map(Number).filter(Number.isInteger);
  if (ids.length) await q(`update watch_candidates set status='dismissed' where id = any($1)`, [ids]);
  revalidatePath("/hub/watch");
}

export async function prepareSelection(fd: FormData) {
  await requireAuth();
  const ids = fd.getAll("ids").map(Number).filter(Number.isInteger).slice(0, 20);
  redirect(ids.length ? `/hub/watch/prepare?ids=${ids.join(",")}` : "/hub/watch");
}

/** Validation d'une opportunité : crée (ou relie) la fiche CRM. Aucun message n'est envoyé. */
export async function acceptCandidate(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const id = Number(fd.get("id"));
  const c = await one<any>(`select * from watch_candidates where id=$1 and kind='brand'`, [id]);
  if (!c) return { error: "Opportunité introuvable" };
  const name = s(fd.get("name")) || c.name;
  const ethics = checkEthics(name, c.title, c.snippet);
  if (!ethics.ok) return { error: `Exclu par la charte : ${ethics.reason}` };
  const verified = fd.get("verified") === "on";
  let brandId: number | null = c.brand_id ?? (await one<{ id: number }>(`select id from brands where lower(name)=lower($1)`, [name]))?.id ?? null;
  if (!brandId) {
    const scoreNotes = (c.score_breakdown as any[] | null)?.filter((l) => l.points > 0).map((l) => `${l.label} ${l.points}/${l.max}`).join(" · ") ?? null;
    brandId = (await one<{ id: number }>(`insert into brands (name, website, sector_id, description, source, verified_at, score, score_notes, opportunities, stage_id, notes)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,(select id from pipeline_stages where key=$10),$11) returning id`,
      [name, `https://${c.domain}`, c.sector_id, null, `Veille : ${c.url}`, verified ? todayParis() : null, c.score, scoreNotes, c.opportunities,
        verified ? "qualified" : "to_study", `Découverte par la veille le ${String(c.first_seen_at).slice(0, 10)}. Extrait source : ${c.snippet ?? ""}`.slice(0, 2000)]))!.id;
  }
  // Interlocuteurs cochés et confirmés par l'utilisateur.
  for (const cid of fd.getAll("contact_ids").map(Number).filter(Number.isInteger)) {
    const k = await one<any>(`select * from watch_candidates where id=$1 and kind='contact'`, [cid]);
    if (!k) continue;
    const [first, ...rest] = (k.person_name ?? "").split(" ");
    const exists = await one(`select 1 from contacts where brand_id=$1 and (linkedin=$2 or instagram=$2)`, [brandId, k.url]);
    if (!exists) await q(`insert into contacts (brand_id, first_name, last_name, role, role_type, linkedin, instagram, source, notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [brandId, first || null, rest.join(" ") || null, k.person_role, null, k.platform === "linkedin" ? k.url : null, k.platform === "instagram" ? k.url : null,
        `${k.url} (résultat public, ${verified ? `vérifié le ${todayParis()}` : "poste actuel à confirmer"})`, null]);
    await q(`update watch_candidates set status='accepted', brand_id=$2 where id=$1`, [cid, brandId]);
  }
  await q(`update watch_candidates set status='accepted', brand_id=$2, verified_at=$3 where id=$1`, [id, brandId, verified ? todayParis() : null]);
  await audit("watch.accept", "brand", brandId, { candidate: id });
  revalidatePath("/hub", "layout");
  return { ok: `Ajoutée au CRM${verified ? " (vérifiée)" : " — statut « Marque à étudier », à vérifier"}.` };
}

// ------------------------------------------------------------- Audience

export async function addSocialAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const platform = s(fd.get("platform"));
  if (!(platform in PLATFORMS)) return { error: "Plateforme invalide" };
  const owner = s(fd.get("owner")) || "personal";
  if (!/^[a-z_]{2,30}$/.test(owner)) return { error: "Entité invalide" };
  const handle = s(fd.get("handle")).replace(/^@/, "");
  if (!handle) return { error: "Identifiant requis" };
  await q(`insert into social_accounts (owner, platform, handle, url) values ($1,$2,$3,$4) on conflict (owner, platform, handle) do update set active=true`, [owner, platform, handle, s(fd.get("url")) || null]);
  revalidatePath("/hub/audience");
  return { ok: "Compte ajouté" };
}

const SnapshotSchema = z.object({
  captured_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date requise (AAAA-MM-JJ)"),
  source: z.string().min(2, "Source obligatoire (ex. Instagram Insights, export CSV, capture du …)").max(200),
});
const NUM_FIELDS = ["followers", "views_30d", "views_90d", "reach_30d", "impressions_30d", "engagements_30d", "posts_30d", "avg_story_views"] as const;

async function upsertSnapshot(accountId: number, row: Record<string, string>) {
  const base = SnapshotSchema.parse({ captured_on: row.captured_on, source: row.source });
  const vals: Record<string, number | null> = {};
  for (const f of NUM_FIELDS) {
    const raw = (row[f] ?? "").replace(/[\s ]/g, "").replace(",", ".");
    if (raw === "") { vals[f] = null; continue; }
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) throw new Error(`Valeur invalide pour ${f} : « ${row[f]} »`);
    vals[f] = Math.round(v);
  }
  if (Object.values(vals).every((v) => v === null)) throw new Error("Au moins une statistique est requise");
  await q(`insert into social_snapshots (account_id, captured_on, followers, views_30d, views_90d, reach_30d, impressions_30d, engagements_30d, posts_30d, avg_story_views,
      audience_geo, audience_age, audience_gender, top_content, source, source_detail)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    on conflict (account_id, captured_on) do update set followers=excluded.followers, views_30d=excluded.views_30d, views_90d=excluded.views_90d, reach_30d=excluded.reach_30d,
      impressions_30d=excluded.impressions_30d, engagements_30d=excluded.engagements_30d, posts_30d=excluded.posts_30d, avg_story_views=excluded.avg_story_views,
      audience_geo=coalesce(excluded.audience_geo, social_snapshots.audience_geo), audience_age=coalesce(excluded.audience_age, social_snapshots.audience_age),
      audience_gender=coalesce(excluded.audience_gender, social_snapshots.audience_gender), top_content=coalesce(excluded.top_content, social_snapshots.top_content),
      source=excluded.source, source_detail=excluded.source_detail`,
    [accountId, base.captured_on, ...NUM_FIELDS.map((f) => vals[f]), row.audience_geo || null, row.audience_age || null, row.audience_gender || null, row.top_content || null, base.source, row.source_detail || null]);
}

export async function addSnapshot(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const row = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).trim()]));
    await upsertSnapshot(Number(fd.get("account_id")), row);
    await audit("audience.snapshot", "social_account", Number(fd.get("account_id")));
  } catch (e) { return { error: e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message }; }
  revalidatePath("/hub/audience");
  return { ok: "Relevé enregistré" };
}

/** Import CSV : en-têtes date,followers,views_30d,views_90d,reach_30d,impressions_30d,engagements_30d,posts_30d,avg_story_views */
export async function importSnapshotsCsv(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const accountId = Number(fd.get("account_id"));
  const source = s(fd.get("source"));
  if (source.length < 2) return { error: "Indiquez la source de l'export (ex. « Export Instagram Insights du 12/11/2026 »)." };
  const file = fd.get("file");
  const text = file instanceof File && file.size ? await file.text() : s(fd.get("csv"));
  if (!text) return { error: "Fichier ou contenu CSV requis" };
  if (text.length > 500_000) return { error: "Fichier trop volumineux (500 Ko max)" };
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const sep = lines[0].includes(";") ? ";" : ",";
  const head = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/^﻿/, ""));
  const alias: Record<string, string> = { date: "captured_on", captured_on: "captured_on", abonnes: "followers", abonnés: "followers", followers: "followers", vues_30j: "views_30d", views_30d: "views_30d", vues_90j: "views_90d", views_90d: "views_90d", portee_30j: "reach_30d", reach_30d: "reach_30d", impressions_30d: "impressions_30d", interactions_30j: "engagements_30d", engagements_30d: "engagements_30d", publications_30j: "posts_30d", posts_30d: "posts_30d", avg_story_views: "avg_story_views" };
  const cols = head.map((h) => alias[h] ?? null);
  if (!cols.includes("captured_on")) return { error: "Colonne « date » manquante dans l'en-tête" };
  let n = 0;
  try {
    for (const l of lines.slice(1)) {
      const cells = l.split(sep);
      const row: Record<string, string> = { source, source_detail: "import CSV" };
      cols.forEach((c, i) => { if (c) row[c] = (cells[i] ?? "").trim(); });
      await upsertSnapshot(accountId, row);
      n++;
    }
  } catch (e) { return { error: `Ligne ${n + 2} : ${e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message} (${n} ligne(s) importée(s) avant l'erreur)` }; }
  await audit("audience.import", "social_account", accountId, { rows: n });
  revalidatePath("/hub/audience");
  return { ok: `${n} relevé(s) importé(s)` };
}

export async function deleteSnapshot(fd: FormData) {
  await requireAuth();
  await q(`delete from social_snapshots where id=$1`, [Number(fd.get("id"))]);
  revalidatePath("/hub/audience");
}

// ------------------------------------------------------------- Prévisions & paramètres

export async function saveForecastSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const cur = await getForecastSettings();
  const num = (k: string, min: number, max: number) => { const v = Number(s(fd.get(k)).replace(",", ".")); if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${k} : valeur entre ${min} et ${max}`); return v; };
  try {
    const next = {
      ...cur,
      capacity_per_month: num("capacity_per_month", 1, 100), avg_deal_hypothesis: num("avg_deal_hypothesis", 0, 1e6),
      cycle_days_hypothesis: num("cycle_days_hypothesis", 1, 365), payment_days_hypothesis: num("payment_days_hypothesis", 0, 365),
      ugc_hours: num("ugc_hours", 0.5, 100), ambitious_outreach_boost: num("ambitious_outreach_boost", 0, 500) / 100, ambitious_growth_bonus: num("ambitious_growth_bonus", 0, 50) / 100,
      hourly_rate: { low: num("hr_low", 0, 1000), mid: num("hr_mid", 0, 1000), high: num("hr_high", 0, 1000) },
      cpm: { low: num("cpm_low", 0, 500), mid: num("cpm_mid", 0, 500), high: num("cpm_high", 0, 500) },
      prior: Object.fromEntries(Object.keys(DEFAULT_FORECAST.prior).map((k) => [k, num(`prior_${k}`, 0, 100) / 100])),
    };
    await setSetting("forecast", next);
  } catch (e) { return { error: (e as Error).message }; }
  await audit("settings.forecast");
  revalidatePath("/hub", "layout");
  return { ok: "Hypothèses enregistrées" };
}

export async function saveWatchSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const v: WatchSettings = {
    enabled: fd.get("enabled") === "on",
    hour: Math.min(23, Math.max(0, Number(fd.get("hour")) || DEFAULT_WATCH.hour)),
    max_queries: Math.min(50, Math.max(1, Number(fd.get("max_queries")) || DEFAULT_WATCH.max_queries)),
    contact_searches: Math.min(20, Math.max(0, Number(fd.get("contact_searches")) || 0)),
    min_score_for_contacts: Math.min(100, Math.max(0, Number(fd.get("min_score_for_contacts")) || 0)),
  };
  await setSetting("watch", v);
  for (const [k, val] of fd.entries()) {
    const m = k.match(/^kw_(\d+)$/);
    if (m) await q(`update sectors set keywords=$2 where id=$1`, [Number(m[1]), String(val).split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30)]);
  }
  revalidatePath("/hub/settings");
  return { ok: "Veille paramétrée" };
}

export async function snapshotNow(_: ActionState, __: FormData): Promise<ActionState> {
  await requireAuth();
  await snapshotForecasts(true);
  revalidatePath("/hub/forecast");
  return { ok: "Prévision du jour enregistrée dans l'historique" };
}
