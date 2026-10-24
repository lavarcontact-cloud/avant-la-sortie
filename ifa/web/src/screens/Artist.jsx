import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLoad } from '../lib/hooks.js';
import { DemoTag, Empty, ErrorBox, Icon, Loading } from '../components/ui.jsx';

function Gallery({ photos, name }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      <div className="gallery">
        {photos.map((p, i) => (
          <button key={p.id} className="gallery-item" onClick={() => setOpen(i)} aria-label={`Photo ${i + 1} sur ${photos.length}`}>
            <img src={p.url} alt={`${name}, photo officielle ${i + 1}`} loading="lazy" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="Photos officielles">
          <div className="media"><img src={photos[open].url} alt={`${name}, photo officielle ${open + 1}`} /></div>
          <button className="tap-zone l" style={{ top: 0, bottom: 0, zIndex: 1 }} onClick={() => setOpen(Math.max(0, open - 1))} aria-label="Précédente" />
          <button className="tap-zone r" style={{ top: 0, bottom: 0, zIndex: 1 }} onClick={() => (open < photos.length - 1 ? setOpen(open + 1) : setOpen(null))} aria-label="Suivante" />
          <div className="top">
            <div className="reel-bar" style={{ position: 'static', marginBottom: 12 }}>{photos.map((x, k) => <i key={x.id} className={k === open ? 'on' : k < open ? 'done' : ''} />)}</div>
            <div className="row between"><span className="mono sodium">Photos officielles</span><button className="icon-btn" onClick={() => setOpen(null)} aria-label="Fermer"><Icon name="x" /></button></div>
          </div>
        </div>
      )}
    </>
  );
}
import { PostCard } from '../components/Post.jsx';
import { dayParts, time, EVENT_KIND, RELEASE_KIND, PLATFORM_LABEL } from '../lib/format.js';

const LINK_ORDER = ['spotify', 'apple_music', 'deezer', 'youtube', 'soundcloud', 'instagram', 'tiktok', 'snapchat', 'x', 'website', 'booking'];

function EventRow({ e }) {
  const d = dayParts(e.starts_at);
  return (
    <div className="ev-row">
      <div className="ev-date"><b>{d.day}</b><span>{d.month}</span></div>
      <div>
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="mono muted">{EVENT_KIND[e.kind]}</span>
          {e.status === 'postponed' && <span className="tag sodium">Reporté</span>}
          {e.status === 'cancelled' && <span className="tag brique">Annulé</span>}
          <DemoTag on={e.is_demo} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 17, textDecoration: e.status === 'cancelled' ? 'line-through' : 'none' }}>{e.title}</div>
        <div className="muted" style={{ fontSize: 14 }}>{[e.venue, e.city].filter(Boolean).join(' · ')} · {time(e.starts_at)}{e.age_policy ? ` · ${e.age_policy}` : ''}</div>
      </div>
      {e.ticket_url && e.status === 'confirmed' ? <a href={e.ticket_url} target="_blank" rel="noopener noreferrer" className="btn sm">Billets</a> : <span />}
    </div>
  );
}

export function Artist() {
  const { data, error, loading, reload } = useLoad('/api/artist');
  const { hash } = useLocation();
  useEffect(() => { if (data && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }); }, [data, hash]);
  if (loading) return <div className="page"><Loading h={500} /></div>;
  if (error) return <div className="page"><ErrorBox error={error} retry={reload} /></div>;
  const a = data.artist;
  const links = LINK_ORDER.filter((k) => a.links?.[k]);
  return (
    <div>
      <header className="artist-head">
        <div className={`bg ${a.banner ? '' : 'gen'}`}>{a.banner && <img src={a.banner.url} alt="" />}</div>
        <span className="mono sodium row" style={{ gap: 6 }}><span className="verified">✓</span> Profil officiel</span>
        <h1 className="display artist-name">{a.name}</h1>
        {a.tagline && <p style={{ fontSize: 18, fontWeight: 600, margin: '8px 0 0' }}>{a.tagline}</p>}
        <p className="mono muted" style={{ marginTop: 8, textTransform: "none" }}>Paris 19ᵉ</p>
      </header>
      <div className="page" style={{ paddingTop: 8 }}>
        {a.bio ? <p className="lede" style={{ whiteSpace: 'pre-wrap' }}>{a.bio}</p> : <p className="muted">La présentation officielle sera rédigée et validée par Ifa et son équipe.</p>}

        {a.gallery?.length > 0 && (
          <section className="section" id="photos">
            <div className="section-head"><h2 className="display h3">Photos</h2><span className="mono dim">officielles</span></div>
            <Gallery photos={a.gallery} name={a.name} />
          </section>
        )}

        <section className="section" id="ecouter">
          <div className="section-head"><h2 className="display h3">Écouter · Suivre</h2></div>
          {links.length ? (
            <div className="links">
              {links.map((k) => <a key={k} className="link-tile" href={a.links[k]} target="_blank" rel="noopener noreferrer">{PLATFORM_LABEL[k] || k}<Icon name="ext" size={16} /></a>)}
            </div>
          ) : <Empty title="Liens à venir">Seuls les comptes vérifiés par l'équipe d'Ifa seront affichés ici.</Empty>}
        </section>

        <section className="section" id="agenda">
          <div className="section-head"><h2 className="display h3">Agenda</h2><span className="mono dim">dates confirmées uniquement</span></div>
          {data.upcoming.length ? data.upcoming.map((e) => <EventRow key={e.id} e={e} />) : <Empty title="Pas de date annoncée">Les concerts, showcases et apparitions confirmés s'afficheront ici.</Empty>}
          {data.past.length > 0 && (
            <details style={{ marginTop: 14 }}>
              <summary className="mono muted" style={{ cursor: 'pointer' }}>Dates passées ({data.past.length})</summary>
              {data.past.map((e) => <EventRow key={e.id} e={e} />)}
            </details>
          )}
        </section>

        <section className="section" id="discographie">
          <div className="section-head"><h2 className="display h3">Discographie</h2></div>
          {data.releases.length ? (
            <div className="disc">
              {data.releases.map((r) => (
                <div key={r.id} className="disc-item">
                  <div className="disc-cover">{r.cover ? <img src={r.cover.url} alt={`Pochette ${r.title}`} loading="lazy" /> : <span className="display h3 dim">{r.title.slice(0, 2)}</span>}</div>
                  <div style={{ fontWeight: 800, marginTop: 8, lineHeight: 1.2 }}>{r.title}</div>
                  <div className="mono muted">{RELEASE_KIND[r.kind]}{r.release_date ? ` · ${new Date(r.release_date).getFullYear()}` : ''}</div>
                  <DemoTag on={r.is_demo} />
                  <div className="row wrap" style={{ gap: 4, marginTop: 6 }}>
                    {Object.entries(r.links || {}).map(([k, u]) => <a key={k} href={u} target="_blank" rel="noopener noreferrer" className="tag">{PLATFORM_LABEL[k] || k} ↗</a>)}
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty title="Discographie à compléter">Les sorties officielles seront ajoutées par l'équipe.</Empty>}
        </section>

        {data.videos.length > 0 && (
          <section className="section">
            <div className="section-head"><h2 className="display h3">Clips & vidéos</h2><Link to="/immersion?piste=clips" className="mono sodium">Immersion →</Link></div>
            {data.videos.slice(0, 4).map((p) => <PostCard key={p.id} post={p} />)}
          </section>
        )}

        {data.announcements.length > 0 && (
          <section className="section">
            <div className="section-head"><h2 className="display h3">Annonces de l'équipe</h2></div>
            {data.announcements.map((p) => <PostCard key={p.id} post={p} />)}
          </section>
        )}

        <section className="section panel">
          <span className="mono muted">Comptes officiels dans Fréquence</span>
          {data.team.length ? data.team.map((t) => <div key={t.handle} className="row" style={{ marginTop: 10 }}><span className="verified">✓</span><Link to={`/u/${t.handle}`}><b>@{t.handle}</b></Link></div>)
            : <p className="muted" style={{ margin: '8px 0 0' }}>Les comptes vérifiés d'Ifa et de son équipe porteront le badge ✓. Tout autre compte qui se présente comme Ifa est faux : signale-le.</p>}
        </section>
      </div>
    </div>
  );
}
