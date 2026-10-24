// Régie : écrans de publication. Un formulaire = une action, avec des libellés
// en français courant et l'aperçu des conséquences (ex. "les fans recevront
// un signal à la publication").
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad } from '../lib/hooks.js';
import { useSession } from '../lib/session.jsx';
import { Loading, ErrorBox, useToast, DemoTag } from '../components/ui.jsx';
import { KIND_LABEL, EVENT_KIND, RELEASE_KIND, PLATFORM_LABEL } from '../lib/format.js';
import { Head, MediaUpload, Seg, fmt, fromLocal, toLocal, useForm } from './kit.jsx';

const STATUS_TAG = { draft: ['Brouillon', ''], scheduled: ['Programmé', 'sodium'], published: ['En ligne', 'canal'], archived: ['Archivé', ''] };

// ---------------------------------------------------------------- publications
function PostForm({ initial, onDone, onCancel }) {
  const editing = Boolean(initial?.id);
  const [f, setF, bind] = useForm({
    kind: initial?.kind || 'announcement', title: initial?.title || '', body: initial?.body || '',
    media: initial?.media_id ? { id: initial.media_id, kind: initial.media_kind, url: `/api/media/${initial.media_id}` } : null,
    source_type: initial?.source_type === 'manual' ? 'manual' : 'app', source_platform: initial?.source_platform || '', source_url: initial?.source_url || '',
    when: initial?.status === 'scheduled' ? 'later' : 'now', publish_at: toLocal(initial?.publish_at), expires_at: toLocal(initial?.expires_at),
    is_pinned: initial?.is_pinned || false, is_featured: initial?.is_featured || false, notify: initial?.notify || false,
  });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const submit = async (action) => {
    setBusy(true); setErr(null);
    const body = {
      kind: f.kind, title: f.title, body: f.body || undefined, media_id: f.media?.id || undefined,
      source_type: f.source_type, source_platform: f.source_platform || undefined, source_url: f.source_url || undefined,
      publish_at: f.when === 'later' ? fromLocal(f.publish_at) : undefined, expires_at: fromLocal(f.expires_at) || undefined,
      is_pinned: f.is_pinned, is_featured: f.is_featured, notify: f.notify,
      action: action === 'draft' ? 'draft' : f.when === 'later' ? 'schedule' : 'publish',
    };
    try {
      if (editing) await api.patch(`/api/admin/posts/${initial.id}`, body); else await api.post('/api/admin/posts', body);
      toast(action === 'draft' ? 'Brouillon enregistré' : f.when === 'later' ? 'Publication programmée' : 'Publié sur le QG');
      onDone();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const isStory = f.kind === 'story';
  return (
    <div className="panel stack" style={{ marginBottom: 24 }}>
      <h2 className="display h4">{editing ? 'Modifier' : 'Nouvelle publication'}</h2>
      <div className="field"><span>Type</span>
        <Seg value={f.kind} onChange={(k) => setF({ ...f, kind: k })} options={['announcement', 'news', 'release', 'clip', 'freestyle', 'video', 'backstage', 'story', 'event'].map((k) => [k, KIND_LABEL[k]])} />
        {isStory && <small>Une onde courte disparaît automatiquement (24 h par défaut).</small>}
      </div>
      <div className="form-grid">
        <label className="field full"><span>Titre</span><input {...bind('title')} maxLength={140} required /></label>
        <label className="field full"><span>Texte</span><textarea {...bind('body')} maxLength={5000} /></label>
        <div className="full"><MediaUpload value={f.media} onChange={(m) => setF({ ...f, media: m })} label="Photo ou vidéo" accept="image/*,video/*" /></div>
        <div className="field full"><span>Provenance</span>
          <Seg value={f.source_type} onChange={(v) => setF({ ...f, source_type: v })} options={[['app', 'Créé pour Fréquence'], ['manual', 'Repris d\'une autre plateforme']]} />
          <small>Chaque contenu affiche sa source. Un contenu repris doit pointer vers l'original.</small>
        </div>
        {(f.source_type === 'manual' || f.kind === 'clip' || f.kind === 'freestyle' || f.kind === 'video') && (
          <>
            <label className="field"><span>Plateforme</span><select {...bind('source_platform')}><option value="">—</option>{Object.entries(PLATFORM_LABEL).slice(0, 9).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field"><span>Lien vers l'original</span><input {...bind('source_url')} type="url" placeholder="https://" /><small>Un lien YouTube est lu directement dans l'appli.</small></label>
          </>
        )}
        <div className="field full"><span>Quand</span>
          <Seg value={f.when} onChange={(v) => setF({ ...f, when: v })} options={[['now', 'Maintenant'], ['later', 'Programmer']]} />
        </div>
        {f.when === 'later' && <label className="field"><span>Date et heure de publication</span><input type="datetime-local" {...bind('publish_at')} /></label>}
        {isStory && <label className="field"><span>Disparaît le (facultatif)</span><input type="datetime-local" {...bind('expires_at')} /></label>}
      </div>
      <label className="check"><input type="checkbox" {...bind('notify', 'checkbox')} /><span>Envoyer un signal aux fans à la publication (selon leurs préférences)</span></label>
      {!isStory && <label className="check"><input type="checkbox" {...bind('is_pinned', 'checkbox')} /><span>Épingler en haut du QG</span></label>}
      <label className="check"><input type="checkbox" {...bind('is_featured', 'checkbox')} /><span>Mettre en avant dans Immersion</span></label>
      {err && <p className="err">{err}</p>}
      <div className="row wrap">
        <button className="btn" disabled={busy || !f.title} onClick={() => submit('publish')}>{f.when === 'later' ? 'Programmer' : 'Publier'}</button>
        <button className="btn ghost" disabled={busy || !f.title} onClick={() => submit('draft')}>Brouillon</button>
        <button className="btn ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

export function Posts() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useLoad(`/api/admin/posts${status ? `?status=${status}` : ''}`, [status]);
  const [editing, setEditing] = useState(params.get('nouveau') ? { kind: params.get('nouveau') } : null);
  const toast = useToast();
  const op = async (p, o) => { try { await api.patch(`/api/admin/posts/${p.id}`, { op: o }); reload(); } catch (e) { toast(e.message); } };
  const del = async (p) => { if (!window.confirm(`Supprimer définitivement « ${p.title} » ?`)) return; await api.del(`/api/admin/posts/${p.id}`); reload(); };
  const close = () => { setEditing(null); setParams({}); };
  return (
    <>
      <Head eyebrow="Publier" title="Le QG">Actus, annonces, clips, coulisses et ondes courtes. Les imports YouTube/Instagram arrivent en brouillon : relis, classe, publie.</Head>
      {!editing && <button className="btn" onClick={() => setEditing({})} style={{ marginBottom: 18 }}>+ Nouvelle publication</button>}
      {editing && <PostForm key={editing.id || editing.kind || 'new'} initial={editing.id ? editing : { kind: editing.kind }} onDone={() => { close(); reload(); }} onCancel={close} />}
      <Seg value={status} onChange={setStatus} options={[['', 'Tout'], ['published', 'En ligne'], ['scheduled', 'Programmés'], ['draft', 'Brouillons'], ['archived', 'Archivés']]} />
      {loading && <Loading h={200} />}
      {error && <ErrorBox error={error} />}
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="table">
          <thead><tr><th>Publication</th><th>Statut</th><th>Date</th><th>Vues</th><th /></tr></thead>
          <tbody>
            {data?.map((p) => (
              <tr key={p.id}>
                <td><b>{p.title}</b><div className="row wrap" style={{ gap: 4, marginTop: 4 }}><span className="tag">{KIND_LABEL[p.kind]}</span>{p.source_platform && <span className="tag">{p.source_type === 'integration' ? 'import ' : ''}{PLATFORM_LABEL[p.source_platform]}</span>}{p.is_pinned && <span className="tag sodium">épinglé</span>}{p.is_featured && <span className="tag sodium">en avant</span>}<DemoTag on={p.is_demo} /></div></td>
                <td><span className={`tag ${STATUS_TAG[p.status][1]}`}>{STATUS_TAG[p.status][0]}</span></td>
                <td className="mono">{fmt(p.publish_at || p.created_at)}{p.expires_at && <div className="dim">expire {fmt(p.expires_at)}</div>}</td>
                <td>{p.views} · {p.likes}♥</td>
                <td><div className="row wrap" style={{ gap: 4 }}>
                  <button className="btn ghost sm" onClick={() => setEditing(p)}>Modifier</button>
                  {p.status === 'published' && <button className="btn ghost sm" onClick={() => op(p, p.is_pinned ? 'unpin' : 'pin')}>{p.is_pinned ? 'Désépingler' : 'Épingler'}</button>}
                  {p.status === 'published' && <button className="btn ghost sm" onClick={() => op(p, 'archive')}>Archiver</button>}
                  {p.status === 'archived' && <button className="btn ghost sm" onClick={() => op(p, 'unarchive')}>Republier</button>}
                  <button className="btn danger sm" onClick={() => del(p)}>Supprimer</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- sorties
export function Releases() {
  const { data, reload } = useLoad('/api/admin/releases');
  const [edit, setEdit] = useState(null);
  const toast = useToast();
  const LINKS = ['spotify', 'apple_music', 'deezer', 'youtube', 'soundcloud'];
  const save = async (e) => {
    e.preventDefault();
    const body = { ...edit, cover_media_id: edit.cover?.id || null, links: edit.links || {} };
    try { if (edit.id) await api.patch(`/api/admin/releases/${edit.id}`, body); else await api.post('/api/admin/releases', body); toast('Enregistré'); setEdit(null); reload(); }
    catch (ex) { toast(ex.message); }
  };
  return (
    <>
      <Head eyebrow="Publier" title="Sorties">La discographie officielle, affichée sur le profil d'Ifa. Une sortie datée dans le futur déclenche le compte à rebours du QG.</Head>
      {!edit && <button className="btn" onClick={() => setEdit({ kind: 'single', links: {}, is_published: true })} style={{ marginBottom: 18 }}>+ Ajouter une sortie</button>}
      {edit && (
        <form className="panel stack" onSubmit={save} style={{ marginBottom: 24 }}>
          <div className="form-grid">
            <label className="field"><span>Titre</span><input value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required /></label>
            <label className="field"><span>Type</span><select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>{Object.entries(RELEASE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field"><span>Date et heure de sortie</span><input type="datetime-local" value={toLocal(edit.release_at) || (edit.release_date ? `${edit.release_date}T00:00` : '')} onChange={(e) => setEdit({ ...edit, release_at: fromLocal(e.target.value), release_date: e.target.value.slice(0, 10) })} /><small>L'heure sert au compte à rebours du QG.</small></label>
            <div><MediaUpload value={edit.cover} onChange={(m) => setEdit({ ...edit, cover: m })} label="Pochette" accept="image/*" /></div>
            <label className="field full"><span>Description</span><textarea value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
            {LINKS.map((k) => <label key={k} className="field"><span>Lien {PLATFORM_LABEL[k]}</span><input type="url" placeholder="https://" value={edit.links?.[k] || ''} onChange={(e) => setEdit({ ...edit, links: { ...edit.links, [k]: e.target.value } })} /></label>)}
          </div>
          <div className="row"><button className="btn">Enregistrer</button><button type="button" className="btn ghost" onClick={() => setEdit(null)}>Annuler</button></div>
        </form>
      )}
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Titre</th><th>Type</th><th>Date</th><th /></tr></thead>
        <tbody>{data?.map((r) => <tr key={r.id}><td><b>{r.title}</b> <DemoTag on={r.is_demo} /></td><td>{RELEASE_KIND[r.kind]}</td><td className="mono">{r.release_date || '—'}</td>
          <td><div className="row" style={{ gap: 4 }}><button className="btn ghost sm" onClick={() => setEdit({ ...r, cover: r.cover_media_id ? { id: r.cover_media_id, kind: 'image', url: `/api/media/${r.cover_media_id}` } : null })}>Modifier</button>
            <button className="btn danger sm" onClick={async () => { if (window.confirm('Supprimer ?')) { await api.del(`/api/admin/releases/${r.id}`); reload(); } }}>Supprimer</button></div></td></tr>)}</tbody>
      </table></div>
    </>
  );
}

// ---------------------------------------------------------------- agenda
export function Events() {
  const [params] = useSearchParams();
  const { data, reload } = useLoad('/api/admin/events');
  const [edit, setEdit] = useState(params.get('nouveau') ? { kind: 'concert', status: 'confirmed' } : null);
  const toast = useToast();
  const save = async (e) => {
    e.preventDefault();
    const body = { ...edit, starts_at: fromLocal(edit.starts_local), ends_at: fromLocal(edit.ends_local) };
    try { if (edit.id) await api.patch(`/api/admin/events/${edit.id}`, body); else await api.post('/api/admin/events', body); toast('Enregistré'); setEdit(null); reload(); }
    catch (ex) { toast(ex.message); }
  };
  return (
    <>
      <Head eyebrow="Publier" title="Agenda">Seules les dates au statut « confirmé » apparaissent comme telles. Un report ou une annulation reste visible et clairement indiqué.</Head>
      {!edit && <button className="btn" onClick={() => setEdit({ kind: 'concert', status: 'confirmed' })} style={{ marginBottom: 18 }}>+ Annoncer une date</button>}
      {edit && (
        <form className="panel stack" onSubmit={save} style={{ marginBottom: 24 }}>
          <div className="form-grid">
            <label className="field full"><span>Titre</span><input value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required /></label>
            <label className="field"><span>Type</span><select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>{Object.entries(EVENT_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field"><span>Statut</span><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="draft">Brouillon (invisible)</option><option value="confirmed">Confirmé</option><option value="postponed">Reporté</option><option value="cancelled">Annulé</option></select></label>
            <label className="field"><span>Lieu</span><input value={edit.venue || ''} onChange={(e) => setEdit({ ...edit, venue: e.target.value })} /></label>
            <label className="field"><span>Ville</span><input value={edit.city || ''} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></label>
            <label className="field"><span>Début</span><input type="datetime-local" value={edit.starts_local || ''} onChange={(e) => setEdit({ ...edit, starts_local: e.target.value })} required /></label>
            <label className="field"><span>Fin (facultatif)</span><input type="datetime-local" value={edit.ends_local || ''} onChange={(e) => setEdit({ ...edit, ends_local: e.target.value })} /></label>
            <label className="field"><span>Billetterie</span><input type="url" value={edit.ticket_url || ''} onChange={(e) => setEdit({ ...edit, ticket_url: e.target.value })} placeholder="https://" /></label>
            <label className="field"><span>Âge / accès</span><input value={edit.age_policy || ''} onChange={(e) => setEdit({ ...edit, age_policy: e.target.value })} placeholder="ex. tous publics, -16 ans accompagnés" /></label>
            <label className="field full"><span>Description</span><textarea value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
          </div>
          {!edit.id && <label className="check"><input type="checkbox" checked={Boolean(edit.notify)} onChange={(e) => setEdit({ ...edit, notify: e.target.checked })} /><span>Prévenir les fans maintenant (signal « Date confirmée »)</span></label>}
          <div className="row"><button className="btn">Enregistrer</button><button type="button" className="btn ghost" onClick={() => setEdit(null)}>Annuler</button></div>
        </form>
      )}
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Date</th><th>Événement</th><th>Statut</th><th /></tr></thead>
        <tbody>{data?.map((e) => <tr key={e.id}><td className="mono">{fmt(e.starts_at)}</td><td><b>{e.title}</b> <DemoTag on={e.is_demo} /><div className="muted">{[EVENT_KIND[e.kind], e.venue, e.city].filter(Boolean).join(' · ')}</div></td><td>{e.status}</td>
          <td><div className="row" style={{ gap: 4 }}><button className="btn ghost sm" onClick={() => setEdit({ ...e, starts_local: toLocal(e.starts_at), ends_local: toLocal(e.ends_at) })}>Modifier</button>
            <button className="btn danger sm" onClick={async () => { if (window.confirm('Supprimer ?')) { await api.del(`/api/admin/events/${e.id}`); reload(); } }}>Supprimer</button></div></td></tr>)}</tbody>
      </table></div>
    </>
  );
}

// ---------------------------------------------------------------- Labo
export function Drops() {
  const [params] = useSearchParams();
  const { data, reload } = useLoad('/api/admin/drops');
  const circles = useLoad('/api/admin/circles');
  const blank = { kind: 'preview', access: 'members', opens_local: '', notify_on_open: true, is_published: false, options: [{ label: '' }, { label: '' }] };
  const [edit, setEdit] = useState(params.get('nouveau') ? blank : null);
  const toast = useToast();
  const save = async (e) => {
    e.preventDefault();
    const body = {
      ...edit, opens_at: fromLocal(edit.opens_local), closes_at: fromLocal(edit.closes_local),
      media_id: edit.media?.id || null, cover_media_id: edit.cover?.id || null,
      options: edit.kind === 'vote' ? edit.options.filter((o) => o.label).map((o) => ({ label: o.label, media_id: o.media?.id })) : [],
    };
    try { if (edit.id) await api.patch(`/api/admin/drops/${edit.id}`, body); else await api.post('/api/admin/drops', body); toast(edit.is_published ? 'Programmé au Labo' : 'Enregistré (non publié)'); setEdit(null); reload(); }
    catch (ex) { toast(ex.message); }
  };
  const state = (d) => (new Date(d.opens_at) > new Date() ? 'à venir' : d.closes_at && new Date(d.closes_at) < new Date() ? 'fermé' : 'ouvert');
  return (
    <>
      <Head eyebrow="Publier" title="Le Labo">Avant-premières, votes, coulisses d'un projet. Le fichier reste invisible jusqu'à l'heure d'ouverture, même pour qui connaîtrait l'adresse.</Head>
      {!edit && <button className="btn uv" onClick={() => setEdit(blank)} style={{ marginBottom: 18 }}>+ Nouvelle expérience</button>}
      {edit && (
        <form className="panel stack" onSubmit={save} style={{ marginBottom: 24, borderColor: 'rgba(141,107,255,.4)' }}>
          <div className="field"><span>Type</span><Seg value={edit.kind} onChange={(k) => setEdit({ ...edit, kind: k })} options={[['preview', 'Avant-première (audio/vidéo)'], ['vote', 'Vote'], ['process', 'Dans le studio'], ['experience', 'Expérience']]} /></div>
          <div className="form-grid">
            <label className="field full"><span>Titre</span><input value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required /></label>
            <label className="field full"><span>Teaser (visible avant l'ouverture)</span><input value={edit.teaser || ''} onChange={(e) => setEdit({ ...edit, teaser: e.target.value })} maxLength={300} /></label>
            <label className="field full"><span>Texte (visible après l'ouverture)</span><textarea value={edit.body || ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></label>
            <div><MediaUpload value={edit.cover} onChange={(m) => setEdit({ ...edit, cover: m })} label="Visuel public (flouté avant ouverture)" accept="image/*" /></div>
            {edit.kind !== 'vote' && <div><MediaUpload value={edit.media} onChange={(m) => setEdit({ ...edit, media: m })} visibility="protected" label="Fichier" /></div>}
            <label className="field"><span>Ouverture</span><input type="datetime-local" value={edit.opens_local || ''} onChange={(e) => setEdit({ ...edit, opens_local: e.target.value })} required /></label>
            <label className="field"><span>Fermeture (facultatif)</span><input type="datetime-local" value={edit.closes_local || ''} onChange={(e) => setEdit({ ...edit, closes_local: e.target.value })} /></label>
            <div className="field full"><span>Qui peut accéder</span><Seg value={edit.access} onChange={(a) => setEdit({ ...edit, access: a })} options={[['members', 'Tous les membres'], ['badge', 'Détenteurs d\'un badge'], ['circle', 'Membres d\'un cercle']]} /></div>
            {edit.access === 'badge' && <label className="field"><span>Badge requis</span><select value={edit.required_badge || ''} onChange={(e) => setEdit({ ...edit, required_badge: e.target.value })} required><option value="" />{[['premiere_onde', 'Première onde'], ['createur', 'Créateur'], ['selection', 'Sélection'], ['votant', 'Voix comptée'], ['defi', 'Relevé'], ['cercle', 'Dans le cercle']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>}
            {edit.access === 'circle' && <label className="field"><span>Cercle requis</span><select value={edit.required_circle_id || ''} onChange={(e) => setEdit({ ...edit, required_circle_id: e.target.value })} required><option value="" />{circles.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
            <label className="field full"><span>Droits de diffusion</span><input value={edit.rights_note || ''} onChange={(e) => setEdit({ ...edit, rights_note: e.target.value })} placeholder="ex. Extrait de 45 s autorisé par le label jusqu'au 30/11" /><small>Obligatoire pour publier une avant-première.</small></label>
          </div>
          {edit.kind === 'vote' && (
            <div className="stack" style={{ '--s': '8px' }}>
              <span className="mono muted">Options du vote</span>
              {edit.options.map((o, i) => (
                <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
                  <input className="input" placeholder={`Option ${i + 1}`} value={o.label} onChange={(e) => { const opts = [...edit.options]; opts[i] = { ...o, label: e.target.value }; setEdit({ ...edit, options: opts }); }} />
                  <div style={{ flex: 1 }}><MediaUpload value={o.media} onChange={(m) => { const opts = [...edit.options]; opts[i] = { ...o, media: m }; setEdit({ ...edit, options: opts }); }} visibility="protected" label="Visuel (facultatif)" accept="image/*" /></div>
                </div>
              ))}
              <button type="button" className="btn ghost sm" onClick={() => setEdit({ ...edit, options: [...edit.options, { label: '' }] })}>+ Option</button>
            </div>
          )}
          <label className="check"><input type="checkbox" checked={edit.notify_on_open} onChange={(e) => setEdit({ ...edit, notify_on_open: e.target.checked })} /><span>Envoyer un signal aux fans à l'ouverture</span></label>
          <label className="check"><input type="checkbox" checked={edit.is_published} onChange={(e) => setEdit({ ...edit, is_published: e.target.checked })} /><span>Publier (le teaser et le compte à rebours deviennent visibles)</span></label>
          <div className="row"><button className="btn uv">Enregistrer</button><button type="button" className="btn ghost" onClick={() => setEdit(null)}>Annuler</button></div>
        </form>
      )}
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Expérience</th><th>Ouverture</th><th>État</th><th>Votes</th><th /></tr></thead>
        <tbody>{data?.map((d) => <tr key={d.id}><td><b>{d.title}</b> <DemoTag on={d.is_demo} /><div className="row" style={{ gap: 4, marginTop: 4 }}><span className="tag uv">{d.kind}</span>{!d.is_published && <span className="tag">non publié</span>}{d.access !== 'members' && <span className="tag sodium">{d.access}</span>}</div></td>
          <td className="mono">{fmt(d.opens_at)}{d.closes_at && <div className="dim">→ {fmt(d.closes_at)}</div>}</td><td>{state(d)}</td><td>{d.kind === 'vote' ? d.votes : '—'}</td>
          <td><div className="row" style={{ gap: 4 }}><button className="btn ghost sm" onClick={() => setEdit({ ...d, opens_local: toLocal(d.opens_at), closes_local: toLocal(d.closes_at), media: d.media_id ? { id: d.media_id, kind: 'audio', url: `/api/media/${d.media_id}` } : null, cover: d.cover_media_id ? { id: d.cover_media_id, kind: 'image', url: `/api/media/${d.cover_media_id}` } : null, options: (d.options || []).map((o) => ({ label: o.label, media: o.media_id ? { id: o.media_id, kind: 'image', url: `/api/media/${o.media_id}` } : null })) })}>Modifier</button>
            <button className="btn danger sm" onClick={async () => { if (window.confirm('Supprimer ?')) { await api.del(`/api/admin/drops/${d.id}`); reload(); } }}>Supprimer</button></div></td></tr>)}</tbody>
      </table></div>
    </>
  );
}

// ---------------------------------------------------------------- défis & cercles
export function Community() {
  const ch = useLoad('/api/admin/challenges');
  const ci = useLoad('/api/admin/circles');
  const [c, setC] = useState(null);
  const [k, setK] = useState(null);
  const toast = useToast();
  const saveC = async (e) => {
    e.preventDefault();
    try { await api.post('/api/admin/challenges', { ...c, starts_at: fromLocal(c.starts_local) || new Date().toISOString(), ends_at: fromLocal(c.ends_local), cover_media_id: c.cover?.id }); toast('Défi créé'); setC(null); ch.reload(); }
    catch (ex) { toast(ex.message); }
  };
  const saveK = async (e) => {
    e.preventDefault();
    try { await api.post('/api/admin/circles', { ...k, ends_at: fromLocal(k.ends_local) }); toast('Cercle créé'); setK(null); ci.reload(); }
    catch (ex) { toast(ex.message); }
  };
  return (
    <>
      <Head eyebrow="Publier" title="Défis & cercles">Un défi récompense la participation par un badge, jamais par un classement. Une salle de sortie est un cercle temporaire qui ferme seul.</Head>
      <div className="row between"><h2 className="display h4">Défis</h2>{!c && <button className="btn sm" onClick={() => setC({})}>+ Défi</button>}</div>
      {c && (
        <form className="panel stack" onSubmit={saveC} style={{ margin: '12px 0 24px' }}>
          <div className="form-grid">
            <label className="field full"><span>Titre</span><input value={c.title || ''} onChange={(e) => setC({ ...c, title: e.target.value })} required /></label>
            <label className="field full"><span>Consigne</span><textarea value={c.brief || ''} onChange={(e) => setC({ ...c, brief: e.target.value })} required /></label>
            <label className="field full"><span>Règles</span><textarea value={c.rules || ''} onChange={(e) => setC({ ...c, rules: e.target.value })} placeholder="Durée max, son à utiliser, ce qui est interdit…" /></label>
            <label className="field"><span>Début</span><input type="datetime-local" value={c.starts_local || ''} onChange={(e) => setC({ ...c, starts_local: e.target.value })} /><small>Vide = maintenant</small></label>
            <label className="field"><span>Fin</span><input type="datetime-local" value={c.ends_local || ''} onChange={(e) => setC({ ...c, ends_local: e.target.value })} /></label>
            <div className="full"><MediaUpload value={c.cover} onChange={(m) => setC({ ...c, cover: m })} label="Visuel" accept="image/*" /></div>
          </div>
          <p className="mono dim">Les fans sont prévenus au lancement (catégorie « Défis »).</p>
          <div className="row"><button className="btn">Lancer</button><button type="button" className="btn ghost" onClick={() => setC(null)}>Annuler</button></div>
        </form>
      )}
      <div className="table-wrap"><table className="table"><tbody>{ch.data?.map((x) => <tr key={x.id}><td><b>{x.title}</b> <DemoTag on={x.is_demo} />{!x.is_published && <span className="tag">dépublié</span>}</td><td className="mono">{fmt(x.starts_at)} → {fmt(x.ends_at)}</td><td>{x.entries} participations</td><td>{x.is_published && <button className="btn ghost sm" onClick={async () => { await api.del(`/api/admin/challenges/${x.id}`); ch.reload(); }}>Dépublier</button>}</td></tr>)}</tbody></table></div>

      <div className="row between section"><h2 className="display h4">Cercles</h2>{!k && <button className="btn sm" onClick={() => setK({ kind: 'permanent' })}>+ Cercle</button>}</div>
      {k && (
        <form className="panel stack" onSubmit={saveK} style={{ margin: '12px 0 24px' }}>
          <div className="form-grid">
            <label className="field"><span>Nom</span><input value={k.name || ''} onChange={(e) => setK({ ...k, name: e.target.value })} required /></label>
            <label className="field"><span>Identifiant (url)</span><input value={k.slug || ''} onChange={(e) => setK({ ...k, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} required /></label>
            <label className="field full"><span>Description</span><input value={k.description || ''} onChange={(e) => setK({ ...k, description: e.target.value })} /></label>
            <div className="field"><span>Type</span><Seg value={k.kind} onChange={(v) => setK({ ...k, kind: v })} options={[['permanent', 'Permanent'], ['release_room', 'Salle de sortie (temporaire)']]} /></div>
            {k.kind === 'release_room' && <label className="field"><span>Ferme le</span><input type="datetime-local" value={k.ends_local || ''} onChange={(e) => setK({ ...k, ends_local: e.target.value })} required /></label>}
          </div>
          <div className="row"><button className="btn">Créer</button><button type="button" className="btn ghost" onClick={() => setK(null)}>Annuler</button></div>
        </form>
      )}
      <div className="table-wrap"><table className="table"><tbody>{ci.data?.map((x) => <tr key={x.id}><td><b>{x.name}</b> <span className="mono dim">/{x.slug}</span></td><td>{x.kind === 'release_room' ? `temporaire → ${fmt(x.ends_at)}` : 'permanent'}</td><td>{x.members} membres</td><td><button className="btn ghost sm" onClick={async () => { await api.patch(`/api/admin/circles/${x.id}`, { is_open: !x.is_open }); ci.reload(); }}>{x.is_open ? 'Fermer' : 'Rouvrir'}</button></td></tr>)}</tbody></table></div>
    </>
  );
}

// ---------------------------------------------------------------- signaux
const CATS = [['announcement', 'Annonce'], ['news', 'Actu'], ['release', 'Sortie'], ['event', 'Événement'], ['drop', 'Labo'], ['challenge', 'Défi'], ['exclusive', 'Exclusif']];
export function Broadcasts() {
  const [params] = useSearchParams();
  const { data, reload } = useLoad('/api/admin/broadcasts');
  const [f, setF] = useState(params.get('nouveau') ? { category: 'announcement', importance: 'normal', when: 'now' } : null);
  const toast = useToast();
  const send = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/broadcasts', { ...f, send_at: f.when === 'later' ? fromLocal(f.send_local) : undefined });
      toast(f.when === 'later' ? 'Signal programmé' : 'Signal en cours d\'envoi (moins d\'une minute)'); setF(null); reload();
    } catch (ex) { toast(ex.message); }
  };
  return (
    <>
      <Head eyebrow="Publier" title="Signaux">Un signal arrive dans la boîte de chaque fan qui suit cette catégorie, et en notification push si c'est activé (hors heures calmes, selon ses réglages).</Head>
      {data && !data.push_configured && <div className="panel" style={{ borderColor: 'rgba(255,184,28,.4)', marginBottom: 16 }}><b>Push non configuré.</b> Les signaux arrivent dans l'appli (boîte Signaux), mais aucune notification n'est envoyée sur les téléphones tant que les clés VAPID ne sont pas installées. Les chiffres d'envoi l'indiquent honnêtement.</div>}
      {!f && <button className="btn" onClick={() => setF({ category: 'announcement', importance: 'normal', when: 'now' })} style={{ marginBottom: 18 }}>+ Nouveau signal</button>}
      {f && (
        <form className="panel stack" onSubmit={send} style={{ marginBottom: 24 }}>
          <div className="field"><span>Catégorie</span><Seg value={f.category} onChange={(c) => setF({ ...f, category: c })} options={CATS} /></div>
          <div className="form-grid">
            <label className="field"><span>Titre (80 car.)</span><input value={f.title || ''} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} required placeholder="Rendez-vous à 20 h pour une annonce" /></label>
            <label className="field"><span>Lien dans l'appli</span><input value={f.url || ''} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="/labo, /ifa#agenda, /qg/…" /></label>
            <label className="field full"><span>Texte (200 car.)</span><input value={f.body || ''} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={200} /></label>
            <div className="field"><span>Importance</span><Seg value={f.importance} onChange={(v) => setF({ ...f, importance: v })} options={[['normal', 'Normale'], ['important', 'Importante']]} /><small>« Importante » atteint aussi ceux qui ont choisi « important seulement ». À garder rare.</small></div>
            <div className="field"><span>Envoi</span><Seg value={f.when} onChange={(v) => setF({ ...f, when: v })} options={[['now', 'Maintenant'], ['later', 'Programmer']]} /></div>
            {f.when === 'later' && <label className="field"><span>Date et heure</span><input type="datetime-local" value={f.send_local || ''} onChange={(e) => setF({ ...f, send_local: e.target.value })} required /></label>}
          </div>
          <div className="panel" style={{ background: 'var(--ink)' }}><span className="mono muted">Aperçu</span><div style={{ fontWeight: 800, marginTop: 6 }}>Fréquence · {f.title || 'Titre du signal'}</div><div className="muted" style={{ fontSize: 14 }}>{f.body}</div></div>
          <div className="row"><button className="btn">{f.when === 'later' ? 'Programmer' : 'Envoyer'}</button><button type="button" className="btn ghost" onClick={() => setF(null)}>Annuler</button></div>
        </form>
      )}
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Signal</th><th>Envoi</th><th>Statut</th><th>Résultat réel</th><th /></tr></thead>
        <tbody>{data?.items.map((b) => (
          <tr key={b.id}>
            <td><b>{b.title}</b><div className="row" style={{ gap: 4, marginTop: 4 }}><span className="tag">{b.category}</span>{b.importance === 'important' && <span className="tag sodium">important</span>}{b.origin !== 'manual' && <span className="tag">auto</span>}</div></td>
            <td className="mono">{fmt(b.send_at)}</td>
            <td>{{ scheduled: 'programmé', sending: 'en cours', sent: 'envoyé', cancelled: 'annulé', failed: 'échec' }[b.status]}</td>
            <td className="mono" style={{ fontSize: 12 }}>{b.stats ? (b.stats.error ? <span className="err">{b.stats.error}</span> : <>{b.stats.inapp} boîtes · {b.stats.push_configured ? `${b.stats.push_sent} push (${b.stats.push_failed} échecs, ${b.stats.push_skipped_quiet} heures calmes)` : 'push non configuré'}</>) : '—'}</td>
            <td>{b.status === 'scheduled' && <button className="btn ghost sm" onClick={async () => { await api.post(`/api/admin/broadcasts/${b.id}/cancel`); reload(); }}>Annuler</button>}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </>
  );
}

// ---------------------------------------------------------------- profil officiel & intégrations
const ALINKS = ['spotify', 'apple_music', 'deezer', 'youtube', 'soundcloud', 'instagram', 'tiktok', 'snapchat', 'x', 'website', 'booking'];
export function ArtistAdmin() {
  const { data } = useLoad('/api/artist');
  const integ = useLoad('/api/admin/integrations');
  const [f, setF] = useState(null);
  const [sync, setSync] = useState({});
  const toast = useToast();
  const { user } = useSession();
  useEffect(() => {
    if (data && !f) setF({ ...data.artist, avatar: data.artist.avatar, banner: data.artist.banner, links: data.artist.links || {} });
  }, [data]); // eslint-disable-line
  if (!f) return <Loading />;
  const save = async (e) => {
    e.preventDefault();
    try { await api.put('/api/admin/artist', { ...f, avatar_media_id: f.avatar?.id || null, banner_media_id: f.banner?.id || null, gallery: (f.gallery || []).map((g) => g.id) }); toast('Profil officiel mis à jour'); }
    catch (ex) { toast(ex.message); }
  };
  const run = async (name) => {
    setSync((s) => ({ ...s, [name]: '…' }));
    const r = await api.post(`/api/admin/integrations/${name}/sync`).catch((e) => ({ ok: false, reason: e.message }));
    setSync((s) => ({ ...s, [name]: r.ok ? `${r.imported} nouveau(x) brouillon(s) sur ${r.seen}` : r.reason }));
  };
  return (
    <>
      <Head eyebrow="Réglages" title="Profil officiel">Ce que les fans voient dans l'onglet Ifa. N'ajoute que des comptes confirmés par Ifa ou son équipe.</Head>
      <form className="panel stack" onSubmit={save}>
        <div className="form-grid">
          <label className="field"><span>Nom d'artiste</span><input value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
          <label className="field"><span>Accroche</span><input value={f.tagline || ''} onChange={(e) => setF({ ...f, tagline: e.target.value })} maxLength={120} /></label>
          <label className="field full"><span>Présentation</span><textarea value={f.bio || ''} onChange={(e) => setF({ ...f, bio: e.target.value })} rows={6} /><small>À faire relire et valider par Ifa.</small></label>
          <div><MediaUpload value={f.banner} onChange={(m) => setF({ ...f, banner: m })} label="Photo principale (bannière)" accept="image/*" /></div>
          <div><MediaUpload value={f.avatar} onChange={(m) => setF({ ...f, avatar: m })} label="Photo de profil" accept="image/*" /></div>
          <div className="field full"><span>Galerie (photos officielles)</span>
            <div className="row wrap" style={{ gap: 8 }}>
              {(f.gallery || []).map((g, i) => (
                <div key={g.id} style={{ position: 'relative', width: 96 }}>
                  <img src={g.url} alt="" style={{ width: 96, height: 144, objectFit: 'cover', borderRadius: 10 }} />
                  <div className="row" style={{ gap: 4, marginTop: 4 }}>
                    <button type="button" className="btn ghost sm" disabled={i === 0} onClick={() => { const x = [...f.gallery]; [x[i - 1], x[i]] = [x[i], x[i - 1]]; setF({ ...f, gallery: x }); }} aria-label="Avancer">←</button>
                    <button type="button" className="btn danger sm" onClick={() => setF({ ...f, gallery: f.gallery.filter((_, k) => k !== i) })} aria-label="Retirer">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <MediaUpload value={null} onChange={(m) => m && setF({ ...f, gallery: [...(f.gallery || []), m] })} label="Ajouter une photo" accept="image/*" />
            <small>N'enregistre que des photos dont l'usage est autorisé par Ifa et son équipe. Pense à cliquer « Enregistrer le profil ».</small>
          </div>
          {ALINKS.map((k) => <label key={k} className="field"><span>{PLATFORM_LABEL[k] || k}</span><input type="url" value={f.links?.[k] || ''} placeholder="https://" onChange={(e) => setF({ ...f, links: { ...f.links, [k]: e.target.value } })} /></label>)}
        </div>
        <button className="btn">Enregistrer le profil</button>
      </form>
      <section className="section">
        <h2 className="display h4">Intégrations</h2>
        <p className="muted">Uniquement par API officielle, avec les accès fournis par l'équipe. Les imports arrivent en brouillon dans Le QG.</p>
        {integ.data && [['youtube', 'YouTube (chaîne officielle)'], ['instagram', 'Instagram (compte pro d\'Ifa)']].map(([k, l]) => (
          <div key={k} className="setting">
            <div><span className={`status-dot ${integ.data[k] ? 'ok' : 'off'}`} />{l}{sync[k] && <div className="mono dim">{sync[k]}</div>}</div>
            {user.role === 'admin' && <button className="btn ghost sm" disabled={!integ.data[k]} onClick={() => run(k)}>{integ.data[k] ? 'Synchroniser' : 'Non configuré'}</button>}
          </div>
        ))}
      </section>
    </>
  );
}
