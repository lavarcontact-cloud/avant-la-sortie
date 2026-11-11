// Bilans quotidiens (matin / midi / soir). Générés par une tâche planifiée
// côté serveur (/api/cron/reports), jamais par un timer navigateur.
import { q, one } from "./db";
import { loadDataset } from "./data";
import { followUpsDue, financeSummary } from "./stats";
import { getSetting, DEFAULT_NOTIF, type NotifSettings } from "./settings";
import { parisParts, todayParis } from "./dates";
import { notify } from "./audit";

export type Slot = "morning" | "midday" | "evening";
export const SLOT_LABEL: Record<Slot, string> = { morning: "Bilan du matin", midday: "Point de mi-journée", evening: "Bilan de fin de journée" };

export interface ReportData {
  since: string; newBrands: number; outreach: number; responses: number; positive: number; negative: number;
  opportunities: { brand_id: number; name: string }[]; followUps: number; meetings: { name: string; title: string; at: string }[];
  signed: number; invoiced: number; collected: number; outstanding: number; overdue: number; priorities: string[]; changed: boolean;
}

export async function buildReport(sinceIso: string): Promise<ReportData> {
  const today = todayParis();
  const [c] = await q<any>(`select
    (select count(*)::int from brands where created_at > $1) as new_brands,
    (select count(*)::int from outreach where created_at > $1) as outreach,
    (select count(*)::int from responses where created_at > $1 and classification<>'automatic') as responses,
    (select count(*)::int from responses where created_at > $1 and classification='positive') as positive,
    (select count(*)::int from responses where created_at > $1 and classification='negative') as negative,
    (select count(*)::int from deals where updated_at > $1) as deals,
    (select count(*)::int from documents where updated_at > $1) as docs,
    (select count(*)::int from interactions where created_at > $1) as inter`, [sinceIso]);
  const ds = await loadDataset();
  const fin = financeSummary(ds, today);
  const due = followUpsDue(ds, today);
  const opportunities = await q<{ brand_id: number; name: string }>(`select distinct b.id as brand_id, b.name from brands b join pipeline_stages s on s.id=b.stage_id where s.key in ('interested','replied','negotiation') order by b.name limit 10`);
  const meetings = await q<{ name: string; title: string; at: string }>(`select b.name, i.title, i.occurred_at as at from interactions i join brands b on b.id=i.brand_id where i.type='meeting' and i.occurred_at between now() and now() + interval '3 days' order by i.occurred_at`);
  const changed = c.new_brands + c.outreach + c.responses + c.deals + c.docs + c.inter > 0;
  const priorities: string[] = [];
  if (c.positive) priorities.push(`Répondre aux ${c.positive} réponse(s) positive(s) reçue(s)`);
  if (opportunities.length) priorities.push(`Faire avancer ${opportunities.length} opportunité(s) en cours`);
  if (due.length) priorities.push(`Effectuer ${due.length} relance(s)`);
  if (fin.overdueCount) priorities.push(`Relancer ${fin.overdueCount} facture(s) en retard`);
  if (meetings.length) priorities.push(`Préparer ${meetings.length} rendez-vous`);
  return {
    since: sinceIso, newBrands: c.new_brands, outreach: c.outreach, responses: c.responses, positive: c.positive, negative: c.negative,
    opportunities, followUps: due.length, meetings, signed: fin.signed, invoiced: fin.invoiced, collected: fin.collected,
    outstanding: fin.outstanding, overdue: fin.overdueCount, priorities, changed,
  };
}

/** Marque les factures échues comme en retard et notifie (une fois). */
export async function flagOverdueInvoices() {
  const rows = await q<{ id: number; number: string; client_name: string; brand_id: number | null }>(
    `update documents set status='overdue', updated_at=now() where kind='invoice' and number is not null and status in ('sent','partially_paid')
     and due_date < (now() at time zone 'Europe/Paris')::date returning id, number, client_name, brand_id`);
  for (const r of rows) await notify({ type: "invoice_overdue", title: `Facture ${r.number} en retard — ${r.client_name}`, brandId: r.brand_id, link: `/hub/documents/${r.id}`, priority: "high" });
  return rows.length;
}

/** Notifie les relances du jour (une fois par jour). */
export async function notifyFollowUps() {
  const today = todayParis();
  const already = await one(`select 1 from notifications where type='follow_up_due' and (created_at at time zone 'Europe/Paris')::date = $1::date`, [today]);
  if (already) return 0;
  const ds = await loadDataset();
  const due = followUpsDue(ds, today);
  if (due.length) await notify({ type: "follow_up_due", title: `${due.length} relance(s) à effectuer aujourd'hui`, link: "/hub/followups" });
  return due.length;
}

/** Détermine le créneau correspondant à l'heure de Paris actuelle (tolérance : l'heure pleine configurée). */
export async function dueSlot(now = new Date()): Promise<Slot | null> {
  const s = await getSetting<NotifSettings>("notifications", DEFAULT_NOTIF);
  if (!s.enabled) return null;
  const p = parisParts(now);
  for (const slot of ["morning", "midday", "evening"] as Slot[]) {
    const [h] = s[slot].split(":").map(Number);
    if (p.hour === h) return slot;
  }
  return null;
}

export async function runReport(slot: Slot, force = false) {
  const today = todayParis();
  const exists = await one(`select 1 from reports where slot=$1 and report_date=$2`, [slot, today]);
  if (exists && !force) return { status: "already_generated" as const };
  const last = await one<{ created_at: string }>(`select created_at from reports order by created_at desc limit 1`);
  const since = last ? new Date(last.created_at).toISOString() : new Date(Date.now() - 86400000).toISOString();
  const data = await buildReport(since);
  // Aucun bilan fabriqué si rien n'a changé depuis le précédent.
  if (!data.changed && !force) return { status: "no_change" as const };
  await q(`insert into reports (slot, report_date, data) values ($1,$2,$3) on conflict (slot, report_date) do update set data=excluded.data, created_at=now()`, [slot, today, JSON.stringify(data)]);
  await notify({ type: "report", title: `${SLOT_LABEL[slot]} disponible`, body: data.priorities.slice(0, 3).join(" · ") || "Aucune action prioritaire.", link: "/hub/reports" });
  return { status: "generated" as const, data };
}
