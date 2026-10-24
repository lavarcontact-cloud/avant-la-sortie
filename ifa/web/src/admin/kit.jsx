// Petits composants partagés par la régie.
import { useState } from 'react';
import { api } from '../lib/api.js';

export const toLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60e3).toISOString().slice(0, 16);
};
export const fromLocal = (v) => (v ? new Date(v).toISOString() : null);
export const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export function MediaUpload({ value, onChange, visibility = 'public', accept = 'image/*,video/*,audio/*', label = 'Fichier' }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setErr(null);
    const form = new FormData();
    form.append('file', f);
    form.append('visibility', visibility);
    try { onChange(await api.upload('/api/admin/media', form)); } catch (ex) { setErr(ex.message); } finally { setBusy(false); e.target.value = ''; }
  };
  return (
    <div className="field">
      <span>{label}{visibility === 'protected' && ' · confidentiel'}</span>
      <div className="panel row between" style={{ padding: 10 }}>
        <div className="row" style={{ minWidth: 0 }}>
          {value?.kind === 'image' && <img src={value.url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
          {value?.kind === 'video' && <video src={value.url} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} muted />}
          {value?.kind === 'audio' && <span className="tag uv">Audio</span>}
          <span className="muted" style={{ fontSize: 14 }}>{busy ? 'Envoi…' : value ? 'Fichier prêt' : 'Aucun fichier'}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {value && <button type="button" className="btn ghost sm" onClick={() => onChange(null)}>Retirer</button>}
          <label className="btn ghost sm" style={{ cursor: 'pointer' }}>Choisir<input type="file" accept={accept} onChange={pick} className="sr" /></label>
        </div>
      </div>
      {visibility === 'protected' && <small>Jamais accessible par une adresse publique : servi uniquement aux personnes autorisées, après l'heure d'ouverture.</small>}
      {err && <small className="err">{err}</small>}
    </div>
  );
}

export function useForm(initial) {
  const [f, setF] = useState(initial);
  const bind = (k, type) => ({
    value: f[k] ?? '',
    checked: type === 'checkbox' ? Boolean(f[k]) : undefined,
    onChange: (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })),
  });
  return [f, setF, bind];
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

export const Head = ({ eyebrow, title, children }) => (
  <div style={{ marginBottom: 22 }}>
    {eyebrow && <span className="mono sodium">{eyebrow}</span>}
    <h1 className="display h2" style={{ margin: '6px 0 6px' }}>{title}</h1>
    {children && <p className="muted" style={{ maxWidth: '62ch', margin: 0 }}>{children}</p>}
  </div>
);
