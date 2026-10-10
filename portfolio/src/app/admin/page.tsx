import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getBreakdowns, getKpis } from "@/lib/analytics/kpi";
import { formatEuros, stripeConfigured } from "@/lib/payments";

const PERIODS = [7, 30, 90] as const;
const nf = (v: unknown) => Number(v ?? 0).toLocaleString("fr-FR");
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1).replace(".", ",")} %` : "n.d.");

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ j?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.j) as 7) ? Number(sp.j) : 30;
  const [k, b] = await Promise.all([getKpis(days), getBreakdowns(days)]);
  const f = b.funnel ?? {};
  const coverage = k.consentTotal ? k.consentAccepted / k.consentTotal : null;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-display text-3xl">Tableau de bord</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Trafic interne exclu. Mesure d'audience : visiteurs ayant accepté uniquement.</p>
        </div>
        <div role="group" aria-label="Période" className="flex gap-1">
          {PERIODS.map((p) => (
            <Link key={p} href={`/admin?j=${p}`} className="chip" aria-current={p === days ? "page" : undefined}>{p} j</Link>
          ))}
        </div>
      </div>

      {/* Indicateurs clés */}
      <section aria-labelledby="h-kpi">
        <h2 id="h-kpi" className="sr-only">Indicateurs clés</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Visiteurs (consentis)" value={nf(k.visitors)} />
          <Tile label="Sessions (consenties)" value={nf(k.sessions)} />
          <Tile label="Demandes de devis" value={nf(k.quotes)} note="exhaustif, côté serveur" />
          <Tile label="Paiements réussis" value={nf(k.paymentsLive)} note={k.paymentsTest ? `+ ${k.paymentsTest} en mode test` : undefined} />
          <Tile label="Chiffre d'affaires encaissé" value={formatEuros(k.revenueLiveCents)} note={k.revenueTestCents ? `test : ${formatEuros(k.revenueTestCents)} (non réel)` : "remboursements déduits"} />
          <Tile label="Paiements commencés" value={nf(k.checkouts)} />
          <Tile label="Taux devis / session" value={pct(k.quotes, k.sessions)} note="majoré : sessions non consenties absentes" />
          <Tile label="Taux d'acceptation de la mesure" value={coverage === null ? "n.d." : pct(k.consentAccepted, k.consentTotal)} note={`${nf(k.consentTotal)} choix enregistrés`} />
        </div>
        {!stripeConfigured() && <p className="mt-3 text-sm text-[var(--color-warn)]">Stripe n'est pas configuré : aucun paiement en ligne possible pour l'instant.</p>}
      </section>

      {/* Entonnoir */}
      <section aria-labelledby="h-funnel">
        <h2 id="h-funnel" className="t-eyebrow mb-3">Entonnoir de conversion · {days} jours</h2>
        <Bars
          rows={[
            { k: "Sessions (consenties)", v: Number(f.sessions ?? 0) },
            { k: "Formulaire de devis ouvert", v: Number(f.quote_started ?? 0) },
            { k: "Devis envoyés", v: Number(f.quote_sent ?? 0) },
            { k: "Paiements commencés", v: Number(f.checkout ?? 0) },
            { k: "Paiements réussis", v: Number(f.paid ?? 0) },
          ]}
        />
        <p className="mt-2 text-xs text-[var(--color-muted)]">Les deux premières étapes ne comptent que les visiteurs consentants ; les trois suivantes sont exhaustives. Les taux entre ces deux groupes sont donc indicatifs.</p>
      </section>

      {/* Évolution */}
      <section aria-labelledby="h-daily">
        <h2 id="h-daily" className="t-eyebrow mb-3">Sessions par jour</h2>
        <Columns data={(b.daily as { day: string; sessions: unknown }[]).map((d) => ({ k: d.day, v: Number(d.sessions) }))} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Table title="Pages les plus vues" rows={b.topPages} />
        <Table title="Projets ouverts" rows={b.topProjects} />
        <Table title="Clics sur les bulles d'artistes" rows={b.bubbles} />
        <Table title="Clics sur les appels à l'action" rows={b.ctas} />
        <Table title="Sources de trafic (sessions)" rows={b.sources} />
        <Table title="Liens externes" rows={b.outbound} />
      </div>

      <section aria-labelledby="h-video">
        <h2 id="h-video" className="t-eyebrow mb-3">Vidéos : lectures et complétion</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)]" tabIndex={0} role="region" aria-label="Vidéos">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--color-muted)]"><tr><th className="p-3">Projet</th><th className="p-3 text-right">Lectures</th><th className="p-3 text-right">Vues à 50 %</th><th className="p-3 text-right">Complétées</th><th className="p-3 text-right">Complétion</th></tr></thead>
            <tbody>
              {(b.videos as { k: string; starts: unknown; half: unknown; completes: unknown }[]).map((r) => (
                <tr key={r.k} className="border-t border-[var(--color-line)]">
                  <td className="p-3">{r.k}</td><td className="p-3 text-right">{nf(r.starts)}</td><td className="p-3 text-right">{nf(r.half)}</td><td className="p-3 text-right">{nf(r.completes)}</td>
                  <td className="p-3 text-right">{pct(Number(r.completes), Number(r.starts))}</td>
                </tr>
              ))}
              {!b.videos.length && <tr><td colSpan={5} className="p-4 text-center text-[var(--color-muted)]">Aucune lecture sur la période.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted)]">Les extraits tournent en boucle : "complétée" = fin de lecture atteinte au moins une fois (vidéos non bouclées) ; pour les boucles, se fier à la vue à 50 %.</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="t-eyebrow mb-3">Performances réelles (p75)</h2>
          <ul className="grid grid-cols-2 gap-2">
            {(b.vitals as { k: string; p75: unknown; n: unknown }[]).map((v) => (
              <li key={v.k} className="rounded-xl border border-[var(--color-line)] p-3">
                <p className="text-xs text-[var(--color-muted)]">{v.k} · {nf(v.n)} mesures</p>
                <p className="t-display text-xl">{v.k === "CLS" ? (Number(v.p75) / 1000).toFixed(3) : `${Math.round(Number(v.p75))} ms`}</p>
              </li>
            ))}
            {!b.vitals.length && <li className="text-sm text-[var(--color-muted)]">Pas encore de mesure.</li>}
          </ul>
        </section>
        <Table title="Erreurs JavaScript" rows={b.errors} empty="Aucune erreur remontée." />
      </div>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="t-display mt-1 text-2xl sm:text-3xl">{value}</p>
      {note && <p className="mt-1 text-[11px] text-[var(--color-muted)]">{note}</p>}
    </div>
  );
}

/** Barres horizontales, une seule série : pas de légende, valeur en bout de barre. */
function Bars({ rows }: { rows: { k: string; v: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.k} className="grid grid-cols-[minmax(120px,220px)_1fr] items-center gap-3 text-sm" title={`${r.k} : ${nf(r.v)}`}>
          <span className="text-[var(--color-muted)]">{r.k}</span>
          <span className="flex items-center gap-2">
            <span className="h-[18px] rounded-r-[4px] bg-[var(--color-accent)]" style={{ width: `${Math.max(0.5, (r.v / max) * 100)}%` }} />
            <span className="t-mono text-xs">{nf(r.v)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Colonnes par jour, une série, info-bulle au survol, tableau équivalent pour lecteurs d'écran. */
function Columns({ data }: { data: { k: string; v: number }[] }) {
  if (!data.length) return <p className="text-sm text-[var(--color-muted)]">Pas encore de données sur la période.</p>;
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <figure>
      <div className="flex h-40 items-end gap-[2px] border-b border-[var(--color-line)]" aria-hidden>
        {data.map((d) => (
          <div key={d.k} className="group relative flex h-full flex-1 items-end justify-center">
            <div className="w-full max-w-[24px] rounded-t-[4px] bg-[var(--color-accent)] transition-opacity group-hover:opacity-80" style={{ height: `${(d.v / max) * 100}%`, minHeight: d.v ? 2 : 0 }} />
            <span className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-md bg-[var(--color-fg)] px-2 py-1 text-xs text-[var(--color-ink)] group-hover:block">
              {new Date(d.k).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : {nf(d.v)}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-[11px] text-[var(--color-muted)]"><span>{data[0].k}</span><span>max {nf(max)}</span><span>{data[data.length - 1].k}</span></figcaption>
      <table className="sr-only"><caption>Sessions par jour</caption><tbody>{data.map((d) => <tr key={d.k}><th>{d.k}</th><td>{d.v}</td></tr>)}</tbody></table>
    </figure>
  );
}

function Table({ title, rows, empty = "Pas encore de données." }: { title: string; rows: Record<string, unknown>[]; empty?: string }) {
  return (
    <section>
      <h2 className="t-eyebrow mb-3">{title}</h2>
      {rows.length ? (
        <ol className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] text-sm">
          {rows.map((r, i) => (
            <li key={String(r.k) + i} className="flex justify-between gap-4 p-3">
              <span className="truncate">{String(r.k ?? "(inconnu)")}</span>
              <span className="t-mono">{nf(r.v)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">{empty}</p>
      )}
    </section>
  );
}
