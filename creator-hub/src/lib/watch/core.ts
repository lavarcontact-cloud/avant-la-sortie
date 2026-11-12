// Moteur de veille — logique pure (normalisation, déduplication, signaux, scoring).
// Aucune information n'est inventée : tout provient du titre, de l'URL et de l'extrait
// renvoyés par la source, et les éléments déduits sont signalés comme tels.
import type { CollabType } from "../constants";

export interface SearchResult { url: string; title: string; snippet: string; date?: string | null }

// ------------------------------------------------------------------ Normalisation

export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\d?\./, "").replace(/^m\./, "");
  } catch { return null; }
}

/** Domaine racine approximatif (sony.fr, shop.sony.fr → sony.fr ; bbc.co.uk conservé). */
export function rootDomain(domain: string): string {
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;
  const sld = parts[parts.length - 2];
  if (["co", "com", "org", "net", "gouv"].includes(sld) && parts.length >= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(france|sas|sasu|sarl|sa|inc|ltd|gmbh|official|officiel|store|shop|paris)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = ""; u.search = "";
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch { return raw.toLowerCase(); }
}

/** Nom déduit d'un domaine (sony.fr → Sony). Toujours présenté comme « déduit, à confirmer ». */
export function nameFromDomain(domain: string): string {
  const label = rootDomain(domain).split(".")[0];
  return label.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Domaines qui ne sont pas des marques (médias, réseaux, annuaires, places de marché…).
const NON_BRAND = [
  "linkedin.com", "instagram.com", "facebook.com", "tiktok.com", "youtube.com", "x.com", "twitter.com", "pinterest.com", "snapchat.com",
  "wikipedia.org", "google.com", "amazon.fr", "amazon.com", "ebay.fr", "cdiscount.com", "leboncoin.fr", "reddit.com", "medium.com",
  "indeed.com", "indeed.fr", "welcometothejungle.com", "glassdoor.fr", "glassdoor.com", "hellowork.com", "apec.fr", "francetravail.fr",
  "lemonde.fr", "lefigaro.fr", "bfmtv.com", "20minutes.fr", "ouest-france.fr", "leparisien.fr", "liberation.fr", "forbes.fr", "forbes.com",
  "trustpilot.com", "societe.com", "pappers.fr", "verif.com", "pagesjaunes.fr", "tripadvisor.fr", "tripadvisor.com", "yelp.fr", "github.com",
];
export const isNonBrandDomain = (domain: string) => NON_BRAND.some((d) => domain === d || domain.endsWith("." + d));

// ------------------------------------------------------------------ Profils (LinkedIn, Instagram)

export const TARGET_ROLES: { re: RegExp; label: string; weight: number }[] = [
  { re: /influenc\w*\s*(marketing\s*)?(manager|lead|specialist|responsable)|responsable\s+(de\s+l')?influence|influence\s+(lead|manager)/i, label: "Influence Manager", weight: 10 },
  { re: /creator\s*(partnerships?|relations?|manager|lead)|responsable\s+cr[ée]ateurs|talent\s+partnerships?/i, label: "Responsable créateurs", weight: 10 },
  { re: /\bpr\b\s*(manager|lead|officer|specialist)?|relations?\s+presse|press\s+(officer|relations?)|attach[ée]e?\s+de\s+presse|public\s+relations/i, label: "PR / Relations presse", weight: 9 },
  { re: /partnerships?\s*(manager|lead|director)|responsable\s+(des\s+)?partenariats|brand\s+partnerships?/i, label: "Partnership Manager", weight: 9 },
  { re: /social\s*media\s*(manager|lead)|responsable\s+(des\s+)?r[ée]seaux\s+sociaux|community\s+manager/i, label: "Social Media Manager", weight: 7 },
  { re: /brand\s*(manager|lead|director)|chef\s+de\s+marque|responsable\s+(de\s+)?marque/i, label: "Brand Manager", weight: 7 },
  { re: /responsable\s+(de\s+la\s+)?communication|communication\s+manager|head\s+of\s+communications?|directeur\s+de\s+la\s+communication|directrice\s+de\s+la\s+communication/i, label: "Responsable communication", weight: 7 },
  { re: /marketing\s*(manager|lead|director)|responsable\s+marketing|head\s+of\s+marketing|directeur\s+marketing|directrice\s+marketing|cmo\b/i, label: "Marketing Manager", weight: 6 },
];

export function roleMatch(role: string | null | undefined) {
  if (!role) return null;
  return TARGET_ROLES.find((r) => r.re.test(role)) ?? null;
}

export function contactQuality(role: string | null | undefined, hasPerson: boolean): "excellent" | "bon" | "générique" | "aucun" {
  const m = roleMatch(role);
  if (m && hasPerson && m.weight >= 9) return "excellent";
  if (m && hasPerson) return "bon";
  if (m || hasPerson) return "générique";
  return "aucun";
}

export interface ParsedProfile { platform: "linkedin" | "instagram"; person_name: string | null; person_role: string | null; company: string | null; profileUrl: string }

/**
 * Lit un titre de résultat de recherche du type « Prénom Nom - Influence Manager - Sony | LinkedIn ».
 * On ne visite jamais LinkedIn : seules les informations publiées dans le résultat de recherche sont utilisées.
 */
export function parseProfileResult(r: SearchResult): ParsedProfile | null {
  const d = normalizeDomain(r.url) ?? "";
  if (d.endsWith("linkedin.com") && /linkedin\.com\/in\//i.test(r.url)) {
    const clean = r.title.replace(/\s*[|–-]\s*LinkedIn\s*$/i, "").trim();
    const parts = clean.split(/\s+[-–—|]\s+/).map((x) => x.trim()).filter(Boolean);
    const person = parts[0] && !/linkedin/i.test(parts[0]) ? parts[0] : null;
    let role = parts[1] ?? null, company = parts[2] ?? null;
    // Format « Influence Manager chez Sony » ou « ... at Sony »
    if (role && !company) { const m = role.match(/^(.*?)\s+(?:chez|at|@)\s+(.+)$/i); if (m) { role = m[1]; company = m[2]; } }
    if (!role) { const m = r.snippet.match(/^(.{3,80}?)\s+(?:chez|at)\s+([^.·|]{2,60})/i); if (m) { role = m[1]; company = m[2]; } }
    return { platform: "linkedin", person_name: person, person_role: role, company: company?.replace(/[.·].*$/, "").trim() ?? null, profileUrl: r.url.split("?")[0] };
  }
  if (d.endsWith("instagram.com")) {
    const m = r.url.match(/instagram\.com\/([A-Za-z0-9._]+)\/?$/);
    if (!m || ["p", "reel", "explore", "stories"].includes(m[1])) return null;
    const nm = r.title.match(/^(.+?)\s*\(@/);
    const role = roleMatch(r.snippet) ? (r.snippet.match(TARGET_ROLES.find((x) => x.re.test(r.snippet))!.re)?.[0] ?? null) : null;
    return { platform: "instagram", person_name: nm?.[1]?.trim() ?? null, person_role: role, company: null, profileUrl: `https://www.instagram.com/${m[1]}/` };
  }
  return null;
}

// ------------------------------------------------------------------ Signaux commerciaux

export const SIGNALS = {
  ugc_recruiting: { label: "Recherche de créateurs UGC", re: /\bugc\b|user[- ]generated|cr[ée]ateurs? de contenu recherch|recrute\s+(des\s+)?cr[ée]ateurs|casting cr[ée]ateurs|appel [àa] cr[ée]ateurs/i, collabs: ["ugc_paid"] },
  ambassador_program: { label: "Programme ambassadeur", re: /ambassad(eur|rice|or)s?\b|programme\s+partenaire|brand\s+ambassador|devenir\s+ambassad/i, collabs: ["ambassador", "influence"] },
  creator_program: { label: "Programme créateurs / affiliation", re: /programme\s+(cr[ée]ateurs?|influenceurs?|affili)|creator\s+(program|programme|fund|hub)|affiliate\s+program|influencer\s+program/i, collabs: ["influence", "ugc_paid"] },
  influence_campaign: { label: "Campagnes d'influence", re: /campagne\s+(d'|d’)?influence|influencer\s+(marketing|campaign)|influenceurs?\b|collaboration\s+avec\s+des\s+cr[ée]ateurs/i, collabs: ["influence"] },
  product_launch: { label: "Lancement de produit", re: /lancement|lance\s+(son|sa|ses|un|une)|nouveau(x)?\s+produits?|nouvelle\s+gamme|launch(es|ed)?\b|new\s+(product|release)|d[ée]voile/i, collabs: ["gifting", "product_test", "ugc_paid"] },
  new_collection: { label: "Nouvelle collection", re: /nouvelle\s+collection|collection\s+(automne|hiver|printemps|été|capsule)|drop\b|capsule|new\s+collection|lookbook/i, collabs: ["gifting", "ugc_paid", "production"] },
  event: { label: "Événement", re: /[ée]v[ée]nement|soir[ée]e\s+de\s+lancement|pop[- ]up|salon\b|festival|showcase|vernissage|inauguration|event\b/i, collabs: ["event", "production"] },
  press_contact: { label: "Contact presse / partenariats publié", re: /espace\s+presse|relations?\s+presse|press\s+(room|kit|contact)|kit\s+m[ée]dia|contact\s+(presse|partenariats?)|partenariats?@|press@|presse@|influence@|pr@/i, collabs: [] },
  hiring_marketing: { label: "Recrutement marketing / influence", re: /recrut\w+\s+(un|une)\s+(chef|responsable|charg[ée])\w*\s+(de\s+)?(marketing|influence|communication|social)|we('re| are) hiring.*(marketing|influence|social)/i, collabs: [] },
  music: { label: "Univers musical", re: /\blabel\b|artiste|clip|album|concert|tourn[ée]e|showcase|rap\b|hip[- ]hop|musique|music/i, collabs: ["music"] },
  content_needs: { label: "Besoin de contenus photo / vidéo", re: /shooting|tournage|contenus?\s+(vid[ée]o|photo)|vid[ée]aste|photographe|production\s+(vid[ée]o|audiovisuelle)|content\s+creator/i, collabs: ["production", "ugc_paid"] },
} as const;
export type Signal = keyof typeof SIGNALS;

export function detectSignals(text: string): Signal[] {
  return (Object.keys(SIGNALS) as Signal[]).filter((k) => SIGNALS[k].re.test(text));
}
export function signalsToOpportunities(signals: Signal[]): CollabType[] {
  return [...new Set(signals.flatMap((s) => SIGNALS[s].collabs as readonly string[]))] as CollabType[];
}

/** Secteur le plus probable d'après les mots-clés (null si aucun). */
export function guessSector(text: string, sectors: { id: number; keywords: string[]; name: string }[]): number | null {
  const t = normalizeName(text);
  let best: { id: number; n: number } | null = null;
  for (const s of sectors) {
    const n = s.keywords.filter((k) => k && t.includes(normalizeName(k))).length;
    if (n > 0 && (!best || n > best.n)) best = { id: s.id, n };
  }
  return best?.id ?? null;
}

// ------------------------------------------------------------------ Scoring /100

export interface ScoreInput {
  sectorMatched: boolean;          // la marque relève d'un de vos secteurs
  keywordHits: number;             // nombre de mots-clés de secteur trouvés
  signals: Signal[];
  hasContactPage?: boolean;        // page de contact / presse officielle connue
  hasPublicEmail?: boolean;        // adresse pro publiée
  bestContactQuality?: "excellent" | "bon" | "générique" | "aucun";
  recentDays?: number | null;      // âge de l'information, si connu
  isProductBrand?: boolean;        // vend des produits physiques (gifting possible)
}
export interface ScoreLine { key: string; label: string; points: number; max: number; reason: string }

/**
 * Score de pertinence sur 100. Ce n'est PAS une probabilité de signature :
 * il mesure l'adéquation et l'accessibilité, critère par critère, avec la raison de chaque point.
 */
export function scoreOpportunity(i: ScoreInput): { score: number; lines: ScoreLine[] } {
  const has = (s: Signal) => i.signals.includes(s);
  const lines: ScoreLine[] = [];
  const add = (key: string, label: string, max: number, points: number, reason: string) => lines.push({ key, label, max, points: Math.max(0, Math.min(max, points)), reason });

  add("fit", "Compatibilité avec votre activité", 20,
    (i.sectorMatched ? 12 : 0) + Math.min(8, i.keywordHits * 4),
    i.sectorMatched ? `Correspond à un de vos secteurs (${i.keywordHits} mot(s)-clé(s) trouvés)` : "Aucun de vos secteurs reconnu dans la source");
  add("ugc", "Possibilité UGC", 15,
    (has("ugc_recruiting") ? 15 : 0) || (has("creator_program") ? 9 : 0) || (has("content_needs") ? 7 : 0),
    has("ugc_recruiting") ? "Recherche explicite de créateurs UGC" : has("creator_program") ? "Programme créateurs publié" : has("content_needs") ? "Besoins de contenus visibles" : "Aucun signal UGC");
  add("gifting", "Potentiel gifting / test", 10,
    (i.isProductBrand ? 4 : 0) + (has("product_launch") ? 4 : 0) + (has("new_collection") ? 4 : 0),
    [i.isProductBrand && "produits physiques", has("product_launch") && "lancement produit", has("new_collection") && "nouvelle collection"].filter(Boolean).join(", ") || "Pas d'indice de produit à tester");
  add("program", "Budget / programme créateur identifiable", 15,
    (has("ambassador_program") ? 9 : 0) + (has("creator_program") ? 9 : 0) + (has("influence_campaign") ? 6 : 0),
    [has("ambassador_program") && "programme ambassadeur", has("creator_program") && "programme créateurs", has("influence_campaign") && "campagnes d'influence"].filter(Boolean).join(", ") || "Aucun programme publié trouvé");
  add("content", "Besoins en contenu", 10,
    (has("content_needs") ? 5 : 0) + (has("event") ? 3 : 0) + (has("new_collection") || has("product_launch") ? 3 : 0),
    [has("content_needs") && "production photo/vidéo", has("event") && "événement", (has("new_collection") || has("product_launch")) && "nouveautés à mettre en avant"].filter(Boolean).join(", ") || "Non déterminé");
  add("news", "Actualité de la marque", 10,
    i.recentDays == null ? (has("product_launch") || has("event") || has("new_collection") ? 5 : 0) : i.recentDays <= 30 ? 10 : i.recentDays <= 90 ? 6 : 2,
    i.recentDays == null ? (has("product_launch") || has("event") || has("new_collection") ? "Actualité mentionnée, date non fournie par la source" : "Pas d'actualité détectée") : `Information datée de ${i.recentDays} jour(s)`);
  add("access", "Accessibilité du service concerné", 10,
    (i.hasContactPage || has("press_contact") ? 5 : 0) + (i.hasPublicEmail ? 5 : 0),
    [(i.hasContactPage || has("press_contact")) && "page presse/contact publiée", i.hasPublicEmail && "adresse pro publique"].filter(Boolean).join(", ") || "Aucun point de contact officiel identifié");
  const q = i.bestContactQuality ?? "aucun";
  add("contact", "Pertinence du contact trouvé", 10, { excellent: 10, bon: 7, générique: 3, aucun: 0 }[q],
    { excellent: "Interlocuteur nommé sur une fonction cible (influence, RP, partenariats)", bon: "Interlocuteur nommé, fonction marketing/communication", générique: "Contact générique ou fonction non ciblée", aucun: "Aucun interlocuteur identifié" }[q]);

  return { score: lines.reduce((s, l) => s + l.points, 0), lines };
}

// ------------------------------------------------------------------ Requêtes de veille

export interface QueryPlan { query: string; sectorId: number | null; purpose: "brands" | "contacts"; brandName?: string }

const BRAND_PATTERNS = [
  (k: string) => `${k} "programme ambassadeur"`,
  (k: string) => `${k} créateurs UGC marque France`,
  (k: string) => `${k} "nouvelle collection" OR lancement ${new Date().getFullYear()}`,
  (k: string) => `${k} "relations presse" OR "espace presse" marque`,
  (k: string) => `${k} "programme créateurs" OR "creator program"`,
];

/** Requêtes de découverte : rotation quotidienne pour ne pas rejouer toujours les mêmes recherches. */
export function planBrandQueries(sectors: { id: number; keywords: string[] }[], dayIndex: number, max: number): QueryPlan[] {
  const all: QueryPlan[] = [];
  for (const s of sectors) for (const k of s.keywords) for (const p of BRAND_PATTERNS) all.push({ query: p(k), sectorId: s.id, purpose: "brands" });
  if (!all.length) return [];
  const out: QueryPlan[] = [];
  // Entrelacement des secteurs puis rotation selon le jour.
  const bySector = sectors.map((s) => all.filter((q) => q.sectorId === s.id)).filter((l) => l.length);
  for (let i = 0; out.length < Math.min(max, all.length); i++) {
    const list = bySector[i % bySector.length];
    out.push(list[(dayIndex + Math.floor(i / bySector.length)) % list.length]);
  }
  return out;
}

/** Recherche d'interlocuteurs via les résultats publics des moteurs (sans visiter LinkedIn ni Instagram). */
export function planContactQueries(brandName: string): QueryPlan[] {
  const roles = `("Influence Manager" OR "PR Manager" OR "Relations presse" OR "Partnership Manager" OR "Social Media Manager" OR "Brand Manager")`;
  return [{ query: `site:linkedin.com/in ${roles} "${brandName}"`, sectorId: null, purpose: "contacts", brandName }];
}

/** Liens de recherche à ouvrir soi-même (respect des CGU : aucune collecte automatisée sur ces plateformes). */
export function manualSearchLinks(brandName: string) {
  const q = encodeURIComponent;
  return [
    { label: "LinkedIn — personnes (influence, RP, partenariats)", url: `https://www.linkedin.com/search/results/people/?keywords=${q(`${brandName} influence OR presse OR partenariats`)}` },
    { label: "Google — page presse officielle", url: `https://www.google.com/search?q=${q(`${brandName} "espace presse" OR "relations presse" OR "contact presse"`)}` },
    { label: "Google — programme créateurs / ambassadeurs", url: `https://www.google.com/search?q=${q(`${brandName} programme ambassadeur OR créateurs OR influence`)}` },
    { label: "Instagram — recherche", url: `https://www.instagram.com/explore/search/keyword/?q=${q(brandName)}` },
  ];
}
