"use server";
// Server actions du Hub. Chaque action vérifie la session et valide ses entrées (zod).
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { q, one, tx } from "@/lib/db";
import { audit, notify } from "@/lib/audit";
import { checkEthics } from "@/lib/ethics";
import { classifyResponse } from "@/lib/classify";
import { COLLAB_KEYS, CHANNELS, CLASSIFICATIONS, INTENTS, INTERACTION_TYPES, DEAL_STATUS, DOC_STATUS, SERVICE_CATEGORIES } from "@/lib/constants";
import { getSetting, setSetting, missingLegal, DEFAULT_LEGAL, DEFAULT_NOTIF, DEFAULT_PROFILE, type LegalSettings, type NotifSettings, type ProfileSettings } from "@/lib/settings";
import { addDays, todayParis } from "@/lib/dates";
import { docTotals } from "@/lib/money";

const s = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const opt = (v: FormDataEntryValue | null) => s(v) || null;
const optNum = (v: FormDataEntryValue | null) => { const x = s(v).replace(",", "."); return x === "" ? null : Number(x); };
const optInt = (v: FormDataEntryValue | null) => { const x = s(v); return x === "" ? null : parseInt(x, 10); };
const url = z.string().max(500).refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), "URL invalide (http(s)://…)");
const email = z.string().max(200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email invalide");

export type ActionState = { error?: string; ok?: string } | undefined;

function fail(msg: string): never { throw new Error(msg); }

// ------------------------------------------------------------- Marques

const BrandSchema = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  website: url, contact_page: url, instagram: z.string().max(200), linkedin: z.string().max(300), tiktok: z.string().max(200),
  public_email: email, description: z.string().max(4000), country: z.string().max(100), city: z.string().max(100),
  company_size: z.string().max(100), brand_type: z.string().max(100), department: z.string().max(200), source: z.string().max(500),
  score_notes: z.string().max(2000), notes: z.string().max(10000),
});

function readBrand(fd: FormData) {
  const data = BrandSchema.parse({
    name: s(fd.get("name")), website: s(fd.get("website")), contact_page: s(fd.get("contact_page")),
    instagram: s(fd.get("instagram")), linkedin: s(fd.get("linkedin")), tiktok: s(fd.get("tiktok")),
    public_email: s(fd.get("public_email")), description: s(fd.get("description")), country: s(fd.get("country")), city: s(fd.get("city")),
    company_size: s(fd.get("company_size")), brand_type: s(fd.get("brand_type")), department: s(fd.get("department")),
    source: s(fd.get("source")), score_notes: s(fd.get("score_notes")), notes: s(fd.get("notes")),
  });
  const score = optInt(fd.get("score"));
  if (score !== null && (score < 0 || score > 100 || Number.isNaN(score))) fail("Le score doit être entre 0 et 100");
  const opportunities = fd.getAll("opportunities").map(String).filter((k) => (COLLAB_KEYS as string[]).includes(k));
  const ethics = checkEthics(data.name, data.description, data.brand_type, data.notes);
  if (!ethics.ok) fail(`Secteur exclu par la charte éthique : ${ethics.reason}. Cette marque ne peut pas être ajoutée.`);
  if (data.public_email && !data.source) fail("Indiquez la source de l'adresse email publique (page officielle, mentions légales…).");
  return {
    ...data, score, opportunities,
    sector_id: optInt(fd.get("sector_id")), stage_id: optInt(fd.get("stage_id")),
    verified_at: opt(fd.get("verified_at")), next_follow_up: opt(fd.get("next_follow_up")),
  };
}

export async function createBrand(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  let id: number;
  try {
    const b = readBrand(fd);
    const dup = await one(`select id from brands where lower(name)=lower($1)`, [b.name]);
    if (dup) return { error: `« ${b.name} » existe déjà dans le CRM.` };
    const stage = b.stage_id ?? (await one<{ id: number }>(`select id from pipeline_stages where key='to_study'`))?.id ?? null;
    const r = await one<{ id: number }>(
      `insert into brands (name, website, sector_id, description, country, city, company_size, brand_type, instagram, linkedin, tiktok,
        contact_page, public_email, department, source, verified_at, score, score_notes, opportunities, stage_id, next_follow_up, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) returning id`,
      [b.name, b.website || null, b.sector_id, b.description || null, b.country || null, b.city || null, b.company_size || null, b.brand_type || null,
        b.instagram || null, b.linkedin || null, b.tiktok || null, b.contact_page || null, b.public_email || null, b.department || null,
        b.source || null, b.verified_at, b.score, b.score_notes || null, b.opportunities, stage, b.next_follow_up, b.notes || null]);
    id = r!.id;
    await audit("brand.create", "brand", id, { name: b.name });
  } catch (e) { return { error: errMsg(e) }; }
  redirect(`/hub/brands/${id}`);
}

export async function updateBrand(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const id = Number(fd.get("id"));
  try {
    const b = readBrand(fd);
    await q(`update brands set name=$2, website=$3, sector_id=$4, description=$5, country=$6, city=$7, company_size=$8, brand_type=$9,
      instagram=$10, linkedin=$11, tiktok=$12, contact_page=$13, public_email=$14, department=$15, source=$16, verified_at=$17, score=$18,
      score_notes=$19, opportunities=$20, next_follow_up=$21, notes=$22, updated_at=now() where id=$1`,
      [id, b.name, b.website || null, b.sector_id, b.description || null, b.country || null, b.city || null, b.company_size || null, b.brand_type || null,
        b.instagram || null, b.linkedin || null, b.tiktok || null, b.contact_page || null, b.public_email || null, b.department || null,
        b.source || null, b.verified_at, b.score, b.score_notes || null, b.opportunities, b.next_follow_up, b.notes || null]);
    await audit("brand.update", "brand", id);
  } catch (e) { return { error: errMsg(e) }; }
  revalidatePath(`/hub/brands/${id}`);
  return { ok: "Fiche enregistrée" };
}

export async function setBrandStage(fd: FormData) {
  await requireAuth();
  const id = Number(fd.get("brand_id")), stageId = Number(fd.get("stage_id"));
  const stage = await one<{ kind: string; label: string }>(`select kind, label from pipeline_stages where id=$1`, [stageId]);
  if (!stage) return;
  await q(`update brands set stage_id=$2, do_not_contact = (do_not_contact or $3), updated_at=now() where id=$1`, [id, stageId, stage.kind === "dnc"]);
  if (stage.kind === "dnc" || stage.kind === "lost") await q(`update outreach set follow_up_done=true where brand_id=$1 and follow_up_done=false`, [id]);
  if (stage.kind === "won") {
    const b = await one<{ name: string }>(`select name from brands where id=$1`, [id]);
    if (stage.label === "Collaboration confirmée") await notify({ type: "collab_confirmed", title: `${b?.name} — collaboration confirmée`, brandId: id, link: `/hub/brands/${id}`, priority: "high" });
  }
  await audit("brand.stage", "brand", id, { stage: stage.label });
  revalidatePath("/hub", "layout");
}

export async function deleteBrand(fd: FormData) {
  await requireAuth();
  const id = Number(fd.get("id"));
  if (s(fd.get("confirm")) !== "SUPPRIMER") return;
  const b = await one<{ name: string }>(`select name from brands where id=$1`, [id]);
  await q(`delete from brands where id=$1`, [id]);
  await audit("brand.delete", "brand", id, { name: b?.name });
  redirect("/hub/brands");
}

// ------------------------------------------------------------- Contacts

export async function createContact(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const brandId = Number(fd.get("brand_id"));
    const d = z.object({
      first_name: z.string().max(100), last_name: z.string().max(100), role: z.string().max(200), role_type: z.string().max(100),
      email, linkedin: z.string().max(300), instagram: z.string().max(200), phone: z.string().max(50), source: z.string().max(500), notes: z.string().max(4000),
    }).parse(Object.fromEntries(["first_name", "last_name", "role", "role_type", "email", "linkedin", "instagram", "phone", "source", "notes"].map((k) => [k, s(fd.get(k))])));
    if (!d.first_name && !d.last_name && !d.role && !d.email) return { error: "Renseignez au moins un nom, une fonction ou un email professionnel." };
    if ((d.email || d.phone) && !d.source) return { error: "Indiquez la source de ces coordonnées (site officiel, signature d'email, LinkedIn…). Aucune adresse privée." };
    if (d.email) {
      const supp = await suppressed(d.email);
      if (supp) return { error: `Cette adresse (ou son domaine) figure dans la liste d'opposition : ${supp}.` };
    }
    const r = await one<{ id: number }>(`insert into contacts (brand_id, first_name, last_name, role, role_type, email, linkedin, instagram, phone, source, notes)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [brandId, d.first_name || null, d.last_name || null, d.role || null, d.role_type || null, d.email ? d.email.toLowerCase() : null, d.linkedin || null, d.instagram || null, d.phone || null, d.source || null, d.notes || null]);
    // Avancer le pipeline si la marque est encore en amont.
    await q(`update brands set stage_id=(select id from pipeline_stages where key='contact_found'), updated_at=now()
      where id=$1 and stage_id in (select id from pipeline_stages where key in ('to_study','qualified'))`, [brandId]);
    await audit("contact.create", "contact", r!.id, { brand_id: brandId });
    revalidatePath(`/hub/brands/${brandId}`);
    return { ok: "Interlocuteur ajouté" };
  } catch (e) { return { error: errMsg(e) }; }
}

export async function optOutContact(fd: FormData) {
  await requireAuth();
  const id = Number(fd.get("id"));
  const c = await one<{ email: string | null; brand_id: number }>(`update contacts set opted_out=true, opted_out_at=now() where id=$1 returning email, brand_id`, [id]);
  if (c?.email) await q(`insert into suppression_list (value, reason) values ($1,$2) on conflict (value) do nothing`, [c.email.toLowerCase(), "Demande d'opposition"]);
  await q(`update outreach set follow_up_done=true where contact_id=$1`, [id]);
  await audit("contact.opt_out", "contact", id);
  revalidatePath(`/hub/brands/${c?.brand_id}`);
}

export async function deleteContact(fd: FormData) {
  await requireAuth();
  const id = Number(fd.get("id"));
  const c = await one<{ brand_id: number }>(`delete from contacts where id=$1 returning brand_id`, [id]);
  await audit("contact.delete", "contact", id);
  revalidatePath(`/hub/brands/${c?.brand_id}`);
}

async function suppressed(emailAddr: string): Promise<string | null> {
  const e = emailAddr.toLowerCase();
  const domain = e.split("@")[1] ?? "";
  const r = await one<{ value: string }>(`select value from suppression_list where value=$1 or value=$2 or value=$3`, [e, domain, "@" + domain]);
  return r?.value ?? null;
}

// ------------------------------------------------------------- Démarches

export async function logOutreach(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const brandId = Number(fd.get("brand_id"));
    const contactId = optInt(fd.get("contact_id"));
    const channel = s(fd.get("channel"));
    if (!(channel in CHANNELS)) return { error: "Canal invalide" };
    const kind = s(fd.get("kind")) === "follow_up" ? "follow_up" : "initial";
    const collab = s(fd.get("collab_type"));
    const brand = await one<{ name: string; do_not_contact: boolean; kind: string | null }>(
      `select b.name, b.do_not_contact, s.kind from brands b left join pipeline_stages s on s.id=b.stage_id where b.id=$1`, [brandId]);
    if (!brand) return { error: "Marque introuvable" };
    if (brand.do_not_contact || brand.kind === "dnc") return { error: "Cette marque est marquée « Ne plus contacter ». Démarche bloquée." };
    if (contactId) {
      const c = await one<{ opted_out: boolean; email: string | null }>(`select opted_out, email from contacts where id=$1`, [contactId]);
      if (c?.opted_out) return { error: "Cet interlocuteur a demandé à ne plus être contacté." };
      if (c?.email && (await suppressed(c.email))) return { error: "Adresse présente dans la liste d'opposition." };
    }
    const notif = await getSetting<NotifSettings>("notifications", DEFAULT_NOTIF);
    if (kind === "follow_up") {
      // Garde-fou : relances sans réponse limitées.
      const r = await one<{ c: number }>(`select count(*)::int as c from outreach o where o.brand_id=$1 and o.kind='follow_up'
        and o.sent_at > coalesce((select max(received_at) from responses where brand_id=$1), 'epoch')`, [brandId]);
      if ((r?.c ?? 0) >= notif.max_follow_ups) return { error: `Limite de ${notif.max_follow_ups} relances sans réponse atteinte. Laissez la relation respirer ou changez d'approche.` };
    }
    const sentAt = s(fd.get("sent_at"));
    const sentIso = sentAt ? new Date(sentAt).toISOString() : new Date().toISOString();
    const followUp = s(fd.get("follow_up_at")) || (fd.get("auto_follow_up") ? addDays(sentIso.slice(0, 10), notif.follow_up_days) : null);
    // La démarche précédente est considérée comme relancée.
    if (kind === "follow_up") await q(`update outreach set follow_up_done=true where brand_id=$1 and follow_up_done=false`, [brandId]);
    const r = await one<{ id: number }>(`insert into outreach (brand_id, contact_id, channel, kind, collab_type, subject, body, sent_at, follow_up_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [brandId, contactId, channel, kind, (COLLAB_KEYS as string[]).includes(collab) ? collab : null, opt(fd.get("subject")), opt(fd.get("body")), sentIso, followUp]);
    await q(`update brands set stage_id=(select id from pipeline_stages where key='contacted'), next_follow_up=$2, updated_at=now()
      where id=$1 and stage_id in (select id from pipeline_stages where key in ('to_study','qualified','contact_found','to_contact','no_answer'))`, [brandId, followUp]);
    if (followUp) await q(`update brands set next_follow_up=$2 where id=$1`, [brandId, followUp]);
    await audit("outreach.create", "outreach", r!.id, { brand_id: brandId, channel, kind });
    revalidatePath("/hub", "layout");
    return { ok: kind === "follow_up" ? "Relance enregistrée" : "Démarche enregistrée" + (followUp ? ` — relance prévue le ${followUp}` : "") };
  } catch (e) { return { error: errMsg(e) }; }
}

export async function markFollowUpDone(fd: FormData) {
  await requireAuth();
  await q(`update outreach set follow_up_done=true where id=$1`, [Number(fd.get("id"))]);
  revalidatePath("/hub", "layout");
}
export async function snoozeFollowUp(fd: FormData) {
  await requireAuth();
  const days = Math.min(30, Math.max(1, Number(fd.get("days")) || 3));
  await q(`update outreach set follow_up_at=$2 where id=$1`, [Number(fd.get("id")), addDays(todayParis(), days)]);
  revalidatePath("/hub", "layout");
}

// ------------------------------------------------------------- Réponses

export async function logResponse(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const brandId = Number(fd.get("brand_id"));
    const content = s(fd.get("content"));
    let contactId = optInt(fd.get("contact_id"));
    let outreachId = optInt(fd.get("outreach_id"));
    const receivedAt = s(fd.get("received_at")) ? new Date(s(fd.get("received_at"))).toISOString() : new Date().toISOString();
    const auto = classifyResponse(content);
    const manual = s(fd.get("classification"));
    const classification = manual && manual in CLASSIFICATIONS ? manual : auto.classification;
    const manualIntents = fd.getAll("intents").map(String).filter((k) => k in INTENTS);
    const intents = manualIntents.length ? manualIntents : auto.intents;
    const classifiedBy = manual && manual !== auto.classification ? "manual" : "rules";
    // Rapprochement : la dernière démarche envoyée à cette marque (et à cet interlocuteur si connu) avant la réponse.
    if (!outreachId) {
      const o = await one<{ id: number; contact_id: number | null }>(`select id, contact_id from outreach where brand_id=$1 and sent_at <= $2
        ${contactId ? "and (contact_id=$3 or contact_id is null)" : ""} order by sent_at desc limit 1`, contactId ? [brandId, receivedAt, contactId] : [brandId, receivedAt]);
      outreachId = o?.id ?? null;
      if (!contactId && o?.contact_id) contactId = o.contact_id;
    }
    const r = await one<{ id: number }>(`insert into responses (brand_id, contact_id, outreach_id, channel, received_at, content, classification, intents, confidence, classified_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [brandId, contactId, outreachId, opt(fd.get("channel")), receivedAt, content || null, classification, intents, classifiedBy === "manual" ? 1 : auto.confidence, classifiedBy]);
    if (outreachId) await q(`update outreach set follow_up_done=true where id=$1`, [outreachId]);
    await applyResponseEffects(brandId, contactId, classification, intents);
    await audit("response.create", "response", r!.id, { brand_id: brandId, classification });
    revalidatePath("/hub", "layout");
    return { ok: `Réponse enregistrée — ${CLASSIFICATIONS[classification as keyof typeof CLASSIFICATIONS].label}` };
  } catch (e) { return { error: errMsg(e) }; }
}

async function applyResponseEffects(brandId: number, contactId: number | null, classification: string, intents: string[]) {
  const brand = await one<{ name: string }>(`select name from brands where id=$1`, [brandId]);
  const name = brand?.name ?? "Marque";
  const setStage = (key: string, onlyFrom?: string[]) => q(`update brands set stage_id=(select id from pipeline_stages where key=$2), updated_at=now()
    where id=$1 ${onlyFrom ? `and stage_id in (select id from pipeline_stages where key = any($3))` : ""}`, onlyFrom ? [brandId, key, onlyFrom] : [brandId, key]);
  const early = ["to_study", "qualified", "contact_found", "to_contact", "contacted", "replied", "no_answer"];
  if (intents.includes("opt_out")) {
    await q(`update brands set do_not_contact=true where id=$1`, [brandId]);
    await setStage("do_not_contact");
    if (contactId) {
      const c = await one<{ email: string | null }>(`update contacts set opted_out=true, opted_out_at=now() where id=$1 returning email`, [contactId]);
      if (c?.email) await q(`insert into suppression_list (value, reason) values ($1,$2) on conflict (value) do nothing`, [c.email, "Demande d'opposition reçue en réponse"]);
    }
    await q(`update outreach set follow_up_done=true where brand_id=$1`, [brandId]);
    await notify({ type: "opt_out", title: `${name} — demande de ne plus être contacté`, body: "Relances arrêtées, contact ajouté à la liste d'opposition.", brandId, link: `/hub/brands/${brandId}` });
    return;
  }
  if (classification === "positive") {
    await setStage("interested", early);
    await notify({ type: "positive_response", title: `NOUVELLE OPPORTUNITÉ — ${name}`, body: "Réponse positive détectée. Préparez une réponse et créez l'opportunité.", brandId, link: `/hub/brands/${brandId}`, priority: "high" });
  } else if (classification === "negative") {
    await setStage("refused", early);
    await q(`update outreach set follow_up_done=true where brand_id=$1`, [brandId]);
    await notify({ type: "negative_response", title: `${name} — réponse négative`, body: "Relances arrêtées pour cette marque.", brandId, link: `/hub/brands/${brandId}`, priority: "low" });
  } else if (classification !== "automatic") {
    await setStage("replied", early);
    await notify({ type: "response", title: `${name} — nouvelle réponse`, brandId, link: `/hub/brands/${brandId}` });
  }
  const labels: Record<string, string> = { pricing_request: "Demande de tarifs", media_kit_request: "Demande de Media Kit", meeting: "Proposition de rendez-vous", partnership: "Proposition de partenariat" };
  for (const i of intents) if (labels[i] && classification !== "negative") await notify({ type: i, title: `${name} — ${labels[i]}`, brandId, link: `/hub/brands/${brandId}`, priority: "high" });
}

export async function reclassifyResponse(fd: FormData) {
  await requireAuth();
  const id = Number(fd.get("id"));
  const c = s(fd.get("classification"));
  if (!(c in CLASSIFICATIONS)) return;
  const r = await one<{ brand_id: number; contact_id: number | null; intents: string[] }>(
    `update responses set classification=$2, classified_by='manual', confidence=1 where id=$1 returning brand_id, contact_id, intents`, [id, c]);
  if (r) await applyResponseEffects(r.brand_id, r.contact_id, c, r.intents.filter((i) => i === "opt_out"));
  await audit("response.reclassify", "response", id, { classification: c });
  revalidatePath("/hub", "layout");
}

// ------------------------------------------------------------- Interactions

export async function logInteraction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const type = s(fd.get("type"));
  if (!(type in INTERACTION_TYPES)) return { error: "Type invalide" };
  const title = s(fd.get("title"));
  if (!title) return { error: "Titre requis" };
  const brandId = Number(fd.get("brand_id"));
  const at = s(fd.get("occurred_at")) ? new Date(s(fd.get("occurred_at"))).toISOString() : new Date().toISOString();
  await q(`insert into interactions (brand_id, contact_id, type, title, body, occurred_at) values ($1,$2,$3,$4,$5,$6)`,
    [brandId, optInt(fd.get("contact_id")), type, title, opt(fd.get("body")), at]);
  await audit("interaction.create", "brand", brandId, { type });
  revalidatePath(`/hub/brands/${brandId}`);
  return { ok: "Ajouté à l'historique" };
}

// ------------------------------------------------------------- Prestations

export async function saveDeal(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const id = optInt(fd.get("id"));
    const brandId = Number(fd.get("brand_id"));
    const collab = s(fd.get("collab_type"));
    if (!(COLLAB_KEYS as string[]).includes(collab)) return { error: "Type de collaboration invalide" };
    const category = s(fd.get("service_category"));
    if (!(SERVICE_CATEGORIES as readonly string[]).includes(category)) return { error: "Catégorie de prestation invalide" };
    const status = s(fd.get("status")) || "proposed";
    if (!(status in DEAL_STATUS)) return { error: "Statut invalide" };
    const title = s(fd.get("title"));
    if (!title) return { error: "Intitulé requis" };
    const isGift = collab === "gifting";
    const vals = [brandId, title, collab, category, status,
      isGift ? null : optNum(fd.get("planned_price")), isGift ? null : optNum(fd.get("negotiated_price")),
      optNum(fd.get("gift_value")), opt(fd.get("signed_at")) ?? (["signed", "in_progress", "delivered"].includes(status) ? todayParis() : null),
      optNum(fd.get("production_hours")), optNum(fd.get("estimated_costs")), opt(fd.get("notes"))];
    for (const v of vals.slice(5, 8)) if (v !== null && typeof v === "number" && (Number.isNaN(v) || v < 0)) return { error: "Montant invalide" };
    let dealId = id;
    if (id) {
      await q(`update deals set brand_id=$1, title=$2, collab_type=$3, service_category=$4, status=$5, planned_price=$6, negotiated_price=$7,
        gift_value=$8, signed_at=$9, production_hours=$10, estimated_costs=$11, notes=$12, updated_at=now() where id=$13`, [...vals, id]);
    } else {
      const r = await one<{ id: number }>(`insert into deals (brand_id, title, collab_type, service_category, status, planned_price, negotiated_price,
        gift_value, signed_at, production_hours, estimated_costs, notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`, vals);
      dealId = r!.id;
    }
    if (["signed", "in_progress", "delivered"].includes(status)) {
      await q(`update brands set stage_id=(select id from pipeline_stages where key=$2), updated_at=now()
        where id=$1 and stage_id not in (select id from pipeline_stages where key in ('invoice_sent','payment_pending','paid'))`,
        [brandId, status === "signed" ? "confirmed" : "in_progress"]);
    }
    await audit(id ? "deal.update" : "deal.create", "deal", dealId, { status, collab });
    revalidatePath("/hub", "layout");
    return { ok: "Prestation enregistrée" };
  } catch (e) { return { error: errMsg(e) }; }
}

export async function deleteDeal(fd: FormData) {
  await requireAuth();
  const id = Number(fd.get("id"));
  await q(`delete from deals where id=$1`, [id]);
  await audit("deal.delete", "deal", id);
  revalidatePath("/hub", "layout");
}

// ------------------------------------------------------------- Dépenses

export async function addExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const amount = optNum(fd.get("amount"));
  const label = s(fd.get("label"));
  if (!label || amount === null || Number.isNaN(amount) || amount < 0) return { error: "Libellé et montant valides requis" };
  await q(`insert into expenses (label, category, amount, spent_at) values ($1,$2,$3,$4)`, [label, opt(fd.get("category")), amount, opt(fd.get("spent_at")) ?? todayParis()]);
  revalidatePath("/hub/finance");
  return { ok: "Dépense ajoutée" };
}
export async function deleteExpense(fd: FormData) {
  await requireAuth();
  await q(`delete from expenses where id=$1`, [Number(fd.get("id"))]);
  revalidatePath("/hub/finance");
}

// ------------------------------------------------------------- Devis & factures

const LineSchema = z.object({
  description: z.string().min(1).max(1000), quantity: z.coerce.number().positive().max(100000),
  unit_price: z.coerce.number().min(0).max(10_000_000), discount_pct: z.coerce.number().min(0).max(100).default(0),
  vat_rate: z.coerce.number().min(0).max(100),
});

export async function saveDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  let id = optInt(fd.get("id"));
  try {
    const kind = s(fd.get("kind")) === "quote" ? "quote" : "invoice";
    const lines = z.array(LineSchema).min(1, "Au moins une ligne de prestation").parse(JSON.parse(s(fd.get("lines")) || "[]"));
    const clientName = s(fd.get("client_name"));
    if (!clientName) return { error: "Nom du client requis" };
    const existing = id ? await one<{ number: string | null; status: string }>(`select number, status from documents where id=$1`, [id]) : null;
    if (existing?.number && kind === "invoice") return { error: "Une facture émise ne peut plus être modifiée. Créez un avoir ou une nouvelle facture." };
    const vals = [kind, optInt(fd.get("brand_id")), optInt(fd.get("deal_id")), clientName, opt(fd.get("client_address")), opt(fd.get("client_siret")),
      opt(fd.get("client_vat")), opt(fd.get("client_email")), opt(fd.get("issue_date")) ?? todayParis(), opt(fd.get("due_date")),
      JSON.stringify(lines), optNum(fd.get("deposit")) ?? 0, opt(fd.get("notes"))];
    if (id) {
      await q(`update documents set kind=$1, brand_id=$2, deal_id=$3, client_name=$4, client_address=$5, client_siret=$6, client_vat=$7, client_email=$8,
        issue_date=$9, due_date=$10, lines=$11, deposit=$12, notes=$13, updated_at=now() where id=$14`, [...vals, id]);
    } else {
      const r = await one<{ id: number }>(`insert into documents (kind, brand_id, deal_id, client_name, client_address, client_siret, client_vat, client_email,
        issue_date, due_date, lines, deposit, notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`, vals);
      id = r!.id;
    }
    await audit("document.save", "document", id, { kind });
  } catch (e) { return { error: errMsg(e) }; }
  redirect(`/hub/documents/${id}`);
}

/** Émission : attribue le numéro séquentiel (AAAA-NNNN) si les mentions légales sont complètes. */
export async function issueDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const id = Number(fd.get("id"));
  const legal = await getSetting<LegalSettings>("legal", DEFAULT_LEGAL);
  const missing = missingLegal(legal);
  if (missing.length) return { error: `Impossible d'émettre : informations légales manquantes (${missing.join(", ")}). Complétez Paramètres → Facturation.` };
  try {
    const number = await tx(async (t) => {
      const d = (await t(`select kind, number, issue_date::text as issue_date from documents where id=$1 for update`, [id]))[0] as any;
      if (!d) throw new Error("Document introuvable");
      if (d.number) return d.number as string;
      const year = Number(String(d.issue_date ?? todayParis()).slice(0, 4));
      const c = (await t(`insert into document_counters (kind, year, last_value) values ($1,$2,1)
        on conflict (kind, year) do update set last_value = document_counters.last_value + 1 returning last_value`, [d.kind, year]))[0] as any;
      const num = `${d.kind === "invoice" ? "F" : "D"}-${year}-${String(c.last_value).padStart(4, "0")}`;
      await t(`update documents set number=$2, status='sent', updated_at=now() where id=$1`, [id, num]);
      return num;
    });
    const doc = await one<{ brand_id: number | null; kind: string }>(`select brand_id, kind from documents where id=$1`, [id]);
    if (doc?.brand_id && doc.kind === "invoice") await q(`update brands set stage_id=(select id from pipeline_stages where key='invoice_sent'), updated_at=now() where id=$1`, [doc.brand_id]);
    if (doc?.brand_id && doc.kind === "quote") await q(`update brands set stage_id=(select id from pipeline_stages where key='proposal_sent'), updated_at=now()
      where id=$1 and stage_id in (select id from pipeline_stages where kind='open')`, [doc.brand_id]);
    await audit("document.issue", "document", id, { number });
    revalidatePath(`/hub/documents/${id}`);
    return { ok: `Document émis : ${number}` };
  } catch (e) { return { error: errMsg(e) }; }
}

export async function setDocumentStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const id = Number(fd.get("id"));
  const status = s(fd.get("status"));
  if (!(status in DOC_STATUS)) return { error: "Statut invalide" };
  const d = await one<{ number: string | null; lines: any; deposit: string; kind: string; brand_id: number | null; client_name: string }>(`select number, lines, deposit, kind, brand_id, client_name from documents where id=$1`, [id]);
  if (!d) return { error: "Introuvable" };
  if (!d.number && status !== "draft" && status !== "cancelled") return { error: "Émettez d'abord le document (numérotation) avant de changer son statut." };
  const total = docTotals(d.lines, Number(d.deposit)).ttc;
  let paid = optNum(fd.get("paid_amount"));
  if (status === "paid") paid = Math.max(0, total - Number(d.deposit));
  await q(`update documents set status=$2, paid_amount=coalesce($3, paid_amount), paid_at=case when $2 in ('paid','partially_paid') then coalesce($4::date, current_date) else paid_at end, updated_at=now() where id=$1`,
    [id, status, paid, opt(fd.get("paid_at"))]);
  if (d.kind === "invoice" && status === "paid") {
    if (d.brand_id) await q(`update brands set stage_id=(select id from pipeline_stages where key='paid'), updated_at=now() where id=$1`, [d.brand_id]);
    await notify({ type: "invoice_paid", title: `Facture ${d.number} payée — ${d.client_name}`, brandId: d.brand_id, link: `/hub/documents/${id}`, priority: "high" });
  }
  if (d.kind === "invoice" && status === "partially_paid" && d.brand_id) await q(`update brands set stage_id=(select id from pipeline_stages where key='payment_pending'), updated_at=now() where id=$1`, [d.brand_id]);
  await audit("document.status", "document", id, { status });
  revalidatePath(`/hub/documents/${id}`);
  return { ok: "Statut mis à jour" };
}

export async function deleteDraft(fd: FormData) {
  await requireAuth();
  const id = Number(fd.get("id"));
  await q(`delete from documents where id=$1 and number is null`, [id]);
  redirect("/hub/documents");
}

// ------------------------------------------------------------- Notifications

export async function markNotificationsRead(fd: FormData) {
  await requireAuth();
  const id = optInt(fd.get("id"));
  if (id) await q(`update notifications set read_at=now() where id=$1`, [id]);
  else await q(`update notifications set read_at=now() where read_at is null`);
  revalidatePath("/hub", "layout");
}

// ------------------------------------------------------------- Paramètres

export async function saveLegal(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const v: LegalSettings = { ...DEFAULT_LEGAL };
  for (const k of Object.keys(DEFAULT_LEGAL) as (keyof LegalSettings)[]) {
    if (k === "vat_exempt") v.vat_exempt = fd.get("vat_exempt") === "on";
    else if (k === "default_vat_rate") v.default_vat_rate = Number(s(fd.get(k)).replace(",", ".")) || 0;
    else (v as any)[k] = s(fd.get(k)).slice(0, 1000);
  }
  if (v.siret && !/^\d{14}$/.test(v.siret.replace(/\s/g, ""))) return { error: "Le SIRET doit comporter 14 chiffres." };
  if (v.siren && !/^\d{9}$/.test(v.siren.replace(/\s/g, ""))) return { error: "Le SIREN doit comporter 9 chiffres." };
  await setSetting("legal", v);
  await audit("settings.legal");
  revalidatePath("/hub/settings");
  return { ok: "Informations de facturation enregistrées" };
}

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const v: ProfileSettings = { ...DEFAULT_PROFILE };
  for (const k of Object.keys(DEFAULT_PROFILE) as (keyof ProfileSettings)[]) {
    if (k === "stats" || k === "references") continue;
    (v as any)[k] = s(fd.get(k)).slice(0, 4000);
  }
  try {
    v.stats = z.array(z.object({ label: z.string().max(100), value: z.string().max(50), source: z.string().max(200), date: z.string().max(20) }))
      .parse(JSON.parse(s(fd.get("stats")) || "[]")).filter((x) => x.label && x.value);
    v.references = z.array(z.object({ name: z.string().max(200), detail: z.string().max(500), year: z.string().max(10), url: z.string().max(500) }))
      .parse(JSON.parse(s(fd.get("references")) || "[]")).filter((x) => x.name);
  } catch { return { error: "Statistiques ou références invalides" }; }
  if (v.stats.some((x) => !x.source)) return { error: "Chaque statistique doit indiquer sa source (ex. Instagram Insights) — aucune donnée non vérifiée." };
  await setSetting("profile", v);
  await audit("settings.profile");
  revalidatePath("/", "layout");
  return { ok: "Profil public enregistré" };
}

export async function saveNotifSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  const v: NotifSettings = {
    morning: s(fd.get("morning")), midday: s(fd.get("midday")), evening: s(fd.get("evening")), enabled: fd.get("enabled") === "on",
    max_follow_ups: Math.min(5, Math.max(0, Number(fd.get("max_follow_ups")) || 0)), follow_up_days: Math.min(60, Math.max(1, Number(fd.get("follow_up_days")) || 7)),
  };
  if (![v.morning, v.midday, v.evening].every((x) => hhmm.test(x))) return { error: "Horaires au format HH:MM" };
  await setSetting("notifications", v);
  revalidatePath("/hub/settings");
  return { ok: "Préférences enregistrées" };
}

export async function saveSector(fd: FormData) {
  await requireAuth();
  const id = optInt(fd.get("id"));
  const name = s(fd.get("name")).slice(0, 100);
  const color = /^#[0-9a-f]{6}$/i.test(s(fd.get("color"))) ? s(fd.get("color")) : "#64748b";
  if (!name) return;
  const ethics = checkEthics(name);
  if (!ethics.ok) return;
  if (id) await q(`update sectors set name=$2, color=$3, archived=$4 where id=$1`, [id, name, color, fd.get("archived") === "on"]);
  else await q(`insert into sectors (name, color, position) values ($1,$2,(select coalesce(max(position),0)+1 from sectors)) on conflict (name) do nothing`, [name, color]);
  revalidatePath("/hub", "layout");
}

export async function saveStageLabel(fd: FormData) {
  await requireAuth();
  const label = s(fd.get("label")).slice(0, 100);
  if (label) await q(`update pipeline_stages set label=$2 where id=$1`, [Number(fd.get("id")), label]);
  revalidatePath("/hub", "layout");
}

export async function addSuppression(fd: FormData) {
  await requireAuth();
  const v = s(fd.get("value")).toLowerCase().slice(0, 200);
  if (v) await q(`insert into suppression_list (value, reason) values ($1,$2) on conflict (value) do nothing`, [v, opt(fd.get("reason"))]);
  await audit("suppression.add", undefined, null, { value: v });
  revalidatePath("/hub/settings");
}
export async function removeSuppression(fd: FormData) {
  await requireAuth();
  await q(`delete from suppression_list where id=$1`, [Number(fd.get("id"))]);
  await audit("suppression.remove", undefined, Number(fd.get("id")));
  revalidatePath("/hub/settings");
}

export async function markInboundHandled(fd: FormData) {
  await requireAuth();
  await q(`update inbound_requests set handled=true where id=$1`, [Number(fd.get("id"))]);
  revalidatePath("/hub", "layout");
}

export async function inboundToBrand(fd: FormData) {
  await requireAuth();
  const id = Number(fd.get("id"));
  const r = await one<{ company: string; name: string; email: string; message: string; brand_id: number | null }>(`select * from inbound_requests where id=$1`, [id]);
  if (!r) return;
  let brandId = r.brand_id ?? (await one<{ id: number }>(`select id from brands where lower(name)=lower($1)`, [r.company]))?.id;
  if (!brandId) {
    brandId = (await one<{ id: number }>(`insert into brands (name, source, stage_id, notes) values ($1,'Demande entrante (formulaire public)',
      (select id from pipeline_stages where key='replied'), $2) returning id`, [r.company, r.message]))!.id;
    const [first, ...rest] = r.name.split(" ");
    await q(`insert into contacts (brand_id, first_name, last_name, email, source) values ($1,$2,$3,$4,'Formulaire public (demande entrante)')`, [brandId, first, rest.join(" ") || null, r.email]);
  }
  await q(`update inbound_requests set handled=true, brand_id=$2 where id=$1`, [id, brandId]);
  redirect(`/hub/brands/${brandId}`);
}

function errMsg(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues.map((i) => i.message).join(" · ");
  if (e && typeof e === "object" && "digest" in e && String((e as any).digest).startsWith("NEXT_REDIRECT")) throw e;
  return e instanceof Error ? e.message : "Erreur inattendue";
}
