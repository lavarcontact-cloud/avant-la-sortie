import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLoad } from '../lib/hooks.js';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { Empty, ErrorBox, Loading } from '../components/ui.jsx';
import { ago } from '../lib/format.js';

const CAT_COLOR = { drop: 'uv', exclusive: 'uv', event: 'sodium', release: 'sodium', announcement: 'sodium', challenge: 'canal', badge: 'canal', moderation: '' };
const CAT_LABEL = { reminder: 'Rappel', news: 'Actu', drop: 'Labo', release: 'Sortie', event: 'Événement', challenge: 'Défi', exclusive: 'Exclusif', announcement: 'Annonce', badge: 'Badge', moderation: 'Ta création' };

// Boîte de réception in-app : toujours disponible, même sans push.
export function Signaux() {
  const { user, refresh } = useSession();
  const { data, error, loading } = useLoad(user ? '/api/notifications' : null);
  const nav = useNavigate();
  useEffect(() => { if (data?.items?.some((n) => !n.read_at)) api.post('/api/notifications/read-all').then(refresh); }, [data]); // eslint-disable-line
  if (!user) {
    return (
      <div className="page stack">
        <h1 className="display h1">Notifications</h1>
        <p className="lede muted" style={{ margin: 0 }}>Pour être prévenu, il faut un compte (gratuit). Tu choisis ensuite ce que tu reçois, et quand.</p>
        <div className="panel">
          {[
            ['Sorties', 'Un nouveau son ou un clip d\'Ifa est dispo.', 'release'],
            ['Le Labo', 'Un extrait en avant-première ou un vote s\'ouvre.', 'drop'],
            ['Dates confirmées', 'Concert, showcase ou live annoncé par l\'équipe, et rappel 2 h avant si tu le demandes.', 'event'],
            ['Annonces de l\'équipe', 'Les infos importantes, publiées par l\'équipe d\'Ifa.', 'announcement'],
            ['Défis', 'Un nouveau défi est lancé dans la commu.', 'challenge'],
          ].map(([t, d, k]) => (
            <div key={k} className="setting"><div><div style={{ fontWeight: 800 }}>{t}</div><div className="muted" style={{ fontSize: 14 }}>{d}</div></div><span className={`tag ${CAT_COLOR[k] || ''}`}>{CAT_LABEL[k]}</span></div>
          ))}
        </div>
        <div className="panel" style={{ fontSize: 14 }}>
          <b>Où tu les reçois</b>
          <p className="muted" style={{ margin: '6px 0 0' }}>Toujours ici, dans l'appli. En plus, en notification sur ton téléphone si tu l'actives : sur Android direct, sur iPhone après avoir ajouté l'appli à l'écran d'accueil. Pas de notif la nuit (21 h - 8 h pour les moins de 18 ans).</p>
        </div>
        <Link className="btn block" to="/bienvenue">Créer mon compte</Link>
        <Link className="btn ghost block" to="/bienvenue">J'ai déjà un compte</Link>
      </div>
    );
  }
  return (
    <div className="page">
      <div className="row between"><span className="mono">Ta boîte</span><Link to="/moi/signaux" className="btn ghost sm">Réglages</Link></div>
      <h1 className="display h1" style={{ margin: '8px 0 18px' }}>Notifications</h1>
      {loading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data?.items.length === 0 && <Empty title="Rien de neuf" action={<Link className="btn ghost sm" to="/moi/signaux">Choisir mes notifications</Link>}>Tes notifications arriveront ici : sorties, ouvertures du Labo, dates, annonces et tes rappels.</Empty>}
      {data?.items.map((n) => (
        <button key={n.id} className="panel" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 8, borderLeft: n.read_at ? undefined : '3px solid var(--sodium)' }}
          onClick={() => n.url && nav(n.url)}>
          <div className="row between"><span className={`tag ${CAT_COLOR[n.category] || ''}`}>{CAT_LABEL[n.category] || n.category}</span><span className="mono dim">{ago(n.created_at)}</span></div>
          <div style={{ fontWeight: 800, marginTop: 8 }}>{n.title}</div>
          {n.body && <div className="muted" style={{ fontSize: 14 }}>{n.body}</div>}
        </button>
      ))}
    </div>
  );
}
