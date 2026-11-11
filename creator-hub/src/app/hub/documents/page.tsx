import Link from "next/link";
import { q } from "@/lib/db";
import { docTotals, eur } from "@/lib/money";
import { DOC_STATUS } from "@/lib/constants";
import { fmtDate, todayParis } from "@/lib/dates";
import { PageHeader, Card, Empty, Badge, docTone } from "@/components/ui";

export const metadata = { title: "Devis & factures" };


export default async function Documents({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const k = (await searchParams).k;
  const rows = await q<any>(`select d.*, d.issue_date::text as issue_date, d.due_date::text as due_date, b.name as brand from documents d left join brands b on b.id=d.brand_id
    ${k === "quote" || k === "invoice" ? "where d.kind=$1" : ""} order by coalesce(d.issue_date, d.created_at::date) desc, d.id desc`, k === "quote" || k === "invoice" ? [k] : []);
  const today = todayParis();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Devis & factures" actions={<><Link href="/hub/documents/new?kind=quote" className="btn btn-ghost">+ Devis</Link><Link href="/hub/documents/new?kind=invoice" className="btn btn-primary">+ Facture</Link></>} />
      <div className="mb-4 flex gap-2">{[["", "Tous"], ["quote", "Devis"], ["invoice", "Factures"]].map(([v, l]) => <Link key={v} href={`/hub/documents${v ? `?k=${v}` : ""}`} className={`btn ${(k ?? "") === v ? "btn-primary" : "btn-ghost"}`}>{l}</Link>)}</div>
      {rows.length === 0 ? <Empty title="Aucun document" action={<Link href="/hub/documents/new" className="btn btn-primary">Créer un devis</Link>}>Renseignez d'abord vos informations légales dans Paramètres → Facturation pour pouvoir émettre.</Empty> : (
        <Card pad={false}><div className="overflow-x-auto"><table className="w-full min-w-[720px]">
          <thead><tr><th className="th">Document</th><th className="th">Client</th><th className="th">Émis le</th><th className="th">Échéance</th><th className="th">Statut</th><th className="th text-right">Total TTC</th></tr></thead>
          <tbody>{rows.map((d) => { const t = docTotals(d.lines, d.deposit, d.paid_amount); const late = d.kind === "invoice" && d.number && t.balance > 0 && d.due_date && d.due_date < today && d.status !== "cancelled"; return (
            <tr key={d.id} className="hover:bg-zinc-50">
              <td className="td"><Link href={`/hub/documents/${d.id}`} className="font-medium hover:underline">{d.kind === "invoice" ? "Facture" : "Devis"} {d.number ?? <span className="text-zinc-400">brouillon #{d.id}</span>}</Link></td>
              <td className="td">{d.client_name}{d.brand && d.brand !== d.client_name && <div className="text-xs text-zinc-500">{d.brand}</div>}</td>
              <td className="td text-xs">{fmtDate(d.issue_date)}</td><td className="td text-xs">{fmtDate(d.due_date)}</td>
              <td className="td"><Badge tone={late ? "red" : docTone(d.status)}>{late ? "En retard" : DOC_STATUS[d.status as keyof typeof DOC_STATUS]}</Badge></td>
              <td className="td text-right tabular">{eur(t.ttc)}</td>
            </tr>); })}</tbody></table></div></Card>
      )}
    </div>
  );
}
