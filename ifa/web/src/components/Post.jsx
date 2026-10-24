import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MediaView, Reactions, SourceLine, KindTag, DemoTag, Icon } from './ui.jsx';
import { youtubeId } from '../lib/format.js';

export function PostCard({ post, lead = false }) {
  const nav = useNavigate();
  const hasMedia = post.media || youtubeId(post.source.url);
  const isVideo = post.media?.kind === 'video' || youtubeId(post.source.url);
  return (
    <article className={`post card ${lead ? 'lead' : ''}`}>
      <Link to={`/qg/${post.id}`} aria-label={post.title}>
        {hasMedia && (
          <div className={`post-media ${isVideo ? 'wide' : ''}`}>
            {post.media?.kind === 'image' && <img src={post.media.url} alt="" loading="lazy" />}
            {post.media?.kind === 'video' && <video src={`${post.media.url}#t=0.1`} preload="metadata" muted playsInline />}
            {!post.media && youtubeId(post.source.url) && <img src={`https://i.ytimg.com/vi/${youtubeId(post.source.url)}/hqdefault.jpg`} alt="" loading="lazy" />}
            {isVideo && <div className="play"><span><Icon name="play" fill /></span></div>}
          </div>
        )}
      </Link>
      <div className="card-pad" style={{ paddingTop: hasMedia ? 14 : 18 }}>
        <div className="post-meta">
          <KindTag kind={post.kind} official={post.author?.official} />
          {post.is_pinned && <span className="tag sodium">Épinglé</span>}
          <DemoTag on={post.is_demo} />
        </div>
        <Link to={`/qg/${post.id}`}><h3 className="post-title">{post.title}</h3></Link>
        {post.body && <p className="post-body">{post.body}</p>}
        <div className="row between" style={{ marginTop: 6 }}>
          <SourceLine source={post.source} date={post.published_at} />
          <Reactions type="post" item={post} compact onComment={() => nav(`/qg/${post.id}#reactions`)} />
        </div>
      </div>
    </article>
  );
}

// Visionneuse plein écran des ondes courtes (stories temporaires).
export function WaveViewer({ items, start, onClose }) {
  const [i, setI] = useState(start);
  const p = items[i];
  if (!p) return null;
  const next = () => (i < items.length - 1 ? setI(i + 1) : onClose());
  const prev = () => i > 0 && setI(i - 1);
  const left = p.expires_at ? Math.max(0, Math.round((new Date(p.expires_at) - Date.now()) / 3600e3)) : null;
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Ondes courtes">
      <div className="media">
        {p.media ? <MediaView media={p.media} autoPlay controls={false} /> : (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 32, background: 'radial-gradient(circle at 30% 20%, rgba(255,184,28,.35), transparent 60%), #111' }}>
            <h2 className="display h1" style={{ textAlign: 'center' }}>{p.title}</h2>
          </div>
        )}
      </div>
      <button className="tap-zone l" style={{ top: 0, bottom: 0, zIndex: 1 }} onClick={prev} aria-label="Précédente" />
      <button className="tap-zone r" style={{ top: 0, bottom: 0, zIndex: 1 }} onClick={next} aria-label="Suivante" />
      <div className="top">
        <div className="reel-bar" style={{ position: 'static', marginBottom: 12 }}>
          {items.map((x, k) => <i key={x.id} className={k === i ? 'on' : k < i ? 'done' : ''} />)}
        </div>
        <div className="row between">
          <div className="row">
            <span className="mono sodium">Onde courte</span>
            {left !== null && <span className="mono muted">disparaît dans {left} h</span>}
            <DemoTag on={p.is_demo} />
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="x" /></button>
        </div>
      </div>
      <div className="bottom">
        {p.media && <h2 className="post-title" style={{ fontSize: 30 }}>{p.title}</h2>}
        {p.body && <p>{p.body}</p>}
        <SourceLine source={p.source} date={p.published_at} />
      </div>
    </div>
  );
}
