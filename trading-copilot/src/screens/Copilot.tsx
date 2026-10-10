import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { answer, type Answer, type CopilotContext } from '../copilot/copilot';
import { Avatar, MOOD_LABEL } from '../ui/Avatar';
import { dt } from '../ui/fmt';

interface Msg { role: 'user' | 'vigie'; text?: string; a?: Answer; llm?: { text?: string; note?: string; loading?: boolean } }

const STARTERS = [
  'Pourquoi Bitcoin bouge aujourd\'hui ?',
  'Quels événements peuvent affecter ETH ?',
  'Quels scénarios pour BTC ?',
  'Qu\'est-ce qui invaliderait un scénario haussier sur BTC ?',
  'Quel serait l\'impact d\'une baisse de 5 % sur ma position ?',
  'Quels frais dois-je payer ?',
  'Pourquoi cette opération pourrait être trop risquée pour mon capital ?',
  'Quelles notions dois-je apprendre avant de commencer ?',
];

export default function Copilot() {
  const app = useApp();
  const { view, p } = app;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [llmOn, setLlmOn] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/copilot').then((r) => (r.ok ? r.json() : null)).then((j) => setLlmOn(Boolean(j?.llm))).catch(() => setLlmOn(false));
  }, []);

  const ctx = (): CopilotContext => ({
    now: app.now, level: p.profile.level, series: view.series, quotes: view.quotes, status: view.status, ledger: view.ledger,
    marks: view.marks, limits: p.limits, peakEquity: view.peak, alerts: view.alerts, newsSource: null,
  });

  const ask = (q: string) => {
    const text = q.trim().slice(0, 500);
    if (!text) return;
    const a = answer(text, ctx());
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'vigie', a }]);
    setInput('');
  };

  useEffect(() => {
    const q = new URLSearchParams(location.hash.split('?')[1] ?? '').get('q');
    if (q) { ask(q); history.replaceState(null, '', '#/vigie'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);

  const rephrase = async (i: number) => {
    const m = msgs[i], q = msgs[i - 1]?.text ?? '';
    if (!m.a) return;
    setMsgs((all) => all.map((x, k) => (k === i ? { ...x, llm: { loading: true } } : x)));
    let llm: Msg['llm'];
    try {
      const r = await fetch('/api/copilot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q, level: p.profile.level, answer: m.a }) });
      const j = await r.json();
      llm = j.text ? { text: j.text } : { note: j.reason === 'nombres_non_sources' ? 'Reformulation rejetée : elle contenait des chiffres absents de l\'analyse. Seule la version vérifiée est affichée.' : (j.error ?? 'Reformulation indisponible.') };
    } catch { llm = { note: 'Reformulation indisponible (réseau).' }; }
    setMsgs((all) => all.map((x, k) => (k === i ? { ...x, llm } : x)));
  };

  const mood = msgs.filter((m) => m.a).at(-1)?.a?.mood ?? 'calme';
  return (
    <div className="screen">
      <div className="row" style={{ gap: 14 }}>
        <Avatar mood={mood} size={60} />
        <div>
          <div className="eyebrow">Copilote · {MOOD_LABEL[mood]}</div>
          <h1 className="h1" style={{ fontSize: 30 }}>{p.profile.name}</h1>
          <div className="hint">Réponses calculées à partir des données affichées ({view.status.source}, {dt(view.status.at)}). Pas de prédiction, pas d'ordre personnalisé.</div>
        </div>
      </div>

      <div className="chat" aria-live="polite">
        {msgs.length === 0 && (
          <div className="card">
            <div className="h2" style={{ marginBottom: 10 }}>Pose ta question</div>
            <div className="suggest">{STARTERS.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => m.role === 'user'
          ? <div key={i} className="msg-user">{m.text}</div>
          : <AnswerCard key={i} a={m.a!} llm={m.llm} llmAvailable={llmOn === true} onRephrase={() => rephrase(i)} onAsk={ask} />)}
        <div ref={endRef} />
      </div>

      <form className="card row" style={{ position: 'sticky', bottom: 'calc(var(--nav-h) + 8px)', padding: 10, flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <label htmlFor="ask" className="sr-only">Question</label>
        <input id="ask" className="input" style={{ fontFamily: 'var(--font)' }} maxLength={500} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ex. : quel impact d'une baisse de 10 % sur ETH ?" autoComplete="off" />
        <button className="btn primary" type="submit" disabled={!input.trim()}>Envoyer</button>
      </form>
    </div>
  );
}

function Sec({ cls, title, items }: { cls: string; title: string; items: string[] }) {
  if (!items.length) return null;
  return <div className={`sec ${cls}`}><div className="sec-title">{title}</div><ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul></div>;
}

function AnswerCard({ a, llm, llmAvailable, onRephrase, onAsk }: { a: Answer; llm?: Msg['llm']; llmAvailable: boolean; onRephrase: () => void; onAsk: (q: string) => void }) {
  return (
    <article className="card answer">
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Avatar mood={a.mood} size={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>{a.title}</h3>
          {a.abstained && <span className="chip attention" style={{ marginBottom: 6 }}>Abstention : donnée essentielle manquante</span>}
          <p style={{ margin: 0 }}>{a.summary}</p>
          <Sec cls="facts" title="1 · Faits observés" items={a.facts} />
          {a.data.length > 0 && (
            <div className="sec data"><div className="sec-title">2 · Données et indicateurs</div>
              <table className="table"><tbody>{a.data.map((d, i) => <tr key={i}><td>{d.label}</td><td className="r num">{d.value}</td><td className="hint">{d.source}</td></tr>)}</tbody></table>
            </div>
          )}
          <Sec cls="hyp" title="3 · Hypothèses" items={a.hypotheses} />
          {a.scenarios.length > 0 && (
            <div className="sec scen"><div className="sec-title">4 · Scénarios alternatifs</div>
              <ul>{a.scenarios.map((s, i) => <li key={i}><strong>{s.name}</strong> — si {s.condition.charAt(0).toLowerCase() + s.condition.slice(1)} : {s.implication}</li>)}</ul>
            </div>
          )}
          <Sec cls="risk" title="5 · Risques et invalidation" items={a.risks} />
          <Sec cls="unc" title="6 · Incertitude et limites" items={a.uncertainty} />
          <div className="hint" style={{ marginTop: 10 }}>7 · Données à jour au {dt(a.updatedAt)}</div>
          {llm?.text && <div className="bubble" style={{ marginTop: 12 }}><div className="eyebrow">Reformulation IA (chiffres vérifiés)</div>{llm.text}</div>}
          {llm?.note && <div className="notice warn" style={{ marginTop: 12 }}>{llm.note}</div>}
          <div className="row" style={{ marginTop: 12 }}>
            {a.followUps.map((f) => <button key={f} className="btn sm ghost" onClick={() => onAsk(f)}>{f}</button>)}
            <button className="btn sm" disabled={!llmAvailable || llm?.loading} onClick={onRephrase} title={llmAvailable ? 'Reformulation par un modèle de langage, contrôlée chiffre par chiffre' : 'Indisponible : aucune clé API configurée sur le serveur'}>
              {llm?.loading ? 'Reformulation…' : llmAvailable ? 'Reformuler (IA)' : 'Reformulation IA indisponible'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
