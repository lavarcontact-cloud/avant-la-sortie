import { useState } from 'react';
import { useApp } from '../state/store';
import { Avatar } from '../ui/Avatar';
import type { Level } from '../copilot/copilot';
import type { Accent } from '../state/persist';

const LEVELS: { id: Level; label: string; desc: string }[] = [
  { id: 'debutant', label: 'Je découvre', desc: 'Explications pas à pas, notions définies.' },
  { id: 'confirme', label: 'J\'ai déjà investi', desc: 'Moins de définitions, plus de chiffres.' },
  { id: 'expert', label: 'Je trade régulièrement', desc: 'Réponses denses, formules et limites statistiques.' },
];

export function Onboarding() {
  const { update } = useApp();
  const [level, setLevel] = useState<Level>('debutant');
  const [accent, setAccent] = useState<Accent>('volt');
  const [memory, setMemory] = useState(false);
  const [ack, setAck] = useState(false);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ob-title" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(4,5,8,.86)', backdropFilter: 'blur(10px)', display: 'flex', padding: 16, overflowY: 'auto' }}>
      <div className="card" data-accent={accent} style={{ maxWidth: 560, width: '100%', display: 'grid', gap: 18, margin: 'auto' }}>
        <div className="row"><Avatar size={56} /><div><div className="eyebrow">Bienvenue</div><h1 id="ob-title" className="h1" style={{ fontSize: 28 }}>Je suis Vigie.</h1></div></div>
        <p style={{ margin: 0, color: 'var(--text-2)' }}>
          Je t'aide à comprendre les marchés crypto, à t'entraîner avec de l'argent <strong>fictif</strong> et à mesurer ton risque. Je montre toujours d'où viennent mes chiffres. Je ne prédis pas les cours et je ne te dirai pas quoi acheter.
        </p>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          <legend className="eyebrow" style={{ marginBottom: 8 }}>Ton niveau</legend>
          {LEVELS.map((l) => (
            <button key={l.id} type="button" className="btn" aria-pressed={level === l.id} onClick={() => setLevel(l.id)} style={{ justifyContent: 'flex-start', textAlign: 'left', borderColor: level === l.id ? 'var(--accent)' : undefined }}>
              <span><strong>{l.label}</strong><br /><span className="hint">{l.desc}</span></span>
            </button>
          ))}
        </fieldset>
        <div className="field"><span className="lbl">Couleur de Vigie</span>
          <div className="seg" role="group" aria-label="Couleur">
            {(['volt', 'ice', 'ember'] as Accent[]).map((a) => <button key={a} type="button" aria-pressed={accent === a} onClick={() => { setAccent(a); document.documentElement.dataset.accent = a; }}>{{ volt: 'Volt', ice: 'Glacier', ember: 'Braise' }[a]}</button>)}
          </div>
        </div>
        <label className="row" style={{ alignItems: 'flex-start', gap: 10, flexWrap: 'nowrap' }}>
          <input type="checkbox" checked={memory} onChange={(e) => setMemory(e.target.checked)} style={{ marginTop: 4 }} />
          <span><strong>Mémoriser mes préférences et ma simulation sur cet appareil.</strong><br /><span className="hint">Stockage local du navigateur uniquement, rien n'est envoyé à un serveur. Sans ton accord, tout est effacé à la fermeture de l'onglet. Modifiable dans Réglages.</span></span>
        </label>
        <label className="row" style={{ alignItems: 'flex-start', gap: 10, flexWrap: 'nowrap' }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 4 }} />
          <span>Je comprends que cette application est un outil <strong>éducatif de simulation</strong> : aucun argent réel, aucun conseil personnalisé, et les crypto-actifs peuvent perdre toute leur valeur.</span>
        </label>
        <button className="btn primary" disabled={!ack} onClick={() => update((p) => ({ ...p, profile: { ...p.profile, level, accent, memoryConsent: memory, onboarded: true } }))}>Commencer</button>
      </div>
    </div>
  );
}
