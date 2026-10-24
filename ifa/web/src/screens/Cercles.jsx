import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLoad } from '../lib/hooks.js';
import { api, view } from '../lib/api.js';
import { sendWithFile } from '../lib/upload.js';
import { useSession } from '../lib/session.jsx';
import { Avatar, Comments, DemoTag, Empty, ErrorBox, Icon, Loading, MediaView, Reactions, ReportSheet, useRequireAccount, useToast } from '../components/ui.jsx';
import { ago, dateLong } from '../lib/format.js';

function FanGrid({ items }) {
  if (!items.length) return <Empty title="Pas encore de créations">Les créations validées par les modérateurs s'affichent ici.</Empty>;
  return (
    <div className="fan-grid">
      {items.map((f) => (
        <Link key={f.id} to={`/cercles/creation/${f.id}`} className="fan-tile">
          {f.media.kind === 'image' ? <img src={f.media.url} alt={f.caption || ''} loading="lazy" /> : <video src={`${f.media.url}#t=0.1`} muted playsInline preload="metadata" />}
          {f.is_featured && <span className="tag sodium star">★ Sélection</span>}
          <span className="who"><Avatar style={f.author.avatar_style} size={20} />@{f.author.handle}</span>
        </Link>
      ))}
    </div>
  );
}

export function Cercles() {
  const circles = useLoad('/api/circles');
  const challenges = useLoad('/api/challenges');
  const feed = useLoad('/api/fan-posts');
  const need = useRequireAccount();
  const nav = useNavigate();
  const open = (challenges.data || []).filter((c) => c.state === 'open');
  return (
    <div className="page">
      <span className="mono" style={{ color: 'var(--canal)' }}>04 · La communauté</span>
      <h1 className="display h1" style={{ margin: '8px 0 10px' }}>Les<br />Cercles</h1>
      <p className="lede muted">Ici on crée, on relève les défis, on se retrouve autour des sorties. Pas de classement, pas de course aux abonnés : l'équipe met en avant les créations, pas les chiffres.</p>

      {open.length > 0 && (
        <section className="section">
          <div className="section-head"><h2 className="display h3">Défis ouverts</h2></div>
          {open.map((c) => (
            <Link key={c.id} to={`/cercles/defi/${c.id}`} className="panel" style={{ display: 'block', marginTop: 8, borderColor: 'rgba(53,217,184,.35)' }}>
              <div className="row between"><div className="row" style={{ gap: 6 }}><span className="tag canal">Défi</span><DemoTag on={c.is_demo} /></div>{c.ends_at && <span className="mono muted">jusqu'au {dateLong(c.ends_at).replace(/^\w+ /, '')}</span>}</div>
              <div className="display h3" style={{ marginTop: 10 }}>{c.title}</div>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>{c.brief}</p>
              <span className="mono dim">{c.entries} participation{c.entries > 1 ? 's' : ''} validée{c.entries > 1 ? 's' : ''}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="section">
        <div className="section-head"><h2 className="display h3">Cercles</h2></div>
        {circles.loading && <Loading h={140} />}
        {circles.data?.length === 0 && <Empty title="Aucun cercle ouvert">L'équipe ouvrira les premiers cercles bientôt.</Empty>}
        {circles.data?.map((c) => (
          <Link key={c.id} to={`/cercles/${c.slug}`} className="circle-card">
            <span className={`ring ${c.kind === 'release_room' ? 'temp' : ''}`}>{c.name[0]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ gap: 6 }}><b>{c.name}</b>{c.joined && <span className="tag canal">Membre</span>}</div>
              <div className="muted" style={{ fontSize: 14 }}>{c.description}</div>
              <span className="mono dim">{c.members} membre{c.members > 1 ? 's' : ''}{c.kind === 'release_room' && c.ends_at ? ` · salle temporaire, ferme ${ago(c.ends_at)}` : ''}</span>
            </div>
          </Link>
        ))}
      </section>

      <section className="section">
        <div className="section-head"><h2 className="display h3">Créations</h2></div>
        {feed.loading ? <Loading /> : feed.error ? <ErrorBox error={feed.error} /> : <FanGrid items={feed.data} />}
      </section>

      <button className="fab" onClick={() => need('publier') && nav('/cercles/publier')}><Icon name="plus" /> Publier</button>
    </div>
  );
}

export function Circle() {
  const { slug } = useParams();
  const { data, error, loading, setData } = useLoad(`/api/circles/${slug}`);
  const need = useRequireAccount();
  const toast = useToast();
  const nav = useNavigate();
  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  const c = data.circle;
  const toggle = async () => {
    if (!need('rejoindre un cercle')) return;
    try {
      const r = c.joined ? await api.del(`/api/circles/${slug}/join`) : await api.post(`/api/circles/${slug}/join`);
      setData((d) => ({ ...d, circle: { ...d.circle, joined: r.joined, members: d.circle.members + (r.joined ? 1 : -1) } }));
      toast(r.joined ? `Bienvenue dans ${c.name}` : 'Tu as quitté le cercle');
    } catch (e) { toast(e.message); }
  };
  return (
    <div className="page">
      <Link to="/cercles" className="mono muted row" style={{ gap: 4, marginBottom: 16 }}><Icon name="back" size={14} /> Cercles</Link>
      <span className={`ring ${c.kind === 'release_room' ? 'temp' : ''}`} style={{ width: 72, height: 72, fontSize: 30 }}>{c.name[0]}</span>
      <h1 className="display h2" style={{ margin: '14px 0 6px' }}>{c.name}</h1>
      <p className="muted">{c.description}</p>
      <p className="mono dim">{c.members} membre{c.members > 1 ? 's' : ''}{c.ends_at ? ` · ${c.ended ? 'fermé' : `ferme ${ago(c.ends_at)}`}` : ''}</p>
      {!c.ended && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className={`btn ${c.joined ? 'ghost' : ''}`} onClick={toggle}>{c.joined ? 'Quitter' : 'Rejoindre'}</button>
          {c.joined && <button className="btn ghost" onClick={() => nav(`/cercles/publier?cercle=${c.id}`)}>Publier ici</button>}
        </div>
      )}
      <section className="section"><FanGrid items={data.posts} /></section>
    </div>
  );
}

export function Challenge() {
  const { id } = useParams();
  const { data, error, loading } = useLoad(`/api/challenges/${id}`);
  const need = useRequireAccount();
  const nav = useNavigate();
  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  const c = data.challenge;
  return (
    <div className="page">
      <Link to="/cercles" className="mono muted row" style={{ gap: 4, marginBottom: 16 }}><Icon name="back" size={14} /> Cercles</Link>
      <div className="row" style={{ gap: 6 }}><span className="tag canal">Défi</span>{c.state === 'closed' && <span className="tag">Terminé</span>}<DemoTag on={c.is_demo} /></div>
      <h1 className="display h1" style={{ margin: '12px 0' }}>{c.title}</h1>
      {c.cover && <img src={c.cover.url} alt="" style={{ borderRadius: 18, marginBottom: 14 }} />}
      <p style={{ fontSize: 18 }}>{c.brief}</p>
      {c.rules && <div className="panel" style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}><span className="mono muted">Règles</span><br />{c.rules}</div>}
      <p className="mono dim" style={{ marginTop: 12 }}>{c.ends_at ? `Jusqu'au ${dateLong(c.ends_at)}` : 'Sans date de fin'} · Participer débloque un badge, pas de classement.</p>
      {c.state === 'open' && <button className="btn block" style={{ marginTop: 8 }} onClick={() => need('participer') && nav(`/cercles/publier?defi=${c.id}`)}>Je participe</button>}
      <section className="section"><div className="section-head"><h2 className="display h3">Participations</h2></div><FanGrid items={data.entries} /></section>
    </div>
  );
}

export function FanPost() {
  const { id } = useParams();
  const { data: p, error, loading } = useLoad(`/api/fan-posts/${id}`);
  const [report, setReport] = useState(null);
  useEffect(() => { if (p) view('fan_post', p.id); }, [p?.id]); // eslint-disable-line
  if (loading) return <div className="page"><Loading h={400} /></div>;
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  return (
    <div className="page">
      <Link to="/cercles" className="mono muted row" style={{ gap: 4, marginBottom: 16 }}><Icon name="back" size={14} /> Cercles</Link>
      <div className="row between">
        <Link to={`/u/${p.author.handle}`} className="row"><Avatar style={p.author.avatar_style} size={40} /><div><b>@{p.author.handle}</b><br /><span className="mono dim">{ago(p.created_at)}</span></div></Link>
        <button className="act" onClick={() => setReport({ type: 'fan_post', id: p.id })} aria-label="Signaler"><Icon name="flag" /></button>
      </div>
      <div style={{ marginTop: 14, borderRadius: 18, overflow: 'hidden', background: '#000' }}><MediaView media={p.media} /></div>
      {p.is_featured && <span className="tag sodium" style={{ marginTop: 12 }}>★ Mis en avant par l'équipe d'Ifa</span>}
      {p.caption && <p style={{ marginTop: 12, fontSize: 17 }}>{p.caption}</p>}
      <Reactions type="fan_post" item={p} onComment={() => document.getElementById('reactions')?.scrollIntoView({ behavior: 'smooth' })} />
      <div id="reactions" className="section" style={{ marginTop: 20 }}><Comments type="fan_post" id={p.id} /></div>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </div>
  );
}

// Parcours de publication d'une création : choix du fichier → aperçu →
// légende + destination → confirmation des droits → envoi en modération.
export function Publish() {
  const [params] = useSearchParams();
  const { user, config } = useSession();
  const circles = useLoad('/api/circles');
  const challenges = useLoad('/api/challenges');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [circleId, setCircleId] = useState(params.get('cercle') || '');
  const [challengeId, setChallengeId] = useState(params.get('defi') || '');
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  if (!user) return <div className="page"><Empty title="Connexion requise" action={<Link className="btn" to="/bienvenue">Me connecter</Link>}>Crée un compte pour publier.</Empty></div>;
  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) { setErr('Choisis une photo ou une vidéo'); return; }
    if (f.size > 80e6) { setErr('Fichier trop lourd (80 Mo max)'); return; }
    setErr(null); setFile(f); setPreview(URL.createObjectURL(f));
  };
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      setDone(await sendWithFile('/api/fan-posts', file, { caption, rights, circle_id: circleId || undefined, challenge_id: challengeId || undefined }, { config, user, purpose: 'fan' }));
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  if (done) {
    return (
      <div className="page stack">
        <span className="mono" style={{ color: 'var(--canal)' }}>Envoyé</span>
        <h1 className="display h1">C'est<br />reçu</h1>
        <p className="lede">{done.message}</p>
        <p className="muted">Tu seras prévenu dans tes Signaux. Suis l'état de tes créations dans ton espace.</p>
        <Link to="/moi" className="btn">Mes créations</Link>
        <Link to="/cercles" className="btn ghost">Retour aux Cercles</Link>
      </div>
    );
  }
  const myCircles = (circles.data || []).filter((c) => c.joined);
  const openChallenges = (challenges.data || []).filter((c) => c.state === 'open');
  return (
    <div className="page stack">
      <Link to="/cercles" className="mono muted row" style={{ gap: 4 }}><Icon name="back" size={14} /> Annuler</Link>
      <h1 className="display h2">Publier une création</h1>
      <label className="panel" style={{ display: 'block', cursor: 'pointer', textAlign: 'center', padding: preview ? 0 : 36, overflow: 'hidden' }}>
        <input type="file" accept="image/*,video/*" onChange={pick} className="sr" />
        {!preview && <><Icon name="plus" size={32} /><div className="display h4" style={{ marginTop: 10 }}>Photo ou vidéo</div><div className="muted" style={{ fontSize: 14 }}>Playback, reprise, montage, dessin… 80 Mo max</div></>}
        {preview && file?.type.startsWith('image') && <img src={preview} alt="Aperçu" style={{ width: '100%' }} />}
        {preview && file?.type.startsWith('video') && <video src={preview} controls playsInline style={{ width: '100%' }} />}
      </label>
      {preview && <button className="btn ghost sm" onClick={() => { setFile(null); setPreview(null); }}>Changer de fichier</button>}
      <label className="field"><span>Légende</span><textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} placeholder="Raconte ta création (pas de numéro, pas de pseudo d'une autre appli)" /></label>
      {openChallenges.length > 0 && (
        <label className="field"><span>Participer à un défi</span>
          <select value={challengeId} onChange={(e) => setChallengeId(e.target.value)}><option value="">Aucun</option>{openChallenges.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        </label>
      )}
      {myCircles.length > 0 && (
        <label className="field"><span>Publier dans un cercle</span>
          <select value={circleId} onChange={(e) => setCircleId(e.target.value)}><option value="">Fil général</option>{myCircles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
      )}
      <label className="check"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
        <span>C'est ma création. Les personnes visibles sont d'accord pour apparaître (et leurs parents si elles ont moins de 15 ans). J'autorise Fréquence et l'équipe d'Ifa à l'afficher dans l'appli et à la mettre en avant, selon les <Link className="link" to="/legal/conditions">conditions de publication</Link>. Je peux la supprimer quand je veux.</span>
      </label>
      <p className="mono dim">Chaque création est vérifiée par un modérateur avant d'être visible.</p>
      {err && <p className="err">{err}</p>}
      <button className="btn block" disabled={!file || !rights || busy} onClick={send}>{busy ? 'Envoi…' : 'Envoyer en validation'}</button>
    </div>
  );
}

export function UserProfile() {
  const { handle } = useParams();
  const { data, error, loading, reload } = useLoad(`/api/u/${handle}`);
  const [report, setReport] = useState(null);
  const { user } = useSession();
  const toast = useToast();
  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  const u = data.user;
  const unblock = async () => { await api.del(`/api/blocks/${u.id}`); toast('Compte débloqué'); reload(); };
  return (
    <div className="page">
      <div className="row between">
        <Avatar style={u.avatar_style} handle={u.handle} size={84} official={u.is_official} />
        {user && user.id !== u.id && !u.is_official && <button className="act" onClick={() => setReport({ type: 'user', id: u.id, userId: u.id })} aria-label="Signaler ou bloquer"><Icon name="dots" /></button>}
      </div>
      <h1 className="display h2" style={{ margin: '14px 0 4px' }}>@{u.handle} {u.is_official && <span className="verified" title="Compte officiel vérifié">✓</span>}</h1>
      {u.display_name && <div style={{ fontWeight: 700 }}>{u.display_name}</div>}
      {u.staff && !u.is_official && <span className="tag">Équipe Fréquence</span>}
      {u.bio && <p className="muted" style={{ marginTop: 8 }}>{u.bio}</p>}
      <p className="mono dim">Membre depuis {new Date(u.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
      {data.blocked && <div className="panel row between" style={{ marginTop: 12 }}><span>Tu as bloqué ce compte.</span><button className="btn ghost sm" onClick={unblock}>Débloquer</button></div>}
      {data.badges.length > 0 && <section className="section"><h2 className="mono muted">Badges</h2><div className="badges">{data.badges.map((b) => <div key={b.code} className="badge" title={b.description}><span className="g">{b.glyph}</span><span className="n">{b.name}</span></div>)}</div></section>}
      <section className="section"><h2 className="mono muted">Créations</h2><FanGrid items={data.posts} /></section>
      <ReportSheet target={report} onClose={(b) => { setReport(null); if (b) reload(); }} />
    </div>
  );
}
