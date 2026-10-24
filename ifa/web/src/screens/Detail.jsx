// Pages de détail d'une sortie et d'une date : tout ce qu'il faut savoir,
// d'où vient l'info, et un rappel.
import { Link, useParams } from 'react-router-dom';
import { useLoad } from '../lib/hooks.js';
import { Countdown, DemoTag, ErrorBox, Icon, Loading, ReminderButton, shareLink, useToast } from '../components/ui.jsx';
import { dateLong, time, EVENT_KIND, RELEASE_KIND, PLATFORM_LABEL } from '../lib/format.js';

const LISTEN = ['spotify', 'apple_music', 'deezer', 'youtube', 'soundcloud'];

function Back() {
  return <Link to="/" className="mono row" style={{ gap: 4, marginBottom: 14 }}><Icon name="back" size={16} /> Accueil</Link>;
}

export function ReleaseDetail() {
  const { id } = useParams();
  const { data: r, error, loading } = useLoad(`/api/releases/${id}`);
  const toast = useToast();
  if (loading) return <div className="page"><Loading h={420} /></div>;
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  const at = r.release_at || (r.release_date ? `${r.release_date}T00:00:00` : null);
  const out = at && new Date(at) <= new Date();
  // liens du titre s'ils existent, sinon les profils d'Ifa sur les plateformes
  const own = LISTEN.filter((k) => r.links?.[k]);
  const fallback = LISTEN.filter((k) => !r.links?.[k] && r.artist_links?.[k]);
  return (
    <div className="page">
      <Back />
      <div className="drop-hero" style={{ marginBottom: 16 }}>
        <span className="sticker">{r.kind === 'clip' ? 'clip' : RELEASE_KIND[r.kind]?.toLowerCase()}</span>
        {r.cover ? <div className="pic"><img src={r.cover.url} alt={`Pochette de ${r.title}`} /></div>
          : r.artist_photo ? <div className="pic"><img src={r.artist_photo.url} alt="" /></div>
            : <div className="pic" style={{ background: 'linear-gradient(160deg, #1A2350, #3A433C)' }} />}
        <div className="txt">
          <DemoTag on={r.is_demo} />
          <h1>{r.title}</h1>
          {at && <p className="when">{out ? 'Sorti le' : r.kind === 'clip' ? 'Le clip sort le' : 'Sort le'} {dateLong(at)}{r.release_at ? ` à ${time(at)}` : ''}</p>}
          {at && !out && <Countdown to={at} />}
        </div>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {!out && at && <ReminderButton type="release" id={r.id} at={at} reminder={r.reminder} label={r.kind === 'clip' ? 'Me prévenir à la sortie du clip' : 'Me prévenir à la sortie'} />}
        <button className="btn ghost" onClick={() => shareLink(`/sortie/${r.id}`, r.title, toast)}><Icon name="share" size={18} /> Partager</button>
      </div>
      {r.description && <p style={{ marginTop: 16, fontSize: 17 }}>{r.description}</p>}
      <section className="section">
        <h2 className="display h4" style={{ marginBottom: 10 }}>{out ? 'Écouter' : 'Où l\'écouter'}</h2>
        {own.length > 0 && <div className="links">{own.map((k) => <a key={k} className="link-tile" href={r.links[k]} target="_blank" rel="noopener noreferrer">{PLATFORM_LABEL[k]}<Icon name="ext" size={16} /></a>)}</div>}
        {fallback.length > 0 && (
          <>
            {own.length === 0 && <p className="muted" style={{ fontSize: 14 }}>Les liens du titre seront ajoutés à la sortie. En attendant, abonne-toi au profil d'Ifa :</p>}
            <div className="links">{fallback.map((k) => <a key={k} className="link-tile" href={r.artist_links[k]} target="_blank" rel="noopener noreferrer">Ifa sur {PLATFORM_LABEL[k]}<Icon name="ext" size={16} /></a>)}</div>
          </>
        )}
      </section>
      <p className="mono" style={{ marginTop: 20 }}><span className="verified">✓</span> Info confirmée par l'équipe d'Ifa{r.is_demo ? ' (exemple de démonstration)' : ''}</p>
    </div>
  );
}

export function EventDetail() {
  const { id } = useParams();
  const { data: e, error, loading } = useLoad(`/api/events/${id}`);
  const toast = useToast();
  if (loading) return <div className="page"><Loading h={300} /></div>;
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  const past = new Date(e.ends_at || e.starts_at) < new Date();
  return (
    <div className="page">
      <Back />
      <div className="drop-hero plain" style={{ marginBottom: 16 }}>
        <div className="txt">
          <span className="sticker">{EVENT_KIND[e.kind]?.toLowerCase()}</span>
          <DemoTag on={e.is_demo} />
          <h1>{e.title}</h1>
          <p className="when">{dateLong(e.starts_at)} à {time(e.starts_at)}</p>
          {e.status === 'postponed' && <span className="tag sodium" style={{ marginTop: 8 }}>Reporté</span>}
          {e.status === 'cancelled' && <span className="tag brique" style={{ marginTop: 8 }}>Annulé</span>}
          {e.status === 'confirmed' && !past && <Countdown to={e.starts_at} />}
        </div>
      </div>
      <div className="panel stack" style={{ '--s': '8px' }}>
        {(e.venue || e.city) && <div><span className="mono">Lieu</span><div style={{ fontWeight: 700 }}>{[e.venue, e.city].filter(Boolean).join(', ')}</div></div>}
        {e.age_policy && <div><span className="mono">Accès</span><div style={{ fontWeight: 700 }}>{e.age_policy}</div></div>}
        {e.description && <p style={{ margin: 0 }}>{e.description}</p>}
      </div>
      <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
        {e.status === 'confirmed' && !past && <ReminderButton type="event" id={e.id} at={new Date(new Date(e.starts_at) - 2 * 3600e3).toISOString()} reminder={e.reminder} label="Me rappeler 2 h avant" />}
        {e.ticket_url && e.status === 'confirmed' && !past && <a className="btn" href={e.ticket_url} target="_blank" rel="noopener noreferrer">Billets <Icon name="ext" size={16} /></a>}
        <button className="btn ghost" onClick={() => shareLink(`/date/${e.id}`, e.title, toast)}><Icon name="share" size={18} /> Partager</button>
      </div>
      <p className="mono" style={{ marginTop: 20 }}><span className="verified">✓</span> Date {e.status === 'confirmed' ? 'confirmée' : 'mise à jour'} par l'équipe d'Ifa{e.is_demo ? ' (exemple de démonstration)' : ''}</p>
    </div>
  );
}
