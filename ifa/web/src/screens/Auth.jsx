import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad } from '../lib/hooks.js';
import { useSession } from '../lib/session.jsx';
import { Avatar, Icon, Loading, ErrorBox } from '../components/ui.jsx';
import { AvatarPicker } from './Me.jsx';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function ageFrom(y, m) {
  if (!y || !m) return null;
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m) a -= 1;
  return a;
}

// Parcours nouvel utilisateur : 1. l'univers  2. le compte  3. les signaux.
export function Welcome() {
  const { user, config, refresh } = useSession();
  const artist = useLoad('/api/artist');
  const photo = artist.data?.artist?.gallery?.[1]?.url || artist.data?.artist?.banner?.url;
  const loc = useLocation();
  const nav = useNavigate();
  const [step, setStep] = useState(user ? 2 : 0);
  const [mode, setMode] = useState('signup');
  const [f, setF] = useState({ email: '', password: '', handle: '', birth_year: '', birth_month: '', parent_email: '', avatar_style: 'sodium:◉', accept_terms: false });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cats, setCats] = useState({ drop: true, release: true, event: true, announcement: true, challenge: true, exclusive: true, news: true });
  const minAge = config?.minAge ?? 12;
  const parentAge = config?.parentalConsentAge ?? 15;
  const age = ageFrom(Number(f.birth_year), Number(f.birth_month));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const from = loc.state?.from || '/';

  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      if (mode === 'login') {
        await api.post('/api/auth/login', { email: f.email, password: f.password });
        await refresh(); nav(from, { replace: true });
      } else {
        await api.post('/api/auth/signup', { ...f, birth_year: Number(f.birth_year), birth_month: Number(f.birth_month) });
        await refresh(); setStep(2);
      }
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  const finish = async () => {
    if (user?.status === 'active') await api.put('/api/notifications/prefs', { categories: cats }).catch(() => {});
    await refresh(); nav(from, { replace: true });
  };
  const years = Array.from({ length: 70 }, (_, i) => new Date().getFullYear() - minAge + 1 - i);

  return (
    <div className={`onb ${step === 0 && photo ? 'on-photo' : ''}`}>
      {step === 0 && photo && <div className="onb-photo"><img src={photo} alt="" /></div>}
      <div className="row between">
        <div className="steps" style={{ width: 120 }}>{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
        <Link to="/" className="mono" style={{ color: 'inherit' }}>Passer</Link>
      </div>

      {step === 0 && (
        <>
          <div className="onb-art">
            <span className="sticker">l'appli officielle</span>
            <div className="big-freq" style={{ marginTop: 14 }}>Tout Ifa,<br /><em>avant</em> tout le monde</div>
            <p className="lede" style={{ marginTop: 14, opacity: .9 }}>Les news en premier, les sons en avant-première, les défis et la commu. Pas d'algo qui choisit à ta place.</p>
          </div>
          <div className="stack" style={{ '--s': '10px' }}>
            <button className="btn block" onClick={() => { setMode('signup'); setStep(1); }}>Créer mon compte</button>
            <button className="btn ghost block" onClick={() => { setMode('login'); setStep(1); }}>J'ai déjà un compte</button>
          </div>
        </>
      )}

      {step === 1 && (
        <form onSubmit={submit} className="stack" style={{ marginTop: 28 }}>
          <div className="seg"><button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Inscription</button><button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Connexion</button></div>
          <h1 className="display h2">{mode === 'signup' ? 'Crée ton compte' : 'Content de te revoir'}</h1>
          {mode === 'signup' && (
            <>
              <div className="row"><Avatar style={f.avatar_style} size={64} /><span className="muted" style={{ fontSize: 14 }}>Ton avatar, c'est un signal, pas une photo.</span></div>
              <AvatarPicker value={f.avatar_style} onChange={(v) => setF({ ...f, avatar_style: v })} />
              <label className="field"><span>Pseudo</span><input value={f.handle} onChange={set('handle')} required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_.]{3,24}" autoComplete="username" /><small>Pas ton vrai nom. Lettres, chiffres, _ et .</small></label>
              <div className="grid2">
                <label className="field"><span>Mois de naissance</span><select value={f.birth_month} onChange={set('birth_month')} required><option value="" />{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
                <label className="field"><span>Année</span><select value={f.birth_year} onChange={set('birth_year')} required><option value="" />{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
              </div>
              <small className="dim" style={{ marginTop: 6, display: 'block' }}>On ne demande pas le jour : juste de quoi appliquer les bonnes règles selon l'âge.</small>
              {age !== null && age < minAge && <p className="err">Fréquence est ouverte à partir de {minAge} ans.</p>}
              {age !== null && age >= minAge && age < parentAge && (
                <label className="field"><span>E-mail d'un parent</span><input type="email" value={f.parent_email} onChange={set('parent_email')} required />
                  <small>Tu as moins de {parentAge} ans : la loi demande l'accord d'un parent. On lui envoie un e-mail. En attendant, tu peux tout regarder.</small></label>
              )}
            </>
          )}
          <label className="field"><span>E-mail</span><input type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></label>
          <label className="field"><span>Mot de passe</span><input type="password" value={f.password} onChange={set('password')} required minLength={mode === 'signup' ? 8 : 1} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />{mode === 'signup' && <small>8 caractères minimum.</small>}</label>
          {mode === 'signup' && (
            <label className="check"><input type="checkbox" checked={f.accept_terms} onChange={set('accept_terms')} required />
              <span>J'accepte les <Link className="link" to="/legal/conditions" target="_blank">conditions</Link>, la <Link className="link" to="/legal/charte" target="_blank">charte de la communauté</Link> et j'ai lu la <Link className="link" to="/legal/confidentialite" target="_blank">politique de confidentialité</Link>.</span>
            </label>
          )}
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn block" disabled={busy || (mode === 'signup' && age !== null && age < minAge)}>{busy ? '…' : mode === 'signup' ? 'Créer mon compte' : 'Me connecter'}</button>
        </form>
      )}

      {step === 2 && user && (
        <div className="stack" style={{ marginTop: 28 }}>
          <span className="sticker">bienvenue @{user.handle}</span>
          <h1 className="display h2">Tu veux être prévenu de quoi ?</h1>
          {user.status === 'pending_parent' ? (
            <p className="lede">On a envoyé un e-mail à ton parent. Dès qu'il valide, tu pourras participer et recevoir les signaux. Tu peux déjà tout explorer.</p>
          ) : (
            <div className="panel">
              {[['drop', 'Extraits inédits du Labo'], ['release', 'Sorties (morceaux, clips)'], ['event', 'Dates confirmées'], ['challenge', 'Défis'], ['announcement', 'Annonces de l\'équipe']].map(([k, l]) => (
                <div className="setting" key={k}><span>{l}</span><label className="switch"><input type="checkbox" checked={cats[k]} onChange={(e) => setCats({ ...cats, [k]: e.target.checked })} aria-label={l} /><i /></label></div>
              ))}
            </div>
          )}
          <p className="muted" style={{ fontSize: 14 }}>Modifiable à tout moment dans Moi → Notifications. {user.is_minor && 'Pas de notification la nuit (21 h – 8 h) par défaut.'}</p>
          <button className="btn block" onClick={finish}>Entrer dans Fréquence <Icon name="back" style={{ transform: 'rotate(180deg)' }} /></button>
        </div>
      )}
    </div>
  );
}

// Page ouverte par le parent depuis l'e-mail.
export function ParentConsent() {
  const { token } = useParams();
  const { data, error, loading } = useLoad(`/api/parent/${token}`);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState(null);
  const decide = async (decision) => {
    try { setDone((await api.post(`/api/parent/${token}`, { decision })).status); } catch (e) { setErr(e.message); }
  };
  if (loading) return <div className="onb"><Loading /></div>;
  if (error) return <div className="onb"><ErrorBox error={error} /></div>;
  return (
    <div className="onb stack">
      <span className="mono sodium">Accord parental</span>
      <h1 className="display h2">Votre enfant souhaite rejoindre Fréquence</h1>
      {done === 'active' && <p className="ok-msg">Merci, le compte « {data.handle} » est activé. Vous pouvez le supprimer à tout moment en nous écrivant, ou votre enfant depuis ses réglages.</p>}
      {done === 'deleted' && <p>Le compte a été supprimé avec toutes ses données.</p>}
      {!done && (
        <>
          <p>Le compte <b>« {data.handle} »</b> a été créé sur Fréquence, l'espace officiel de l'artiste Ifa (actualités, extraits, vidéos, communauté de fans).</p>
          <div className="panel" style={{ fontSize: 15 }}>
            <b>Ce que votre accord permet</b>
            <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
              <li>publier des créations (vérifiées par un modérateur avant d'être visibles) ;</li>
              <li>commenter, réagir, voter, rejoindre des cercles ;</li>
              <li>recevoir des notifications (jamais entre 21 h et 8 h par défaut).</li>
            </ul>
            <b style={{ display: 'block', marginTop: 12 }}>Ce que Fréquence ne fait pas</b>
            <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
              <li>pas de messagerie privée entre utilisateurs ;</li>
              <li>pas de photo de profil, pas de localisation, pas de publicité ciblée ;</li>
              <li>données collectées : e-mail, pseudo, mois et année de naissance.</li>
            </ul>
          </div>
          <Link to="/legal/confidentialite" className="link">Lire la politique de confidentialité</Link>
          {err && <p className="err">{err}</p>}
          <button className="btn block" onClick={() => decide('accept')}>J'autorise ce compte</button>
          <button className="btn danger block" onClick={() => decide('refuse')}>Je refuse : supprimer le compte</button>
        </>
      )}
    </div>
  );
}
