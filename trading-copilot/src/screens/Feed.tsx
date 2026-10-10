import { useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../state/store';
import { detectHistory } from '../engine/radar';
import { run, signals } from '../engine/backtest';
import { LESSONS } from '../copilot/copilot';
import { EXERCISES } from '../state/exercises';
import { debrief } from '../engine/debrief';
import { eur, pc, dday } from '../ui/fmt';

interface Quiz { id: string; q: string; options: string[]; answer: number; why: string; level: 'debutant' | 'confirme' | 'expert' }
const QUIZZES: Quiz[] = [
  { id: 'q-dd', level: 'debutant', q: 'Après une perte de 50 %, quel gain faut-il pour revenir au capital de départ ?', options: ['+50 %', '+75 %', '+100 %'], answer: 2, why: 'Il reste la moitié du capital : il faut le doubler, soit +100 %.' },
  { id: 'q-fee', level: 'debutant', q: 'Avec 0,6 % de frais par exécution, combien coûte un achat suivi d\'une vente ?', options: ['0,6 %', 'Environ 1,2 %', 'Rien si je gagne'], answer: 1, why: 'Les frais s\'appliquent à l\'achat ET à la vente, gagnant ou perdant.' },
  { id: 'q-corr', level: 'confirme', q: 'BTC et ETH ont une corrélation de 0,85. Détenir les deux…', options: ['divise le risque par deux', 'diversifie peu', 'supprime le risque'], answer: 1, why: 'Des actifs très corrélés baissent généralement ensemble.' },
  { id: 'q-var', level: 'expert', q: 'Une VaR historique 95 % à 1 jour de 4 % signifie…', options: ['La perte ne dépassera jamais 4 %', 'Environ 1 séance sur 20 a perdu plus de 4 % dans l\'échantillon', 'Il y a 95 % de chances de gagner'], answer: 1, why: 'C\'est un quantile empirique du passé, pas une borne ni une probabilité de gain.' },
  { id: 'q-stop', level: 'debutant', q: 'Quand faut-il décider de son stop ?', options: ['Avant d\'entrer', 'Quand la perte devient gênante', 'Jamais, il faut être patient'], answer: 0, why: 'Le stop formalise où l\'idée est fausse. Décidé après coup, il cède aux émotions.' },
];

type Card = { id: string; kind: string; glow: string; priority: number; body: ReactNode };

export default function Feed() {
  const { view, p, update, startExercise, mode } = useApp();
  const [shown, setShown] = useState(8);
  const cards = useMemo<Card[]>(() => {
    const out: Card[] = [];
    const lv = p.profile.level;
    // Alertes de risque sur la simulation
    const db = debrief(view.ledger, view.marks, p.limits, view.peak).filter((d) => d.tone === 'negative');
    for (const d of db.slice(0, 2)) out.push({ id: `risk-${d.title}`, kind: 'Alerte de risque', glow: 'var(--loss)', priority: 100, body: <><div className="big">{d.title}</div><p className="muted">{d.detail}</p><a className="btn sm" href="#/cockpit">Voir le bilan</a></> });
    // Mouvements inhabituels (apparition des conditions sur 20 séances)
    for (const a of p.profile.followed) {
      for (const al of detectHistory(a, view.series[a].candles, view.series[a].source, 20).filter((x) => x.kind === 'move' || x.kind === 'breakout' || x.kind === 'vol_regime').slice(-3)) {
        out.push({ id: al.id, kind: 'Mouvement inhabituel', glow: al.severity === 'important' ? 'var(--loss)' : 'var(--warn)', priority: 60 + (al.dataAt / 1e12), body: <><div className="hint num">{dday(al.dataAt)} · {al.source}</div><div className="big">{al.title}</div><p className="muted">{al.explanation}</p><a className="btn sm" href={`#/vigie?q=${encodeURIComponent(`Quels scénarios pour ${a} ?`)}`}>Scénarios possibles</a></> });
      }
    }
    // Résultat d'une stratégie (calcul réel sur le snapshot, net de frais)
    const c = view.series.BTC.candles;
    if (c.length > 120) {
      const bh = run(c, signals('buy_hold', c, {}), view.ledger.execution).metrics;
      const sm = run(c, signals('sma_cross', c, { fast: 10, slow: 30 }), view.ledger.execution).metrics;
      out.push({ id: 'strat-sma', kind: 'Résultat d\'une stratégie', glow: 'var(--info)', priority: 40, body: <>
        <div className="big">Croisement 10/30 j vs achat-conservation sur BTC</div>
        <p className="muted">Du {dday(c[0].t)} au {dday(c[c.length - 1].t)}, net de frais : croisement <strong className="num">{pc(sm.totalReturn)}</strong> (repli max {pc(sm.maxDrawdown)}, {sm.trades} opérations) contre <strong className="num">{pc(bh.totalReturn)}</strong> pour l'achat-conservation (repli max {pc(bh.maxDrawdown)}).</p>
        <p className="hint">Une seule période, un seul jeu de paramètres choisi a posteriori : ce résultat ne prouve rien sur l'avenir.</p>
        <a className="btn sm" href="#/pro">Ouvrir le laboratoire</a></> });
    }
    // Simulations à tester
    for (const ex of EXERCISES.filter((e) => e.level === lv || lv === 'expert').slice(0, 2)) out.push({ id: `ex-${ex.id}`, kind: 'Simulation à tester', glow: 'var(--sim)', priority: 30, body: <><div className="big">{ex.title}</div><p className="muted">{ex.brief}</p><p className="hint">Objectif : {ex.goal}</p><button className="btn sm primary" onClick={() => { startExercise(ex.id); location.hash = '#/cockpit'; }}>Lancer le replay</button></> });
    // Mini-cours et quiz
    const lessons = Object.entries(LESSONS);
    lessons.slice(0, lv === 'debutant' ? 4 : 6).forEach(([k, l], i) => out.push({ id: `lesson-${k}`, kind: i % 2 ? 'Explication d\'un indicateur' : 'Mini-cours', glow: 'var(--accent)', priority: 20 - i, body: <><div className="big">{l.title}</div><p className="muted">{lv === 'expert' && l.expert ? `${l.body} ${l.expert}` : l.body}</p></> }));
    for (const qz of QUIZZES.filter((q) => lv === 'expert' || q.level === lv || q.level === 'debutant')) out.push({ id: qz.id, kind: 'Question pédagogique', glow: 'var(--accent)', priority: 25, body: <QuizCard q={qz} done={p.quiz[qz.id]} onDone={(ok) => update((x) => ({ ...x, quiz: { ...x.quiz, [qz.id]: ok } }))} /> });
    // Débriefing d'opération
    const lastTrade = view.ledger.closedTrades.at(-1);
    if (lastTrade) out.push({ id: `debrief-${lastTrade.closedAt}`, kind: 'Débriefing d\'une opération', glow: lastTrade.netPnl >= 0 ? 'var(--gain)' : 'var(--loss)', priority: 90, body: <><div className="big">{lastTrade.asset} : {lastTrade.netPnl >= 0 ? '+' : ''}{eur(lastTrade.netPnl)} net</div><p className="muted">Entrée moyenne {eur(lastTrade.entryAvg)}, sortie {eur(lastTrade.exitPrice)}, frais {eur(lastTrade.fees)}. {lastTrade.stopPrice ? `Stop prévu à ${eur(lastTrade.stopPrice)}.` : 'Aucun stop n\'avait été défini.'}</p></> });
    out.push({ id: 'news', kind: 'Actualité vérifiée', glow: 'var(--muted)', priority: 1, body: <><div className="big">Pas encore de source d'actualités</div><p className="muted">Aucun flux d'actualités vérifié n'est connecté. Plutôt que d'afficher des titres non sourcés, ce type de carte reste vide.</p></> });
    return out.sort((a, b) => b.priority - a.priority);
  }, [view.series, view.ledger, view.marks, view.peak, p.profile.level, p.profile.followed, p.limits, p.quiz, update, startExercise]);

  return (
    <div className="screen">
      <div>
        <div className="eyebrow">Fil · {mode === 'replay' ? 'contexte du replay' : 'contexte actuel'}</div>
        <h1 className="h1">L'essentiel, puis c'est tout.</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>Trié par importance pour toi, pas pour te faire trader. Le fil a une fin.</p>
      </div>
      <div className="feed">
        {cards.slice(0, shown).map((c) => (
          <article key={c.id} className="card feed-card" style={{ ['--glow' as string]: c.glow }}>
            <div className="kind"><span className="chip">{c.kind}</span></div>
            {c.body}
          </article>
        ))}
      </div>
      {shown < cards.length
        ? <button className="btn" onClick={() => setShown((s) => s + 6)}>Afficher {Math.min(6, cards.length - shown)} cartes de plus</button>
        : <div className="card flat" style={{ textAlign: 'center' }}><div className="h2">Tu es à jour.</div><p className="muted" style={{ margin: '6px 0 0' }}>Rien d'autre d'important pour l'instant. Reviens après la prochaine séance.</p></div>}
    </div>
  );
}

function QuizCard({ q, done, onDone }: { q: Quiz; done?: boolean; onDone: (ok: boolean) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <>
      <div className="big">{q.q}</div>
      <div className="grid" style={{ gap: 8 }}>
        {q.options.map((o, i) => (
          <button key={i} className={`btn quiz-opt ${pick !== null ? (i === q.answer ? 'right' : i === pick ? 'wrong' : '') : ''}`} disabled={pick !== null} onClick={() => { setPick(i); onDone(i === q.answer); }}>{o}</button>
        ))}
      </div>
      {pick !== null && <p className="muted" role="status">{pick === q.answer ? 'Exact. ' : 'Pas tout à fait. '}{q.why}</p>}
      {pick === null && done !== undefined && <p className="hint">Déjà répondu ({done ? 'correct' : 'à revoir'}).</p>}
    </>
  );
}
