import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { STRATEGIES, type ProtocolResult, type StrategyId, type Metrics } from '../engine/backtest';
import type { AssetId } from '../engine/types';
import { positionSize, gapRisk, shock, historicalVaR } from '../engine/risk';
import { valuate } from '../engine/ledger';
import { simpleReturns } from '../engine/indicators';
import { LinesChart } from '../ui/Charts';
import { eur, pc, qty, dday } from '../ui/fmt';
import { SNAPSHOT } from '../data/snapshot';

interface Res { proto: ProtocolResult; curves: { times: number[]; strategy: number[]; benchmark: number[] }; ms: number }

export default function Pro() {
  return (
    <div className="screen">
      <div><div className="eyebrow">Espace professionnel</div><h1 className="h1">Laboratoire</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>Backtests avec protocole chronologique, outils de risque et exports. Un indicateur technique n'est pas une preuve de rentabilité.</p></div>
      <Backtest />
      <div className="grid-2"><SizeTool /><StressTool /></div>
      <Export />
    </div>
  );
}

function Backtest() {
  const { p } = useApp();
  const [asset, setAsset] = useState<AssetId>('BTC');
  const [strategy, setStrategy] = useState<StrategyId>('sma_cross');
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const reqId = useRef(0);
  useEffect(() => {
    const w = new Worker(new URL('../workers/backtest.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => { if (e.data.id !== reqId.current) return; setBusy(false); if (e.data.ok) { setRes(e.data); setErr(null); } else setErr(e.data.error); };
    worker.current = w;
    return () => w.terminate();
  }, []);
  // Le backtest utilise toujours le snapshot complet et figé : résultats reproductibles.
  const candles = SNAPSHOT[asset].candles;
  const launch = () => { setBusy(true); reqId.current++; worker.current?.postMessage({ id: reqId.current, candles, strategy, execution: p.execution }); };

  const lines = useMemo(() => res ? [
    { label: 'Stratégie', color: '#d6ff3d', points: res.curves.times.map((t, i) => ({ t, v: res.curves.strategy[i] })) },
    { label: 'Achat-conservation', color: '#7cc4ff', dashed: true, points: res.curves.times.map((t, i) => ({ t, v: res.curves.benchmark[i] })) },
  ] : [], [res]);

  return (
    <section className="card" aria-labelledby="bt">
      <div className="card-head"><span id="bt" className="h2">Backtest</span><span className="hint">données : {SNAPSHOT[asset].source}, {candles.length} séances, {dday(candles[0].t)} → {dday(candles[candles.length - 1].t)}</span></div>
      <div className="row">
        <div className="seg" role="group" aria-label="Actif">{(['BTC', 'ETH'] as AssetId[]).map((a) => <button key={a} aria-pressed={asset === a} onClick={() => setAsset(a)}>{a}</button>)}</div>
        <div className="seg" role="group" aria-label="Stratégie">{(['sma_cross', 'donchian'] as StrategyId[]).map((s) => <button key={s} aria-pressed={strategy === s} onClick={() => setStrategy(s)}>{STRATEGIES[s].name}</button>)}</div>
        <button className="btn primary" onClick={launch} disabled={busy}>{busy ? 'Calcul…' : 'Lancer le protocole'}</button>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>{STRATEGIES[strategy].description} Signal à la clôture, exécution à l'ouverture suivante. Coûts : frais {(p.execution.feeRate * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} %, demi-spread {p.execution.spreadBps / 2} pb, glissement {p.execution.slippageBps} pb, participation max 1 % du volume. Découpage 60 / 20 / 20 % (entraînement / validation / test).</p>
      {err && <div className="notice err">{err}</div>}
      {res && (
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="scroll-x"><table className="table">
            <thead><tr><th>Période</th><th className="r">Stratégie</th><th className="r">Achat-conserv.</th><th className="r">Repli max</th><th className="r">Vol. ann.</th><th className="r">Sharpe*</th><th className="r">Opérations</th><th className="r">Réussite</th><th className="r">Gain/perte moy.</th><th className="r">Exposition</th></tr></thead>
            <tbody>{res.proto.segments.map((s) => <SegRow key={s.name} s={s} />)}</tbody>
          </table></div>
          <p className="hint">Paramètres retenus sur l'entraînement : <span className="num">{JSON.stringify(res.proto.chosen)}</span> · calcul {res.ms.toFixed(0)} ms dans un Web Worker · *Sharpe avec taux sans risque nul.</p>
          <div><div className="eyebrow" style={{ marginBottom: 6 }}>Période de test (jamais vue lors du choix des paramètres)</div><LinesChart lines={lines} height={220} label="Capital de la stratégie et de l'achat-conservation sur la période de test" /></div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Sensibilité aux paramètres (Sharpe sur l'entraînement)</div>
            <div className="heat" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {res.proto.grid.map((g, i) => {
                const v = Number.isFinite(g.trainSharpe) ? g.trainSharpe : 0;
                const col = v >= 0 ? `color-mix(in srgb, var(--gain) ${Math.min(60, v * 30)}%, var(--bg-2))` : `color-mix(in srgb, var(--loss) ${Math.min(60, -v * 30)}%, var(--bg-2))`;
                return <div key={i} style={{ background: col }} title={`rendement ${pc(g.trainReturn)}`}>{Object.values(g.params).join('/')}<br />{Number.isFinite(g.trainSharpe) ? g.trainSharpe.toFixed(2) : 'n/a'}</div>;
              })}
            </div>
            <p className="hint">Si seuls quelques réglages isolés fonctionnent, le résultat tient probablement du hasard.</p>
          </div>
          <div className="notice warn"><ul style={{ margin: 0, paddingLeft: 18 }}>{res.proto.warnings.map((w) => <li key={w}>{w}</li>)}<li>Les performances passées ne préjugent pas des performances futures.</li></ul></div>
        </div>
      )}
    </section>
  );
}

const f = (m: Metrics, k: keyof Metrics, kind: 'pc' | 'u' | 'n' | 'x' = 'pc') => {
  const v = m[k];
  if (!Number.isFinite(v)) return 'n/a';
  return kind === 'pc' ? pc(v) : kind === 'u' ? pc(v).replace('+', '') : kind === 'x' ? v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
};
function SegRow({ s }: { s: ProtocolResult['segments'][number] }) {
  const name = { train: 'Entraînement', validation: 'Validation', test: 'Test' }[s.name];
  return <tr><td>{name}<div className="hint num">{dday(s.from)} → {dday(s.to)}</div></td>
    <td className={`r num ${s.strategy.totalReturn >= 0 ? 'gain' : 'loss'}`}>{f(s.strategy, 'totalReturn')}</td>
    <td className="r num">{f(s.benchmark, 'totalReturn')}</td><td className="r num">{f(s.strategy, 'maxDrawdown')}</td><td className="r num">{f(s.strategy, 'volAnn', 'u')}</td>
    <td className="r num">{f(s.strategy, 'sharpe', 'x')}</td><td className="r num">{f(s.strategy, 'trades', 'n')}</td><td className="r num">{f(s.strategy, 'winRate', 'u')}</td><td className="r num">{f(s.strategy, 'payoff', 'x')}</td><td className="r num">{f(s.strategy, 'exposure', 'u')}</td></tr>;
}

function SizeTool() {
  const { view, p } = useApp();
  const v = valuate(view.ledger, view.marks);
  const last = view.marks.BTC ?? 0;
  const [entry, setEntry] = useState(String(Math.round(last)));
  const [stop, setStop] = useState(String(Math.round(last * 0.95)));
  const [risk, setRisk] = useState(String(p.limits.maxRiskPerTradePct * 100));
  const e = Number(entry), s = Number(stop), r = Number(risk) / 100;
  const ps = positionSize({ equity: v.equity, riskPct: r, entry: e, stop: s, feeRate: view.ledger.execution.feeRate });
  return (
    <section className="card"><div className="card-head"><span className="h2">Taille de position</span><span className="hint">BTC · capital {eur(v.equity, 0)}</span></div>
      <div className="grid-3">
        <div className="field"><label htmlFor="pe">Entrée</label><input id="pe" className="input" value={entry} onChange={(x) => setEntry(x.target.value)} /></div>
        <div className="field"><label htmlFor="ps">Stop</label><input id="ps" className="input" value={stop} onChange={(x) => setStop(x.target.value)} /></div>
        <div className="field"><label htmlFor="pr">Risque %</label><input id="pr" className="input" value={risk} onChange={(x) => setRisk(x.target.value)} /></div>
      </div>
      {ps.qty > 0 ? <p style={{ marginBottom: 0 }}><strong className="num">{qty(ps.qty)} BTC</strong> ({eur(ps.notional ?? 0)}, {pc((ps.notional ?? 0) / v.equity).replace('+', '')} du capital). Perte au stop ≈ {eur(ps.riskAmount ?? 0)}, frais inclus. Avec un gap de 5 % sous le stop : {eur(gapRisk(ps.qty, e, s, 0.05, view.ledger.execution.feeRate))}.</p>
        : <p className="warn" style={{ marginBottom: 0 }}>{ps.reason}</p>}
      <p className="hint">Formule : quantité = capital × risque ÷ [(entrée − stop) + frais × (entrée + stop)].</p>
    </section>
  );
}

function StressTool() {
  const { view } = useApp();
  const [pct, setPct] = useState(-10);
  const r = shock(view.ledger, view.marks, { BTC: pct / 100, ETH: pct / 100 });
  const vr = historicalVaR(simpleReturns(view.series.BTC.candles.map((c) => c.c)), 0.95);
  return (
    <section className="card"><div className="card-head"><span className="h2">Scénario défavorable</span><span className="hint">choc instantané BTC et ETH</span></div>
      <label className="field"><span className="lbl">Variation : <span className="num">{pct} %</span></span><input type="range" min={-60} max={30} value={pct} onChange={(e) => setPct(Number(e.target.value))} /></label>
      <p>Capital simulé : {eur(r.equityBefore)} → <strong className={`num ${r.delta < 0 ? 'loss' : 'gain'}`}>{eur(r.equityAfter)}</strong> ({pc(r.deltaPct, 2)}).</p>
      <p className="hint" style={{ marginBottom: 0 }}>{vr.insufficient ? 'Historique insuffisant pour la VaR.' : `VaR historique 95 % à 1 jour sur BTC : ${pc(-vr.var)} (n = ${vr.n} séances). Ce n'est pas une perte maximale.`}</p>
    </section>
  );
}

function Export() {
  const { view, p } = useApp();
  const dl = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const csv = () => {
    const rows = [['horodatage_utc', 'sens', 'actif', 'quantite', 'prix', 'prix_reference', 'frais_eur', 'cout_implicite_eur', 'source_prix']];
    for (const f of view.ledger.fills) rows.push([new Date(f.at).toISOString(), f.side, f.asset, String(f.qty), String(f.price), String(f.refPrice), String(f.fee), String(f.implicitCost), f.quoteSource]);
    dl('vigie-executions.csv', rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  };
  const json = () => dl('vigie-journal.json', JSON.stringify({ exportedAt: new Date().toISOString(), note: 'Journal de SIMULATION. Rejouer les événements reconstruit l\'état à l\'identique.', limits: p.limits, events: view.events }, null, 2), 'application/json');
  return (
    <section className="card"><div className="card-head"><span className="h2">Exports</span><span className="hint">{view.ledger.fills.length} exécution(s) · {view.events.length} événement(s)</span></div>
      <div className="row"><button className="btn" onClick={csv} disabled={!view.ledger.fills.length}>Exécutions (CSV)</button><button className="btn" onClick={json}>Journal complet (JSON, auditable)</button></div>
    </section>
  );
}
