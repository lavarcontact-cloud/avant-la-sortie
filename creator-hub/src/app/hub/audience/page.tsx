import Link from "next/link";
import { q } from "@/lib/db";
import { computeAll } from "@/lib/forecast/service";
import { PLATFORMS, OWNERS, type Platform } from "@/lib/forecast/audience";
import { SCENARIOS, SCENARIO_LABEL, monthLabel } from "@/lib/forecast/business";
import { eur0 } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { PageHeader, Card, Badge, Empty, Kpi } from "@/components/ui";
import { ActionForm, Disclosure, ConfirmSubmit } from "@/components/client";
import { ScenarioChart, SCENARIO_COLORS } from "@/components/chart";
import { addSocialAccount, addSnapshot, importSnapshotsCsv, deleteSnapshot } from "../intel-actions";

export const metadata = { title: "Audience Value" };
const nf = (v: number | null | undefined) => (v == null ? "—" : new Intl.NumberFormat("fr-FR").format(v));
const SC_REAL = { prudent: "Prudent", central: "Réaliste", ambitious: "Ambitieux" } as const;

export default async function Audience({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const owner = (await searchParams).owner && /^[a-z_]+$/.test((await searchParams).owner!) ? (await searchParams).owner! : "personal";
  const all = await computeAll({ owner });
  const owners = await q<{ owner: string }>(`select distinct owner from social_accounts`);
  const ownerList = [...new Set(["personal", "lavar_media", ...owners.map((o) => o.owner)])];
  const snaps = await q<any>(`select s.*, s.captured_on::text as captured_on, a.platform, a.handle from social_snapshots s join social_accounts a on a.id=s.account_id where a.owner=$1 order by s.captured_on desc limit 40`, [owner]);
  const { metrics, prices, potential, projection, bf } = all;
  const labels = projection.rows.map((r) => (r.month === 0 ? "Auj." : `M+${r.month}`));
  // Abonnés prévus (prévision faite avant le mois) vs abonnés réellement relevés dans le mois.
  const audAcc = owner !== "personal" ? [] : await q<any>(`
    with f as (select distinct on (target_month) target_month, made_on, followers from forecast_snapshots
      where kind='audience' and scenario='central' and made_on < (target_month || '-01')::date order by target_month, made_on desc),
    r as (select to_char(s.captured_on,'YYYY-MM') m, s.account_id, max(s.followers) followers from social_snapshots s join social_accounts a on a.id=s.account_id
      where a.owner='personal' group by 1,2)
    select f.target_month as month, f.made_on::text as made_on, f.followers::bigint as predicted, (select sum(followers)::bigint from r where r.m=f.target_month) as actual
    from f where f.target_month < to_char(now(),'YYYY-MM') order by 1`);
  const totalFollowersNow = metrics.reduce((a, m) => a + (m.latest?.followers ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Audience Value" subtitle="Combien votre audience peut rapporter aujourd'hui et dans 6 mois. Distinct du potentiel de prospection : l'audience peut stagner pendant que vos revenus progressent, et inversement."
        actions={<Link href="/hub/forecast" className="btn btn-ghost">← Business Forecast</Link>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Entité :</span>
        {ownerList.map((o) => <Link key={o} href={`/hub/audience?owner=${o}`} className={`btn ${owner === o ? "btn-primary" : "btn-ghost"}`}>{OWNERS[o] ?? o}</Link>)}
        <span className="text-xs text-zinc-500">Les audiences et revenus de structures différentes ne sont jamais additionnés.</span>
      </div>

      {/* Comptes */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.account.id} title={<span>{PLATFORMS[m.account.platform as Platform] ?? m.account.platform} · @{m.account.handle}</span>}>
            {!m.latest ? <p className="text-sm text-zinc-500">Aucun relevé. Ajoutez vos statistiques ci-dessous.</p> : (
              <dl className="grid grid-cols-2 gap-y-1 text-sm tabular">
                <dt className="text-zinc-500">Abonnés</dt><dd className="text-right font-semibold">{nf(m.latest.followers)}</dd>
                <dt className="text-zinc-500">Vues 30 j</dt><dd className="text-right">{nf(m.latest.views_30d)}</dd>
                <dt className="text-zinc-500">Vues 90 j</dt><dd className="text-right">{nf(m.latest.views_90d)}</dd>
                <dt className="text-zinc-500">Portée 30 j</dt><dd className="text-right">{nf(m.latest.reach_30d)}</dd>
                <dt className="text-zinc-500">Vues / publication</dt><dd className="text-right">{nf(m.viewsPerPost == null ? null : Math.round(m.viewsPerPost))}</dd>
                <dt className="text-zinc-500">Engagement</dt><dd className="text-right">{m.engagementRate == null ? "—" : `${(m.engagementRate * 100).toFixed(1)} %`}</dd>
                <dt className="text-zinc-500">Croissance/mois</dt><dd className="text-right">{m.followerGrowth == null ? "inconnue" : `${(m.followerGrowth * 100).toFixed(1)} %`}</dd>
              </dl>)}
            {m.latest && <p className="mt-2 text-[0.68rem] text-zinc-500">Relevé du {fmtDate(m.latest.captured_on)} ({m.freshnessDays} j) · source : {m.latest.source}{m.engagementFormula ? ` · engagement = ${m.engagementFormula}` : ""}</p>}
            {m.missing.length > 0 && <p className="mt-1 text-[0.68rem] text-amber-700">Manquant : {m.missing.join(", ")}</p>}
          </Card>))}
        <Card title="Ajouter un compte">
          <ActionForm action={addSocialAccount} submitLabel="Ajouter" resetOnOk className="space-y-2">
            <input type="hidden" name="owner" value={owner} />
            <select name="platform" className="input">{Object.entries(PLATFORMS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input name="handle" required placeholder="@identifiant" className="input" />
            <input name="url" placeholder="URL du profil (facultatif)" className="input" />
            <p className="text-[0.68rem] text-zinc-500">Entité : {OWNERS[owner] ?? owner}</p>
          </ActionForm>
        </Card>
      </div>

      {metrics.length > 0 && (
        <Card title="Saisir ou importer des statistiques réelles" className="mt-4">
          <div className="flex flex-wrap gap-2">
            <Disclosure label="+ Relevé manuel">
              <ActionForm action={addSnapshot} submitLabel="Enregistrer le relevé" resetOnOk className="grid gap-2 sm:grid-cols-4">
                <label className="field"><span>Compte</span><select name="account_id" className="input">{metrics.map((m) => <option key={m.account.id} value={m.account.id}>{m.account.platform} @{m.account.handle}</option>)}</select></label>
                <label className="field"><span>Date du relevé *</span><input type="date" name="captured_on" required defaultValue={all.today} className="input" /></label>
                <label className="field sm:col-span-2"><span>Source * (ex. Instagram Insights, capture du 12/11)</span><input name="source" required className="input" /></label>
                {[["followers", "Abonnés"], ["views_30d", "Vues 30 j"], ["views_90d", "Vues 90 j"], ["reach_30d", "Portée 30 j"], ["impressions_30d", "Impressions 30 j"], ["engagements_30d", "Interactions 30 j"], ["posts_30d", "Publications 30 j"], ["avg_story_views", "Vues moy. / story"]].map(([k, l]) =>
                  <label key={k} className="field"><span>{l}</span><input name={k} inputMode="numeric" className="input" /></label>)}
                <label className="field sm:col-span-2"><span>Audience géographique (ex. France 72 %, Belgique 6 %)</span><input name="audience_geo" className="input" /></label>
                <label className="field"><span>Tranches d'âge</span><input name="audience_age" placeholder="18-24 : 41 %…" className="input" /></label>
                <label className="field"><span>Répartition H/F</span><input name="audience_gender" className="input" /></label>
                <label className="field sm:col-span-4"><span>Contenus les plus performants</span><input name="top_content" className="input" /></label>
              </ActionForm>
            </Disclosure>
            <Disclosure label="↑ Import CSV">
              <ActionForm action={importSnapshotsCsv} submitLabel="Importer" className="grid gap-2 sm:grid-cols-3">
                <select name="account_id" className="input">{metrics.map((m) => <option key={m.account.id} value={m.account.id}>{m.account.platform} @{m.account.handle}</option>)}</select>
                <input name="source" required placeholder="Source de l'export *" className="input" />
                <input type="file" name="file" accept=".csv,text/csv" className="input" />
                <textarea name="csv" rows={3} className="input font-mono !text-xs sm:col-span-3" placeholder={"date,followers,views_30d,views_90d,reach_30d,impressions_30d,engagements_30d,posts_30d,avg_story_views\n2026-11-01,11365,…"} />
              </ActionForm>
            </Disclosure>
          </div>
          {snaps.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[800px]"><thead><tr><th className="th">Date</th><th className="th">Compte</th><th className="th text-right">Abonnés</th><th className="th text-right">Vues 30 j</th><th className="th text-right">Portée</th><th className="th text-right">Interactions</th><th className="th text-right">Publications</th><th className="th">Source</th><th className="th" /></tr></thead>
            <tbody>{snaps.map((s) => <tr key={s.id}><td className="td text-xs">{s.captured_on}</td><td className="td text-xs">{s.platform} @{s.handle}</td><td className="td text-right tabular">{nf(s.followers)}</td><td className="td text-right tabular">{nf(s.views_30d)}</td><td className="td text-right tabular">{nf(s.reach_30d)}</td><td className="td text-right tabular">{nf(s.engagements_30d)}</td><td className="td text-right tabular">{nf(s.posts_30d)}</td><td className="td text-xs">{s.source}</td>
              <td className="td"><form action={deleteSnapshot}><input type="hidden" name="id" value={s.id} /><ConfirmSubmit message="Supprimer ce relevé ?" className="text-xs text-zinc-400 hover:text-red-600">×</ConfirmSubmit></form></td></tr>)}</tbody></table></div>}
        </Card>
      )}

      {/* Potentiel actuel */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-400">Potentiel commercial mensuel aujourd'hui</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Potentiel théorique" value={eur0(potential.theoretical)} hint="capacité entièrement vendue" tone="muted" />
        <Kpi label="CA accessible (réaliste)" value={eur0(potential.accessible.central)} hint={`${eur0(potential.accessible.prudent)} – ${eur0(potential.accessible.ambitious)}`} tone="accent" />
        <Kpi label="CA réalisé (30 j encaissés)" value={eur0(potential.realized)} tone="green" />
        <Kpi label="Abonnés (entité)" value={nf(totalFollowersNow)} hint={OWNERS[owner] ?? owner} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Scénarios du mois" className="xl:col-span-2" pad={false}>
          <table className="w-full"><thead><tr><th className="th">Scénario</th><th className="th text-right">Collaborations</th><th className="th text-right">Tarif moyen</th><th className="th text-right">CA</th><th className="th text-right">Charge (h)</th><th className="th">Hypothèse de conversion</th></tr></thead>
            <tbody>{SCENARIOS.map((sc) => { const x = potential.scenarios[sc]; return <tr key={sc}><td className="td font-medium">{SC_REAL[sc]}</td><td className="td text-right tabular">{x.collabs}</td><td className="td text-right tabular">{eur0(x.avgPrice)}</td><td className="td text-right tabular font-semibold">{eur0(x.revenue)}</td><td className="td text-right tabular">{x.hours}</td><td className="td text-xs">{x.conversion}</td></tr>; })}</tbody></table>
          <p className="px-4 py-2 text-xs text-zinc-500">Collaborations = contrats attendus par mois selon le Business Forecast (moyenne M+1 à M+3), plafonnés par votre capacité. Une audience n'est pas une garantie de revenus.</p>
        </Card>
        <Card title="Par type de potentiel">
          <ul className="space-y-1.5 text-sm">{potential.byType.map((t) => <li key={t.label} className="flex justify-between"><span>{t.label}<div className="text-[0.68rem] text-zinc-500">{t.note}</div></span><span className="tabular font-medium">{t.value ? eur0(t.value) : "—"}</span></li>)}</ul>
        </Card>
      </div>

      {/* Tarifs */}
      <Card title="Grille tarifaire estimée" className="mt-6" pad={false}>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px]">
          <thead><tr><th className="th">Prestation</th><th className="th text-right">Basse</th><th className="th text-right">Centrale</th><th className="th text-right">Haute</th><th className="th text-right">dont production</th><th className="th text-right">dont diffusion</th><th className="th">Justification</th><th className="th">Confiance</th></tr></thead>
          <tbody>{prices.map((p) => (
            <tr key={p.key} className={p.available ? "" : "opacity-60"}><td className="td font-medium">{p.label}</td>
              {p.available ? <><td className="td text-right tabular">{eur0(p.low)}</td><td className="td text-right tabular font-semibold">{eur0(p.mid)}</td><td className="td text-right tabular">{eur0(p.high)}</td>
                <td className="td text-right tabular">{eur0(p.production.mid)}</td><td className="td text-right tabular">{p.publication ? eur0(p.publication.mid) : "—"}</td></>
                : <td className="td text-xs text-amber-700" colSpan={5}>Non estimable — manquant : {p.missing.join(", ") || "statistiques"}</td>}
              <td className="td text-xs text-zinc-600">{p.justification.join(" · ")}{p.realData && <div className="text-emerald-700">Données réelles : {p.realData}</div>}<div className="text-zinc-400">{p.conditions.join(" ")}</div></td>
              <td className="td"><Badge tone={p.confidence === "élevée" ? "green" : p.confidence === "moyenne" ? "blue" : "amber"}>{p.confidence}</Badge></td></tr>))}</tbody></table></div>
        <p className="px-4 py-2 text-xs text-zinc-500">Production = temps × taux horaire (hypothèses modifiables dans Paramètres). Diffusion = vues réelles par publication × CPM (hypothèse). Le nombre d'abonnés seul n'entre pas dans le calcul. Droits d'usage, exclusivité et diffusion payante sont facturés en plus.</p>
      </Card>

      {/* Projection 6 mois */}
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card title={<span>Abonnés projetés (total de l'entité) {projection.provisional && <Badge tone="amber">provisoire</Badge>}</span>}>
          <ScenarioChart unit="" labels={labels} series={SCENARIOS.map((sc) => ({ label: SCENARIO_LABEL[sc], color: SCENARIO_COLORS[sc], dashed: sc !== "central", values: projection.rows.map((r) => Object.values(r.followers[sc]).reduce<number>((a, x) => a + (x ?? 0), 0)) }))} empty="Renseignez vos statistiques pour projeter l'audience." />
        </Card>
        <Card title="Potentiel mensuel de l'audience vs CA pondéré de la prospection">
          <ScenarioChart labels={labels} series={[
            { label: "Potentiel audience (central)", color: "#a855f7", values: projection.rows.map((r) => r.revenue.central) },
            { label: "CA pondéré prospection (central)", color: SCENARIO_COLORS.central, values: projection.rows.map((r) => r.weighted.central) },
          ]} empty="Pas encore de données." />
        </Card>
      </div>
      <Card title="Projection à 6 mois" className="mt-4" pad={false}>
        {metrics.length === 0 ? <div className="p-4"><Empty title="Aucun compte">Ajoutez vos comptes et au moins un relevé de statistiques.</Empty></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[1100px]">
            <thead><tr><th className="th">Échéance</th>{metrics.map((m) => <th key={m.account.id} className="th text-right">{m.account.platform} (P · C · A)</th>)}<th className="th text-right">Vues/mois (central)</th><th className="th text-right">Collabs (central)</th><th className="th text-right">Tarif moyen (C)</th><th className="th text-right">CA potentiel (C)</th><th className="th text-right">CA pondéré (C)</th><th className="th text-right">Récurrents</th><th className="th">Confiance</th></tr></thead>
            <tbody>{projection.rows.map((r) => (
              <tr key={r.month}><td className="td font-medium">{r.month === 0 ? "Aujourd'hui" : `Dans ${r.month} mois · ${monthLabel(bf.months[r.month].ym)}`}</td>
                {metrics.map((m) => { const k = `${m.account.platform}:${m.account.handle}`; return <td key={k} className="td text-right text-xs tabular">{nf(r.followers.prudent[k])} · <b>{nf(r.followers.central[k])}</b> · {nf(r.followers.ambitious[k])}</td>; })}
                <td className="td text-right tabular">{nf(r.views.central)}</td><td className="td text-right tabular">{r.collabs.central}</td><td className="td text-right tabular">{eur0(r.avgRate.central)}</td>
                <td className="td text-right tabular">{eur0(r.revenue.central)}</td><td className="td text-right tabular font-semibold">{eur0(r.weighted.central)}</td><td className="td text-right tabular">{r.recurring.central}</td>
                <td className="td"><Badge tone={r.confidence === "moyen" ? "blue" : "amber"}>{r.confidence}</Badge></td></tr>))}</tbody></table></div>
        )}
        <ul className="space-y-0.5 px-4 py-3 text-xs text-zinc-500">{projection.notes.map((n) => <li key={n}>• {n}</li>)}<li>• CA potentiel = capacité mensuelle × tarif moyen projeté ; CA pondéré = prévision de la prospection (Business Forecast).</li></ul>
      </Card>

      <Card title="Prévisions d'audience vs réalité" className="mt-4">
        {audAcc.length === 0 ? <p className="text-sm text-zinc-500">Les projections sont archivées chaque jour ; la comparaison avec vos relevés réels apparaîtra après un mois complet.</p> :
          <ul className="text-sm">{audAcc.map((a: any) => { const p = Number(a.predicted), r = a.actual == null ? null : Number(a.actual); return <li key={a.month}>{monthLabel(a.month)} : abonnés prévus le {a.made_on} : {nf(p)} — relevés : {r == null ? "aucun relevé ce mois-là" : nf(r)}{r != null && p > 0 && ` (écart ${Math.round(((r - p) / p) * 100)} %)`}</li>; })}</ul>}
      </Card>
    </div>
  );
}
