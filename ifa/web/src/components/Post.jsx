import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MediaView, Reactions, SourceLine, DemoTag, Icon, Avatar } from './ui.jsx';
import { youtubeId, ago, KIND_LABEL, PLATFORM_LABEL } from '../lib/format.js';

// Une publication officielle présentée comme un post : qui, quand, d'où ça vient.
export function PostCard({ post, lead = false }) {
  const nav = useNavigate();
  const yt = youtubeId(post.source.url);
  const hasMedia = post.media || yt;
  const isVideo = post.media?.kind === 'video' || yt;
  const label = post.source.type === 'app' ? 'officiel' : post.source.type === 'integration' ? `importé de ${PLATFORM_LABEL[post.source.platform] || 'une plateforme'}` : `via ${PLATFORM_LABEL[post.source.platform] || 'un lien'}`;
  return (
    <article className={`post card ${lead ? 'lead' : ''}`}>
      <div className="post-head">
        <Avatar official size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="who">{post.author?.official ? 'ifa' : 'équipe ifa'} <span className="verified" title="Compte officiel">✓</span></div>
          <div className="meta">
            <span>{KIND_LABEL[post.kind]} · {ago(post.published_at)}</span>
            <>· {post.source.url ? <a href={post.source.url} target="_blank" rel="noopener noreferrer">{label} ↗</a> : <span>{label}</span>}</>
          </div>
        </div>
        {post.is_pinned && <span className="sticker orange" style={{ fontSize: 12 }}>épinglé</span>}
        <DemoTag on={post.is_demo} />
      </div>
      {hasMedia && (
        <Link to={`/qg/${post.id}`} aria-label={post.title}>
          <div className={`post-media ${isVideo ? 'wide' : ''}`}>
            {post.media?.kind === 'image' && <img src={post.media.url} alt="" loading="lazy" />}
            {post.media?.kind === 'video' && <video src={`${post.media.url}#t=0.1`} preload="metadata" muted playsInline />}
            {!post.media && yt && <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" loading="lazy" />}
            {isVideo && <div className="play"><span><Icon name="play" fill /></span></div>}
          </div>
        </Link>
      )}
      <div className="card-pad" style={{ paddingTop: hasMedia ? 6 : 0 }}>
        {hasMedia && <Reactions type="post" item={post} onComment={() => nav(`/qg/${post.id}#reactions`)} />}
        <Link to={`/qg/${post.id}`}><h3 className="post-title">{post.title}</h3></Link>
        {post.body && <p className="post-body">{post.body}</p>}
        {!hasMedia && <div style={{ marginTop: 6 }}><Reactions type="post" item={post} onComment={() => nav(`/qg/${post.id}#reactions`)} /></div>}
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
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 32, background: 'linear-gradient(160deg, #1A2350, #FF5A2B)' }}>
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
            <span style={{ fontWeight: 800 }}>ifa</span><span className="verified">✓</span>
            {left !== null && <span style={{ opacity: .75, fontSize: 13 }}>encore {left} h</span>}
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
