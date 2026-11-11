import Link from "next/link";
import { loadDataset } from "@/lib/data";
import { contactPerformance } from "@/lib/stats";
import { fmtDate } from "@/lib/dates";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";

export const metadata = { title: "Interlocuteurs" };

export default async function Contacts({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const sp = await searchParams;
  const ds = await loadDataset();
  let rows = contactPerformance(ds);
  if (sp.q) { const s = sp.q.toLowerCase(); rows = rows.filter((r) => `${r.contact.first_name} ${r.contact.last_name} ${r.contact.email} ${r.brandName} ${r.contact.role}`.toLowerCase().includes(s)); }
  const F: Record<string, (r: (typeof rows)[number]) => boolean> = {
    responsive: (r) => r.responses > 0, positive: (r) => r.positive > 0, fast: (r) => r.avgResponseHours !== null && r.avgResponseHours <= 48,
    silent: (r) => r.badge.startsWith("Sans réponse après"), established: (r) => r.badge === "Relation établie",
  };
  if (sp.f && F[sp.f]) rows = rows.filter(F[sp.f]);
  const tabs = [["", "Tous"], ["responsive", "Répondent"], ["positive", "Positifs"], ["fast", "Rapides (< 48 h)"], ["established", "Relation établie"], ["silent", "Sans réponse (3+ tentatives, 21 j+)"]];
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Interlocuteurs RP" subtitle="Personne n'est classé « sans réponse » avant 3 tentatives sur au moins 21 jours." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(([k, l]) => <Link key={k} href={`/hub/contacts${k ? `?f=${k}` : ""}`} className={`btn ${(sp.f ?? "") === k ? "btn-primary" : "btn-ghost"}`}>{l}</Link>)}
        <form className="ml-auto"><input name="q" defaultValue={sp.q} placeholder="Rechercher…" className="input !w-56" /></form>
      </div>
      {rows.length === 0 ? <Empty title="Aucun interlocuteur">Ajoutez des interlocuteurs depuis les fiches marques.</Empty> : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead><tr><th className="th">Nom</th><th className="th">Entreprise</th><th className="th">Fonction</th><th className="th">Email pro</th><th className="th">1er contact</th><th className="th text-right">Démarches</th><th className="th text-right">Réponses</th><th className="th text-right">Pos.</th><th className="th text-right">Refus</th><th className="th text-right">Délai moy.</th><th className="th">Dernière interaction</th><th className="th">Prochaine relance</th><th className="th">Statut</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.contact.id} className="hover:bg-zinc-50">
                  <td className="td font-medium">{[r.contact.first_name, r.contact.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="td"><Link href={`/hub/brands/${r.contact.brand_id}`} className="hover:underline">{r.brandName}</Link></td>
                  <td className="td text-xs">{r.contact.role ?? r.contact.role_type ?? "—"}</td>
                  <td className="td text-xs">{r.contact.email ?? "—"}</td>
                  <td className="td text-xs">{r.firstContact ? fmtDate(new Date(r.firstContact)) : "—"}</td>
                  <td className="td text-right tabular">{r.attempts}</td><td className="td text-right tabular">{r.responses}</td><td className="td text-right tabular">{r.positive}</td><td className="td text-right tabular">{r.negative}</td>
                  <td className="td text-right tabular">{r.avgResponseHours === null ? "—" : r.avgResponseHours < 48 ? `${r.avgResponseHours} h` : `${Math.round(r.avgResponseHours / 24)} j`}</td>
                  <td className="td text-xs">{r.lastInteraction ? fmtDate(new Date(r.lastInteraction)) : "—"}</td>
                  <td className="td text-xs">{r.nextFollowUp ? fmtDate(r.nextFollowUp) : "—"}</td>
                  <td className="td"><Badge tone={r.badge === "Relation établie" || r.badge === "Répond positivement" ? "green" : r.badge.startsWith("Sans réponse") ? "red" : r.badge === "Ne plus contacter" ? "dark" : r.badge.startsWith("Répond") || r.badge.startsWith("A déjà") ? "blue" : "slate"}>{r.badge}</Badge></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
