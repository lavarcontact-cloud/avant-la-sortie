import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../lib/session.jsx';
import { Icon, Avatar, Sheet } from './ui.jsx';
import { isIOS, isStandalone } from '../lib/push.js';

export const STATIONS = [
  { to: '/', num: '01', label: 'QG', match: (p) => p === '/' || p.startsWith('/qg') },
  { to: '/immersion', num: '02', label: 'Immersion', match: (p) => p.startsWith('/immersion') },
  { to: '/labo', num: '03', label: 'Labo', match: (p) => p.startsWith('/labo') },
  { to: '/cercles', num: '04', label: 'Cercles', match: (p) => p.startsWith('/cercles') || p.startsWith('/u/') },
  { to: '/ifa', num: '05', label: 'Ifa', match: (p) => p.startsWith('/ifa') },
];

export function Dial() {
  const { pathname } = useLocation();
  const idx = STATIONS.findIndex((s) => s.match(pathname));
  return (
    <nav className={`dial ${idx === 2 ? 'uv' : ''}`} aria-label="Navigation principale">
      {idx >= 0 && <span className="dial-needle" style={{ transform: `translateX(${idx * 100}%)` }} />}
      {STATIONS.map((s, i) => (
        <NavLink key={s.to} to={s.to} className={`station ${i === idx ? 'on' : ''}`} aria-current={i === idx ? 'page' : undefined}>
          <span className="num">{s.num}</span>
          <span className="lab">{s.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function TopBar({ transparent = false }) {
  const { user, unread } = useSession();
  return (
    <header className="topbar" style={transparent ? { background: 'linear-gradient(rgba(0,0,0,.6), transparent)' } : undefined}>
      <Link to="/" className="brand" aria-label="Fréquence, accueil">
        <span className="wave" aria-hidden="true"><i /><i /><i /><i /></span>
        <span>
          <span className="brand-word">Fréquence</span><br />
          <span className="freq">75.019 · IFA</span>
        </span>
      </Link>
      <div className="row" style={{ gap: 8 }}>
        <Link to="/signaux" className="icon-btn" aria-label={`Signaux${unread ? `, ${unread} non lus` : ''}`}>
          <Icon name="bell" />
          {unread > 0 && <span className="pip">{unread > 99 ? '99+' : unread}</span>}
        </Link>
        <Link to={user ? '/moi' : '/bienvenue'} className="icon-btn" aria-label={user ? 'Mon espace' : 'Se connecter'}>
          {user ? <Avatar style={user.avatar_style} handle={user.handle} size={30} official={user.is_official} /> : <Icon name="user" />}
        </Link>
      </div>
    </header>
  );
}

// Invitation à installer : Android via beforeinstallprompt, iOS via instructions.
export function InstallPrompt() {
  const [evt, setEvt] = useState(null);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('frq_install_dismissed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    if (isIOS() && !isStandalone()) setTimeout(() => setIos(true), 20000);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const close = () => { setDismissed(true); try { localStorage.setItem('frq_install_dismissed', '1'); } catch { /* stockage indisponible */ } };
  if (dismissed || isStandalone() || (!evt && !ios)) return null;
  return (
    <Sheet open onClose={close} label="Installer Fréquence">
      <div className="stack">
        <span className="mono sodium">Installer</span>
        <h2 className="display h2">Garde Ifa sur ton écran d'accueil</h2>
        {evt ? (
          <>
            <p className="muted">Ouverture instantanée, plein écran, et les signaux d'Ifa en notification si tu les actives.</p>
            <button className="btn block" onClick={async () => { evt.prompt(); await evt.userChoice; close(); }}>Installer l'appli</button>
          </>
        ) : (
          <>
            <p className="muted">Sur iPhone : touche <b>Partager</b> <span aria-hidden="true">⬆︎</span> en bas de Safari, puis <b>« Sur l'écran d'accueil »</b>. C'est aussi ce qui permet de recevoir les notifications (iOS 16.4 ou plus).</p>
            <button className="btn block" onClick={close}>Compris</button>
          </>
        )}
        <button className="btn ghost block" onClick={close}>Plus tard</button>
      </div>
    </Sheet>
  );
}
