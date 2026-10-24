import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLoad } from '../lib/hooks.js';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { Empty, ErrorBox, Loading } from '../components/ui.jsx';
import { ago } from '../lib/format.js';

const CAT_COLOR = { drop: 'uv', exclusive: 'uv', event: 'sodium', release: 'sodium', announcement: 'sodium', challenge: 'canal', badge: 'canal', moderation: '' };
const CAT_LABEL = { news: 'Actu', drop: 'Labo', release: 'Sortie', event: 'Événement', challenge: 'Défi', exclusive: 'Exclusif', announcement: 'Annonce', badge: 'Badge', moderation: 'Ta création' };

// Boîte de réception in-app : toujours disponible, même sans push.
export function Signaux() {
  const { user, refresh } = useSession();
  const { data, error, loading } = useLoad(user ? '/api/notifications' : null);
  const nav = useNavigate();
  useEffect(() => { if (data?.items?.some((n) => !n.read_at)) api.post('/api/notifications/read-all').then(refresh); }, [data]); // eslint-disable-line
  if (!user) return <div className="page"><Empty title="Les signaux d'Ifa" action={<Link className="btn" to="/bienvenue">Créer mon compte</Link>}>Avec un compte, tu reçois ici les sorties, les ouvertures du Labo et les dates confirmées.</Empty></div>;
  return (
    <div className="page">
      <div className="row between"><span className="mono sodium">Boîte de réception</span><Link to="/moi/signaux" className="mono muted">Réglages →</Link></div>
      <h1 className="display h1" style={{ margin: '8px 0 18px' }}>Signaux</h1>
      {loading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data?.items.length === 0 && <Empty title="Aucun signal">Rien de neuf pour l'instant. Choisis ce que tu veux recevoir dans les réglages.</Empty>}
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
