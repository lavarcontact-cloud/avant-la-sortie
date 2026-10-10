import { lazy, Suspense, useMemo } from 'react';
import { useApp } from '../state/store';
import { valuate } from '../engine/ledger';
import { exposure, drawdown } from '../engine/risk';
import { debrief } from '../engine/debrief';
import { Avatar } from '../ui/Avatar';
import { eur, pc, qty, sign, dday } from '../ui/fmt';
import { EXERCISES } from '../state/exercises';
import { SNAPSHOT } from '../data/snapshot';
import type { Mood } from '../copilot/copilot';

const LinesChart = lazy(() => import('../ui/Charts').then((m) => ({ default: m.LinesChart })));

export function Cockpit() {
  const { view, mode, setMode, p, advance, startExercise } = useApp();
  const v = valuate(view.ledger, view.marks);
  const ex = exposure(view.ledger, view.marks);
  const dd = drawdown(view.equity.map((e) => e.v).concat(v.equity));
  const top = view.alerts[0];
  const breach = -dd.current > p.limits.maxDrawdownPct || ex.largestWeight > p.limits.maxPositionPct;
  const mood: Mood = view.status.freshness === 'stale' && mode === 'live' ? 'reserve' : breach ? 'alerte' : top && top.severity !== 'info' ? 'attentif' : 'calme';
  const message = mood === 'reserve'
    ? 'Je n\'ai pas de cotation temps réel : j\'affiche le dernier snapshot disponible et je bloque les ordres au marché. Le replay historique reste ouvert.'
    : breach ? 'Le risque dépasse une limite que tu as définie. Regarde le détail avant toute nouvelle opération.'
      : top ? `Configuration à surveiller : ${top.title}.` : 'Rien d\'inhabituel dans les données. Rester en observation est une option.';

  const lines = useMemo(() => {
    const pts = view.equity;
    if (pts.length < 2) return [];
    const b0 = pts.find((x) => x.btc)?.btc;
    const out = [
      { label: 'Net', color: '#eef0f5', points: pts.map((e) => ({ t: e.t, v: e.v })) },
      { label: 'Brut (avant frais)', color: '#7d8496', dashed: true, points: pts.map((e) => ({ t: e.t, v: e.v + e.fees })) },
    ];
    if (b0) out.push({ label: 'BTC acheté-conservé', color: '#7cc4ff', dashed: true, points: pts.filter((e) => e.btc).map((e) => ({ t: e.t, v: view.ledger.initialCapital * e.btc! / b0 })) });
    return out;
  }, [view.equity, view.ledger.initialCapital]);

  const rb = p.replay;
  const exercise = rb ? EXERCISES.find((e) => e.id === rb.exerciseId) : undefined;
  const replayDone = rb ? rb.cursor > rb.endIdx : false;

  return (
    <div className="screen">
      <div className="row between">
        <div className="seg" role="group" aria-label="Mode de simulation">
          <button aria-pressed={mode === 'live'} onClick={() => setMode('live')}>Temps réel</button>
          <button aria-pressed={mode === 'replay'} onClick={() => (rb ? setMode('replay') : startExercise('fev-2026'))}>Replay historique</button>
        </div>
        <span className="chip" title="Le compte réel n'existe pas dans cette version">Compte réel : non connecté</span>
      </div>

      <section className="card" aria-labelledby="cap-title">
        <div className="card-head"><span id="cap-title" className="eyebrow">Capital simulé · {view.ledger.label}</span><span className="chip sim">Argent fictif</span></div>
        <div className="hero-value num" data-testid="equity">{eur(v.equity)}</div>
        <div className="row" style={{ marginTop: 8 }}>
          <span className={`num ${sign(v.netPnl)}`} data-testid="net-pnl">{v.netPnl >= 0 ? '+' : ''}{eur(v.netPnl)} ({pc(v.netReturn, 2)})</span>
          <span className="muted">net de frais, depuis {eur(view.ledger.initialCapital, 0)} de départ</span>
        </div>
        <div className="grid-3" style={{ marginTop: 18 }}>
          <Kpi label="Liquidités disponibles" value={eur(v.availableCash)} />
          <Kpi label="Liquidités bloquées (ordres)" value={eur(v.reservedCash)} />
          <Kpi label="Valeur des positions" value={eur(v.positionsValue)} />
          <Kpi label="Gains/pertes réalisés (bruts)" value={eur(v.realizedGross)} tone={v.realizedGross} />
          <Kpi label="Gains/pertes latents" value={eur(v.unrealized)} tone={v.unrealized} />
          <Kpi label="Frais payés" value={`−${eur(v.feesPaid)}`} hint={`dont spread et glissement estimés : ${eur(view.ledger.implicitCosts)} (déjà inclus dans les prix)`} />
        </div>
        {v.missingMarks.length > 0 && <div className="notice warn" style={{ marginTop: 12 }}>Cours indisponible pour {v.missingMarks.join(', ')} : valeur exclue du total.</div>}
      </section>

      <section className="card row" style={{ alignItems: 'flex-start', gap: 14 }} aria-live="polite">
        <Avatar mood={mood} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">{p.profile.name}</div>
          <div className="bubble" style={{ marginTop: 6 }}>{message}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <a className="btn sm" href="#/vigie">Poser une question</a>
            {top && <a className="btn sm ghost" href="#/radar">Voir le radar</a>}
          </div>
        </div>
      </section>

      {mode === 'replay' && rb && (
        <section className="card" aria-label="Contrôles du replay">
          <div className="card-head"><span className="h2">{exercise?.title}</span><span className="chip sim">Séance {Math.min(rb.cursor, rb.endIdx) - rb.startIdx + 1} / {rb.endIdx - rb.startIdx + 1}</span></div>
          <p className="muted" style={{ margin: '0 0 12px' }}>{exercise?.goal} Nous sommes le <strong className="num">{dday(SNAPSHOT.BTC.candles[Math.min(rb.cursor, SNAPSHOT.BTC.candles.length - 1)].t)}</strong>, à l'ouverture. La suite est cachée.</p>
          <div className="row">
            <button className="btn primary" disabled={replayDone} onClick={() => advance(1)}>Séance suivante</button>
            <button className="btn" disabled={replayDone} onClick={() => advance(5)}>+5 séances</button>
            <a className="btn ghost" href="#/marche">Passer un ordre</a>
            <select className="input" style={{ width: 'auto', fontFamily: 'var(--font)' }} aria-label="Changer d'exercice" value="" onChange={(e) => e.target.value && startExercise(e.target.value)}>
              <option value="">Nouvel exercice…</option>
              {EXERCISES.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
        </section>
      )}

      <div className="grid-2 wide-left">
        <section className="card">
          <div className="card-head"><span className="h2">Évolution du capital</span><span className="hint">net · brut · référence</span></div>
          {lines.length ? <Suspense fallback={<div className="chart sm" />}><LinesChart lines={lines} height={240} label="Courbe de capital simulé, brut, et BTC acheté-conservé" /></Suspense>
            : <p className="muted">La courbe apparaîtra après les premières {mode === 'replay' ? 'séances' : 'minutes de cotation temps réel'}.</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <span className="hint">Repli actuel <span className={`num ${sign(dd.current)}`}>{pc(dd.current)}</span></span>
            <span className="hint">Repli max <span className="num loss">{pc(dd.maxDrawdown)}</span></span>
            <span className="hint">Limite <span className="num">{pc(-p.limits.maxDrawdownPct, 0)}</span></span>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><span className="h2">Exposition</span><span className="hint">concentration {ex.hhi.toFixed(2)}</span></div>
          <div className="bar" aria-hidden="true" style={{ height: 12 }}>
            {ex.byAsset.map((b, i) => <span key={b.asset} style={{ width: `${b.weight * 100}%`, background: i ? 'var(--info)' : 'var(--accent)' }} />)}
            <span style={{ width: `${Math.max(0, ex.cashWeight) * 100}%`, background: 'var(--line-2)' }} />
          </div>
          <table className="table" style={{ marginTop: 10 }}>
            <tbody>
              {ex.byAsset.map((b) => <tr key={b.asset}><td>{b.asset}</td><td className="r num">{eur(b.value)}</td><td className={`r num ${b.weight > p.limits.maxPositionPct ? 'warn' : ''}`}>{(b.weight * 100).toFixed(1)} %</td></tr>)}
              <tr><td>Liquidités</td><td className="r num">{eur(v.cash)}</td><td className="r num">{(ex.cashWeight * 100).toFixed(1)} %</td></tr>
            </tbody>
          </table>
          <p className="hint">Limite par actif : {(p.limits.maxPositionPct * 100).toFixed(0)} %. BTC et ETH sont fortement corrélés : les détenir ensemble diversifie peu.</p>
        </section>
      </div>

      <section className="card">
        <div className="card-head"><span className="h2">Positions</span><span className="hint">valorisées au {mode === 'replay' ? 'cours d\'ouverture de la séance' : 'dernier cours connu'}</span></div>
        {v.lines.length === 0 ? <p className="muted" style={{ margin: 0 }}>Aucune position. Tout le capital simulé est en liquidités.</p> : (
          <div className="scroll-x"><table className="table">
            <thead><tr><th>Actif</th><th className="r">Quantité</th><th className="r">Prix moyen</th><th className="r">Cours</th><th className="r">Latent</th></tr></thead>
            <tbody>{v.lines.map((l) => (
              <tr key={l.asset}><td>{l.asset}</td><td className="r num">{qty(l.qty)}</td><td className="r num">{eur(l.avgPrice)}</td><td className="r num">{eur(l.mark)}</td>
                <td className={`r num ${sign(l.unrealized)}`}>{eur(l.unrealized)} ({pc(l.unrealizedPct)})</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      {(replayDone || view.ledger.fills.length > 0) && <Debrief />}

      <History />
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone?: number; hint?: string }) {
  return <div className="kpi" title={hint}><span className="label">{label}</span><span className={`value ${tone !== undefined ? sign(tone) : ''}`}>{value}</span>{hint && <span className="hint">{hint}</span>}</div>;
}

function Debrief() {
  const { view, p } = useApp();
  const items = debrief(view.ledger, view.marks, p.limits, view.peak);
  return (
    <section className="card" aria-labelledby="deb">
      <div className="card-head"><span id="deb" className="h2">Bilan de la simulation</span><span className="hint">règles explicites, pas d'avis subjectif</span></div>
      <div className="grid">
        {items.map((it, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <span className={`chip ${it.tone === 'positive' ? '' : it.tone === 'negative' ? 'important' : 'info'}`} style={{ color: it.tone === 'positive' ? 'var(--gain)' : undefined }}>{it.tone === 'positive' ? 'Efficace' : it.tone === 'negative' ? 'À corriger' : 'À noter'}</span>
            <div><strong>{it.title}</strong><div className="hint">{it.detail}</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function History() {
  const { view } = useApp();
  const fills = [...view.ledger.fills].reverse().slice(0, 50);
  if (!fills.length) return null;
  return (
    <section className="card">
      <div className="card-head"><span className="h2">Historique des exécutions</span><a className="hint" href="#/pro">Exporter</a></div>
      <div className="scroll-x"><table className="table">
        <thead><tr><th>Horodatage (UTC)</th><th>Sens</th><th>Actif</th><th className="r">Qté</th><th className="r">Prix</th><th className="r">Frais</th><th>Source du prix</th></tr></thead>
        <tbody>{fills.map((f, i) => (
          <tr key={i}><td className="num">{new Date(f.at).toISOString().replace('T', ' ').slice(0, 19)}</td><td className={f.side === 'buy' ? 'gain' : 'loss'}>{f.side === 'buy' ? 'Achat' : 'Vente'}</td><td>{f.asset}</td>
            <td className="r num">{qty(f.qty)}</td><td className="r num">{eur(f.price)}</td><td className="r num">{eur(f.fee)}</td><td className="hint">{f.quoteSource}</td></tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}
