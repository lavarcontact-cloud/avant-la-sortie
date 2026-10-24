// Le Labo : avant-premières, votes, coulisses d'un projet.
// Avant l'heure d'ouverture, l'API ne renvoie ni le fichier, ni son identifiant,
// ni le texte complet : uniquement le teaser public et la date.
import { Router } from 'express';
import { q, one, many } from '../db.js';
import { requireActive } from '../lib/auth.js';
import { fail, uuid } from '../lib/http.js';
import { canAccessDrop, dropWindow } from '../lib/access.js';
import { mediaRef } from '../lib/content.js';
import { award } from '../lib/badges.js';

const r = Router();
export default r;

const LOCK_REASONS = {
  upcoming: 'Pas encore ouvert', closed: 'Fermé', auth_required: 'Connecte-toi pour accéder au Labo',
  pending_parent: 'En attente de l\'accord d\'un parent', badge_required: 'Réservé aux détenteurs d\'un badge',
  circle_required: 'Réservé aux membres d\'un cercle', suspended: 'Compte suspendu',
};

async function shape(user, d, { full = false } = {}) {
  const access = await canAccessDrop(user, d);
  const base = {
    id: d.id, title: d.title, teaser: d.teaser, kind: d.kind, opens_at: d.opens_at, closes_at: d.closes_at,
    state: dropWindow(d), access: d.access, required_badge: d.required_badge, rights_note: d.rights_note,
    cover: mediaRef(d.cover_media_id, 'image'), is_demo: d.is_demo,
    unlocked: access.allowed, lock_reason: access.allowed ? null : (LOCK_REASONS[access.reason] || 'Accès restreint'),
  };
  if (d.required_badge) base.required_badge_name = (await one('select name from badges where code=$1', [d.required_badge]))?.name;
  if (d.required_circle_id) base.required_circle = await one('select slug, name from circles where id=$1', [d.required_circle_id]);
  if (!full || !access.allowed) return base;
  const media = d.media_id ? await one('select id, kind, mime from media where id = $1', [d.media_id]) : null;
  const out = { ...base, body: d.body, media: media && mediaRef(media.id, media.kind, media.mime) };
  if (d.kind === 'vote') {
    const options = await many(`select o.id, o.label, o.position, m.id as media_id, m.kind as media_kind, m.mime as media_mime,
        (select count(*)::int from drop_votes v where v.option_id = o.id) as votes
      from drop_options o left join media m on m.id = o.media_id where o.drop_id = $1 order by o.position`, [d.id]);
    const my = user ? await one('select option_id from drop_votes where drop_id=$1 and user_id=$2', [d.id, user.id]) : null;
    const total = options.reduce((s, o) => s + o.votes, 0);
    // les résultats ne s'affichent qu'après avoir voté (ou à la fermeture), pour ne pas influencer
    const showResults = Boolean(my) || dropWindow(d) === 'closed';
    out.my_vote = my?.option_id || null;
    out.total_votes = showResults ? total : null;
    out.options = options.map((o) => ({
      id: o.id, label: o.label, media: mediaRef(o.media_id, o.media_kind, o.media_mime),
      votes: showResults ? o.votes : null,
    }));
  }
  return out;
}

r.get('/labo', async (req, res) => {
  const rows = await many(`select * from drops where is_published order by
    case when opens_at <= now() and (closes_at is null or closes_at > now()) then 0 when opens_at > now() then 1 else 2 end, opens_at desc`);
  res.json(await Promise.all(rows.map((d) => shape(req.user, d))));
});

r.get('/labo/:id', async (req, res) => {
  const d = await one('select * from drops where id = $1 and is_published', [uuid(req.params.id)]);
  if (!d) fail(404, 'Introuvable');
  res.json(await shape(req.user, d, { full: true }));
});

r.post('/labo/:id/vote', requireActive, async (req, res) => {
  const d = await one(`select * from drops where id = $1 and is_published and kind = 'vote'`, [uuid(req.params.id)]);
  if (!d) fail(404, 'Vote introuvable');
  const access = await canAccessDrop(req.user, d);
  if (!access.allowed) fail(403, LOCK_REASONS[access.reason] || 'Accès restreint');
  const opt = await one('select id from drop_options where id = $1 and drop_id = $2', [uuid(req.body?.option_id), d.id]);
  if (!opt) fail(400, 'Option invalide');
  const ins = await q('insert into drop_votes (drop_id, user_id, option_id) values ($1,$2,$3) on conflict do nothing', [d.id, req.user.id, opt.id]);
  if (!ins.rowCount) fail(409, 'Tu as déjà voté');
  await award(req.user.id, 'votant', d.title);
  res.json(await shape(req.user, d, { full: true }));
});
