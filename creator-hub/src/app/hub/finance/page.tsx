import Link from "next/link";
import { q } from "@/lib/db";
import { loadDataset } from "@/lib/data";
import { financeSummary, revenueByService, invoiceTTC, invoicePaid, issuedInvoices, dealValue, isSigned } from "@/lib/stats";
import { todayParis, fmtDate } from "@/lib/dates";
import { eur, eur0 } from "@/lib/money";
import { COLLAB_TYPES, DEAL_STATUS } from "@/lib/constants";
import { PageHeader, Card, Kpi, Empty, Bar, Badge } from "@/components/ui";
import { ActionForm, ConfirmSubmit } from "@/components/client";
import { addExpense, deleteExpense } from "../actions";

export const metadata = { title: "Finances" };

export default async function Finance() {
  const today = todayParis();
  const ds = await loadDataset();
  const f = financeSummary(ds, today);
  const services = revenueByService(ds);
  const maxSvc = Math.max(1, ...services.map((s) => s.signed));
  const brandName = new Map(ds.brands.map((b) => [b.id, b.name]));
  const deals = [...ds.deals].sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());
  const inv = issuedInvoices(ds.documents);
  const expenses = await q<any>(`select id, label, category, amount, spent_at::text as spent_at from expenses order by spent_at desc limit 50`);
  const mostAsked = [...services].sort((a, b) => b.count - a.count)[0];
  const bestHour = services.filter((s) => s.perHour !== null).sort((a, b) => b.perHour! - a.perHour!)[0];
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Porte-monnaie" subtitle="Signé, facturé, encaissé et gifting sont quatre informations distinctes. Le gifting n'est jamais compté en chiffre d'affaires."
        actions={<Link href="/hub/documents/new?kind=invoice" className="btn btn-primary">+ Facture</Link>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Revenus signés (HT)" value={eur0(f.signed)} />
        <Kpi label="Revenus facturés (TTC)" value={eur0(f.invoiced)} />
        <Kpi label="Revenus encaissés" value={eur0(f.collected)} tone="green" />
        <Kpi label="Paiements en attente" value={eur0(f.outstanding)} tone={f.outstanding ? "accent" : "default"} />
        <Kpi label="Factures en retard" value={f.overdueCount} hint={f.overdueCount ? eur0(f.overdueAmount) : undefined} tone={f.overdueCount ? "red" : "default"} />
        <Kpi label="Dépenses pro" value={eur0(f.expenses)} tone="muted" />
        <Kpi label="Revenu net estimé" value={eur0(f.net)} hint="encaissé − dépenses, avant cotisations" />
        <Kpi label="Produits reçus (gifting)" value={eur0(f.giftValue)} hint={`${f.giftCount} produit(s) · hors CA`} tone="muted" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card title="Revenus par prestation" className="xl:col-span-2" pad={false}>
          {services.length === 0 ? <div className="p-4"><Empty title="Aucune prestation enregistrée">Ajoutez une prestation depuis une fiche marque.</Empty></div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr><th className="th">Prestation</th><th className="th text-right">Demandes</th><th className="th text-right">Signées</th><th className="th">CA signé</th><th className="th text-right">Facturé</th><th className="th text-right">Encaissé</th><th className="th text-right">Moyenne</th><th className="th text-right">€ / heure</th><th className="th text-right">Marge est.</th></tr></thead>
                <tbody>{services.map((s) => (
                  <tr key={s.category}>
                    <td className="td font-medium">{s.category}{s.giftValue > 0 && <div className="text-xs font-normal text-zinc-500">+ {eur0(s.giftValue)} de produits (hors CA)</div>}</td>
                    <td className="td text-right tabular">{s.count}</td><td className="td text-right tabular">{s.signedCount}</td>
                    <td className="td w-40"><Bar value={s.signed} max={maxSvc} color="#10b981" label={eur0(s.signed)} /></td>
                    <td className="td text-right tabular">{eur0(s.invoiced)}</td><td className="td text-right tabular">{eur0(s.collected)}</td>
                    <td className="td text-right tabular">{s.avg === null ? "—" : eur0(s.avg)}</td>
                    <td className="td text-right tabular">{s.perHour === null ? "—" : eur0(s.perHour)}</td>
                    <td className="td text-right tabular">{s.margin === null ? "—" : eur0(s.margin)}</td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Lecture">
          <ul className="space-y-2 text-sm text-zinc-700">
            {services.length === 0 && <li className="text-zinc-500">Les enseignements apparaîtront avec vos premières prestations.</li>}
            {services[0]?.signed > 0 && <li>→ <b>{services[0].category}</b> rapporte le plus ({eur0(services[0].signed)} signés).</li>}
            {mostAsked && <li>→ <b>{mostAsked.category}</b> est la plus demandée ({mostAsked.count}).</li>}
            {bestHour && <li>→ <b>{bestHour.category}</b> est la plus rentable à l'heure ({eur0(bestHour.perHour)} / h, sur les heures renseignées).</li>}
            {services.length > 0 && !bestHour && <li className="text-zinc-500">Renseignez le temps de production pour mesurer la rentabilité horaire.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card title={`Prestations (${deals.length})`} pad={false}>
          {deals.length === 0 ? <div className="p-4"><Empty title="Aucune prestation" /></div> : (
            <div className="max-h-[460px] overflow-auto"><table className="w-full">
              <thead><tr><th className="th">Marque · prestation</th><th className="th">Statut</th><th className="th text-right">Montant</th></tr></thead>
              <tbody>{deals.map((d) => (
                <tr key={d.id}><td className="td"><Link href={`/hub/brands/${d.brand_id}`} className="font-medium hover:underline">{brandName.get(d.brand_id)}</Link><div className="text-xs text-zinc-500">{d.service_category} · {COLLAB_TYPES[d.collab_type as keyof typeof COLLAB_TYPES]?.short}</div></td>
                  <td className="td"><Badge tone={isSigned(d) ? "green" : "slate"}>{DEAL_STATUS[d.status as keyof typeof DEAL_STATUS]}</Badge></td>
                  <td className="td text-right tabular">{d.collab_type === "gifting" ? <span className="text-zinc-500">{eur(Number(d.gift_value))} (produit)</span> : eur(dealValue(d))}</td></tr>))}
              </tbody></table></div>
          )}
        </Card>
        <Card title="Factures émises" pad={false} action={<Link href="/hub/documents" className="text-xs text-zinc-500 hover:text-zinc-900">Tout voir →</Link>}>
          {inv.length === 0 ? <div className="p-4"><Empty title="Aucune facture émise" /></div> : (
            <div className="max-h-[460px] overflow-auto"><table className="w-full">
              <thead><tr><th className="th">N°</th><th className="th">Échéance</th><th className="th text-right">TTC</th><th className="th text-right">Reste</th></tr></thead>
              <tbody>{inv.map((d) => { const rest = invoiceTTC(d) - invoicePaid(d); const late = rest > 0.009 && d.due_date && String(d.due_date) < today; return (
                <tr key={d.id}><td className="td"><Link href={`/hub/documents/${d.id}`} className="font-medium hover:underline">{d.number}</Link></td>
                  <td className="td text-xs">{fmtDate(d.due_date as string)} {late && <Badge tone="red">Retard</Badge>}</td>
                  <td className="td text-right tabular">{eur(invoiceTTC(d))}</td><td className="td text-right tabular">{rest > 0.009 ? eur(rest) : <span className="text-emerald-600">Payée</span>}</td></tr>); })}
              </tbody></table></div>
          )}
        </Card>
      </div>

      <Card title="Dépenses professionnelles" className="mt-6">
        <ActionForm action={addExpense} submitLabel="Ajouter" resetOnOk className="grid gap-2 sm:grid-cols-5">
          <input name="label" placeholder="Libellé" className="input sm:col-span-2" required />
          <input name="category" placeholder="Catégorie (matériel, transport…)" className="input" />
          <input name="amount" type="number" step="0.01" min={0} placeholder="Montant €" className="input" required />
          <input name="spent_at" type="date" className="input" />
        </ActionForm>
        {expenses.length > 0 && <ul className="mt-4 divide-y divide-zinc-100">{expenses.map((e) => (
          <li key={e.id} className="flex items-center justify-between py-2 text-sm"><span>{e.label} <span className="text-xs text-zinc-500">{e.category} · {fmtDate(e.spent_at)}</span></span>
            <span className="flex items-center gap-3 tabular">{eur(Number(e.amount))}<form action={deleteExpense}><input type="hidden" name="id" value={e.id} /><ConfirmSubmit message="Supprimer cette dépense ?" className="text-xs text-zinc-400 hover:text-red-600">×</ConfirmSubmit></form></span></li>))}</ul>}
      </Card>
    </div>
  );
}
