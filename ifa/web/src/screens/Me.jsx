import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad } from '../lib/hooks.js';
import { useSession, isStaff } from '../lib/session.jsx';
import { Avatar, Empty, Icon, Loading, Sheet, useToast } from '../components/ui.jsx';
import { pushSupport, enablePush, disablePush, currentSubscription, isIOS, isStandalone } from '../lib/push.js';
import { ago } from '../lib/format.js';

const COLORS = ['sodium', 'uv', 'canal', 'brique', 'craie'];
const GLYPHS = ['◉', '▲', '◆', '✚', '○', '■', '✦', '≋'];
const STATUS = { pending: ['En validation', ''], approved: ['En ligne', 'canal'], rejected: ['Non publiée', 'brique'], removed: ['Retirée', 'brique'] };

export function AvatarPicker({ value, onChange }) {
  const [c, g] = value.split(':');
  return (
    <div className="stack" style={{ '--s': '12px' }}>
      <div className="row" style={{ gap: 8 }}>
        {COLORS.map((x) => <button key={x} type="button" onClick={() => onChange(`${x}:${g}`)} className={`avatar av-${x}`} style={{ width: 36, height: 36, outline: x === c ? '2px solid var(--chalk)' : 'none', outlineOffset: 2 }} aria-label={`Couleur ${x}`} />)}
      </div>
      <div className="avatar-pick">
        {GLYPHS.map((x) => <button key={x} type="button" onClick={() => onChange(`${c}:${x}`)} className={`avatar av-${c} ${x === g ? 'on' : ''}`} aria-label={`Symbole ${x}`} style={{ fontSize: 24 }}>{x}</button>)}
      </div>
    </div>
  );
}

export function Me() {
  const { user, badges, logout, loading } = useSession();
  const mine = useLoad(user ? '/api/fan-posts/mine' : null);
  const saved = useLoad(user ? '/api/me/saved' : null);
  const [edit, setEdit] = useState(false);
  const nav = useNavigate();
  if (loading) return <div className="page"><Loading /></div>;
  if (!user) return <div className="page"><Empty title="Pas connecté" action={<Link className="btn" to="/bienvenue">Me connecter</Link>}>Connecte-toi pour retrouver ton espace.</Empty></div>;
  return (
    <div className="page">
      {user.status === 'pending_parent' && (
        <div className="panel" style={{ borderColor: 'rgba(255,184,28,.4)', marginBottom: 18 }}>
          <span className="mono sodium">En attente</span>
          <p style={{ margin: '6px 0 0' }}>On a envoyé un e-mail à ton parent. Tant qu'il n'a pas validé, tu peux tout regarder, mais pas encore publier, commenter ou voter.</p>
        </div>
      )}
      <div className="row between">
        <Avatar style={user.avatar_style} handle={user.handle} size={84} official={user.is_official} />
        <button className="btn ghost sm" onClick={() => setEdit(true)}>Modifier</button>
      </div>
      <h1 className="display h2" style={{ margin: '14px 0 4px' }}>@{user.handle}</h1>
      {user.display_name && <div style={{ fontWeight: 700 }}>{user.display_name}</div>}
      {user.bio && <p className="muted">{user.bio}</p>}
      {isStaff(user) && <Link to="/regie" className="btn uv block" style={{ marginTop: 14 }}>Ouvrir la régie (équipe)</Link>}

      <section className="section">
        <h2 className="mono muted">Badges</h2>
        {badges.length ? <div className="badges">{badges.map((b) => <div key={b.code} className="badge" title={b.description}><span className="g">{b.glyph}</span><span className="n">{b.name}</span><span className="mono dim" style={{ fontSize: 9 }}>{ago(b.awarded_at)}</span></div>)}</div>
          : <p className="muted">Participe aux défis, aux votes ou publie une création pour débloquer tes premiers badges.</p>}
      </section>

      <section className="section">
        <div className="section-head"><h2 className="mono muted" style={{ margin: 0 }}>Mes créations</h2><Link to="/cercles/publier" className="mono sodium">Publier →</Link></div>
        {mine.data?.length === 0 && <p className="muted">Aucune création pour l'instant.</p>}
        {mine.data?.map((p) => (
          <div key={p.id} className="setting">
            <div className="row" style={{ minWidth: 0 }}>
              <div style={{ width: 48, height: 64, borderRadius: 8, overflow: 'hidden', background: '#000', flex: 'none' }}>
                {p.media_kind === 'image' ? <img src={`/api/media/${p.media_id}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <video src={`/api/media/${p.media_id}#t=0.1`} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.caption || 'Sans légende'}</div>
                {p.moderation_note && <div className="muted" style={{ fontSize: 13 }}>Motif : {p.moderation_note}</div>}
                <span className="mono dim">{ago(p.created_at)}</span>
              </div>
            </div>
            <span className={`tag ${STATUS[p.status][1]}`}>{STATUS[p.status][0]}</span>
          </div>
        ))}
      </section>

      <section className="section">
        <h2 className="mono muted">Favoris</h2>
        {(saved.data?.posts.length || 0) + (saved.data?.fan_posts.length || 0) === 0 && <p className="muted">Garde des contenus avec <Icon name="save" size={14} /> pour les retrouver ici.</p>}
        {saved.data?.posts.map((p) => <Link key={p.id} to={`/qg/${p.id}`} className="setting"><b>{p.title}</b><Icon name="back" style={{ transform: 'rotate(180deg)' }} /></Link>)}
        {saved.data?.fan_posts.map((p) => <Link key={p.id} to={`/cercles/creation/${p.id}`} className="setting"><span>Création de @{p.author.handle}</span><Icon name="back" style={{ transform: 'rotate(180deg)' }} /></Link>)}
      </section>

      <section className="section panel">
        <Link to="/moi/signaux" className="setting"><span>Notifications et horaires</span><Icon name="back" style={{ transform: 'rotate(180deg)' }} /></Link>
        <Link to="/moi/confidentialite" className="setting"><span>Confidentialité, blocages, mes données</span><Icon name="back" style={{ transform: 'rotate(180deg)' }} /></Link>
        <Link to="/legal/charte" className="setting"><span>Charte de la communauté</span><Icon name="back" style={{ transform: 'rotate(180deg)' }} /></Link>
        <button className="setting" style={{ width: '100%' }} onClick={async () => { await logout(); nav('/'); }}><span>Me déconnecter</span><span /></button>
      </section>
      <EditProfile open={edit} onClose={() => setEdit(false)} />
    </div>
  );
}

function EditProfile({ open, onClose }) {
  const { user, refresh } = useSession();
  const [f, setF] = useState({ display_name: user?.display_name || '', bio: user?.bio || '', avatar_style: user?.avatar_style || 'sodium:◉' });
  const [err, setErr] = useState(null);
  const toast = useToast();
  const save = async () => {
    try { await api.patch('/api/me', f); await refresh(); toast('Profil mis à jour'); onClose(); } catch (e) { setErr(e.message); }
  };
  return (
    <Sheet open={open} onClose={onClose} label="Modifier mon profil">
      <div className="stack">
        <h2 className="display h3">Mon profil</h2>
        <div className="row"><Avatar style={f.avatar_style} size={64} /><span className="muted" style={{ fontSize: 14 }}>Pas de photo de profil sur Fréquence : chacun choisit son signal. Ça protège tout le monde.</span></div>
        <AvatarPicker value={f.avatar_style} onChange={(v) => setF({ ...f, avatar_style: v })} />
        <label className="field"><span>Nom affiché (facultatif)</span><input value={f.display_name} maxLength={40} onChange={(e) => setF({ ...f, display_name: e.target.value })} /><small>Évite ton nom de famille.</small></label>
        <label className="field"><span>Bio</span><textarea value={f.bio} maxLength={160} onChange={(e) => setF({ ...f, bio: e.target.value })} /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn block" onClick={save}>Enregistrer</button>
      </div>
    </Sheet>
  );
}

export function NotifSettings() {
  const { user, config, refresh } = useSession();
  const { data, setData } = useLoad(user ? '/api/notifications/prefs' : null);
  const [subscribed, setSubscribed] = useState(null);
  const [msg, setMsg] = useState(null);
  const toast = useToast();
  useEffect(() => { currentSubscription().then((s) => setSubscribed(Boolean(s))).catch(() => setSubscribed(false)); }, []);
  if (!user) return <div className="page"><Empty title="Connexion requise" /></div>;
  if (!data) return <div className="page"><Loading /></div>;
  const p = data.prefs;
  const save = async (patch) => {
    const next = { ...p, ...patch, categories: { ...p.categories, ...(patch.categories || {}) } };
    setData((d) => ({ ...d, prefs: next }));
    try { const r = await api.put('/api/notifications/prefs', next); setData((d) => ({ ...d, prefs: r.prefs })); refresh(); }
    catch (e) { toast(e.message); }
  };
  const support = pushSupport(config);
  const togglePush = async () => {
    setMsg(null);
    try {
      if (subscribed) { await disablePush(); setSubscribed(false); toast('Notifications push désactivées sur cet appareil'); }
      else { await enablePush(config); setSubscribed(true); toast('Notifications push activées sur cet appareil'); }
    } catch (e) { setMsg(e.message); }
  };
  const test = async () => {
    const r = await api.post('/api/push/test');
    setMsg(r.ok ? 'Signal de test envoyé : il doit apparaître dans quelques secondes.' : r.reason === 'no_subscription' ? 'Cet appareil n\'est pas abonné.' : 'Le push n\'est pas configuré sur le serveur.');
  };
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="page">
      <Link to="/moi" className="mono muted row" style={{ gap: 4, marginBottom: 16 }}><Icon name="back" size={14} /> Mon espace</Link>
      <h1 className="display h2">Signaux</h1>
      <p className="muted">Tu choisis ce qui t'arrive, et quand. Tout reste aussi dans ta boîte Signaux dans l'appli.</p>

      <section className="section panel">
        <h2 className="mono muted" style={{ marginTop: 0 }}>Notifications push sur cet appareil</h2>
        {support.ok ? (
          <div className="setting">
            <span>{subscribed ? 'Activées' : 'Désactivées'}</span>
            <label className="switch"><input type="checkbox" checked={Boolean(subscribed)} onChange={togglePush} aria-label="Notifications push" /><i /></label>
          </div>
        ) : <p style={{ margin: 0 }}>{support.text}</p>}
        {support.reason === 'ios-install' && <p className="muted" style={{ fontSize: 14 }}>Dans Safari : Partager ⬆︎ → « Sur l'écran d'accueil », puis ouvre Fréquence depuis l'icône.</p>}
        {subscribed && <button className="btn ghost sm" onClick={test}>Envoyer un signal de test</button>}
        {msg && <p className="muted" style={{ fontSize: 14, marginTop: 10 }}>{msg}</p>}
        <p className="mono dim" style={{ marginTop: 10 }}>{data.push.devices} appareil{data.push.devices > 1 ? 's' : ''} abonné{data.push.devices > 1 ? 's' : ''}</p>
      </section>

      <section className="section panel">
        <h2 className="mono muted" style={{ marginTop: 0 }}>Ce que je reçois</h2>
        {Object.entries(data.categories).map(([k, label]) => (
          <div className="setting" key={k}>
            <span>{label}</span>
            <label className="switch"><input type="checkbox" checked={p.categories[k]} onChange={(e) => save({ categories: { [k]: e.target.checked } })} aria-label={label} /><i /></label>
          </div>
        ))}
      </section>

      <section className="section panel">
        <h2 className="mono muted" style={{ marginTop: 0 }}>Fréquence des push</h2>
        <div className="seg">
          {[['all', 'Tout'], ['important', 'Important seulement'], ['off', 'Aucun push']].map(([k, l]) => <button key={k} className={p.frequency === k ? 'on' : ''} onClick={() => save({ frequency: k })}>{l}</button>)}
        </div>
        <div className="row" style={{ marginTop: 16, gap: 8 }}>
          <span>Heures calmes de</span>
          <select className="input" style={{ width: 90, minHeight: 40 }} value={p.quiet_start} onChange={(e) => save({ quiet_start: Number(e.target.value) })}>{hours.map((h) => <option key={h} value={h}>{h} h</option>)}</select>
          <span>à</span>
          <select className="input" style={{ width: 90, minHeight: 40 }} value={p.quiet_end} onChange={(e) => save({ quiet_end: Number(e.target.value) })}>{hours.map((h) => <option key={h} value={h}>{h} h</option>)}</select>
        </div>
        <p className="mono dim" style={{ marginTop: 8 }}>Aucun push pendant ces heures (heure de Paris). Les signaux t'attendent dans l'appli.</p>
      </section>

      <section className="section panel">
        <div className="setting">
          <div><div>Découverte personnalisée</div><div className="muted" style={{ fontSize: 13 }}>Dans Immersion, met en avant les formats que tu aimes. Désactivée : ordre chronologique.</div></div>
          <label className="switch"><input type="checkbox" checked={p.personalized} onChange={(e) => save({ personalized: e.target.checked })} aria-label="Découverte personnalisée" /><i /></label>
        </div>
      </section>
      {isIOS() && !isStandalone() && <p className="mono dim" style={{ marginTop: 16 }}>Astuce iPhone : installe l'appli pour recevoir les push.</p>}
    </div>
  );
}

export function Privacy() {
  const { user } = useSession();
  const blocks = useLoad(user ? '/api/blocks' : null);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState(null);
  const nav = useNavigate();
  const toast = useToast();
  if (!user) return <div className="page"><Empty title="Connexion requise" /></div>;
  const remove = async () => {
    try { await api.del('/api/me', { password: pw }); toast('Compte supprimé'); window.location.href = '/'; } catch (e) { setErr(e.message); }
  };
  return (
    <div className="page">
      <Link to="/moi" className="mono muted row" style={{ gap: 4, marginBottom: 16 }}><Icon name="back" size={14} /> Mon espace</Link>
      <h1 className="display h2">Confidentialité</h1>
      <section className="section panel">
        <h2 className="mono muted" style={{ marginTop: 0 }}>Ce que Fréquence sait de toi</h2>
        <p style={{ fontSize: 15 }}>Ton e-mail, ton pseudo, ton mois et ton année de naissance, et ce que tu fais dans l'appli (créations, commentaires, réactions, votes). Pas de nom, pas d'adresse, pas de localisation, pas de contacts, pas de pub ciblée.</p>
        <p style={{ fontSize: 15, margin: 0 }}>Il n'y a pas de messages privés sur Fréquence. Personne de l'équipe ne te demandera jamais ton numéro, une photo ou un rendez-vous en privé.</p>
        <Link to="/legal/confidentialite" className="link" style={{ display: 'inline-block', marginTop: 10 }}>Politique de confidentialité</Link>
      </section>
      <section className="section panel">
        <h2 className="mono muted" style={{ marginTop: 0 }}>Comptes bloqués</h2>
        {blocks.data?.length === 0 && <p className="muted" style={{ margin: 0 }}>Aucun.</p>}
        {blocks.data?.map((b) => (
          <div className="setting" key={b.id}><span>@{b.handle}</span><button className="btn ghost sm" onClick={async () => { await api.del(`/api/blocks/${b.id}`); blocks.reload(); }}>Débloquer</button></div>
        ))}
      </section>
      <PasswordChange />
      <section className="section panel stack" style={{ '--s': '10px' }}>
        <h2 className="mono muted" style={{ margin: 0 }}>Mes données</h2>
        <a className="btn ghost" href="/api/me/export" download>Télécharger mes données (JSON)</a>
        {!confirm ? <button className="btn danger" onClick={() => setConfirm(true)}>Supprimer mon compte</button> : (
          <>
            <p style={{ margin: 0 }}>La suppression est immédiate et définitive : profil, créations, commentaires, votes.</p>
            <label className="field"><span>Mot de passe</span><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
            {err && <p className="err">{err}</p>}
            <div className="row"><button className="btn danger" disabled={!pw} onClick={remove}>Supprimer définitivement</button><button className="btn ghost" onClick={() => { setConfirm(false); nav('/moi/confidentialite'); }}>Annuler</button></div>
          </>
        )}
      </section>
    </div>
  );
}

function PasswordChange() {
  const [f, setF] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setMsg(null);
    try { await api.put('/api/me/password', f); setF({ current: '', next: '' }); setMsg({ ok: true, text: 'Mot de passe changé. Tes autres appareils ont été déconnectés.' }); }
    catch (ex) { setMsg({ ok: false, text: ex.message }); }
  };
  return (
    <form className="section panel stack" style={{ '--s': '10px' }} onSubmit={save}>
      <h2 className="mono muted" style={{ margin: 0 }}>Mot de passe</h2>
      <label className="field"><span>Actuel</span><input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></label>
      <label className="field"><span>Nouveau (10 caractères minimum)</span><input type="password" autoComplete="new-password" minLength={10} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required /></label>
      {msg && <p className={msg.ok ? 'ok-msg' : 'err'}>{msg.text}</p>}
      <button className="btn ghost">Changer le mot de passe</button>
    </form>
  );
}
