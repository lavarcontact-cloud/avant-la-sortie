import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { analyzeGoal } from '../engine/goal';
import { SNAPSHOT } from '../data/snapshot';
import { eur, pc, dday } from '../ui/fmt';
import { Avatar } from '../ui/Avatar';

export default function Goal() {
  const { p } = useApp();
  const [capital, setCapital] = useState('1000');
  const [target, setTarget] = useState('100000');
  const [days, setDays] = useState('90');
  const [trades, setTrades] = useState('20');
  const c = Number(capital), t = Number(target), d = Math.round(Number(days)), n = Number(trades);
  const valid = c > 0 && t > 0 && d >= 7 && d <= 365 && n >= 0 && n <= 1000;
  const g = useMemo(() => valid ? analyzeGoal({ capital: c, target: t, days: d, feeRate: p.execution.feeRate, tradesPerMonth: n }, SNAPSHOT.BTC.candles) : null, [valid, c, t, d, n, p.execution.feeRate]);
  const mood = g?.verdict === 'hors_historique' ? 'alerte' : g?.verdict === 'exceptionnel' ? 'attentif' : 'calme';
  const h = g?.history;
  const scen = h ? [{ n: 'Défavorable (10e centile)', r: h.p10 }, { n: 'Médian', r: h.p50 }, { n: 'Favorable (90e centile)', r: h.p90 }] : [];
  return (
    <div className="screen">
      <div><div className="eyebrow">Calculateur d'objectif</div><h1 className="h1">Que faudrait-il vraiment ?</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>Un objectif n'est pas une promesse. Ce calcul confronte l'objectif aux rendements réellement observés sur BTC ({dday(SNAPSHOT.BTC.candles[0].t)} → {dday(SNAPSHOT.BTC.candles.at(-1)!.t)}).</p></div>
      <section className="card">
        <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="field"><label htmlFor="gc">Capital de départ (€)</label><input id="gc" className="input" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} /></div>
          <div className="field"><label htmlFor="gt">Objectif (€)</label><input id="gt" className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div className="field"><label htmlFor="gd">Durée (jours)</label><input id="gd" className="input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
          <div className="field"><label htmlFor="gn">Transactions / mois</label><input id="gn" className="input" inputMode="numeric" value={trades} onChange={(e) => setTrades(e.target.value)} /></div>
        </div>
        {!valid && <p className="warn">Durée entre 7 et 365 jours, montants positifs.</p>}
      </section>
      {g && (
        <>
          <section className="card row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <Avatar mood={mood} size={52} />
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow">Verdict</div>
              <div className="h2" style={{ fontSize: 22, margin: '4px 0 8px' }}>{{ atteignable_historiquement: 'Déjà observé sans levier', exceptionnel: 'Exceptionnel : il fallait acheter au meilleur moment', hors_historique: 'Hors de tout ce qui a été observé', donnees_insuffisantes: 'Données insuffisantes' }[g.verdict]}</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)' }}>{g.explanation.map((x) => <li key={x} style={{ marginBottom: 4 }}>{x}</li>)}</ul>
            </div>
          </section>
          <div className="grid-3">
            <div className="card kpi"><span className="label">Gain nécessaire</span><span className="value">{pc(g.requiredReturn, 0)}</span></div>
            <div className="card kpi"><span className="label">Par mois (composé)</span><span className="value">{pc(g.requiredMonthly, 1)}</span></div>
            <div className="card kpi"><span className="label">Frais sur la période</span><span className="value loss">−{pc(g.feeDragPct, 1).replace('+', '')}</span></div>
          </div>
          {h && (
            <section className="card">
              <div className="card-head"><span className="h2">Si l'avenir ressemblait à la période observée</span><span className="hint">{h.windows} fenêtres glissantes, {h.independentWindows} indépendantes</span></div>
              <table className="table"><thead><tr><th>Scénario historique (BTC, sans levier, avant frais)</th><th className="r">Rendement</th><th className="r">Capital final</th></tr></thead>
                <tbody>{scen.map((s) => <tr key={s.n}><td>{s.n}</td><td className={`r num ${s.r >= 0 ? 'gain' : 'loss'}`}>{pc(s.r)}</td><td className="r num">{eur(c * (1 + s.r))}</td></tr>)}
                  <tr><td>Objectif</td><td className="r num">{pc(g.requiredReturn, 0)}</td><td className="r num">{eur(t)}</td></tr></tbody></table>
              {g.leverage && g.verdict !== 'atteignable_historiquement' && <p className="notice err" style={{ marginTop: 12 }}>Levier nécessaire même au meilleur moment : ×{g.leverage.needed.toFixed(1)}. Une baisse de {pc(-g.leverage.liquidationMove, 2)} suffirait alors à perdre tout le capital ; la pire baisse observée en cours de fenêtre a été de {pc(g.leverage.worstAdverseInWindows)}.</p>}
              <p className="hint">Fréquences passées sur un échantillon court et chevauchant : ce ne sont pas des probabilités. Un seul actif, une seule année de données.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
