import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useLoad } from '../lib/hooks.js';
import { api, view } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { PostCard, WaveViewer } from '../components/Post.jsx';
import { Countdown, Empty, ErrorBox, Loading, MediaView, Reactions, SourceLine, KindTag, DemoTag, Comments, Icon, useToast, shareLink, ReminderButton, Provenance } from '../components/ui.jsx';
import { dateLong, time, ago, EVENT_KIND, KIND_LABEL } from '../lib/format.js';

// Le "signal" du moment : la prochaine échéance réelle (sortie ou date), sinon
// la dernière annonce épinglée. Jamais de compte à rebours inventé.
const RELEASE_STICKER = { single: 'nouveau son', ep: 'nouvel EP', album: 'nouvel album', mixtape: 'nouvelle mixtape', clip: 'nouveau clip', freestyle: 'freestyle' };

// La prochaine échéance réelle (sortie ou date confirmée), sinon l'annonce
// épinglée. Jamais de compte à rebours inventé.
function NextDrop({ data, user }) {
  const candidates = [];
  const r = data.next_release;
  if (r?.release_at || r?.release_date) candidates.push({ type: 'release', at: r.release_at || `${r.release_date}T00:00:00`, x: r });
  if (data.next_event) candidates.push({ type: 'event', at: data.next_event.starts_at, x: data.next_event });
  candidates.sort((a, b) => new Date(a.at) - new Date(b.at));
  const s = candidates[0];
  const pinned = data.pinned[0];
  const photo = (s?.type === 'release' && s.x.cover?.url) || data.artist.banner?.url;
  const openDrop = data.drops.find((d) => d.state === 'open');
  if (!s) {
    if (!pinned) return null;
    return (
      <Link to={`/qg/${pinned.id}`} className="drop-hero plain">
        <div className="txt"><span className="sticker orange">annonce</span><h1 style={{ fontSize: 30 }}>{pinned.title}</h1><DemoTag on={pinned.is_demo} /></div>
      </Link>
    );
  }
  const when = s.type === 'event'
    ? `${EVENT_KIND[s.x.kind]} · ${[s.x.venue, s.x.city].filter(Boolean).join(', ')} · ${dateLong(s.at)} à ${time(s.at)}`
    : s.x.kind === 'clip' ? `Le clip sort ${dateLong(s.at)} à ${time(s.at)}` : `Sur toutes les plateformes ${dateLong(s.at)}${s.x.release_at ? ` à ${time(s.at)}` : ''}`;
  return (
    <section>
      <Link to={s.type === 'event' ? `/date/${s.x.id}` : `/sortie/${s.x.id}`} className={`drop-hero ${photo ? '' : 'plain'}`}>
        <span className="sticker">{s.type === 'event' ? 'date confirmée' : RELEASE_STICKER[s.x.kind] || 'sortie'}</span>
        {photo && <div className="pic"><img src={photo} alt="" /></div>}
        <div className="txt">
          <DemoTag on={s.x.is_demo} />
          <h1>{s.x.title}</h1>
          <p className="when">{when}</p>
          <Countdown to={s.at} />
        </div>
      </Link>
      <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
        <ReminderButton type={s.type} id={s.x.id} at={s.type === 'event' ? new Date(new Date(s.at) - 2 * 3600e3).toISOString() : s.at} reminder={s.x.reminder} label={s.type === 'event' ? 'Me rappeler 2 h avant' : 'Me prévenir à la sortie'} />
        {openDrop && <Link to={`/labo/${openDrop.id}`} className="btn uv"><Icon name="play" fill size={16} /> Écouter en avant-première</Link>}
        <Link to={s.type === 'event' ? `/date/${s.x.id}` : `/sortie/${s.x.id}`} className="btn ghost">Détails</Link>
      </div>
    </section>
  );
}

export function QG() {
  const { data, error, loading, reload } = useLoad('/api/qg');
  const [wave, setWave] = useState(null);
  const { user } = useSession();
  if (loading && !data) return <div className="page stack"><Loading h={90} /><Loading h={380} /><Loading h={320} /></div>;
  if (error) return <div className="page"><ErrorBox error={error} retry={reload} /></div>;
  const nothing = !data.feed.length && !data.pinned.length && !data.stories.length;
  const pinned = data.pinned.filter((p) => p.id !== (data.next_release || data.next_event ? null : data.pinned[0]?.id));
  return (
    <div className="page">
      <div className="stories" aria-label="Stories">
        <Link to="/ifa" className="story">
          <span className="story-ring">{data.artist.banner ? <img src={data.artist.banner.url} alt="" /> : <span className="ifa-av">ifa</span>}</span>
          <span>ifa</span>
        </Link>
        {data.stories.map((st, i) => (
          <button key={st.id} className="story" onClick={() => setWave(i)} aria-label={`Story : ${st.title}`}>
            <span className="story-ring">
              {st.media?.kind === 'image' && <img src={st.media.url} alt="" />}
              {st.media?.kind === 'video' && <video src={`${st.media.url}#t=0.1`} muted playsInline preload="metadata" />}
              {!st.media && <span>{st.title}</span>}
            </span>
            <span>{ago(st.published_at).replace('il y a ', '')}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 18 }}><NextDrop data={data} user={user} /></div>

      {data.drops.length > 0 && (
        <section className="section">
          <div className="section-head"><h2 className="display h3">Au Labo</h2><Link to="/labo" className="mono">Tout voir</Link></div>
          {data.drops.slice(0, 2).map((d) => (
            <Link to={`/labo/${d.id}`} key={d.id} className="panel row between" style={{ marginTop: 8 }}>
              <div className="row" style={{ minWidth: 0 }}>
                <span className="ring" style={{ background: 'var(--navy)', color: '#fff' }}><Icon name={d.state === 'open' ? 'play' : 'lock'} fill={d.state === 'open'} size={20} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{d.title}</div>
                  <div className="mono">{d.state === 'open' ? 'ouvert maintenant' : <>ouvre dans <Countdown to={d.opens_at} compact /></>}</div>
                </div>
              </div>
              <DemoTag on={d.is_demo} />
            </Link>
          ))}
        </section>
      )}

      {data.challenge && (
        <Link to={`/cercles/defi/${data.challenge.id}`} className="panel" style={{ display: 'block', marginTop: 24, background: 'var(--mint)', color: 'var(--mint-ink)' }}>
          <div className="row between"><span className="sticker orange">défi</span><DemoTag on={data.challenge.is_demo} /></div>
          <div className="display h3" style={{ marginTop: 10 }}>{data.challenge.title}</div>
          <p style={{ margin: '6px 0 0', fontSize: 15 }}>{data.challenge.brief}</p>
        </Link>
      )}

      <section className="section" aria-label="Publications">
        <div className="section-head">
          <h2 className="display h3">Les news</h2>
          <Link to="/qg/archives" className="mono">Tout l'historique</Link>
        </div>
        {nothing && <Empty title="Rien pour l'instant">Les news, sorties et coulisses d'Ifa arrivent ici dès que l'équipe publie.</Empty>}
        {pinned.map((p) => <PostCard key={p.id} post={p} lead />)}
        {data.feed.map((p) => <PostCard key={p.id} post={p} />)}
      </section>

      {data.featured.length > 0 && (
        <section className="section" aria-label="Créas de la commu">
          <div className="section-head"><h2 className="display h3">Les créas de la commu</h2><Link to="/cercles" className="mono">Voir la commu</Link></div>
          <div className="fan-grid">
            {data.featured.map((f) => (
              <Link key={f.id} to={`/cercles/creation/${f.id}`} className="fan-tile">
                {f.media.kind === 'image' ? <img src={f.media.url} alt="" loading="lazy" /> : <video src={`${f.media.url}#t=0.1`} muted playsInline preload="metadata" />}
                <span className="sticker star" style={{ fontSize: 12 }}>validé par ifa</span>
                <span className="who">@{f.author.handle}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!user && (
        <section className="section panel stack" style={{ '--s': '10px', background: 'var(--navy)', color: '#fff' }}>
          <span className="sticker">gratuit</span>
          <h2 className="display h3">Crée ton compte</h2>
          <p style={{ margin: 0, opacity: .85 }}>Les sons en avant-première au Labo, les votes, les défis et les notifs de sortie.</p>
          <Link to="/bienvenue" className="btn" style={{ background: '#fff', color: '#111633' }}>C'est parti</Link>
        </section>
      )}
      {wave !== null && <WaveViewer items={data.stories} start={wave} onClose={() => setWave(null)} />}
    </div>
  );
}

export function PostDetail() {
  const { id } = useParams();
  const { hash } = useLocation();
  const { data: p, error, loading } = useLoad(`/api/posts/${id}`);
  const toast = useToast();
  useEffect(() => { if (p) view('post', p.id); }, [p?.id]); // eslint-disable-line
  useEffect(() => { if (p && hash === '#reactions') document.getElementById('reactions')?.scrollIntoView({ behavior: 'smooth' }); }, [p, hash]);
  if (loading) return <div className="page"><Loading h={400} /></div>;
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  const hasMedia = p.media || p.source.platform === 'youtube';
  return (
    <div className="page">
      <Link to="/" className="mono row" style={{ gap: 4, marginBottom: 16 }}><Icon name="back" size={16} /> Accueil</Link>
      <div className="post-meta">
        <KindTag kind={p.kind} official={p.author?.official} />
        <Provenance source={p.source} />
        <DemoTag on={p.is_demo} />
      </div>
      <h1 className="display h2" style={{ margin: '14px 0 12px' }}>{p.title}</h1>
      <div className="row between wrap" style={{ marginBottom: 16 }}>
        <span className="mono">Publié le {new Date(p.published_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })} par l'équipe d'Ifa</span>
      </div>
      {hasMedia && <div className={`post-media ${p.media?.kind === 'image' ? '' : 'wide'}`} style={{ borderRadius: 18, aspectRatio: p.media?.kind === 'image' ? 'auto' : undefined }}><MediaView media={p.media} sourceUrl={p.source.url} wide /></div>}
      {p.body && <div style={{ marginTop: 18, whiteSpace: 'pre-wrap', fontSize: 17 }}>{p.body}</div>}
      {p.source.url && (
        <a href={p.source.url} target="_blank" rel="noopener noreferrer" className="btn ghost block" style={{ marginTop: 18 }}>
          Voir l'original sur {p.source.platform ? p.source.platform.replace('_', ' ') : 'le site source'} <Icon name="ext" size={16} />
        </a>
      )}
      <div className="row between" style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
        <Reactions type="post" item={p} onComment={() => document.getElementById('reactions')?.scrollIntoView({ behavior: 'smooth' })} />
        <button className="act" onClick={() => shareLink(`/qg/${p.id}`, p.title, toast)}><Icon name="share" /></button>
      </div>
      <div id="reactions" className="section" style={{ marginTop: 24 }}><Comments type="post" id={p.id} /></div>
    </div>
  );
}

const FILTERS = [['', 'Tout'], ['announcement', 'Annonces'], ['news', 'Actus'], ['release', 'Sorties'], ['clip', 'Clips'], ['freestyle', 'Freestyles'], ['backstage', 'Coulisses'], ['event', 'Événements']];
export function Archives() {
  const [kind, setKind] = useState('');
  const [items, setItems] = useState(null);
  const [next, setNext] = useState(null);
  const [err, setErr] = useState(null);
  const load = async (before) => {
    try {
      const r = await api.get(`/api/posts?${new URLSearchParams({ ...(kind && { kind }), ...(before && { before }) })}`);
      setItems((xs) => (before ? [...xs, ...r.items] : r.items)); setNext(r.next);
    } catch (e) { setErr(e); }
  };
  useEffect(() => { setItems(null); load(); }, [kind]); // eslint-disable-line
  return (
    <div className="page">
      <h1 className="display h1" style={{ margin: '0 0 16px' }}>Tout l'historique</h1>
      <div className="chips" style={{ marginBottom: 18 }}>
        {FILTERS.map(([k, l]) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {err && <ErrorBox error={err} />}
      {!items && !err && <Loading />}
      {items?.length === 0 && <Empty title="Rien ici">Aucun contenu {kind ? `de type « ${KIND_LABEL[kind]} »` : ''} pour l'instant.</Empty>}
      {items?.map((p) => <PostCard key={p.id} post={p} />)}
      {next && <button className="btn ghost block" style={{ marginTop: 16 }} onClick={() => load(next)}>Plus ancien</button>}
    </div>
  );
}
