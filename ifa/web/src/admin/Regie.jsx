import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSession, canEdit, canModerate, isStaff } from '../lib/session.jsx';
import { useLoad } from '../lib/hooks.js';
import { api } from '../lib/api.js';
import { Icon, Loading, ErrorBox, useToast } from '../components/ui.jsx';
import { Head, fmt, Seg } from './kit.jsx';
import { Posts, Releases, Events, Drops, Community, Broadcasts, ArtistAdmin } from './Studio.jsx';

const REASON = { harassment: 'Harcèlement', hate: 'Haine', sexual: 'Sexuel', violence: 'Violence', spam: 'Spam', personal_info: 'Infos perso', copyright: 'Droits', minor_safety: 'Sécurité mineur', other: 'Autre' };

export function Regie() {
  const { user, loading } = useSession();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const ov = useLoad(user && isStaff(user) ? '/api/admin/overview' : null, [loc.pathname]);
  if (loading) return <div className="page"><Loading /></div>;
  if (!isStaff(user)) return <Navigate to="/" replace />;
  const c = ov.data?.counts;
  const nav = [
    ['Tableau de bord', '', true, null],
    ...(canEdit(user) ? [['grp', 'Publier'], ['Le QG (publications)', 'publications', true], ['Signaux (notifications)', 'signaux', true, c?.scheduled], ['Le Labo', 'labo', true], ['Sorties', 'sorties', true], ['Agenda', 'agenda', true], ['Défis & cercles', 'communaute', true]] : []),
    ['grp', 'Communauté'],
    ...(canModerate(user) ? [['Modération', 'moderation', true, (c?.pendingFan || 0) + (c?.openReports || 0)]] : []),
    ['Comptes', 'comptes', true],
    ...(canEdit(user) ? [['grp', 'Mesurer'], ['Statistiques', 'stats', true]] : []),
    ...(user.role === 'admin' ? [['grp', 'Réglages'], ['Profil officiel & intégrations', 'profil', true], ['Journal', 'journal', true]] : []),
  ];
  return (
    <div className="regie">
      <div className="regie-mobile-bar">
        <b className="brand-word">Régie</b>
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Menu"><Icon name="menu" /></button>
      </div>
      <aside className={`regie-nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="row between" style={{ padding: '0 12px 12px' }}>
          <div><div className="brand-word">Régie</div><span className="freq">Fréquence · équipe</span></div>
          {open && <button className="icon-btn" aria-label="Fermer"><Icon name="x" /></button>}
        </div>
        {nav.map(([a, b, , badge], i) => (a === 'grp'
          ? <div key={i} className="grp mono dim">{b}</div>
          : <NavLink key={b} to={`/regie/${b}`} end={b === ''} className={({ isActive }) => (isActive ? 'active' : '')}>{a}{badge ? <span className="tag sodium">{badge}</span> : null}</NavLink>))}
        <div className="grp mono dim">Compte</div>
        <Link to="/">← Retour à l'appli</Link>
        <div className="mono dim" style={{ padding: '10px 12px' }}>@{user.handle} · {user.role}</div>
      </aside>
      <main className="regie-main">
        <Routes>
          <Route index element={<Overview ov={ov} />} />
          <Route path="publications" element={<Posts />} />
          <Route path="signaux" element={<Broadcasts />} />
          <Route path="labo" element={<Drops />} />
          <Route path="sorties" element={<Releases />} />
          <Route path="agenda" element={<Events />} />
          <Route path="communaute" element={<Community />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="comptes" element={<Users />} />
          <Route path="stats" element={<Stats />} />
          <Route path="profil" element={<ArtistAdmin />} />
          <Route path="journal" element={<Audit />} />
        </Routes>
      </main>
    </div>
  );
}

function Overview({ ov }) {
  const { user } = useSession();
  if (ov.loading && !ov.data) return <Loading />;
  if (ov.error) return <ErrorBox error={ov.error} />;
  const { counts: c, services: s } = ov.data;
  return (
    <>
      <Head eyebrow={`Bonjour @${user.handle}`} title="Tableau de bord">Ce qui demande ton attention aujourd'hui, puis les raccourcis.</Head>
      <div className="kpis">
        {canModerate(user) && <Link to="/regie/moderation" className={`kpi ${c.pendingFan ? 'alert' : ''}`}><span className="mono muted">Créations à valider</span><b>{c.pendingFan}</b></Link>}
        {canModerate(user) && <Link to="/regie/moderation" className={`kpi ${c.openReports ? 'alert' : ''}`}><span className="mono muted">Signalements ouverts</span><b>{c.openReports}</b></Link>}
        <div className="kpi"><span className="mono muted">Actifs aujourd'hui</span><b>{c.active1}</b></div>
        <div className="kpi"><span className="mono muted">Actifs 7 jours</span><b>{c.active7}</b></div>
        <div className="kpi"><span className="mono muted">Comptes</span><b>{c.users}</b><span className="mono dim">+{c.newUsers7} cette semaine</span></div>
        <div className="kpi"><span className="mono muted">Abonnés push</span><b>{c.pushSubs}</b></div>
        <div className="kpi"><span className="mono muted">En attente parent</span><b>{c.pendingParents}</b></div>
        {canEdit(user) && <Link to="/regie/signaux" className="kpi"><span className="mono muted">Signaux programmés</span><b>{c.scheduled}</b></Link>}
      </div>
      {canEdit(user) && (
        <section className="section">
          <h2 className="display h4" style={{ marginBottom: 12 }}>Publier en un geste</h2>
          <div className="row wrap">
            <Link to="/regie/publications?nouveau=announcement" className="btn">Annonce</Link>
            <Link to="/regie/publications?nouveau=story" className="btn ghost">Onde courte (24 h)</Link>
            <Link to="/regie/publications?nouveau=clip" className="btn ghost">Clip / vidéo</Link>
            <Link to="/regie/labo?nouveau=1" className="btn uv">Avant-première</Link>
            <Link to="/regie/agenda?nouveau=1" className="btn ghost">Date</Link>
            <Link to="/regie/signaux?nouveau=1" className="btn ghost">Signal</Link>
          </div>
        </section>
      )}
      <section className="section panel">
        <h2 className="mono muted" style={{ marginTop: 0 }}>Services connectés</h2>
        {[
          ['Notifications push web', s.push, 'Clés VAPID à générer (npm run vapid) et à ajouter aux variables d\'environnement.'],
          ['E-mails (accord parental)', s.mail, 'Variable SMTP_URL à configurer. Sans elle, les comptes de moins de 15 ans restent en attente.'],
          ['Import YouTube', s.youtube, 'YOUTUBE_API_KEY + YOUTUBE_CHANNEL_ID (chaîne officielle confirmée par l\'équipe).'],
          ['Import Instagram', s.instagram, 'Jeton de l\'API Instagram du compte professionnel d\'Ifa (INSTAGRAM_ACCESS_TOKEN).'],
          ['TikTok', s.tiktok, 'Nécessite une app TikTok for Developers validée et la connexion du compte d\'Ifa. En attendant : ajout manuel avec lien.'],
          ['Snapchat', s.snapchat, 'Pas d\'API publique de lecture des stories : ajout manuel avec lien vers l\'original.'],
        ].map(([n, ok, help]) => (
          <div key={n} className="setting"><div><div><span className={`status-dot ${ok ? 'ok' : 'off'}`} />{n}</div>{!ok && <div className="muted" style={{ fontSize: 13 }}>{help}</div>}</div><span className={`tag ${ok ? 'canal' : ''}`}>{ok ? 'Actif' : 'Non configuré'}</span></div>
        ))}
      </section>
    </>
  );
}

function Moderation() {
  const { data, error, loading, reload } = useLoad('/api/admin/moderation');
  const [notes, setNotes] = useState({});
  const { user } = useSession();
  const toast = useToast();
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const decide = async (id, decision) => {
    try { await api.post(`/api/admin/fan-posts/${id}/decision`, { decision, note: notes[id] }); toast(decision === 'approve' ? 'Publié' : 'Refusé, motif envoyé'); reload(); }
    catch (e) { toast(e.message); }
  };
  const resolve = async (r, action) => {
    try { await api.post('/api/admin/reports/resolve', { target_type: r.target_type, target_id: r.target_id, action }); toast('Traité'); reload(); }
    catch (e) { toast(e.message); }
  };
  const feature = async (id) => { try { await api.post(`/api/admin/fan-posts/${id}/feature`, { on: true }); toast('Mis en avant'); } catch (e) { toast(e.message); } };
  return (
    <>
      <Head eyebrow="Communauté" title="Modération">Rien n'est publié sans validation. En cas de refus, le motif est montré à l'auteur : reste bienveillant et précis.</Head>
      <h2 className="display h4">Créations à valider ({data.pending.length})</h2>
      {data.pending.length === 0 && <p className="muted">Tout est à jour.</p>}
      {data.pending.map((p) => (
        <div key={p.id} className="mod-item" style={{ marginTop: 10 }}>
          <div className="thumb">{p.media.kind === 'image' ? <img src={p.media.url} alt="" /> : <video src={p.media.url} controls playsInline />}</div>
          <div className="stack" style={{ '--s': '8px' }}>
            <div className="row wrap" style={{ gap: 6 }}>
              <b>@{p.handle}</b><span className="mono dim">compte créé {fmt(p.author_since)}</span>
              {p.author_rejections > 0 && <span className="tag brique">{p.author_rejections} refus passés</span>}
              {p.challenge_title && <span className="tag canal">Défi : {p.challenge_title}</span>}
              {p.circle_name && <span className="tag">Cercle : {p.circle_name}</span>}
            </div>
            <div>{p.caption || <span className="dim">Sans légende</span>}</div>
            <span className="mono dim">Reçu {fmt(p.created_at)} · droits confirmés par l'auteur</span>
            <input className="input" placeholder="Motif si refus (visible par l'auteur)" value={notes[p.id] || ''} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
            <div className="row wrap">
              <button className="btn sm" onClick={() => decide(p.id, 'approve')}>Publier</button>
              <button className="btn danger sm" onClick={() => decide(p.id, 'reject')}>Refuser</button>
            </div>
          </div>
        </div>
      ))}
      <h2 className="display h4" style={{ marginTop: 36 }}>Signalements ({data.reports.length})</h2>
      {data.reports.length === 0 && <p className="muted">Aucun signalement ouvert.</p>}
      {data.reports.map((r) => (
        <div key={r.target_type + r.target_id} className="panel" style={{ marginTop: 10 }}>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="tag brique">{r.count} signalement{r.count > 1 ? 's' : ''}</span>
            <span className="tag">{{ comment: 'Commentaire', fan_post: 'Création', user: 'Compte', post: 'Publication officielle' }[r.target_type]}</span>
            {r.reasons.map((x) => <span key={x} className="tag">{REASON[x]}</span>)}
            <span className="mono dim">{fmt(r.last_at)}</span>
          </div>
          {r.preview ? (
            <div style={{ margin: '10px 0' }}>
              {r.preview.handle && <b>@{r.preview.handle} </b>}
              {r.preview.status && <span className="mono dim">[{r.preview.status}] </span>}
              <span>{r.preview.body}</span>
              {r.preview.media_id && <div style={{ width: 120, marginTop: 8 }}>{r.preview.media_kind === 'image' ? <img src={`/api/media/${r.preview.media_id}`} alt="" style={{ borderRadius: 8 }} /> : <video src={`/api/media/${r.preview.media_id}`} controls style={{ borderRadius: 8 }} />}</div>}
            </div>
          ) : <p className="dim">Contenu déjà supprimé.</p>}
          {r.details?.length > 0 && <ul className="muted" style={{ fontSize: 14 }}>{r.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
          <div className="row wrap">
            <button className="btn ghost sm" onClick={() => resolve(r, 'dismiss')}>Rien à signaler</button>
            {r.target_type === 'comment' && r.preview?.status === 'hidden' && <button className="btn ghost sm" onClick={() => resolve(r, 'restore')}>Rétablir</button>}
            {['comment', 'fan_post'].includes(r.target_type) && <button className="btn sm" onClick={() => resolve(r, 'remove')}>Retirer le contenu</button>}
            {r.target_type !== 'post' && <button className="btn danger sm" onClick={() => resolve(r, 'suspend')}>Retirer + suspendre le compte</button>}
            {r.target_type === 'post' && <Link className="btn ghost sm" to="/regie/publications">Voir les publications</Link>}
          </div>
        </div>
      ))}
      {data.hidden.length > 0 && (
        <>
          <h2 className="display h4" style={{ marginTop: 36 }}>Commentaires masqués automatiquement</h2>
          {data.hidden.map((c) => <div key={c.id} className="setting"><span><b>@{c.handle}</b> {c.body}</span></div>)}
        </>
      )}
      {canEdit(user) && (
        <>
          <h2 className="display h4" style={{ marginTop: 36 }}>Mettre en avant</h2>
          <FeaturePicker onFeature={feature} />
        </>
      )}
    </>
  );
}

function FeaturePicker({ onFeature }) {
  const { data } = useLoad('/api/fan-posts');
  if (!data) return null;
  return (
    <div className="fan-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
      {data.map((f) => (
        <div key={f.id} className="fan-tile">
          {f.media.kind === 'image' ? <img src={f.media.url} alt="" /> : <video src={`${f.media.url}#t=0.1`} muted />}
          <span className="who">@{f.author.handle}</span>
          {f.is_featured ? <span className="tag sodium star">★</span> : <button className="btn sm star" style={{ position: 'absolute', top: 8, left: 8 }} onClick={() => onFeature(f.id)}>★ Mettre en avant</button>}
        </div>
      ))}
    </div>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data, reload } = useLoad(`/api/admin/users?${new URLSearchParams({ ...(q && { q }), ...(status && { status }) })}`, [q, status]);
  const { user } = useSession();
  const toast = useToast();
  const patch = async (id, body) => { try { await api.patch(`/api/admin/users/${id}`, body); toast('Mis à jour'); reload(); } catch (e) { toast(e.message); } };
  return (
    <>
      <Head eyebrow="Communauté" title="Comptes">L'âge exact et l'e-mail ne sont pas affichés aux modérateurs : seule la tranche d'âge l'est.</Head>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Rechercher un pseudo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Seg value={status} onChange={setStatus} options={[['', 'Tous'], ['active', 'Actifs'], ['pending_parent', 'Attente parent'], ['suspended', 'Suspendus']]} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Pseudo</th><th>Âge</th><th>Rôle</th><th>Statut</th><th>Créations</th><th>Signalé</th><th /></tr></thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id}>
                <td><b>@{u.handle}</b>{u.is_official && <span className="verified" style={{ marginLeft: 6 }}>✓</span>}{u.email && <div className="mono dim">{u.email}</div>}</td>
                <td><span className={`tag ${u.age_band !== '18+' ? 'sodium' : ''}`}>{u.age_band}</span></td>
                <td>{user.role === 'admin' && u.id !== user.id ? (
                  <select className="input" style={{ minHeight: 36, padding: '4px 8px' }} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                    {['fan', 'moderator', 'editor', 'admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>) : u.role}</td>
                <td>{u.status === 'pending_parent' ? 'attente parent' : u.status === 'suspended' ? <span className="tag brique">suspendu</span> : 'actif'}</td>
                <td>{u.creations}</td>
                <td>{u.open_reports ? <span className="tag brique">{u.open_reports}</span> : '—'}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {u.id !== user.id && u.status === 'active' && <button className="btn danger sm" onClick={() => patch(u.id, { status: 'suspended' })}>Suspendre</button>}
                    {u.status === 'suspended' && <button className="btn ghost sm" onClick={() => patch(u.id, { status: 'active' })}>Réactiver</button>}
                    {user.role === 'admin' && u.id !== user.id && <button className="btn ghost sm" onClick={() => patch(u.id, { is_official: !u.is_official })}>{u.is_official ? 'Retirer ✓' : 'Vérifier ✓'}</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Spark({ data, k }) {
  const max = Math.max(1, ...data.map((d) => d[k]));
  return <div className="spark">{data.map((d) => <i key={d.day} title={`${d.day} : ${d[k]}`} style={{ height: `${(d[k] / max) * 100}%` }} />)}</div>;
}

function Stats() {
  const { data, loading, error } = useLoad('/api/admin/stats');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return (
    <>
      <Head eyebrow="Mesurer" title="Statistiques">Mesures agrégées, sans profil individuel ni traceur tiers. Elles disent ce qui intéresse la communauté, pas qui fait quoi.</Head>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="panel"><span className="mono muted">Personnes actives par jour · 30 j</span><Spark data={data.daily} k="active" /></div>
        <div className="panel"><span className="mono muted">Inscriptions par jour · 30 j</span><Spark data={data.signups} k="n" /></div>
      </div>
      <section className="section">
        <h2 className="display h4">Contenus les plus vus (30 j)</h2>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Contenu</th><th>Type</th><th>Vues</th><th>J'aime</th><th>Favoris</th><th>Commentaires</th></tr></thead>
          <tbody>{data.top.map((p) => <tr key={p.id}><td>{p.title}</td><td>{p.kind}</td><td>{p.views}</td><td>{p.likes}</td><td>{p.saves}</td><td>{p.comments}</td></tr>)}</tbody>
        </table></div>
      </section>
      <div className="grid2 section" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="panel"><span className="mono muted">Vues par format</span>{data.byKind.map((k) => <div key={k.kind} className="setting"><span>{k.kind}</span><span className="mono">{k.views} vues · {k.posts} publi.</span></div>)}</div>
        <div className="panel"><span className="mono muted">Tranches d'âge (comptes actifs)</span>{data.ages.map((a) => <div key={a.band} className="setting"><span>{a.band}</span><span className="mono">{a.n}</span></div>)}</div>
        <div className="panel"><span className="mono muted">Derniers signaux envoyés</span>{data.broadcasts.map((b) => <div key={b.id} className="setting"><span>{b.title}</span><span className="mono dim">{b.stats?.inapp ?? 0} reçus · {b.stats?.push_sent ?? 0} push</span></div>)}</div>
        <div className="panel"><span className="mono muted">Votes du Labo</span>{data.votes.map((v) => <div key={v.title} className="setting"><span>{v.title}</span><span className="mono">{v.votes}</span></div>)}</div>
      </div>
    </>
  );
}

function Audit() {
  const { data } = useLoad('/api/admin/audit');
  return (
    <>
      <Head eyebrow="Réglages" title="Journal">Toutes les actions de l'équipe sont tracées : publication, modération, changement de rôle.</Head>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Quand</th><th>Qui</th><th>Action</th><th>Cible</th></tr></thead>
        <tbody>{data?.map((a) => <tr key={a.id}><td className="mono">{fmt(a.created_at)}</td><td>{a.handle ? `@${a.handle}` : 'système'}</td><td>{a.action}</td><td className="mono dim">{a.target_type} {a.target_id?.slice(0, 8)}</td></tr>)}</tbody>
      </table></div>
    </>
  );
}
