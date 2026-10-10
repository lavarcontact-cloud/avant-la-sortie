import { useState } from 'react';
import { useApp } from '../state/store';
import type { Level } from '../copilot/copilot';
import type { Accent } from '../state/persist';

export default function Settings() {
  const { p, update, resetLive, wipeAll, market } = useApp();
  const [capital, setCapital] = useState('10000');
  const [confirmWipe, setConfirmWipe] = useState(false);
  const setLimit = (k: keyof typeof p.limits, v: number | boolean) => update((x) => ({ ...x, limits: { ...x.limits, [k]: v } }));
  const setEx = (k: keyof typeof p.execution, v: number) => update((x) => ({ ...x, execution: { ...x.execution, [k]: v } }));
  const pctField = (id: string, label: string, val: number, on: (v: number) => void, max = 100, step = 0.5) => (
    <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" type="number" min={0} max={max} step={step} value={+(val * 100).toFixed(3)} onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= max) on(v / 100); }} /></div>
  );
  return (
    <div className="screen">
      <div><div className="eyebrow">Réglages</div><h1 className="h1">Ton cadre</h1></div>
      <section className="card grid">
        <div className="h2">Profil et copilote</div>
        <div className="grid-2">
          <div className="field"><label htmlFor="nm">Nom du copilote</label><input id="nm" className="input" style={{ fontFamily: 'var(--font)' }} maxLength={20} value={p.profile.name} onChange={(e) => update((x) => ({ ...x, profile: { ...x.profile, name: e.target.value.replace(/[<>]/g, '') || 'Vigie' } }))} /></div>
          <div className="field"><span className="lbl">Niveau des explications</span><div className="seg" role="group">{(['debutant', 'confirme', 'expert'] as Level[]).map((l) => <button key={l} aria-pressed={p.profile.level === l} onClick={() => update((x) => ({ ...x, profile: { ...x.profile, level: l } }))}>{{ debutant: 'Débutant', confirme: 'Confirmé', expert: 'Expert' }[l]}</button>)}</div></div>
          <div className="field"><span className="lbl">Couleur</span><div className="seg" role="group">{(['volt', 'ice', 'ember'] as Accent[]).map((a) => <button key={a} aria-pressed={p.profile.accent === a} onClick={() => update((x) => ({ ...x, profile: { ...x.profile, accent: a } }))}>{{ volt: 'Volt', ice: 'Glacier', ember: 'Braise' }[a]}</button>)}</div></div>
          <label className="row"><input type="checkbox" checked={p.profile.memoryConsent} onChange={(e) => update((x) => ({ ...x, profile: { ...x.profile, memoryConsent: e.target.checked } }))} />Mémoriser préférences et simulation sur cet appareil</label>
        </div>
      </section>
      <section className="card grid">
        <div className="h2">Limites de risque</div>
        <p className="hint" style={{ margin: 0 }}>Vigie te prévient quand une opération simulée les dépasse. Tu restes libre de maintenir l'ordre après confirmation.</p>
        <div className="grid-3">
          {pctField('l1', 'Poids max par actif (%)', p.limits.maxPositionPct, (v) => setLimit('maxPositionPct', v))}
          {pctField('l2', 'Risque max par opération (%)', p.limits.maxRiskPerTradePct, (v) => setLimit('maxRiskPerTradePct', v), 20, 0.1)}
          {pctField('l3', 'Repli max toléré (%)', p.limits.maxDrawdownPct, (v) => setLimit('maxDrawdownPct', v))}
        </div>
        <label className="row"><input type="checkbox" checked={p.limits.requireStop} onChange={(e) => setLimit('requireStop', e.target.checked)} />Signaler les achats sans stop</label>
      </section>
      <section className="card grid">
        <div className="h2">Hypothèses d'exécution</div>
        <p className="hint" style={{ margin: 0 }}>Paramètres de simulation, pas les tarifs vérifiés d'une plateforme. Ils s'appliquent aux nouvelles simulations et au backtest.</p>
        <div className="grid-3">
          {pctField('e1', 'Frais par exécution (%)', p.execution.feeRate, (v) => setEx('feeRate', v), 10, 0.01)}
          <div className="field"><label htmlFor="e2">Spread supposé (pb)</label><input id="e2" className="input" type="number" min={0} max={1000} value={p.execution.spreadBps} onChange={(e) => setEx('spreadBps', Math.max(0, Math.min(1000, Number(e.target.value))))} /></div>
          <div className="field"><label htmlFor="e3">Glissement (pb)</label><input id="e3" className="input" type="number" min={0} max={1000} value={p.execution.slippageBps} onChange={(e) => setEx('slippageBps', Math.max(0, Math.min(1000, Number(e.target.value))))} /></div>
        </div>
      </section>
      <section className="card grid">
        <div className="h2">Recommencer</div>
        <div className="row"><div className="field" style={{ width: 180 }}><label htmlFor="cap">Capital virtuel (€)</label><input id="cap" className="input" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} /></div>
          <button className="btn" style={{ alignSelf: 'end' }} disabled={!(Number(capital) >= 100 && Number(capital) <= 10_000_000)} onClick={() => resetLive(Number(capital))}>Nouvelle simulation temps réel</button></div>
        <div className="row">{!confirmWipe ? <button className="btn ghost" onClick={() => setConfirmWipe(true)}>Effacer toutes mes données locales</button>
          : <><span className="warn">Effacement définitif de la simulation et des préférences ?</span><button className="btn sell" onClick={wipeAll}>Confirmer</button><button className="btn ghost" onClick={() => setConfirmWipe(false)}>Annuler</button></>}</div>
      </section>
      <section className="card flat grid">
        <div className="h2">Données et confidentialité</div>
        <ul className="hint" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Marché : API publique Coinbase Exchange (sans clé, sans compte). État du flux : {market.feed}{market.feedDetail ? ` — ${market.feedDetail}` : ''}.</li>
          {market.loadErrors.length > 0 && <li>Échecs de chargement : {market.loadErrors.join(' ; ')}. Repli sur le snapshot réel horodaté.</li>}
          <li>Aucun compte, aucun identifiant d'exchange, aucune clé privée ou seed phrase ne te sera jamais demandé.</li>
          <li>Ta simulation reste dans ton navigateur. La reformulation IA (si activée par l'hébergeur) n'envoie que la question et l'analyse calculée, sans identifiant.</li>
        </ul>
      </section>
    </div>
  );
}
