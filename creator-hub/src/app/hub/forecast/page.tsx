import Link from "next/link";
import { computeAll, recommendations, sectorChanges } from "@/lib/forecast/service";
import { SCENARIOS, SCENARIO_LABEL, monthLabel } from "@/lib/forecast/business";
import { periodStatus } from "@/lib/forecast/learning";
import { addMonthsYm } from "@/lib/forecast/business";
import { eur0 } from "@/lib/money";
import { PageHeader, Card, Kpi, Badge, Empty } from "@/components/ui";
import { ActionForm } from "@/components/client";
import { ScenarioChart, SCENARIO_COLORS } from "@/components/chart";
import { snapshotNow } from "../intel-actions";

export const metadata = { title: "Business Forecast" };
const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)} %`);
const SRC_TONE = { données: "green", mixte: "blue", hypothèse: "amber" } as const;

export default async function Forecast() {
  const all = await computeAll();
  const { bf, trend, accuracy, calibration } = all;
  const recs = recommendations(all);
  const changes = await sectorChanges(all);
  const labels = bf.months.map((m) => (m.month === 0 ? "Ce mois" : monthLabel(m.ym)));
  const pastMonths = Array.from({ length: 6 }, (_, i) => addMonthsYm(all.today.slice(0, 7), i - 5));
  const periods = periodStatus(all.ds, pastMonths);
  const trendTone = { progresse: "green", stagne: "slate", recule: "red", insuffisant: "amber" }[trend.status];
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Business Forecast" subtitle={<>Ce que la prospection peut raisonnablement produire. Une réponse positive n'est pas une signature ; une proposition n'est pas un revenu ; un contrat signé n'est pas un encaissement. Confiance globale : <Badge tone={bf.confidence === "élevé" ? "green" : bf.confidence === "moyen" ? "blue" : "amber"}>{bf.confidence}</Badge></>}
        actions={<><Link href="/hub/audience" className="btn btn-ghost">Audience Value →</Link><ActionForm action={snapshotNow} submitLabel="Enregistrer la prévision du jour" submitClass="btn btn-ghost"><span /></ActionForm></>} />

      {bf.confidence === "faible" && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>Prévision provisoire.</b> {bf.outcomes} issue(s) connue(s) seulement : les probabilités reposent surtout sur les hypothèses affichées plus bas (modifiables dans <Link href="/hub/settings#forecast" className="underline">Paramètres</Link>). Elles se corrigent automatiquement à mesure que vos démarches aboutissent ou échouent.</div>}

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Aujourd'hui</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Contrats potentiels" value={bf.totals.potentialCount} hint="opportunités ouvertes" />
        <Kpi label="Contrats probables" value={bf.totals.probable.central.toFixed(1)} hint={`${bf.totals.probable.prudent.toFixed(1)} – ${bf.totals.probable.ambitious.toFixed(1)}`} />
        <Kpi label="Signés ce mois" value={bf.totals.signedCount} tone="green" />
        <Kpi label="CA potentiel (non pondéré)" value={eur0(bf.totals.potentialValue)} tone="muted" hint="si tout signait" />
        <Kpi label="CA prévisionnel pondéré" value={eur0(bf.totals.weighted.central)} tone="accent" hint={`${eur0(bf.totals.weighted.prudent)} – ${eur0(bf.totals.weighted.ambitious)}`} />
        <Kpi label="CA facturé (TTC)" value={eur0(bf.totals.invoiced)} />
        <Kpi label="CA encaissé" value={eur0(bf.totals.collected)} tone="green" hint={bf.totals.receivables ? `${eur0(bf.totals.receivables)} à recevoir` : undefined} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {SCENARIOS.map((sc) => { const x = bf.scenarios[sc]; return (
          <Card key={sc} title={<span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SCENARIO_COLORS[sc] }} />Scénario {SCENARIO_LABEL[sc].toLowerCase()} · 6 mois</span>}>
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm tabular">
              <dt className="text-zinc-500">Contrats estimés</dt><dd className="text-right font-semibold">{x.contracts6m.toFixed(1)}</dd>
              <dt className="text-zinc-500">CA prévisionnel pondéré</dt><dd className="text-right font-semibold">{eur0(x.weighted6m)}</dd>
              <dt className="text-zinc-500">Revenus probables à encaisser</dt><dd className="text-right">{eur0(x.cash6m)}</dd>
              <dt className="text-zinc-500">Confiance</dt><dd className="text-right">{x.confidence}</dd>
            </dl>
            {x.risks.length > 0 && <div className="mt-3 border-t border-zinc-100 pt-2"><div className="text-xs font-medium text-zinc-500">Facteurs de risque</div><ul className="mt-1 space-y-1 text-xs text-zinc-600">{x.risks.map((r) => <li key={r}>• {r}</li>)}</ul></div>}
          </Card>); })}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card title="CA prévisionnel pondéré par mois">
          <ScenarioChart labels={labels} series={SCENARIOS.map((sc) => ({ label: SCENARIO_LABEL[sc], color: SCENARIO_COLORS[sc], values: bf.months.map((m) => m.weighted[sc]), dashed: sc !== "central" }))} empty="Aucune opportunité ouverte ni démarche récente : la prévision est nulle. Enregistrez vos démarches pour l'activer." />
        </Card>
        <Card title="Encaissements attendus par mois">
          <ScenarioChart labels={labels} series={SCENARIOS.map((sc) => ({ label: SCENARIO_LABEL[sc], color: SCENARIO_COLORS[sc], values: bf.months.map((m) => m.cash[sc]), dashed: sc !== "central" }))} empty="Aucun encaissement attendu." />
        </Card>
      </div>

      <Card title="Projection mois par mois" className="mt-6" pad={false}>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px]">
          <thead><tr><th className="th">Mois</th><th className="th text-right">Contrats pipeline</th><th className="th text-right">Nouveaux (prospection)</th><th className="th text-right">Contrats (prudent · central · ambitieux)</th><th className="th text-right">CA pondéré central</th><th className="th text-right">Encaissement central</th><th className="th">Confiance</th></tr></thead>
          <tbody>{bf.months.map((m) => (
            <tr key={m.ym}><td className="td font-medium">{labels[m.month]}</td>
              <td className="td text-right tabular">{m.pipelineContracts.central.toFixed(1)}</td><td className="td text-right tabular">{m.newContracts.central.toFixed(1)}</td>
              <td className="td text-right tabular">{m.contracts.prudent.toFixed(1)} · <b>{m.contracts.central.toFixed(1)}</b> · {m.contracts.ambitious.toFixed(1)}{m.capped.central && <Badge tone="amber">capacité</Badge>}</td>
              <td className="td text-right tabular">{eur0(m.weighted.central)}</td><td className="td text-right tabular">{eur0(m.cash.central)}</td>
              <td className="td"><Badge tone={m.confidence === "élevé" ? "green" : m.confidence === "moyen" ? "blue" : "amber"}>{m.confidence}</Badge></td></tr>))}</tbody></table></div>
      </Card>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card title="Hypothèses utilisées" className="xl:col-span-2">
          <ul className="divide-y divide-zinc-100 text-sm">{bf.assumptions.map((a) => (
            <li key={a.label} className="flex flex-wrap items-baseline justify-between gap-2 py-2"><span>{a.label}<div className="text-xs text-zinc-500">{a.detail}</div></span><span className="flex items-center gap-2 text-right font-medium">{a.value}<Badge tone={SRC_TONE[a.source]}>{a.source}</Badge></span></li>))}</ul>
          <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Probabilité de signature par étape</div>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[600px]">
            <thead><tr><th className="th">Étape</th><th className="th text-right">Marques passées</th><th className="th text-right">Issues connues</th><th className="th text-right">Gagnées</th><th className="th text-right">Hypothèse</th><th className="th text-right">Probabilité (intervalle)</th><th className="th">Source</th></tr></thead>
            <tbody>{bf.stageProbs.map((p) => <tr key={p.key}><td className="td">{p.label}</td><td className="td text-right tabular">{p.reached}</td><td className="td text-right tabular">{p.closed}</td><td className="td text-right tabular">{p.won}</td><td className="td text-right tabular text-zinc-500">{pct(p.prior)}</td><td className="td text-right tabular"><b>{pct(p.p)}</b> <span className="text-xs text-zinc-500">({pct(p.low)} – {pct(p.high)})</span></td><td className="td"><Badge tone={SRC_TONE[p.source]}>{p.source}</Badge></td></tr>)}</tbody></table></div>
        </Card>
        <Card title="Tendance (30 j vs 30 j précédents)">
          <div className="mb-2"><Badge tone={trendTone}>{trend.status === "insuffisant" ? "Données insuffisantes" : `Activité : ${trend.status}`}</Badge></div>
          <ul className="space-y-1.5 text-sm">{trend.metrics.map((m) => <li key={m.label} className="flex justify-between"><span className="text-zinc-600">{m.label}</span><span className="tabular">{m.previous} → <b>{m.current}</b> {m.change !== null && m.change !== 0 && <span className={m.change > 0 ? "text-emerald-600" : "text-red-600"}>({m.change > 0 ? "+" : ""}{Math.round(m.change * 100)} %)</span>}</span></li>)}</ul>
          {changes.length > 0 && <div className="mt-3 border-t border-zinc-100 pt-2 text-sm">{changes.map((c) => <p key={c} className="mt-1">→ {c}</p>)}</div>}
          <div className="mt-3 border-t border-zinc-100 pt-2 text-xs font-medium text-zinc-500">Périodes (CA signé réel)</div>
          <ul className="mt-1 text-xs">{periods.map((p) => <li key={p.month} className="flex justify-between py-0.5"><span>{monthLabel(p.month)}</span><span className="tabular">{eur0(p.revenue)} {p.status !== "—" && <Badge tone={p.status === "croissance" ? "green" : p.status === "recul" ? "red" : "slate"}>{p.status}</Badge>}</span></li>)}</ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card title="Prévision par secteur (scénario central, 6 mois)" pad={false}>
          <table className="w-full"><thead><tr><th className="th">Secteur</th><th className="th text-right">Opportunités</th><th className="th text-right">Contrats</th><th className="th text-right">Court terme (≤ 2 mois)</th><th className="th text-right">CA pondéré 6 mois</th></tr></thead>
            <tbody>{bf.sectors.map((s) => <tr key={s.sector_id}><td className="td"><span className="inline-flex items-center gap-1.5 font-medium"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span><div className="text-xs text-zinc-500">{s.note}</div></td>
              <td className="td text-right tabular">{s.pipelineCount}</td><td className="td text-right tabular">{s.contracts6m.toFixed(1)}</td><td className="td text-right tabular">{eur0(s.shortTerm)}</td><td className="td text-right tabular font-semibold">{eur0(s.weighted6m)}</td></tr>)}</tbody></table>
        </Card>
        <Card title="Recommandations (fondées sur vos données)">
          {recs.length === 0 ? <p className="text-sm text-zinc-500">Pas encore assez de données pour recommander quoi que ce soit de fiable.</p> :
            <ul className="space-y-3 text-sm">{recs.map((r) => <li key={r.text}><b>→ {r.text}</b><div className="text-xs text-zinc-500">{r.why}</div></li>)}</ul>}
        </Card>
      </div>

      <Card title="Opportunités pondérées" className="mt-6" pad={false}>
        {bf.opportunities.length === 0 ? <div className="p-4"><Empty title="Aucune opportunité ouverte">Une opportunité apparaît dès qu'une marque est au statut « Contacté » ou au-delà.</Empty></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr><th className="th">Marque</th><th className="th">Étape</th><th className="th text-right">Montant</th><th className="th text-right">Probabilité</th><th className="th text-right">Pondéré</th><th className="th">Signature attendue</th></tr></thead>
            <tbody>{[...bf.opportunities].sort((a, b) => b.p.central * b.value - a.p.central * a.value).map((o) => (
              <tr key={o.brand_id}><td className="td"><Link className="font-medium hover:underline" href={`/hub/brands/${o.brand_id}`}>{o.name}</Link></td><td className="td text-xs">{o.stage_label}</td>
                <td className="td text-right tabular">{eur0(o.value)}<div className="text-[0.68rem] text-zinc-400">{o.valueSource}</div></td>
                <td className="td text-right tabular">{pct(o.p.central)} <span className="text-xs text-zinc-400">({pct(o.p.prudent)}–{pct(o.p.ambitious)})</span></td>
                <td className="td text-right tabular font-semibold">{eur0(o.p.central * o.value)}</td><td className="td text-xs">{labels[o.expectedMonth]}</td></tr>))}</tbody></table></div>
        )}
      </Card>

      <Card title="Prévisions vs réalité (apprentissage)" className="mt-6" pad={false}>
        {accuracy.length === 0 ? <div className="p-4"><Empty title="Pas encore de mois comparable">Chaque jour, la prévision est archivée (tâche planifiée ou bouton « Enregistrer la prévision du jour »). À la fin de chaque mois, elle est comparée au réalisé et l'écart corrige les prévisions suivantes (à partir de 2 mois).</Empty></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[860px]"><thead><tr><th className="th">Mois</th><th className="th">Prévu le</th><th className="th text-right">Prévu (CA pondéré)</th><th className="th text-right">Réel (CA signé)</th><th className="th text-right">Écart</th><th className="th text-right">Précision</th><th className="th text-right">Facturé</th><th className="th text-right">Encaissé (prévu → réel)</th><th className="th">Explications</th></tr></thead>
            <tbody>{accuracy.map((a) => (
              <tr key={a.month}><td className="td font-medium">{monthLabel(a.month)}</td><td className="td text-xs">{a.madeOn}</td><td className="td text-right tabular">{eur0(a.predictedRevenue)}</td><td className="td text-right tabular">{eur0(a.actualRevenue)}</td>
                <td className={`td text-right tabular ${a.errorEur < 0 ? "text-red-600" : "text-emerald-600"}`}>{a.errorEur > 0 ? "+" : ""}{eur0(a.errorEur)} {a.errorPct !== null && `(${a.errorPct > 0 ? "+" : ""}${Math.round(a.errorPct * 100)} %)`}</td>
                <td className="td text-right tabular">{pct(a.accuracy)}</td><td className="td text-right tabular">{eur0(a.actualInvoiced)}</td><td className="td text-right tabular">{eur0(a.predictedCash)} → {eur0(a.actualCash)}</td>
                <td className="td text-xs">{a.factors.join(" · ") || "—"}</td></tr>))}</tbody></table>
            <p className="px-4 py-2 text-xs text-zinc-500">Ajustement appris : {calibration.months >= 2 ? `× ${calibration.factor.toFixed(2)} appliqué aux probabilités (médiane réel/prévu sur ${calibration.months} mois)` : `non appliqué (${calibration.months} mois comparé, minimum 2)`}.</p></div>
        )}
      </Card>
    </div>
  );
}
