import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLoad, useTick } from '../lib/hooks.js';
import { api, view } from '../lib/api.js';
import { Countdown, Empty, ErrorBox, Loading, Icon, DemoTag, useRequireAccount, useToast } from '../components/ui.jsx';
import { dateLong, time } from '../lib/format.js';

const KIND = { preview: 'Avant-première', vote: 'Vote', process: 'Dans le studio', experience: 'Expérience' };
const GLYPHS = '▓▒░█▄▀■□◆◇○●◘◙';

// Texte "brouillé" : le contenu verrouillé reste illisible, par construction
// (le vrai texte n'est même pas envoyé par l'API avant l'ouverture).
function Cipher({ seed = 'x' }) {
  useTick(140);
  const len = 72;
  let out = '';
  for (let i = 0; i < len; i++) out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  return <div className="cipher" aria-hidden="true">{out}<br /><span style={{ letterSpacing: '.3em' }}>{seed.length ? 'SIGNAL CRYPTÉ' : ''}</span></div>;
}

function DropCard({ d }) {
  const locked = !d.unlocked;
  return (
    <Link to={`/labo/${d.id}`} className={`drop ${locked ? 'locked' : ''}`}>
      <div className="drop-cover">
        {d.cover ? <img src={d.cover.url} alt="" /> : null}
        {locked && <Cipher seed={d.id} />}
        {!d.cover && !locked && <div className="cipher" style={{ color: '#B9A6FF' }}>{KIND[d.kind]}</div>}
      </div>
      <div className="drop-body">
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="tag uv">{KIND[d.kind]}</span>
          {d.state === 'upcoming' && <span className="tag">Ouvre le {dateLong(d.opens_at).replace(/^\w+ /, '')}</span>}
          {d.state === 'open' && d.unlocked && <span className="tag canal">Accessible</span>}
          {d.state === 'closed' && <span className="tag">Fermé</span>}
          {d.access !== 'members' && <span className="tag sodium">{d.access === 'badge' ? `Badge ${d.required_badge_name || ''}` : `Cercle ${d.required_circle?.name || ''}`}</span>}
          <DemoTag on={d.is_demo} />
        </div>
        <h3 className="post-title" style={{ marginTop: 12 }}>{d.title}</h3>
        {d.teaser && <p className="muted" style={{ fontSize: 15, margin: 0 }}>{d.teaser}</p>}
        {d.state === 'upcoming' && <div style={{ marginTop: 10 }}><Countdown to={d.opens_at} /></div>}
        {d.state === 'open' && !d.unlocked && <p className="lock uv" style={{ margin: '10px 0 0', fontSize: 14 }}><Icon name="lock" size={16} />{d.lock_reason}</p>}
      </div>
    </Link>
  );
}

export function Labo() {
  const { data, error, loading, reload } = useLoad('/api/labo');
  const groups = useMemo(() => ({
    open: (data || []).filter((d) => d.state === 'open'),
    upcoming: (data || []).filter((d) => d.state === 'upcoming'),
    closed: (data || []).filter((d) => d.state === 'closed'),
  }), [data]);
  return (
    <div className="labo-bg" style={{ minHeight: '100dvh' }}>
      <div className="page">
        <span className="mono uv">03 · Accès restreint</span>
        <h1 className="display h1" style={{ margin: '8px 0 10px' }}>Le<br />Labo</h1>
        <p className="lede muted">Extraits inédits, votes sur les pochettes, étapes d'un projet. Chaque porte s'ouvre à l'heure fixée par l'équipe d'Ifa, pas avant.</p>
        {loading && <Loading h={300} />}
        {error && <ErrorBox error={error} retry={reload} />}
        {data && data.length === 0 && <div style={{ marginTop: 24 }}><Empty title="Le Labo est fermé">Aucune expérience programmée pour l'instant. Active les signaux « Extraits inédits » pour être prévenu à l'ouverture.</Empty></div>}
        {groups.open.length > 0 && <section className="section"><h2 className="mono muted">Ouvert maintenant</h2>{groups.open.map((d) => <DropCard key={d.id} d={d} />)}</section>}
        {groups.upcoming.length > 0 && <section className="section"><h2 className="mono muted">Prochaines ouvertures</h2>{groups.upcoming.map((d) => <DropCard key={d.id} d={d} />)}</section>}
        {groups.closed.length > 0 && <section className="section"><h2 className="mono muted">Refermé</h2>{groups.closed.map((d) => <DropCard key={d.id} d={d} />)}</section>}
      </div>
    </div>
  );
}

// Lecteur audio maison : pas de bouton de téléchargement, flux protégé.
function Player({ src }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [p, setP] = useState(0);
  const bars = useMemo(() => Array.from({ length: 48 }, (_, i) => 25 + Math.abs(Math.sin(i * 1.7) * 55) + (i % 5) * 4), []);
  useEffect(() => {
    const a = ref.current;
    const up = () => setP(a.duration ? a.currentTime / a.duration : 0);
    const end = () => setPlaying(false);
    a.addEventListener('timeupdate', up); a.addEventListener('ended', end);
    return () => { a.removeEventListener('timeupdate', up); a.removeEventListener('ended', end); };
  }, []);
  const toggle = () => { const a = ref.current; if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); } };
  const seek = (e) => { const a = ref.current; const r = e.currentTarget.getBoundingClientRect(); if (a.duration) a.currentTime = ((e.clientX - r.left) / r.width) * a.duration; };
  return (
    <div className="player" onContextMenu={(e) => e.preventDefault()}>
      <audio ref={ref} src={src} preload="metadata" controlsList="nodownload" />
      <button className="pp" onClick={toggle} aria-label={playing ? 'Pause' : 'Écouter'}><Icon name={playing ? 'pause' : 'play'} fill size={22} /></button>
      <div className="bars" onClick={seek} role="slider" aria-label="Position" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
        {bars.map((h, i) => <i key={i} className={i / bars.length < p ? 'p' : ''} style={{ height: `${h}%` }} />)}
      </div>
    </div>
  );
}

export function DropDetail() {
  const { id } = useParams();
  const { data: d, error, loading, setData, reload } = useLoad(`/api/labo/${id}`);
  const need = useRequireAccount();
  const toast = useToast();
  useEffect(() => { if (d?.unlocked) view('drop', d.id); }, [d?.unlocked]); // eslint-disable-line
  // à l'heure d'ouverture, on recharge pour obtenir le contenu
  useEffect(() => {
    if (!d || d.state !== 'upcoming') return undefined;
    const ms = new Date(d.opens_at) - Date.now() + 1500;
    if (ms > 2 ** 31 - 1) return undefined;
    const t = setTimeout(reload, ms);
    return () => clearTimeout(t);
  }, [d?.state, d?.opens_at]); // eslint-disable-line
  if (loading && !d) return <div className="page"><Loading h={400} /></div>;
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  const vote = async (optionId) => {
    if (!need('voter')) return;
    try { setData(await api.post(`/api/labo/${d.id}/vote`, { option_id: optionId })); toast('Vote enregistré'); }
    catch (e) { toast(e.message); }
  };
  return (
    <div className="labo-bg" style={{ minHeight: '100dvh' }}>
      <div className="page">
        <Link to="/labo" className="mono muted row" style={{ gap: 4, marginBottom: 16 }}><Icon name="back" size={14} /> Labo</Link>
        <div className="row wrap" style={{ gap: 6 }}><span className="tag uv">{KIND[d.kind]}</span><DemoTag on={d.is_demo} /></div>
        <h1 className="display h2" style={{ margin: '12px 0' }}>{d.title}</h1>
        {d.cover && <div className={`drop ${d.unlocked ? '' : 'locked'}`} style={{ marginBottom: 16 }}><div className="drop-cover"><img src={d.cover.url} alt="" /></div></div>}
        {!d.unlocked ? (
          <div className="panel stack" style={{ borderColor: 'rgba(141,107,255,.35)' }}>
            <p className="lock uv" style={{ margin: 0 }}><Icon name="lock" size={18} /> {d.lock_reason}</p>
            {d.teaser && <p style={{ margin: 0 }}>{d.teaser}</p>}
            {d.state === 'upcoming' && <><span className="mono muted">Ouverture {dateLong(d.opens_at)} à {time(d.opens_at)}</span><Countdown to={d.opens_at} /></>}
            {d.lock_reason?.startsWith('Connecte') && <Link className="btn uv" to="/bienvenue">Me connecter</Link>}
            {d.required_circle && <Link className="btn ghost" to={`/cercles/${d.required_circle.slug}`}>Voir le cercle {d.required_circle.name}</Link>}
          </div>
        ) : (
          <div className="stack">
            {d.media?.kind === 'audio' && <Player src={d.media.url} />}
            {d.media?.kind === 'video' && <video src={d.media.url} controls playsInline controlsList="nodownload" style={{ width: '100%', borderRadius: 18 }} onContextMenu={(e) => e.preventDefault()} />}
            {d.media?.kind === 'image' && <img src={d.media.url} alt="" style={{ borderRadius: 18 }} />}
            {d.body && <div style={{ whiteSpace: 'pre-wrap', fontSize: 17 }}>{d.body}</div>}
            {d.kind === 'vote' && (
              <div>
                <h2 className="display h3" style={{ marginBottom: 12 }}>{d.my_vote ? 'Résultats' : 'Ton choix'}</h2>
                {d.options.map((o) => {
                  const pct = d.total_votes ? Math.round((o.votes / d.total_votes) * 100) : 0;
                  return (
                    <button key={o.id} className={`vote-opt ${d.my_vote === o.id ? 'mine' : ''}`} onClick={() => !d.my_vote && d.state === 'open' && vote(o.id)} disabled={Boolean(d.my_vote) || d.state !== 'open'}>
                      {d.total_votes !== null && <span className="fill" style={{ width: `${pct}%` }} />}
                      {o.media?.kind === 'image' && <img src={o.media.url} alt="" />}
                      <b style={{ flex: 1 }}>{o.label}</b>
                      {d.total_votes !== null && <span className="mono">{pct}%</span>}
                      {d.my_vote === o.id && <Icon name="check" />}
                    </button>
                  );
                })}
                <p className="mono dim" style={{ marginTop: 10 }}>{d.total_votes !== null ? `${d.total_votes} vote${d.total_votes > 1 ? 's' : ''}` : 'Les résultats s\'affichent après ton vote'} · un vote par compte</p>
              </div>
            )}
            {d.closes_at && <p className="mono muted">Accessible jusqu'au {dateLong(d.closes_at)} à {time(d.closes_at)}</p>}
            {d.rights_note && <p className="mono dim">Droits : {d.rights_note}. Enregistrer ou rediffuser ce contenu est interdit.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
