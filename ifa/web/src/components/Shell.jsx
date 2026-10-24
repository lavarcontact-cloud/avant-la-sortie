import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../lib/session.jsx';
import { Icon, Avatar, Sheet } from './ui.jsx';
import { isIOS, isStandalone } from '../lib/push.js';

// Barre d'onglets classique en bas (le code que tout le monde connaît), avec
// le bouton de création au centre.
const TABS = [
  { to: '/', label: 'Accueil', icon: 'home', match: (p) => p === '/' || p.startsWith('/qg') || p.startsWith('/ifa') },
  { to: '/immersion', label: 'Clips', icon: 'clips', match: (p) => p.startsWith('/immersion') },
  { to: '/cercles/publier', create: true },
  { to: '/cercles', label: 'Commu', icon: 'users', match: (p) => p.startsWith('/cercles') && !p.startsWith('/cercles/publier') || p.startsWith('/u/') },
  { to: '/labo', label: 'Labo', icon: 'flask', match: (p) => p.startsWith('/labo') },
];

export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((t) => (t.create ? (
        <NavLink key="create" to={t.to} className="tab-create" aria-label="Publier une création"><Icon name="plus" /></NavLink>
      ) : (
        <NavLink key={t.to} to={t.to} className={`tab ${t.match(pathname) ? 'on' : ''}`} aria-current={t.match(pathname) ? 'page' : undefined}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </NavLink>
      )))}
    </nav>
  );
}

export function TopBar({ over = false }) {
  const { user, unread } = useSession();
  return (
    <header className={`topbar ${over ? 'over' : ''}`}>
      <Link to="/" className="brand" aria-label="Accueil">
        <span>
          <span className="brand-word">ifa<i>.</i></span>
          <span className="brand-sub">l'appli officielle</span>
        </span>
      </Link>
      <div className="row" style={{ gap: 8 }}>
        <Link to="/signaux" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} non lues` : ''}`}>
          <Icon name="bell" />
          {unread > 0 && <span className="pip">{unread > 99 ? '99+' : unread}</span>}
        </Link>
        <Link to={user ? '/moi' : '/bienvenue'} className="icon-btn" aria-label={user ? 'Mon profil' : 'Se connecter'}>
          {user ? <Avatar style={user.avatar_style} handle={user.handle} size={34} official={user.is_official} /> : <Icon name="user" />}
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
    <Sheet open onClose={close} label="Installer l'appli">
      <div className="stack">
        <span className="sticker">à installer</span>
        <h2 className="display h2">Garde Ifa sur ton écran d'accueil</h2>
        {evt ? (
          <>
            <p className="muted">Ça s'ouvre direct, en plein écran, et tu reçois les notifs de sortie si tu les actives.</p>
            <button className="btn block" onClick={async () => { evt.prompt(); await evt.userChoice; close(); }}>Installer</button>
          </>
        ) : (
          <>
            <p className="muted">Sur iPhone : touche <b>Partager</b> en bas de Safari, puis <b>« Sur l'écran d'accueil »</b>. C'est aussi ce qui débloque les notifs (iOS 16.4 ou plus).</p>
            <button className="btn block" onClick={close}>Compris</button>
          </>
        )}
        <button className="btn ghost block" onClick={close}>Plus tard</button>
      </div>
    </Sheet>
  );
}
