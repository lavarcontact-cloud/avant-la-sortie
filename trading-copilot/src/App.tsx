import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AppProvider, useApp } from './state/store';
import { Icon } from './ui/icons';
import { ago, dt } from './ui/fmt';
import { Onboarding } from './screens/Onboarding';
import { Cockpit } from './screens/Cockpit';

const Market = lazy(() => import('./screens/Market'));
const Radar = lazy(() => import('./screens/Radar'));
const Feed = lazy(() => import('./screens/Feed'));
const Copilot = lazy(() => import('./screens/Copilot'));
const Pro = lazy(() => import('./screens/Pro'));
const Goal = lazy(() => import('./screens/Goal'));
const Settings = lazy(() => import('./screens/Settings'));

const ROUTES: { id: string; label: string; icon: () => ReactNode; desk?: boolean }[] = [
  { id: 'cockpit', label: 'Cockpit', icon: Icon.cockpit },
  { id: 'marche', label: 'Marché', icon: Icon.market },
  { id: 'fil', label: 'Fil', icon: Icon.feed },
  { id: 'radar', label: 'Radar', icon: Icon.radar },
  { id: 'vigie', label: 'Vigie', icon: Icon.copilot },
  { id: 'pro', label: 'Espace pro', icon: Icon.pro, desk: true },
  { id: 'objectif', label: 'Objectif', icon: Icon.goal, desk: true },
  { id: 'reglages', label: 'Réglages', icon: Icon.settings, desk: true },
];

function useRoute() {
  const get = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'cockpit');
  const [r, setR] = useState(get);
  useEffect(() => {
    const on = () => { setR(get()); window.scrollTo({ top: 0 }); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function DataStatusPill() {
  const { view, now, mode, market } = useApp();
  const s = view.status;
  if (mode === 'replay') return <span className="status-pill" title="Données historiques réelles rejouées séance par séance"><span className="led replay" />Replay · {new Date(s.at).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</span>;
  const label = s.kind === 'live' && s.freshness !== 'stale' ? `Temps réel · ${ago(s.at, now)}` : s.kind === 'live' ? `Flux interrompu · ${ago(s.at, now)}` : `Snapshot · ${new Date(s.at).toLocaleDateString('fr-FR')}`;
  const title = `Source : ${s.source}\nDonnée du ${dt(s.at)}\nFlux WebSocket : ${market.feed}${market.feedDetail ? ` (${market.feedDetail})` : ''}`;
  return <span className="status-pill" title={title} aria-label={title}><span className={`led ${s.freshness}`} />{label}</span>;
}

function Shell() {
  const route = useRoute();
  const { p, view, mode, notice } = useApp();
  const important = view.alerts.filter((a) => a.severity !== 'info').length;
  useEffect(() => { document.documentElement.dataset.accent = p.profile.accent; }, [p.profile.accent]);
  const Screen = { cockpit: Cockpit, marche: Market, radar: Radar, fil: Feed, vigie: Copilot, pro: Pro, objectif: Goal, reglages: Settings }[route] ?? Cockpit;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">◆</span><span className="brand-name">{p.profile.name}</span></div>
        <div className="spacer" />
        <span className="mode-banner" role="status" title="Aucun argent réel n'est engagé dans cette application"><span className="dot" />Simulation{mode === 'replay' ? ' · replay' : ''}</span>
        <DataStatusPill />
      </header>
      <nav className="nav" aria-label="Navigation principale">
        {ROUTES.map((r) => (
          <a key={r.id} href={`#/${r.id}`} aria-current={route === r.id ? 'page' : undefined} className={r.desk ? 'desk-only' : undefined}>
            {r.icon()}<span>{r.label}</span>
            {r.id === 'radar' && important > 0 && <span className="badge" aria-label={`${important} alertes`}>{important}</span>}
          </a>
        ))}
      </nav>
      <main className="main" id="main">
        {notice && <div className="notice warn" style={{ marginTop: 16 }}>{notice}</div>}
        <Suspense fallback={<div className="screen"><div className="card muted">Chargement…</div></div>}>
          <Screen />
        </Suspense>
        <footer className="legal" style={{ marginTop: 32 }}>
          Application éducative de simulation. Aucun ordre réel n'est transmis, aucun actif n'est conservé. Les contenus ne constituent ni un conseil en investissement ni une recommandation personnalisée.
          Les performances passées ou simulées ne préjugent pas des performances futures. Les crypto-actifs peuvent perdre tout ou partie de leur valeur.
        </footer>
      </main>
      {!p.profile.onboarded && <Onboarding />}
    </div>
  );
}

export default function App() {
  return <AppProvider><Shell /></AppProvider>;
}
