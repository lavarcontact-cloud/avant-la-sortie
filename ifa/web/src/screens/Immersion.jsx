import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLoad } from '../lib/hooks.js';
import { api, view } from '../lib/api.js';
import { Icon, Sheet, Comments, useRequireAccount, useToast, shareLink, DemoTag, ReportSheet, Avatar, Empty } from '../components/ui.jsx';
import { KIND_LABEL, youtubeId, ago } from '../lib/format.js';

// Le Tunnel : chaque piste est une séquence qu'on traverse de côté (pouce
// gauche/droite ou tap sur les bords). Le changement de piste se fait en bas,
// dans la zone du pouce. Pas de défilement vertical sans fin.
const TRACKS = [
  ['pour-toi', 'Pour toi'], ['clips', 'Clips & freestyles'], ['coulisses', 'Coulisses'],
  ['signaux', 'Stories'], ['selection', 'Sélection équipe'], ['fans', 'Créations fans'], ['defis', 'Défis'],
];

function Shot({ item, active, muted }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) { v.play().catch(() => {}); view(item.type, item.id); } else { v.pause(); }
  }, [active]); // eslint-disable-line
  const yt = item.type === 'post' && !item.media ? youtubeId(item.source?.url) : null;
  return (
    <div className="shot">
      {item.media?.kind === 'video' && <video ref={ref} src={item.media.url} muted={muted} loop playsInline preload={active ? 'auto' : 'metadata'} />}
      {item.media?.kind === 'image' && <img src={item.media.url} alt="" />}
      {yt && (active
        ? <iframe src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=${muted ? 1 : 0}&playsinline=1&rel=0&modestbranding=1`} title={item.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        : <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" />)}
      <div className="grad" />
      <div className="shot-info">
        {item.type === 'post' ? (
          <>
            <div className="row" style={{ gap: 6 }}>
              <span className="tag sodium"><span className="verified" style={{ width: 12, height: 12, fontSize: 8 }}>✓</span>{KIND_LABEL[item.kind]}</span>
              <DemoTag on={item.is_demo} />
              {item.source?.platform && item.source.type !== 'app' && <span className="tag">via {item.source.platform}</span>}
            </div>
            <h2 className="post-title">{item.title}</h2>
          </>
        ) : (
          <>
            <div className="row" style={{ gap: 8 }}>
              <Avatar style={item.author.avatar_style} handle={item.author.handle} size={28} />
              <b>@{item.author.handle}</b>
              <span className="tag canal">Création fan</span>
              {item.is_featured && <span className="tag sodium">★ Sélection</span>}
            </div>
            {item.caption && <p style={{ marginTop: 8, textShadow: '0 1px 10px rgba(0,0,0,.6)' }}>{item.caption}</p>}
          </>
        )}
        <span className="mono muted">{ago(item.published_at || item.created_at)}</span>
      </div>
    </div>
  );
}

export function Immersion() {
  const [params, setParams] = useSearchParams();
  const track = params.get('piste') || 'pour-toi';
  const { data, loading } = useLoad(`/api/immersion?track=${track}`);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [state, setState] = useState({});
  const [comments, setComments] = useState(false);
  const [report, setReport] = useState(null);
  const trackRef = useRef(null);
  const need = useRequireAccount();
  const toast = useToast();
  const nav = useNavigate();
  const items = data?.items || [];
  const cur = items[idx];

  useEffect(() => { setIdx(0); trackRef.current?.scrollTo({ left: 0 }); }, [track]);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const on = () => setIdx(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, [data]);
  const go = (d) => {
    const el = trackRef.current;
    const n = Math.max(0, Math.min(items.length - 1, idx + d));
    el?.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  };
  useEffect(() => {
    const k = (e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const s = cur ? (state[cur.id] || { liked: cur.liked, likes: cur.likes, saved: cur.saved }) : {};
  const react = async (kind) => {
    if (!cur || !need('réagir')) return;
    const on = kind === 'like' ? !s.liked : !s.saved;
    const nextS = kind === 'like' ? { ...s, liked: on, likes: s.likes + (on ? 1 : -1) } : { ...s, saved: on };
    setState((x) => ({ ...x, [cur.id]: nextS }));
    try { await api.post('/api/react', { target_type: cur.type, target_id: cur.id, kind, on }); if (kind === 'save') toast(on ? 'Gardé dans tes favoris' : 'Retiré des favoris'); }
    catch (e) { toast(e.message); }
  };

  return (
    <div className="tunnel">
      {cur && <div className="reel-bar" aria-hidden="true">{items.slice(0, 24).map((x, k) => <i key={x.id + k} className={k === idx ? 'on' : k < idx ? 'done' : ''} />)}</div>}
      <div className="tunnel-track" ref={trackRef}>
        {items.map((it, k) => <Shot key={`${it.type}-${it.id}`} item={it} active={k === idx} muted={muted} />)}
        {!loading && items.length === 0 && (
          <div className="shot" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
            <Empty title="Piste vide pour l'instant">
              {track === 'fans' || track === 'defis' ? 'Les créations validées par l\'équipe apparaîtront ici.' : 'Les vidéos publiées par l\'équipe d\'Ifa apparaîtront ici.'}
            </Empty>
          </div>
        )}
      </div>
      {items.length > 1 && <>
        <button className="tap-zone l" onClick={() => go(-1)} aria-label="Vidéo précédente" />
        <button className="tap-zone r" onClick={() => go(1)} aria-label="Vidéo suivante" />
      </>}
      <div className="tunnel-controls">
        {cur && (
          <div className="tunnel-actions">
            <div className="row" style={{ gap: 12 }}>
              <button className={`round ${s.liked ? 'on' : ''}`} onClick={() => react('like')} aria-label="J'aime" aria-pressed={s.liked}><Icon name="heart" fill={s.liked} />{s.likes > 0 && <small>{s.likes}</small>}</button>
              <button className="round" onClick={() => setComments(true)} aria-label="Commentaires"><Icon name="chat" />{cur.comments > 0 && <small>{cur.comments}</small>}</button>
              <button className={`round ${s.saved ? 'on' : ''}`} onClick={() => react('save')} aria-label="Favori" aria-pressed={s.saved}><Icon name="save" fill={s.saved} /></button>
              <button className="round" onClick={() => shareLink(cur.type === 'post' ? `/qg/${cur.id}` : `/cercles/creation/${cur.id}`, cur.title, toast)} aria-label="Partager"><Icon name="share" /></button>
            </div>
            <div className="row" style={{ gap: 12 }}>
              {cur.type === 'fan_post' && <button className="round" onClick={() => setReport({ type: 'fan_post', id: cur.id })} aria-label="Signaler"><Icon name="flag" /></button>}
              <button className="round" onClick={() => setMuted(!muted)} aria-label={muted ? 'Activer le son' : 'Couper le son'}><Icon name={muted ? 'mute' : 'sound'} /></button>
            </div>
          </div>
        )}
        <div className="chips" role="tablist" aria-label="Pistes">
          {TRACKS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={track === k} className={`chip ${track === k ? 'on' : ''}`} onClick={() => setParams({ piste: k }, { replace: true })}>{l}</button>
          ))}
        </div>
      </div>
      <Sheet open={comments && Boolean(cur)} onClose={() => setComments(false)} label="Commentaires">
        {cur && <Comments type={cur.type} id={cur.id} />}
        {cur?.type === 'post' && <button className="btn ghost block" style={{ marginTop: 14 }} onClick={() => nav(`/qg/${cur.id}`)}>Ouvrir la publication</button>}
      </Sheet>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </div>
  );
}
