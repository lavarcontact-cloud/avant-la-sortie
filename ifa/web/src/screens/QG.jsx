import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useLoad } from '../lib/hooks.js';
import { api, view } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { PostCard, WaveViewer } from '../components/Post.jsx';
import { Countdown, Empty, ErrorBox, Loading, MediaView, Reactions, SourceLine, KindTag, DemoTag, Comments, Icon, useToast, shareLink } from '../components/ui.jsx';
import { dateLong, time, EVENT_KIND, RELEASE_KIND, KIND_LABEL } from '../lib/format.js';

// Le "signal" du moment : la prochaine échéance réelle (sortie ou date), sinon
// la dernière annonce épinglée. Jamais de compte à rebours inventé.
function HeroBg({ banner }) {
  return banner ? <div className="hero-photo" aria-hidden="true"><img src={banner.url} alt="" /></div> : null;
}

function Signal({ data }) {
  const candidates = [];
  if (data.next_release?.release_at || data.next_release?.release_date) candidates.push({ type: 'release', at: data.next_release.release_at || `${data.next_release.release_date}T00:00:00`, x: data.next_release });
  if (data.next_event) candidates.push({ type: 'event', at: data.next_event.starts_at, x: data.next_event });
  candidates.sort((a, b) => new Date(a.at) - new Date(b.at));
  const s = candidates[0];
  const pinned = data.pinned[0];
  if (!s && !pinned) {
    return (
      <div className="signal-hero">
        <HeroBg banner={data.artist.banner} />
        <div className="scan" />
        <span className="mono muted">Pas de signal programmé</span>
        <h1 className="display h1" style={{ marginTop: 10 }}>Reste<br />branché</h1>
        <p className="muted" style={{ marginTop: 10 }}>Dès qu'Ifa ou son équipe annonce une sortie ou une date, le compte à rebours s'allume ici.</p>
      </div>
    );
  }
  if (!s) {
    return (
      <Link to={`/qg/${pinned.id}`} className="signal-hero">
        <HeroBg banner={data.artist.banner} />
        <div className="scan" />
        <div className="row"><span className="live-dot" /><span className="mono sodium">Annonce épinglée</span><DemoTag on={pinned.is_demo} /></div>
        <h1 className="display h2" style={{ marginTop: 12 }}>{pinned.title}</h1>
      </Link>
    );
  }
  return (
    <Link to={s.type === 'event' ? '/ifa#agenda' : '/ifa#discographie'} className="signal-hero">
      <HeroBg banner={data.artist.banner} />
        <div className="scan" />
      <div className="row">
        <span className="live-dot" />
        <span className="mono sodium">{s.type === 'event' ? `${EVENT_KIND[s.x.kind]} confirmé` : `${RELEASE_KIND[s.x.kind]} annoncé`}</span>
        <DemoTag on={s.x.is_demo} />
      </div>
      <h1 className="display h1" style={{ marginTop: 10 }}>{s.x.title}</h1>
      <p className="muted" style={{ margin: '6px 0 0' }}>
        {s.type === 'event' ? `${[s.x.venue, s.x.city].filter(Boolean).join(' · ')} — ${dateLong(s.at)}, ${time(s.at)}` : `Sortie le ${dateLong(s.at)}${s.x.release_at ? ` à ${time(s.at)}` : ''}`}
      </p>
      <Countdown to={s.at} />
    </Link>
  );
}

export function QG() {
  const { data, error, loading, reload } = useLoad('/api/qg');
  const [wave, setWave] = useState(null);
  const { user } = useSession();
  if (loading && !data) return <div className="page stack"><Loading h={260} /><Loading h={180} /><Loading h={320} /></div>;
  if (error) return <div className="page"><ErrorBox error={error} retry={reload} /></div>;
  const nothing = !data.feed.length && !data.pinned.length && !data.stories.length;
  return (
    <div className="page">
      <Signal data={data} />

      {data.stories.length > 0 && (
        <section className="section" style={{ marginTop: 28 }} aria-label="Ondes courtes">
          <div className="section-head"><h2 className="mono muted" style={{ margin: 0 }}>Ondes courtes · 24 h</h2></div>
          <div className="waves-strip">
            {data.stories.map((s, i) => {
              const total = new Date(s.expires_at) - new Date(s.published_at);
              const left = Math.max(0, Math.min(1, (new Date(s.expires_at) - Date.now()) / total));
              return (
                <button key={s.id} className="wave-card" onClick={() => setWave(i)} aria-label={`Onde courte : ${s.title}`}>
                  {s.media?.kind === 'image' && <img src={s.media.url} alt="" />}
                  {s.media?.kind === 'video' && <video src={`${s.media.url}#t=0.1`} muted playsInline preload="metadata" />}
                  {!s.media && <div className="txtonly">{s.title}</div>}
                  <div className="shade" />
                  {s.media && <div className="t">{s.title}</div>}
                  <div className="life"><i style={{ width: `${left * 100}%` }} /></div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {data.drops.length > 0 && (
        <section className="section" aria-label="Le Labo">
          <div className="section-head"><h2 className="display h3">Au Labo</h2><Link to="/labo" className="mono uv">Tout voir →</Link></div>
          {data.drops.slice(0, 2).map((d) => (
            <Link to={`/labo/${d.id}`} key={d.id} className="panel row between" style={{ borderColor: 'rgba(141,107,255,.35)', marginTop: 8 }}>
              <div>
                <div className="row" style={{ gap: 6 }}><span className="tag uv">{d.state === 'open' ? 'Ouvert' : 'Bientôt'}</span><DemoTag on={d.is_demo} /></div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>{d.title}</div>
              </div>
              <span className="uv">{d.state === 'open' ? <Icon name="play" fill /> : <Countdown to={d.opens_at} compact />}</span>
            </Link>
          ))}
        </section>
      )}

      {data.challenge && (
        <Link to={`/cercles/defi/${data.challenge.id}`} className="panel" style={{ display: 'block', marginTop: 24, borderColor: 'rgba(53,217,184,.35)' }}>
          <div className="row" style={{ gap: 6 }}><span className="tag canal">Défi en cours</span><DemoTag on={data.challenge.is_demo} /></div>
          <div className="display h3" style={{ marginTop: 10 }}>{data.challenge.title}</div>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>{data.challenge.brief}</p>
        </Link>
      )}

      <section className="section" aria-label="Fil officiel">
        <div className="section-head">
          <h2 className="display h3">Le fil officiel</h2>
          <Link to="/qg/archives" className="mono sodium">Archives →</Link>
        </div>
        {nothing && <Empty title="Rien sur les ondes pour l'instant">Les actus, sorties et coulisses d'Ifa arrivent ici dès que l'équipe publie.</Empty>}
        {data.pinned.map((p) => <PostCard key={p.id} post={p} lead />)}
        {data.feed.map((p, i) => <PostCard key={p.id} post={p} lead={i === 0 && !data.pinned.length} />)}
      </section>

      {data.featured.length > 0 && (
        <section className="section" aria-label="Sélection des fans">
          <div className="section-head"><h2 className="display h3">Sélection de l'équipe</h2><Link to="/cercles" className="mono sodium">Les Cercles →</Link></div>
          <div className="fan-grid">
            {data.featured.map((f) => (
              <Link key={f.id} to={`/cercles/creation/${f.id}`} className="fan-tile">
                {f.media.kind === 'image' ? <img src={f.media.url} alt="" loading="lazy" /> : <video src={`${f.media.url}#t=0.1`} muted playsInline preload="metadata" />}
                <span className="who">@{f.author.handle}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!user && (
        <section className="section panel stack" style={{ '--s': '10px' }}>
          <span className="mono sodium">Rejoins la fréquence</span>
          <h2 className="display h3">Avant-premières, votes, défis</h2>
          <p className="muted" style={{ margin: 0 }}>Un compte gratuit pour accéder au Labo et participer aux Cercles.</p>
          <Link to="/bienvenue" className="btn">Créer mon compte</Link>
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
      <Link to="/" className="mono muted row" style={{ gap: 4, marginBottom: 16 }}><Icon name="back" size={14} /> QG</Link>
      <div className="post-meta">
        <KindTag kind={p.kind} official={p.author?.official} />
        <DemoTag on={p.is_demo} />
      </div>
      <h1 className="display h2" style={{ margin: '14px 0 12px' }}>{p.title}</h1>
      <div className="row between wrap" style={{ marginBottom: 16 }}>
        <SourceLine source={p.source} date={p.published_at} />
        {p.author && <span className="mono muted">par @{p.author.handle}</span>}
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
      <span className="mono sodium">Historique</span>
      <h1 className="display h1" style={{ margin: '8px 0 16px' }}>Archives</h1>
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
