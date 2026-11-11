import Link from "next/link";
import { q, one } from "@/lib/db";
import { getSetting, DEFAULT_LEGAL, type LegalSettings } from "@/lib/settings";
import { PageHeader, Card } from "@/components/ui";
import { DocumentEditor } from "../editor";
import { addDays, todayParis } from "@/lib/dates";

export const metadata = { title: "Nouveau document" };

export default async function NewDoc({ searchParams }: { searchParams: Promise<{ brand?: string; deal?: string; kind?: string; from?: string }> }) {
  const sp = await searchParams;
  const [brands, deals, legal] = await Promise.all([
    q<{ id: number; name: string }>(`select id, name from brands order by name`),
    q<any>(`select id, title, brand_id, coalesce(negotiated_price, planned_price) as price, service_category from deals where collab_type<>'gifting' order by created_at desc`),
    getSetting<LegalSettings>("legal", DEFAULT_LEGAL),
  ]);
  const brand = sp.brand ? await one<any>(`select id, name, public_email from brands where id=$1`, [Number(sp.brand)]) : null;
  const deal = sp.deal ? deals.find((d) => d.id === Number(sp.deal)) : null;
  const kind = sp.kind === "invoice" ? "invoice" : "quote";
  const src = sp.from ? await one<any>(`select * from documents where id=$1`, [Number(sp.from)]) : null;
  const vat = legal.vat_exempt ? 0 : legal.default_vat_rate;
  const doc = src ? {
    kind, brand_id: src.brand_id, deal_id: src.deal_id, client_name: src.client_name, client_email: src.client_email, client_address: src.client_address,
    client_siret: src.client_siret, client_vat: src.client_vat, issue_date: todayParis(), due_date: addDays(todayParis(), 30), deposit: 0, lines: src.lines,
    notes: src.number ? `Suivant devis n° ${src.number}.` : null,
  } : {
    kind, brand_id: brand?.id ?? null, deal_id: deal?.id ?? null, client_name: brand?.name ?? "", client_email: "",
    issue_date: todayParis(), due_date: addDays(todayParis(), 30), deposit: 0,
    lines: deal ? [{ description: `${deal.title} — ${deal.service_category}`, quantity: 1, unit_price: Number(deal.price) || 0, discount_pct: 0, vat_rate: vat }] : [],
  };
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Nouveau devis / facture" subtitle="Le numéro définitif est attribué à l'émission, après vérification des mentions légales." actions={<Link href="/hub/documents" className="btn btn-ghost">Annuler</Link>} />
      <Card><DocumentEditor doc={doc} brands={brands} deals={deals} defaultVat={legal.default_vat_rate} vatExempt={legal.vat_exempt} /></Card>
    </div>
  );
}
