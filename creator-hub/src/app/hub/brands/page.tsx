import Link from "next/link";
import { q } from "@/lib/db";
import { getSectors, getStages } from "@/lib/data";
import { COLLAB_TYPES, COMPANY_SIZES, BRAND_TYPES } from "@/lib/constants";
import { PageHeader, Card, Badge, Empty, stageTone } from "@/components/ui";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Marques" };

type SP = { q?: string; sector?: string; stage?: string; collab?: string; country?: string; city?: string; size?: string; type?: string; min?: string; sort?: string };

export default async function Brands({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [sectors, stages] = await Promise.all([getSectors(), getStages()]);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)); };
  if (sp.q) add(`(b.name ilike ? or b.description ilike $${params.length + 1} or b.notes ilike $${params.length + 1})`, `%${sp.q}%`);
  if (sp.sector) add(`b.sector_id = ?`, Number(sp.sector));
  if (sp.stage) add(`b.stage_id = ?`, Number(sp.stage));
  if (sp.collab) add(`? = any(b.opportunities)`, sp.collab);
  if (sp.country) add(`b.country ilike ?`, `%${sp.country}%`);
  if (sp.city) add(`b.city ilike ?`, `%${sp.city}%`);
  if (sp.size) add(`b.company_size = ?`, sp.size);
  if (sp.type) add(`b.brand_type = ?`, sp.type);
  if (sp.min) add(`b.score >= ?`, Number(sp.min));
  const order = sp.sort === "name" ? "b.name" : sp.sort === "recent" ? "b.created_at desc" : sp.sort === "followup" ? "b.next_follow_up nulls last" : "b.score desc nulls last, b.updated_at desc";
  const rows = await q<any>(`
    select b.id, b.name, b.website, b.city, b.country, b.score, b.opportunities, b.next_follow_up::text as next_follow_up, b.do_not_contact, b.verified_at::text as verified_at,
      s.name as sector, s.color, st.label as stage, st.kind as stage_kind,
      (select count(*)::int from contacts c where c.brand_id=b.id) as contacts,
      (select count(*)::int from outreach o where o.brand_id=b.id) as outreach,
      (select count(*)::int from responses r where r.brand_id=b.id and r.classification<>'automatic') as responses,
      (select max(sent_at) from outreach o where o.brand_id=b.id) as last_outreach
    from brands b left join sectors s on s.id=b.sector_id left join pipeline_stages st on st.id=b.stage_id
    ${where.length ? "where " + where.join(" and ") : ""} order by ${order} limit 500`, params);
  const total = (await q<{ c: number }>(`select count(*)::int c from brands`))[0].c;
  const statusCounts = await q<{ kind: string; c: number }>(`select coalesce(s.kind,'open') kind, count(*)::int c from brands b left join pipeline_stages s on s.id=b.stage_id group by 1`);
  const contacted = (await q<{ c: number }>(`select count(distinct brand_id)::int c from outreach`))[0].c;
  const sc = Object.fromEntries(statusCounts.map((x) => [x.kind, x.c]));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Marques · CRM" subtitle={`${total} marque(s) · ${contacted} contactée(s) · ${sc.won ?? 0} gagnée(s) · ${sc.lost ?? 0} refus / sans réponse · ${sc.dnc ?? 0} à ne plus contacter`}
        actions={<><Link href="/hub/pipeline" className="btn btn-ghost">Vue pipeline</Link><Link href="/hub/brands/new" className="btn btn-accent">+ Ajouter une marque</Link></>} />
      <Card className="mb-4">
        <form className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input name="q" defaultValue={sp.q} placeholder="Recherche…" className="input lg:col-span-2" />
          <select name="sector" defaultValue={sp.sector ?? ""} className="input"><option value="">Tous secteurs</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select name="stage" defaultValue={sp.stage ?? ""} className="input"><option value="">Tous statuts</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <select name="collab" defaultValue={sp.collab ?? ""} className="input"><option value="">Toute collaboration</option>{Object.entries(COLLAB_TYPES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select>
          <select name="sort" defaultValue={sp.sort ?? ""} className="input"><option value="">Tri : pertinence</option><option value="recent">Plus récentes</option><option value="followup">Prochaine relance</option><option value="name">Nom</option></select>
          <input name="country" defaultValue={sp.country} placeholder="Pays" className="input" />
          <input name="city" defaultValue={sp.city} placeholder="Ville" className="input" />
          <select name="size" defaultValue={sp.size ?? ""} className="input"><option value="">Toute taille</option>{COMPANY_SIZES.map((s) => <option key={s}>{s}</option>)}</select>
          <select name="type" defaultValue={sp.type ?? ""} className="input"><option value="">Tout type</option>{BRAND_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
          <input name="min" type="number" min={0} max={100} defaultValue={sp.min} placeholder="Score min." className="input" />
          <div className="flex gap-2"><button className="btn btn-primary flex-1">Filtrer</button><Link href="/hub/brands" className="btn btn-ghost">×</Link></div>
        </form>
      </Card>
      {rows.length === 0 ? (
        <Empty title={total ? "Aucune marque ne correspond aux filtres" : "Aucune marque pour l'instant"} action={<Link href="/hub/brands/new" className="btn btn-accent">+ Ajouter une marque</Link>}>
          {total ? "Élargissez la recherche." : "Commencez par vos cibles prioritaires : Sony, MPB, DJI… en renseignant leurs pages officielles."}
        </Empty>
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead><tr><th className="th">Marque</th><th className="th">Secteur</th><th className="th">Statut</th><th className="th text-right">Score</th><th className="th">Opportunités</th><th className="th text-right">Contacts</th><th className="th text-right">Démarches</th><th className="th text-right">Réponses</th><th className="th">Prochaine relance</th></tr></thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50">
                    <td className="td"><Link href={`/hub/brands/${b.id}`} className="font-medium text-zinc-900 hover:underline">{b.name}</Link>
                      <div className="text-xs text-zinc-500">{[b.city, b.country].filter(Boolean).join(", ") || "—"}{b.verified_at ? ` · vérifié ${fmtDate(b.verified_at)}` : " · non vérifié"}</div></td>
                    <td className="td">{b.sector ? <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: b.color }} />{b.sector}</span> : "—"}</td>
                    <td className="td"><Badge tone={b.do_not_contact ? "dark" : stageTone(b.stage_kind)}>{b.stage ?? "—"}</Badge></td>
                    <td className="td text-right tabular font-medium">{b.score ?? "—"}</td>
                    <td className="td"><div className="flex max-w-56 flex-wrap gap-1">{(b.opportunities as string[]).map((o) => <Badge key={o}>{COLLAB_TYPES[o as keyof typeof COLLAB_TYPES]?.short ?? o}</Badge>)}</div></td>
                    <td className="td text-right tabular">{b.contacts}</td>
                    <td className="td text-right tabular">{b.outreach}</td>
                    <td className="td text-right tabular">{b.responses}</td>
                    <td className="td text-xs">{b.next_follow_up ? fmtDate(b.next_follow_up) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
