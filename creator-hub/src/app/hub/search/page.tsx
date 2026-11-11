import Link from "next/link";
import { q } from "@/lib/db";
import { PageHeader, Card, Empty } from "@/components/ui";

export const metadata = { title: "Recherche" };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const term = ((await searchParams).q ?? "").trim().slice(0, 100);
  const like = `%${term}%`;
  const [brands, contacts, docs] = term ? await Promise.all([
    q<any>(`select id, name, city from brands where name ilike $1 or description ilike $1 or notes ilike $1 or website ilike $1 limit 20`, [like]),
    q<any>(`select c.id, c.brand_id, c.first_name, c.last_name, c.role, c.email, b.name as brand from contacts c join brands b on b.id=c.brand_id
      where c.first_name ilike $1 or c.last_name ilike $1 or c.email ilike $1 or c.role ilike $1 or (coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')) ilike $1 limit 20`, [like]),
    q<any>(`select id, kind, number, client_name from documents where number ilike $1 or client_name ilike $1 limit 20`, [like]),
  ]) : [[], [], []];
  const none = term && !brands.length && !contacts.length && !docs.length;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Recherche" subtitle={term ? `Résultats pour « ${term} »` : "Marques, interlocuteurs, devis et factures"} />
      <form className="mb-4"><input name="q" defaultValue={term} autoFocus className="input" placeholder="Rechercher…" /></form>
      {none && <Empty title="Aucun résultat" action={<Link href="/hub/brands/new" className="btn btn-accent">+ Ajouter « {term} » comme marque</Link>} />}
      <div className="space-y-4">
        {brands.length > 0 && <Card title="Marques"><ul className="divide-y divide-zinc-100">{brands.map((b) => <li key={b.id} className="py-2"><Link className="font-medium hover:underline" href={`/hub/brands/${b.id}`}>{b.name}</Link> <span className="text-xs text-zinc-500">{b.city}</span></li>)}</ul></Card>}
        {contacts.length > 0 && <Card title="Interlocuteurs"><ul className="divide-y divide-zinc-100">{contacts.map((c) => <li key={c.id} className="py-2"><Link className="font-medium hover:underline" href={`/hub/brands/${c.brand_id}`}>{[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email}</Link> <span className="text-xs text-zinc-500">{c.role} · {c.brand}</span></li>)}</ul></Card>}
        {docs.length > 0 && <Card title="Documents"><ul className="divide-y divide-zinc-100">{docs.map((d) => <li key={d.id} className="py-2"><Link className="font-medium hover:underline" href={`/hub/documents/${d.id}`}>{d.kind === "invoice" ? "Facture" : "Devis"} {d.number ?? `brouillon #${d.id}`}</Link> <span className="text-xs text-zinc-500">{d.client_name}</span></li>)}</ul></Card>}
      </div>
    </div>
  );
}
