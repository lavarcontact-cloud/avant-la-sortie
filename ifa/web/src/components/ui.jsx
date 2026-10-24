import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { ago, KIND_LABEL, PLATFORM_LABEL, countdown, pad, youtubeId } from '../lib/format.js';
import { useTick } from '../lib/hooks.js';

// ---------------------------------------------------------------- icônes
const P = {
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  save: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  play: 'M7 4v16l13-8z',
  pause: 'M7 4h4v16H7zM14 4h4v16h-4z',
  x: 'M18 6 6 18M6 6l12 12',
  back: 'M15 18l-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  ext: 'M7 17 17 7M8 7h9v9',
  sound: 'M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  mute: 'M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6',
  dots: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  cal: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  check: 'M20 6 9 17l-5-5',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  clips: 'M4 4h16v16H4zM10 8.5v7l6-3.5z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  flask: 'M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 14h9',
};
export function Icon({ name, size = 20, fill = false, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}

// ---------------------------------------------------------------- toasts
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const show = (m) => { setMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(null), 3200); };
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------------------------------------------------------- petits éléments
export function Avatar({ style, handle, size = 36, official = false }) {
  const { config } = useSession() || {};
  const [color, glyph] = String(style || 'craie:◉').split(':');
  const photo = official ? config?.artist_photo?.url : null;
  return (
    <span className={`avatar ${official ? 'av-official' : `av-${color}`}`} style={{ width: size, height: size, fontSize: size * (official ? 0.36 : 0.45) }} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : official ? 'ifa' : glyph || handle?.[0]}
    </span>
  );
}
export const DemoTag = ({ on }) => (on ? <span className="tag demo" title="Contenu d'exemple, pas une information réelle">Exemple</span> : null);

export function SourceLine({ source, date }) {
  const label = source.type === 'app' ? 'Publié dans Fréquence' : source.type === 'integration' ? `Importé de ${PLATFORM_LABEL[source.platform] || 'une plateforme'}` : `Repris de ${PLATFORM_LABEL[source.platform] || 'l\'extérieur'}`;
  return (
    <span className="source">
      {date && <span>{ago(date)}</span>}
      <span aria-hidden="true">·</span>
      {source.url
        ? <a href={source.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{label} ↗</a>
        : <span>{label}</span>}
    </span>
  );
}

export function KindTag({ kind, official = true }) {
  return (
    <span className={`tag ${kind === 'announcement' ? 'sodium' : ''}`}>
      {official && <span className="verified" style={{ width: 12, height: 12, fontSize: 8 }}>✓</span>}
      {KIND_LABEL[kind] || kind}
    </span>
  );
}

export const Empty = ({ title, children, action }) => (
  <div className="empty">
    <div className="display h4">{title}</div>
    <div>{children}</div>
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);
export const Loading = ({ h = 220 }) => <div className="skeleton" style={{ height: h }} aria-label="Chargement" />;
export const ErrorBox = ({ error, retry }) => (
  <div className="empty">
    <div className="err">{error?.message || 'Erreur'}</div>
    {retry && <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={retry}>Réessayer</button>}
  </div>
);

export function Countdown({ to, compact = false }) {
  useTick(1000);
  const c = countdown(to);
  if (compact) return <span className="mono">{c.d > 0 ? `${c.d}j ` : ''}{pad(c.h)}:{pad(c.m)}:{pad(c.s)}</span>;
  return (
    <div className="count" aria-label="Compte à rebours">
      <div><b>{pad(c.d)}</b><span>jours</span></div>
      <div><b>{pad(c.h)}</b><span>heures</span></div>
      <div><b>{pad(c.m)}</b><span>min</span></div>
      <div><b>{pad(c.s)}</b><span>sec</span></div>
    </div>
  );
}

export function Sheet({ open, onClose, children, label }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-back" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- médias
export function MediaView({ media, sourceUrl, autoPlay = false, controls = true, wide = false, poster }) {
  const yt = youtubeId(sourceUrl);
  if (media?.kind === 'image') return <img src={media.url} alt="" loading="lazy" />;
  if (media?.kind === 'video') {
    return <video src={media.url} poster={poster} playsInline muted={autoPlay} autoPlay={autoPlay} loop={autoPlay} controls={controls} preload="metadata" />;
  }
  if (yt) {
    return <iframe src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1&playsinline=1`} title="Vidéo YouTube" loading="lazy"
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen style={{ aspectRatio: wide ? '16/9' : undefined }} />;
  }
  return null;
}

// ---------------------------------------------------------------- garde de connexion
export function useRequireAccount() {
  const { user } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  return (action = 'participer') => {
    if (!user) { nav('/bienvenue', { state: { from: window.location.pathname } }); return false; }
    if (user.status === 'pending_parent') { toast(`Il faut l'accord d'un parent pour ${action}. On lui a envoyé un e-mail.`); return false; }
    return true;
  };
}

// ---------------------------------------------------------------- réactions
export function Reactions({ type, item, onComment, compact = false }) {
  const [state, setState] = useState({ liked: item.liked, likes: item.likes, saved: item.saved });
  const need = useRequireAccount();
  const toast = useToast();
  useEffect(() => setState({ liked: item.liked, likes: item.likes, saved: item.saved }), [item.id]); // eslint-disable-line
  const react = async (kind) => {
    if (!need('réagir')) return;
    const on = kind === 'like' ? !state.liked : !state.saved;
    setState((s) => kind === 'like' ? { ...s, liked: on, likes: s.likes + (on ? 1 : -1) } : { ...s, saved: on });
    try {
      const r = await api.post('/api/react', { target_type: type, target_id: item.id, kind, on });
      if (kind === 'like') setState((s) => ({ ...s, likes: r.count }));
      else toast(on ? 'Gardé dans tes favoris' : 'Retiré des favoris');
    } catch (e) { toast(e.message); }
  };
  const share = () => shareLink(type === 'post' ? `/qg/${item.id}` : `/cercles/creation/${item.id}`, item.title || item.caption, toast);
  return (
    <div className="actions" onClick={(e) => e.preventDefault()}>
      <button className={`act ${state.liked ? 'on' : ''}`} onClick={() => react('like')} aria-pressed={state.liked} aria-label="J'aime">
        <Icon name="heart" fill={state.liked} />{state.likes > 0 && state.likes}
      </button>
      <button className="act" onClick={onComment} aria-label="Commentaires"><Icon name="chat" />{item.comments > 0 && item.comments}</button>
      <button className={`act ${state.saved ? 'on' : ''}`} onClick={() => react('save')} aria-pressed={state.saved} aria-label="Favori"><Icon name="save" fill={state.saved} /></button>
      {!compact && <button className="act" onClick={share} aria-label="Partager"><Icon name="share" /></button>}
    </div>
  );
}

export async function shareLink(path, title, toast) {
  const url = `${window.location.origin}${path}`;
  try {
    if (navigator.share) await navigator.share({ title: title || 'Fréquence', url });
    else { await navigator.clipboard.writeText(url); toast?.('Lien copié'); }
  } catch { /* partage annulé */ }
}

// ---------------------------------------------------------------- signalement
const REASONS = [
  ['harassment', 'Harcèlement ou insulte'], ['hate', 'Haine, discrimination'], ['sexual', 'Contenu sexuel'],
  ['violence', 'Violence, menace'], ['minor_safety', 'Met un mineur en danger'], ['personal_info', 'Infos personnelles exposées'],
  ['spam', 'Spam, arnaque'], ['copyright', 'Droits d\'auteur'], ['other', 'Autre'],
];
export function ReportSheet({ target, onClose }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { user } = useSession();
  const send = async () => {
    setBusy(true);
    try {
      const r = await api.post('/api/reports', { target_type: target.type, target_id: target.id, reason, details: details || undefined });
      toast(r.message);
      onClose();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  const block = async () => {
    try { await api.post('/api/blocks', { user_id: target.userId }); toast('Compte bloqué : tu ne verras plus ses messages ni ses créations.'); onClose(true); }
    catch (e) { toast(e.message); }
  };
  return (
    <Sheet open={Boolean(target)} onClose={() => onClose()} label="Signaler">
      <div className="stack">
        <h2 className="display h3">Signaler</h2>
        <p className="muted" style={{ fontSize: 14 }}>Ton signalement est anonyme pour la personne concernée. Une vraie personne de l'équipe le lit.</p>
        {!user ? <p>Connecte-toi pour signaler.</p> : (
          <>
            <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
              {REASONS.map(([k, l]) => <button key={k} className={`chip ${reason === k ? 'on' : ''}`} onClick={() => setReason(k)}>{l}</button>)}
            </div>
            <label className="field"><span>Précisions (facultatif)</span><textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} /></label>
            <button className="btn block" disabled={!reason || busy} onClick={send}>Envoyer le signalement</button>
            {target?.userId && target.userId !== user.id && <button className="btn ghost block" onClick={block}>Bloquer ce compte</button>}
            <p className="dim" style={{ fontSize: 13 }}>Danger immédiat ? Appelle le 17 ou le 112. Harcèlement : 3018 (gratuit, anonyme, 7j/7).</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- commentaires
export function Comments({ type, id }) {
  const [items, setItems] = useState(null);
  const [body, setBody] = useState('');
  const [err, setErr] = useState(null);
  const [report, setReport] = useState(null);
  const { user } = useSession();
  const need = useRequireAccount();
  const load = () => api.get(`/api/comments?target_type=${type}&target_id=${id}`).then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [type, id]); // eslint-disable-line
  const send = async (e) => {
    e.preventDefault();
    if (!need('commenter') || !body.trim()) return;
    setErr(null);
    try {
      const c = await api.post('/api/comments', { target_type: type, target_id: id, body });
      setItems((xs) => [...(xs || []), c]); setBody('');
    } catch (ex) { setErr(ex.message); }
  };
  const remove = async (c) => { await api.del(`/api/comments/${c.id}`); setItems((xs) => xs.filter((x) => x.id !== c.id)); };
  return (
    <div>
      <div className="section-head"><h3 className="display h4">Réactions</h3><span className="mono dim">{items?.length ?? ''}</span></div>
      {items === null && !err && <Loading h={60} />}
      {items?.length === 0 && <p className="muted">Personne n'a encore réagi. Lance la discussion, dans le respect de la charte.</p>}
      {items?.map((c) => (
        <div key={c.id} className={`comment ${c.author.official ? 'official' : ''}`}>
          <Avatar style={c.author.avatar_style} handle={c.author.handle} official={c.author.official} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 6 }}>
              <Link to={`/u/${c.author.handle}`} className="who">{c.author.handle}</Link>
              {c.author.official && <span className="verified" title="Compte officiel">✓</span>}
              {c.author.staff && !c.author.official && <span className="tag">Équipe</span>}
              <span className="mono dim">{ago(c.created_at)}</span>
            </div>
            <p>{c.body}</p>
          </div>
          {c.mine
            ? <button className="act" onClick={() => remove(c)} aria-label="Supprimer mon commentaire"><Icon name="x" size={16} /></button>
            : <button className="act" onClick={() => setReport({ type: 'comment', id: c.id, userId: c.author.id })} aria-label="Signaler"><Icon name="flag" size={16} /></button>}
        </div>
      ))}
      <form onSubmit={send} className="row" style={{ marginTop: 14, alignItems: 'stretch' }}>
        <input className="input" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder={user ? 'Ajoute ta réaction…' : 'Connecte-toi pour réagir'} aria-label="Ton commentaire" onFocus={() => !user && need('commenter')} />
        <button className="btn" disabled={!body.trim()}>Envoyer</button>
      </form>
      {err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}
      <ReportSheet target={report} onClose={(blocked) => { setReport(null); if (blocked) load(); }} />
    </div>
  );
}
