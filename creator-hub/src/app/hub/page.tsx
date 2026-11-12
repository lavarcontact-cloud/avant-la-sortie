import Link from "next/link";
import { loadDataset } from "@/lib/data";
import { computeKpis, sectorPerformance, sectorInsights, contactPerformance, timingAnalysis, followUpsDue, type Kpis } from "@/lib/stats";
import { addDays, todayParis, WEEKDAYS, TIME_SLOTS, fmtDate, parisMidnight } from "@/lib/dates";
import { eur0 } from "@/lib/money";
import { CHANNELS } from "@/lib/constants";
import { Card, Kpi, PageHeader, Empty, Bar, Badge, pctLabel } from "@/components/ui";
import { q } from "@/lib/db";
import { computeAll } from "@/lib/forecast/service";
import { SCENARIOS, SCENARIO_LABEL } from "@/lib/forecast/business";
import { ScenarioChart, SCENARIO_COLORS } from "@/components/chart";

export const metadata = { title: "Dashboard" };

const PERIODS = [{ k: "1", l: "Aujourd'hui" }, { k: "7", l: "7 jours" }, { k: "30", l: "30 jours" }, { k: "90", l: "90 jours" }, { k: "custom", l: "Personnalisée" }];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ p?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const p = PERIODS.some((x) => x.k === sp.p) ? sp.p! : "30";
  const today = todayParis();
  let fromYmd: string, toYmd: string;
  if (p === "custom" && sp.from && sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) { fromYmd = sp.from; toYmd = sp.to; }
  else { const days = p === "custom" ? 30 : Number(p); fromYmd = addDays(today, -days + 1); toYmd = today; }
  const from = parisMidnight(fromYmd);
  const to = parisMidnight(addDays(toYmd, 1));
  const len = to - from;

  const ds = await loadDataset();
  const k = computeKpis(ds, from, to, today);
  const prev = computeKpis(ds, from - len, from, today);
  const d = (key: keyof Kpis) => (k[key] - prev[key]);
  const sectors = sectorPerformance(ds);
  const insights = sectorInsights(sectors);
  const contacts = contactPerformance(ds).filter((c) => c.attempts > 0).slice(0, 8);
  const timing = timingAnalysis(ds);
  const due = followUpsDue(ds, today);
  const brandName = new Map(ds.brands.map((b) => [b.id, b.name]));
  const hot = await q<{ id: number; brand_id: number; name: string; received_at: string; intents: string[] }>(
    `select r.id, r.brand_id, b.name, r.received_at, r.intents from responses r join brands b on b.id=r.brand_id
     left join pipeline_stages s on s.id=b.stage_id
     where r.classification in ('positive','info_request') and coalesce(s.key,'') in ('replied','interested','contacted')
     order by r.received_at desc limit 6`);
  const meetings = await q<{ brand_id: number; name: string; title: string; occurred_at: string }>(
    `select i.brand_id, b.name, i.title, i.occurred_at from interactions i join brands b on b.id=i.brand_id where i.type='meeting' and i.occurred_at >= now() order by i.occurred_at limit 5`);
  const isEmpty = ds.brands.length === 0;
  const fc = await computeAll();
  const fLabels = fc.bf.months.map((m) => (m.month === 0 ? "Auj." : `M+${m.month}`));
  const watchNew = (await q<{ c: number; top: string | null }>(`select count(*)::int c, (select name from watch_candidates where kind='brand' and status='new' order by score desc nulls last limit 1) top from watch_candidates where kind='brand' and status='new'`))[0];
  const maxSectorOut = Math.max(1, ...sectors.map((s) => s.outreach));
  const maxSigned = Math.max(1, ...sectors.map((s) => s.signed));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Dashboard"
        subtitle={<>Période du {fmtDate(fromYmd)} au {fmtDate(toYmd)} · comparée à la période précédente de même durée</>}
        actions={
          <form className="flex flex-wrap items-center gap-1.5">
            <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5">
              {PERIODS.map((x) => (
                <Link key={x.k} href={x.k === "custom" ? `/hub?p=custom&from=${fromYmd}&to=${toYmd}` : `/hub?p=${x.k}`}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${p === x.k ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>{x.l}</Link>
              ))}
            </div>
            {p === "custom" && (<>
              <input type="hidden" name="p" value="custom" />
              <input type="date" name="from" defaultValue={fromYmd} className="input !w-auto !py-1 !text-xs" />
              <input type="date" name="to" defaultValue={toYmd} className="input !w-auto !py-1 !text-xs" />
              <button className="btn btn-ghost !py-1 !text-xs">Appliquer</button>
            </>)}
          </form>
        }
      />

      {isEmpty && (
        <div className="mb-6 rounded-2xl bg-zinc-900 p-6 text-white">
          <div className="text-xs font-medium uppercase tracking-wider text-accent">Démarrage</div>
          <h2 className="mt-2 font-display text-xl font-semibold">Votre CRM est vide — c'est normal, aucune donnée n'est inventée.</h2>
          <ol className="mt-3 grid gap-1.5 text-sm text-zinc-300 sm:grid-cols-2">
            <li>1. Ajoutez une marque (site officiel + source vérifiée)</li>
            <li>2. Ajoutez l'interlocuteur RP / influence identifié publiquement</li>
            <li>3. Préparez le message, envoyez-le vous-même, puis enregistrez la démarche</li>
            <li>4. La relance est planifiée automatiquement (J+7 par défaut)</li>
          </ol>
          <div className="mt-4 flex gap-2"><Link href="/hub/brands/new" className="btn btn-accent">+ Ajouter ma première marque</Link><Link href="/hub/settings" className="btn border border-white/20 text-white hover:bg-white/10">Compléter mon profil</Link></div>
        </div>
      )}

      {/* Actions du jour */}
      {(due.length > 0 || hot.length > 0) && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          {hot.length > 0 && (
            <Card title={<span className="flex items-center gap-2"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent" /></span>Opportunités à traiter</span>}>
              <ul className="divide-y divide-zinc-100">
                {hot.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/hub/brands/${h.brand_id}`} className="font-medium hover:underline">{h.name}</Link>
                    <span className="flex flex-wrap justify-end gap-1">{h.intents.filter((i) => i !== "opt_out").map((i) => <Badge key={i} tone="accent">{i === "pricing_request" ? "Tarifs" : i === "media_kit_request" ? "Media Kit" : i === "meeting" ? "RDV" : "Partenariat"}</Badge>)}<span className="text-xs text-zinc-400">{fmtDate(h.received_at)}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {due.length > 0 && (
            <Card title={`Relances dues (${due.length})`} action={<Link href="/hub/followups" className="text-xs text-zinc-500 hover:text-zinc-900">Tout voir →</Link>}>
              <ul className="divide-y divide-zinc-100">
                {due.slice(0, 6).map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/hub/brands/${o.brand_id}`} className="font-medium hover:underline">{brandName.get(o.brand_id)}</Link>
                    <span className="text-xs text-zinc-500">{CHANNELS[o.channel as keyof typeof CHANNELS] ?? o.channel} · prévue {fmtDate(String(o.follow_up_at))}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Pilotage : trois questions du matin */}
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Link href="/hub/watch?status=new" className="card p-4 transition hover:border-zinc-300">
          <div className="text-[0.72rem] font-medium text-zinc-500">Qui contacter aujourd'hui ?</div>
          <div className="mt-1 font-display text-2xl font-semibold">{watchNew.c + due.length}</div>
          <div className="mt-1 text-xs text-zinc-500">{watchNew.c} opportunité(s) de veille{watchNew.top ? ` (dont ${watchNew.top})` : ""} · {due.length} relance(s) due(s)</div>
        </Link>
        <Link href="/hub/forecast" className="card p-4 transition hover:border-zinc-300">
          <div className="text-[0.72rem] font-medium text-zinc-500">Collaborations raisonnablement atteignables (3 mois)</div>
          <div className="mt-1 font-display text-2xl font-semibold">{fc.bf.months.slice(0, 3).reduce((a, m) => a + m.contracts.central, 0).toFixed(1)}</div>
          <div className="mt-1 text-xs text-zinc-500">fourchette {fc.bf.months.slice(0, 3).reduce((a, m) => a + m.contracts.prudent, 0).toFixed(1)} – {fc.bf.months.slice(0, 3).reduce((a, m) => a + m.contracts.ambitious, 0).toFixed(1)} · confiance {fc.bf.confidence}</div>
        </Link>
        <Link href="/hub/forecast" className="card p-4 transition hover:border-zinc-300">
          <div className="text-[0.72rem] font-medium text-zinc-500">CA prévisionnel pondéré à 6 mois</div>
          <div className="mt-1 font-display text-2xl font-semibold text-accent">{eur0(fc.bf.scenarios.central.weighted6m)}</div>
          <div className="mt-1 text-xs text-zinc-500">prudent {eur0(fc.bf.scenarios.prudent.weighted6m)} · ambitieux {eur0(fc.bf.scenarios.ambitious.weighted6m)} · activité {fc.trend.status}</div>
        </Link>
      </div>
      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card title="Potentiel commercial (prospection) — CA pondéré / mois" action={<Link href="/hub/forecast" className="text-xs text-zinc-500 hover:text-zinc-900">Business Forecast →</Link>}>
          <ScenarioChart labels={fLabels} series={SCENARIOS.map((sc) => ({ label: SCENARIO_LABEL[sc], color: SCENARIO_COLORS[sc], dashed: sc !== "central", values: fc.bf.months.map((m) => m.weighted[sc]) }))} empty="Aucune opportunité ouverte : enregistrez vos démarches pour activer la prévision." />
        </Card>
        <Card title={<span>Valeur de l'audience — potentiel / mois {fc.projection.provisional && <Badge tone="amber">provisoire</Badge>}</span>} action={<Link href="/hub/audience" className="text-xs text-zinc-500 hover:text-zinc-900">Audience Value →</Link>}>
          <ScenarioChart labels={fLabels} series={SCENARIOS.map((sc) => ({ label: SCENARIO_LABEL[sc], color: SCENARIO_COLORS[sc], dashed: sc !== "central", values: fc.projection.rows.map((r) => r.revenue[sc]) }))} empty="Renseignez vos statistiques d'audience (Audience Value) pour estimer leur valeur." />
        </Card>
      </div>

      {/* KPIs prospection */}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Prospection</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Marques identifiées" value={k.brands} delta={d("brands")} hint={`${ds.brands.length} au total`} href="/hub/brands" />
        <Kpi label="Marques qualifiées" value={k.qualified} delta={d("qualified")} />
        <Kpi label="Contacts pros" value={k.contacts} hint="au total" href="/hub/contacts" />
        <Kpi label="Démarches" value={k.outreach} delta={d("outreach")} />
        <Kpi label="Réponses" value={k.responses} delta={d("responses")} hint={k.outreach ? pctLabel(k.responses / k.outreach) : undefined} href="/hub/responses" />
        <Kpi label="Relances à faire" value={k.followUpsDue} tone={k.followUpsDue ? "accent" : "default"} href="/hub/followups" />
        <Kpi label="Réponses positives" value={k.positive} delta={d("positive")} tone="green" />
        <Kpi label="Réponses négatives" value={k.negative} delta={d("negative")} tone="muted" />
        <Kpi label="Rendez-vous" value={k.meetings} delta={d("meetings")} />
        <Kpi label="Collaborations conclues" value={k.collaborations} delta={d("collaborations")} tone="green" />
        <Kpi label="Valeur gifting reçue" value={eur0(k.giftValue)} hint="hors CA" tone="muted" />
        <Kpi label="Dépenses" value={eur0(k.expenses)} tone="muted" />
      </div>

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-400">Argent</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="CA signé" value={eur0(k.signed)} delta={Math.round(d("signed"))} href="/hub/finance" />
        <Kpi label="Facturé (TTC)" value={eur0(k.invoiced)} delta={Math.round(d("invoiced"))} href="/hub/documents" />
        <Kpi label="Encaissé" value={eur0(k.collected)} delta={Math.round(d("collected"))} tone="green" />
        <Kpi label="Reste à encaisser" value={eur0(k.outstanding)} hint="toutes périodes" tone={k.outstanding ? "accent" : "default"} />
      </div>

      {/* Secteurs */}
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card title="Performance par secteur" className="xl:col-span-2" pad={false}>
          {ds.outreach.length === 0 ? <div className="p-4"><Empty title="Aucune démarche enregistrée">Le classement des secteurs apparaîtra dès vos premières démarches.</Empty></div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead><tr><th className="th">Secteur</th><th className="th text-right">Marques</th><th className="th text-right">Contacts</th><th className="th">Démarches</th><th className="th text-right">Taux réponse</th><th className="th text-right">Collabs</th><th className="th">CA signé</th><th className="th text-right">Encaissé</th><th className="th text-right">Moy./presta</th><th className="th text-right">Délai moyen</th></tr></thead>
                <tbody>
                  {[...sectors].sort((a, b) => b.signed - a.signed || (b.responseRate ?? -1) - (a.responseRate ?? -1)).map((s) => (
                    <tr key={s.sector.id}>
                      <td className="td whitespace-nowrap"><span className="inline-flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.sector.color }} />{s.sector.name}</span></td>
                      <td className="td text-right tabular">{s.brands}</td>
                      <td className="td text-right tabular">{s.contacts}</td>
                      <td className="td min-w-36"><Bar value={s.outreach} max={maxSectorOut} color={s.sector.color} label={String(s.outreach)} /></td>
                      <td className="td text-right tabular">{pctLabel(s.responseRate)}{s.outreach > 0 && s.outreach < 5 && <span className="ml-1 text-[0.65rem] text-amber-600" title="Moins de 5 démarches : échantillon insuffisant">*</span>}</td>
                      <td className="td text-right tabular">{s.collaborations}</td>
                      <td className="td min-w-40"><Bar value={s.signed} max={maxSigned} color="#10b981" label={eur0(s.signed)} /></td>
                      <td className="td text-right tabular">{eur0(s.collected)}</td>
                      <td className="td text-right tabular">{s.avgDeal === null ? "—" : eur0(s.avgDeal)}</td>
                      <td className="td text-right tabular">{s.avgDaysToDeal === null ? "—" : `${s.avgDaysToDeal} j`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-2 text-[0.7rem] text-zinc-400">* moins de 5 démarches : taux non significatif. Taux de réponse = démarches ayant reçu une réponse ÷ démarches envoyées.</p>
            </div>
          )}
        </Card>
        <Card title="Où concentrer vos efforts">
          <ul className="space-y-2.5 text-sm text-zinc-700">
            {insights.map((i, n) => <li key={n} className="flex gap-2"><span className="text-accent">→</span><span>{i}</span></li>)}
          </ul>
        </Card>
      </div>

      {/* Meilleurs moments */}
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card title="Meilleurs moments pour démarcher" className="xl:col-span-2">
          {ds.outreach.length === 0 ? <Empty title="Pas encore de données">La heatmap compare les réponses au nombre d'envois de chaque créneau (taux, pas volume brut).</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-separate border-spacing-1">
                <thead><tr><th />{TIME_SLOTS.map((s) => <th key={s.key} className="text-[0.68rem] font-medium text-zinc-500">{s.label}</th>)}<th className="text-[0.68rem] font-medium text-zinc-500">Total</th></tr></thead>
                <tbody>
                  {timing.grid.map((row, i) => (
                    <tr key={i}>
                      <td className="pr-2 text-xs text-zinc-500">{WEEKDAYS[i]}</td>
                      {row.map((c, j) => {
                        const reliable = c.sent >= timing.minSample;
                        const alpha = c.rate === null ? 0 : 0.12 + c.rate * 0.88;
                        return (
                          <td key={j} title={`${c.responded} réponse(s) / ${c.sent} envoi(s)`} className="h-11 rounded-md text-center text-[0.7rem] tabular"
                            style={{ background: c.sent ? `rgba(255,91,60,${reliable ? alpha : alpha * 0.4})` : "#f4f4f5", color: c.rate && c.rate > 0.5 && reliable ? "#fff" : "#3f3f46", outline: reliable ? "none" : undefined }}>
                            {c.sent ? <>{pctLabel(c.rate)}<div className="text-[0.6rem] opacity-70">n={c.sent}</div></> : ""}
                          </td>
                        );
                      })}
                      <td className="text-center text-[0.7rem] tabular text-zinc-600">{timing.byDay[i].sent ? `${pctLabel(timing.byDay[i].rate)} · ${timing.byDay[i].sent}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[0.7rem] text-zinc-400">Heure de Paris. Cases pâles : moins de {timing.minSample} envois, non significatif.</p>
            </div>
          )}
        </Card>
        <Card title="Lecture des données">
          <ul className="space-y-2.5 text-sm text-zinc-700">{timing.recs.map((r, i) => <li key={i} className="flex gap-2"><span className="text-accent">→</span>{r}</li>)}</ul>
          {timing.byChannel.size > 0 && (
            <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3">
              <div className="text-xs font-medium text-zinc-500">Par canal</div>
              {[...timing.byChannel.entries()].map(([ch, c]) => (
                <div key={ch} className="grid grid-cols-[110px_1fr] items-center gap-2 text-xs"><span className="truncate text-zinc-600">{CHANNELS[ch as keyof typeof CHANNELS] ?? ch}</span><Bar value={c.rate ?? 0} max={1} label={`${pctLabel(c.rate)} (${c.sent})`} color="#18181b" /></div>
              ))}
              <div className="pt-2 text-xs font-medium text-zinc-500">Par type d'interlocuteur</div>
              {[...timing.byRole.entries()].map(([r, c]) => (
                <div key={r} className="grid grid-cols-[110px_1fr] items-center gap-2 text-xs"><span className="truncate text-zinc-600" title={r}>{r}</span><Bar value={c.rate ?? 0} max={1} label={`${pctLabel(c.rate)} (${c.sent})`} color="#71717a" /></div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Interlocuteurs */}
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card title="Interlocuteurs RP" className="xl:col-span-2" pad={false} action={<Link href="/hub/contacts" className="text-xs text-zinc-500 hover:text-zinc-900">Analyse complète →</Link>}>
          {contacts.length === 0 ? <div className="p-4"><Empty title="Aucun interlocuteur contacté">Associez vos démarches à un interlocuteur pour mesurer qui répond, vite et positivement.</Empty></div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead><tr><th className="th">Interlocuteur</th><th className="th text-right">Démarches</th><th className="th text-right">Réponses</th><th className="th text-right">Positives</th><th className="th text-right">Délai moy.</th><th className="th">Statut</th></tr></thead>
                <tbody>{contacts.map((c) => (
                  <tr key={c.contact.id}>
                    <td className="td"><Link href={`/hub/brands/${c.contact.brand_id}`} className="font-medium hover:underline">{[c.contact.first_name, c.contact.last_name].filter(Boolean).join(" ") || c.contact.role || c.contact.email}</Link><div className="text-xs text-zinc-500">{c.brandName} · {c.contact.role_type ?? c.contact.role ?? "—"}</div></td>
                    <td className="td text-right tabular">{c.attempts}</td><td className="td text-right tabular">{c.responses}</td><td className="td text-right tabular">{c.positive}</td>
                    <td className="td text-right tabular">{c.avgResponseHours === null ? "—" : c.avgResponseHours < 48 ? `${c.avgResponseHours} h` : `${Math.round(c.avgResponseHours / 24)} j`}</td>
                    <td className="td"><Badge tone={c.badge.startsWith("Relation") || c.badge.startsWith("Répond pos") ? "green" : c.badge.startsWith("Sans réponse") ? "red" : c.badge.startsWith("Répond") ? "blue" : "slate"}>{c.badge}</Badge></td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Rendez-vous à venir">
          {meetings.length === 0 ? <p className="text-sm text-zinc-500">Aucun rendez-vous planifié. Ajoutez-les depuis une fiche marque (Historique → Réunion).</p> : (
            <ul className="divide-y divide-zinc-100">{meetings.map((m, i) => <li key={i} className="py-2 text-sm"><Link className="font-medium hover:underline" href={`/hub/brands/${m.brand_id}`}>{m.name}</Link><div className="text-xs text-zinc-500">{m.title} · {fmtDate(m.occurred_at)}</div></li>)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
