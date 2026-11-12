import Link from "next/link";
import { q } from "@/lib/db";
import { getSectors } from "@/lib/data";
import { getSetting } from "@/lib/settings";
import { getProvider } from "@/lib/watch/providers";
import { DEFAULT_WATCH, type WatchSettings } from "@/lib/watch/engine";
import { SIGNALS, type Signal } from "@/lib/watch/core";
import { COLLAB_TYPES } from "@/lib/constants";
import { fmtDate, fmtDateTime, todayParis } from "@/lib/dates";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import { ActionForm, Disclosure } from "@/components/client";
import { runWatchNow, importWatchResults, dismissCandidates, prepareSelection } from "../intel-actions";

export const metadata = { title: "Veille commerciale" };

type SP = { status?: string; sector?: string; collab?: string; quality?: string; min?: string; kind?: string; new?: string };
const QUALITY_TONE: Record<string, string> = { excellent: "green", bon: "blue", générique: "slate", aucun: "amber" };

export default async function Watch({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [sectors, runs, settings] = await Promise.all([
    getSectors(),
    q<any>(`select * from watch_runs order by started_at desc limit 8`),
    getSetting<WatchSettings>("watch", DEFAULT_WATCH),
  ]);
  const provider = getProvider();
  const status = sp.status ?? "new";
  const where: string[] = ["b.kind='brand'"]; const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)); };
  if (status !== "all") add("b.status = ?", status);
  if (sp.sector) add("b.sector_id = ?", Number(sp.sector));
  if (sp.collab) add("? = any(b.opportunities)", sp.collab);
  if (sp.quality) add("coalesce(b.contact_quality,'aucun') = ?", sp.quality);
  if (sp.min) add("coalesce(b.score,0) >= ?", Number(sp.min));
  if (sp.new === "today") add("(b.first_seen_at at time zone 'Europe/Paris')::date = ?::date", todayParis());
  const rows = await q<any>(`select b.*, s.name as sector, s.color,
      (select count(*)::int from watch_candidates c where c.kind='contact' and c.parent_id=b.id) as contacts
    from watch_candidates b left join sectors s on s.id=b.sector_id where ${where.join(" and ")}
    order by b.score desc nulls last, b.first_seen_at desc limit 200`, params);
  const counts = await q<{ status: string; n: number }>(`select status, count(*)::int n from watch_candidates where kind='brand' group by 1`);
  const cnt = Object.fromEntries(counts.map((c) => [c.status, c.n]));
  const contactsChanged = await q<any>(`select * from watch_candidates where kind='contact' and changed_at is not null and changed_at > now() - interval '14 days' order by changed_at desc limit 10`);
  const newContacts = await q<any>(`select c.*, p.name as brand from watch_candidates c left join watch_candidates p on p.id=c.parent_id where c.kind='contact' and c.status='new' order by c.first_seen_at desc limit 20`);
  const last = runs.find((r) => r.status !== "skipped");

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Veille commerciale" subtitle={<>Nouvelles marques et interlocuteurs détectés chaque jour, dédoublonnés, notés sur 100 (pertinence, pas probabilité de signature). Rien n'est ajouté au CRM ni envoyé sans votre validation.</>}
        actions={<ActionForm action={runWatchNow} submitLabel="Lancer la veille maintenant" submitClass="btn btn-accent"><span /></ActionForm>} />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card>
          <div className="text-xs text-zinc-500">Source automatique</div>
          {provider ? <div className="mt-1 flex items-center gap-2 text-sm font-medium">{provider.label} <Badge tone="green">Configurée</Badge></div>
            : <div className="mt-1 text-sm"><Badge tone="amber">Non configurée</Badge><p className="mt-1 text-xs text-zinc-500">Ajoutez <code>FIRECRAWL_API_KEY</code> pour la veille quotidienne automatique ({settings.max_queries} requêtes/jour, {settings.hour} h). En attendant : import manuel.</p></div>}
        </Card>
        <Card>
          <div className="text-xs text-zinc-500">Dernière veille</div>
          {last ? <div className="mt-1 text-sm"><b>{fmtDateTime(last.started_at)}</b> · {last.provider} · <Badge tone={last.status === "done" ? "green" : "red"}>{last.status}</Badge>
            <div className="text-xs text-zinc-500">{last.results} résultats · {last.new_brands} nouvelles marques · {last.new_contacts} interlocuteurs · {last.known} déjà connus · {last.updated} mis à jour</div></div>
            : <p className="mt-1 text-sm text-zinc-500">Aucune veille exécutée.</p>}
        </Card>
        <Card>
          <div className="text-xs text-zinc-500">Respect des plateformes</div>
          <p className="mt-1 text-xs text-zinc-600">Seuls les résultats publics des moteurs de recherche sont lus. LinkedIn et Instagram ne sont jamais visités ni « scrapés ». Un interlocuteur reste « à vérifier » tant que vous n'avez pas confirmé son poste actuel.</p>
        </Card>
      </div>

      <Card className="mb-4" title="Importer des résultats (vos propres recherches)">
        <Disclosure label="Coller des résultats">
          <ActionForm action={importWatchResults} submitLabel="Analyser et dédoublonner" resetOnOk className="grid gap-3 sm:grid-cols-3">
            <label className="field sm:col-span-3"><span>Une ligne par résultat : URL ; titre ; extrait (titre et extrait facultatifs, mais améliorent la détection)</span>
              <textarea name="results" rows={5} className="input font-mono !text-xs" placeholder={"https://www.marque.fr/presse ; Marque — Espace presse ; Nouvelle collection et programme ambassadeur\nhttps://fr.linkedin.com/in/... ; Prénom Nom - Influence Manager - Marque | LinkedIn ;"} /></label>
            <label className="field"><span>Secteur (facultatif)</span><select name="sector_id" className="input"><option value="">Détection automatique</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="field"><span>Rattacher les profils à la marque (facultatif)</span><input name="brand_name" className="input" placeholder="Nom de la marque" /></label>
          </ActionForm>
        </Disclosure>
      </Card>

      <div className="mb-3 flex flex-wrap gap-2">
        {[["new", "Nouvelles"], ["known", "Déjà au CRM"], ["accepted", "Validées"], ["dismissed", "Ignorées"], ["all", "Toutes"]].map(([k, l]) => (
          <Link key={k} href={`/hub/watch?status=${k}`} className={`btn ${status === k ? "btn-primary" : "btn-ghost"}`}>{l} <span className="text-xs opacity-60">{k === "all" ? Object.values(cnt).reduce((a, b) => a + b, 0) : cnt[k] ?? 0}</span></Link>))}
        <Link href={`/hub/watch?status=new&new=today`} className={`btn ${sp.new === "today" ? "btn-primary" : "btn-ghost"}`}>Découvertes du jour</Link>
      </div>
      <Card className="mb-4">
        <form className="grid gap-2 sm:grid-cols-6">
          <input type="hidden" name="status" value={status} />
          <select name="sector" defaultValue={sp.sector ?? ""} className="input"><option value="">Tous secteurs</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select name="collab" defaultValue={sp.collab ?? ""} className="input"><option value="">Toute collaboration</option>{Object.entries(COLLAB_TYPES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select>
          <select name="quality" defaultValue={sp.quality ?? ""} className="input"><option value="">Qualité du contact</option>{["excellent", "bon", "générique", "aucun"].map((x) => <option key={x}>{x}</option>)}</select>
          <input name="min" type="number" min={0} max={100} defaultValue={sp.min} placeholder="Score min." className="input" />
          <button className="btn btn-primary">Filtrer</button><Link href="/hub/watch" className="btn btn-ghost">Réinitialiser</Link>
        </form>
      </Card>

      {rows.length === 0 ? <Empty title="Aucune opportunité dans cette vue">{provider ? "Lancez la veille ou élargissez les filtres." : "Importez des résultats ou configurez la source automatique."}</Empty> : (
        <form>
          <div className="mb-2 flex gap-2"><button formAction={prepareSelection} className="btn btn-accent">Préparer les démarches de la sélection</button><button formAction={dismissCandidates} className="btn btn-ghost">Ignorer la sélection</button></div>
          <Card pad={false}><div className="overflow-x-auto"><table className="w-full min-w-[980px]">
            <thead><tr><th className="th w-8" /><th className="th">Opportunité</th><th className="th text-right">Score</th><th className="th">Signaux</th><th className="th">Collaborations</th><th className="th">Contact</th><th className="th">Vue</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50">
                <td className="td"><input type="checkbox" name="ids" value={r.id} /></td>
                <td className="td"><Link href={`/hub/watch/prepare?ids=${r.id}`} className="font-medium hover:underline">{r.name}</Link> <span className="text-xs text-zinc-400">(nom déduit)</span>
                  <div className="text-xs text-zinc-500">{r.sector ? <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} /> : null}{r.sector ?? "Secteur non déterminé"} · <a href={r.url} target="_blank" rel="noreferrer" className="underline">{r.domain} ↗</a></div>
                  {r.snippet && <div className="mt-0.5 line-clamp-2 max-w-md text-xs text-zinc-500">« {r.snippet} »</div>}</td>
                <td className="td text-right"><span className="font-display text-lg font-semibold tabular">{r.score ?? "—"}</span>
                  <details className="text-left text-[0.68rem] text-zinc-500"><summary className="cursor-pointer text-right">détail</summary><ul className="mt-1 w-64 space-y-0.5">{(r.score_breakdown ?? []).map((l: any) => <li key={l.key}><b>{l.points}/{l.max}</b> {l.label} — {l.reason}</li>)}</ul></details></td>
                <td className="td"><div className="flex max-w-60 flex-wrap gap-1">{(r.signals as Signal[]).map((s) => <Badge key={s} tone="violet">{SIGNALS[s]?.label ?? s}</Badge>)}</div></td>
                <td className="td"><div className="flex max-w-48 flex-wrap gap-1">{(r.opportunities as string[]).map((o) => <Badge key={o}>{COLLAB_TYPES[o as keyof typeof COLLAB_TYPES]?.short ?? o}</Badge>)}</div></td>
                <td className="td"><Badge tone={QUALITY_TONE[r.contact_quality ?? "aucun"]}>{r.contact_quality ?? "aucun"}</Badge>{r.contacts > 0 && <div className="text-xs text-zinc-500">{r.contacts} profil(s)</div>}</td>
                <td className="td text-xs text-zinc-500">1re fois {fmtDate(r.first_seen_at)}{r.seen_count > 1 && <div>revue {r.seen_count}×</div>}{r.status === "known" && <div><Link className="underline" href={`/hub/brands/${r.brand_id}`}>Fiche CRM</Link></div>}</td>
              </tr>))}</tbody></table></div></Card>
        </form>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title={`Nouveaux interlocuteurs (${newContacts.length})`}>
          {newContacts.length === 0 ? <p className="text-sm text-zinc-500">Aucun pour l'instant.</p> : <ul className="divide-y divide-zinc-100">{newContacts.map((c) => (
            <li key={c.id} className="py-2 text-sm"><b>{c.person_name ?? "Nom non publié"}</b> · {c.person_role ?? "fonction non publiée"} · {c.company ?? c.brand ?? "entreprise non publiée"} <Badge tone={QUALITY_TONE[c.contact_quality]}>{c.contact_quality}</Badge>
              <div className="text-xs text-zinc-500"><a href={c.url} target="_blank" rel="noreferrer" className="underline">{c.platform} ↗</a> · résultat public du {fmtDate(c.first_seen_at)} · <span className="text-amber-700">poste actuel à confirmer</span></div></li>))}</ul>}
        </Card>
        <Card title="Interlocuteurs dont les informations ont changé (14 j)">
          {contactsChanged.length === 0 ? <p className="text-sm text-zinc-500">Aucun changement détecté.</p> : <ul className="divide-y divide-zinc-100">{contactsChanged.map((c) => (
            <li key={c.id} className="py-2 text-sm"><b>{c.person_name}</b> : {c.previous?.person_role ?? "?"} @ {c.previous?.company ?? "?"} → <b>{c.person_role}</b> @ {c.company}<div className="text-xs text-zinc-500"><a className="underline" href={c.url} target="_blank" rel="noreferrer">source ↗</a> · {fmtDate(c.changed_at)}</div></li>))}</ul>}
        </Card>
      </div>

      <Card title="Historique des veilles" className="mt-6">
        <ul className="divide-y divide-zinc-100 text-sm">{runs.map((r) => (
          <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{fmtDateTime(r.started_at)} · {r.provider} · {r.trigger}</span>
            <span className="text-xs text-zinc-500">{r.status === "skipped" || r.status === "failed" ? <span className="text-amber-700">{r.error}</span> : `${r.results} résultats · ${r.new_brands} marques · ${r.new_contacts} contacts · ${r.known} connus`}</span></li>))}</ul>
      </Card>
    </div>
  );
}
