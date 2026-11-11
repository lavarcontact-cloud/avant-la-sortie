import Link from "next/link";
import { q } from "@/lib/db";
import { SLOT_LABEL, type ReportData, type Slot } from "@/lib/reports";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { eur0 } from "@/lib/money";
import { PageHeader, Card, Empty } from "@/components/ui";
import { ActionForm } from "@/components/client";
import { generateReportNow } from "./actions";

export const metadata = { title: "Bilans" };

export default async function Reports() {
  const rows = await q<{ id: number; slot: Slot; report_date: string; data: ReportData; created_at: string }>(`select id, slot, report_date::text as report_date, data, created_at from reports order by created_at desc limit 30`);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Bilans quotidiens" subtitle={<>Matin, midi et soir (heure de Paris), générés par la tâche planifiée <code>/api/cron/reports</code>. Aucun bilan n'est créé si rien n'a changé. <Link href="/hub/settings#notifications" className="underline">Horaires</Link></>}
        actions={<ActionForm action={generateReportNow} submitLabel="Générer un bilan maintenant" submitClass="btn btn-ghost"><span /></ActionForm>} />
      {rows.length === 0 ? <Empty title="Aucun bilan pour l'instant">Les bilans apparaissent ici une fois la tâche planifiée configurée (voir README), ou via « Générer un bilan maintenant ».</Empty> : (
        <div className="space-y-4">{rows.map((r) => { const d = r.data; return (
          <Card key={r.id} title={<span>{SLOT_LABEL[r.slot]} · {fmtDate(r.report_date)} <span className="font-normal text-zinc-400">— depuis {fmtDateTime(d.since)}</span></span>}>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[["Nouvelles marques", d.newBrands], ["Démarches", d.outreach], ["Réponses", d.responses], ["Positives", d.positive], ["Relances à faire", d.followUps], ["CA signé", eur0(d.signed)], ["Facturé", eur0(d.invoiced)], ["Encaissé", eur0(d.collected)]].map(([l, v]) => (
                <div key={String(l)} className="rounded-lg bg-zinc-50 p-2.5"><div className="text-xs text-zinc-500">{l}</div><div className="font-semibold tabular">{v}</div></div>))}
            </div>
            {d.opportunities.length > 0 && <p className="mt-3 text-sm"><b>Opportunités à traiter :</b> {d.opportunities.map((o, i) => <span key={o.brand_id}>{i > 0 && ", "}<Link className="underline" href={`/hub/brands/${o.brand_id}`}>{o.name}</Link></span>)}</p>}
            {d.meetings.length > 0 && <p className="mt-1 text-sm"><b>Rendez-vous :</b> {d.meetings.map((m) => `${m.name} (${fmtDateTime(m.at)})`).join(", ")}</p>}
            <div className="mt-3"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Actions prioritaires</div>
              {d.priorities.length ? <ul className="mt-1 list-inside list-disc text-sm">{d.priorities.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="text-sm text-zinc-500">Aucune.</p>}</div>
          </Card>); })}</div>
      )}
    </div>
  );
}
