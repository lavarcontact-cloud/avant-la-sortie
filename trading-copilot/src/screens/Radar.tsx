import { useState } from 'react';
import { useApp } from '../state/store';
import type { AssetId } from '../engine/types';
import { RULES } from '../engine/radar';
import { eur, dt } from '../ui/fmt';

const SEV_LABEL = { important: 'Important', attention: 'À surveiller', info: 'Information' } as const;

export default function Radar() {
  const { view, p, update } = useApp();
  const alerts = view.alerts.filter((a) => !p.dismissed.includes(a.id));
  const hidden = view.alerts.length - alerts.length;
  return (
    <div className="screen">
      <div>
        <div className="eyebrow">Radar de marché</div>
        <h1 className="h1">Ce qui sort de l'ordinaire</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>Détecteurs déterministes sur les séances clôturées de {view.series.BTC.source}. Chaque alerte indique la règle appliquée et les valeurs mesurées. Pas d'urgence artificielle : une condition qui persiste n'est signalée qu'une fois.</p>
      </div>
      {alerts.length === 0 && <div className="card muted">Aucun signal au-dessus des seuils documentés. C'est une information en soi : le marché se comporte dans sa norme récente.</div>}
      <div className="grid" aria-live="polite">
        {alerts.map((a) => (
          <article key={a.id} className="card" aria-label={a.title}>
            <div className="card-head">
              <div className="row"><span className={`chip ${a.severity}`}>{SEV_LABEL[a.severity]}</span><span className="chip">{a.asset === 'PORTFOLIO' ? 'Portefeuille' : a.asset}</span></div>
              <span className="hint num">donnée du {dt(a.dataAt)}</span>
            </div>
            <h2 className="h2">{a.title}</h2>
            <p style={{ color: 'var(--text-2)', margin: '6px 0 10px' }}>{a.explanation}</p>
            <details>
              <summary className="hint" style={{ cursor: 'pointer' }}>Règle et mesures</summary>
              <p className="hint num" style={{ margin: '6px 0' }}>Règle : {a.rule}</p>
              <p className="hint num" style={{ margin: 0 }}>{Object.entries(a.metrics).map(([k, v]) => `${k} = ${Number.isInteger(v) ? v : v.toFixed(4)}`).join(' · ')}</p>
              <p className="hint" style={{ margin: '6px 0 0' }}>Source : {a.source}</p>
            </details>
            <div className="row" style={{ marginTop: 10 }}>
              <a className="btn sm" href={`#/vigie?q=${encodeURIComponent(a.asset === 'PORTFOLIO' ? 'Quels risques pour mon portefeuille ?' : `Pourquoi ${a.asset} bouge ?`)}`}>Demander à {p.profile.name}</a>
              <button className="btn sm ghost" onClick={() => update((x) => ({ ...x, dismissed: [...x.dismissed, a.id].slice(-500) }))}>Masquer</button>
            </div>
          </article>
        ))}
      </div>
      {hidden > 0 && <button className="btn sm ghost" onClick={() => update((x) => ({ ...x, dismissed: [] }))}>Réafficher {hidden} alerte(s) masquée(s)</button>}
      <Scenarios />
      <section className="card flat">
        <div className="h2" style={{ marginBottom: 8 }}>Seuils utilisés</div>
        <p className="hint num" style={{ margin: 0 }}>
          Mouvement |z| ≥ {RULES.moveZ} (30 j) · Volume ≥ {RULES.volumeRatio}× médiane 20 j · Volatilité 7 j/90 j ≥ {RULES.volRegimeHigh} ou ≤ {RULES.volRegimeLow} · Canal {RULES.donchianN} j · Repli ≥ {RULES.drawdownFrom90dHigh * 100} % du plus haut 90 j · Amplitude ≥ {RULES.rangeRatio}× · Corrélation ≥ {RULES.corrHigh} · Spread ≥ {RULES.spreadBps} pb.
          Non couverts dans cette version : actualités, données on-chain, carnet d'ordres (aucune source vérifiée connectée).
        </p>
      </section>
    </div>
  );
}

function Scenarios() {
  const { p, addScenario, removeScenario, view } = useApp();
  const [asset, setAsset] = useState<AssetId>('BTC');
  const [bias, setBias] = useState<'haussier' | 'baissier'>('haussier');
  const [label, setLabel] = useState('');
  const [level, setLevel] = useState('');
  const last = view.series[asset].candles.at(-1)?.c;
  const lvl = Number(level.replace(',', '.'));
  const valid = label.trim().length > 0 && lvl > 0;
  return (
    <section className="card" aria-labelledby="sc">
      <div className="card-head"><span id="sc" className="h2">Mes scénarios surveillés</span><span className="hint">alerte quand une clôture invalide l'hypothèse</span></div>
      {p.scenarios.length > 0 && (
        <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
          {p.scenarios.map((s) => {
            const invalid = view.alerts.some((a) => a.id === `scenario-${s.id}`);
            return <li key={s.id} style={{ marginBottom: 6 }}><strong>{s.asset}</strong> {s.bias} « {s.label} » — invalidé si clôture {s.bias === 'haussier' ? '<' : '>'} {eur(s.invalidation, 0)} {invalid ? <span className="chip important">invalidé</span> : <span className="chip">valide</span>} <button className="btn sm ghost" onClick={() => removeScenario(s.id)}>Retirer</button></li>;
          })}
        </ul>
      )}
      <div className="grid-2">
        <div className="field"><label htmlFor="sc-label">Hypothèse</label><input id="sc-label" className="input" style={{ fontFamily: 'var(--font)' }} maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Reprise après le creux de septembre" /></div>
        <div className="field"><label htmlFor="sc-level">Niveau d'invalidation (€)</label><input id="sc-level" className="input" inputMode="decimal" value={level} onChange={(e) => setLevel(e.target.value)} placeholder={last ? String(Math.round(last * 0.95)) : ''} /></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <div className="seg" role="group" aria-label="Actif">{(['BTC', 'ETH'] as AssetId[]).map((a) => <button key={a} aria-pressed={asset === a} onClick={() => setAsset(a)}>{a}</button>)}</div>
        <div className="seg" role="group" aria-label="Biais">{(['haussier', 'baissier'] as const).map((b) => <button key={b} aria-pressed={bias === b} onClick={() => setBias(b)}>{b}</button>)}</div>
        <button className="btn primary" disabled={!valid} onClick={() => { addScenario({ asset, bias, label: label.trim(), invalidation: lvl }); setLabel(''); setLevel(''); }}>Surveiller</button>
      </div>
    </section>
  );
}
