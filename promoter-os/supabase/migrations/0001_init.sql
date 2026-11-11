-- PROMOTER OS — schéma initial (MVP Little Room)
-- Cible : Supabase (PostgreSQL 15+), région UE.
-- Les règles métier critiques sont appliquées DANS la base (contraintes,
-- triggers, fonctions) pour qu'aucune interface ni aucun agent IA ne puisse
-- les contourner.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type member_role       as enum ('owner', 'promoter', 'door', 'analyst');
create type contact_status    as enum ('active', 'flagged', 'inactive', 'unsubscribed');
create type contact_source    as enum ('inbound_dm', 'qr_code', 'story', 'referral', 'event', 'manual', 'import');
create type consent_purpose   as enum ('invitations', 'reminders');
create type template_kind     as enum ('invitation', 'relance', 'confirmation', 'rappel');
create type event_status      as enum ('draft', 'open', 'closed', 'reported');
create type invitation_status as enum ('prepared', 'sent', 'yes', 'no', 'question', 'cancelled');
create type attendance_status as enum ('unknown', 'present', 'absent');
create type message_direction as enum ('out', 'in');
create type message_channel   as enum ('instagram_manual', 'instagram_api', 'other');

-- ---------------------------------------------------------------------------
-- Espace de travail (l'activité d'un promoteur ou d'une équipe)
-- ---------------------------------------------------------------------------
create table workspaces (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  -- Nombre d'absences après confirmation avant signalement. Réglable.
  no_show_threshold       int  not null default 2 check (no_show_threshold >= 1),
  -- Si vrai, un contact qui atteint le seuil passe en "inactive" (plus invitable).
  -- Si faux, il est seulement "flagged" (signalé, toujours invitable).
  auto_deactivate         boolean not null default false,
  created_at              timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null,                -- auth.users.id
  role         member_role not null,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table venues (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  name                  text not null,
  group_size            int not null default 10 check (group_size > 0),
  commission_per_group  numeric(10,2) not null default 300 check (commission_per_group >= 0),
  conditions            text,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (workspace_id, name)
);

-- ---------------------------------------------------------------------------
-- Contacts (CRM)
-- ---------------------------------------------------------------------------
create table contacts (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  instagram_handle   citext not null check (instagram_handle ~ '^[a-z0-9._]{1,30}$'),
  display_name       text,
  source             contact_source not null,
  source_detail      text,                              -- ex. "recommandée par @x", "QR Little Room 12/11"
  adult_verified_at  timestamptz,                       -- majorité vérifiée (obligatoire si alcool)
  adult_verified_by  uuid,
  status             contact_status not null default 'active',
  notes              text,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (workspace_id, instagram_handle)               -- détection des doublons
);

-- Consentement distinct par établissement et par finalité.
-- venue_id NULL = consentement pour l'ensemble des établissements de l'espace
-- (à n'utiliser que si la personne l'a explicitement accepté).
create table consents (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contacts(id) on delete cascade,
  venue_id    uuid references venues(id) on delete cascade,
  purpose     consent_purpose not null,
  evidence    text not null,                -- ex. "DM entrant 'INVITATION' du 12/11"
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create unique index consents_one_active
  on consents (contact_id, coalesce(venue_id, '00000000-0000-0000-0000-000000000000'::uuid), purpose)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Messagerie
-- ---------------------------------------------------------------------------
create table message_templates (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  kind          template_kind not null,
  variant       text not null default 'A',     -- variantes A/B
  body          text not null,                 -- placeholders : {{prenom}}, {{soiree}}, {{date}}
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Soirées et invitations
-- ---------------------------------------------------------------------------
create table events (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  venue_id          uuid not null references venues(id),
  title             text not null,
  starts_at         timestamptz not null,
  target_guests     int not null default 10 check (target_guests > 0),
  tables_available  int not null default 1 check (tables_available >= 0),
  conditions        text,
  alcohol_offer     boolean not null default true,   -- impose la majorité vérifiée
  status            event_status not null default 'draft',
  created_by        uuid,
  created_at        timestamptz not null default now()
);

create table invitations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  contact_id     uuid not null references contacts(id) on delete cascade,
  template_id    uuid references message_templates(id),
  status         invitation_status not null default 'prepared',
  group_no       int check (group_no >= 1),
  sent_at        timestamptz,
  responded_at   timestamptz,
  relance_count  int not null default 0 check (relance_count between 0 and 1),  -- UNE relance max
  relanced_at    timestamptz,
  confirmed_at   timestamptz,
  attendance     attendance_status not null default 'unknown',
  checked_in_at  timestamptz,
  checked_in_by  uuid,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  unique (event_id, contact_id)    -- jamais deux invitations pour la même soirée
);

create table messages (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid references invitations(id) on delete cascade,
  contact_id     uuid not null references contacts(id) on delete cascade,
  direction      message_direction not null,
  channel        message_channel not null,
  body           text not null,
  classified_as  invitation_status,       -- résultat de la classification OUI/NON/question
  created_by     uuid,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Commissions
-- ---------------------------------------------------------------------------
create table commission_payments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  amount     numeric(10,2) not null check (amount > 0),
  paid_at    date not null default current_date,
  note       text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Journal d'audit (historique complet des actions)
-- ---------------------------------------------------------------------------
create table audit_log (
  id           bigint generated always as identity primary key,
  workspace_id uuid,
  actor        uuid,
  action       text not null,
  entity       text not null,
  entity_id    uuid,
  data         jsonb,
  at           timestamptz not null default now()
);

-- ===========================================================================
-- Fonctions utilitaires
-- ===========================================================================

-- Utilisateur courant (Supabase : auth.uid()). Isolé pour pouvoir tester hors Supabase.
create or replace function app_uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function is_member(ws uuid, roles member_role[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = ws and m.user_id = app_uid()
      and (roles is null or m.role = any(roles))
  )
$$;

create or replace function log_action(ws uuid, act text, ent text, ent_id uuid, payload jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_log (workspace_id, actor, action, entity, entity_id, data)
  values (ws, app_uid(), act, ent, ent_id, payload);
$$;

-- Le contact a-t-il un consentement actif pour cet établissement ?
create or replace function has_consent(c uuid, v uuid, p consent_purpose)
returns boolean language sql stable as $$
  select exists (
    select 1 from consents
    where contact_id = c and purpose = p and revoked_at is null
      and (venue_id = v or venue_id is null)
  )
$$;

-- ===========================================================================
-- Règles métier appliquées par triggers
-- ===========================================================================

-- Une invitation ne peut être créée que si le contact est invitable.
create or replace function trg_invitation_guard() returns trigger
language plpgsql as $$
declare
  c contacts;
  e events;
begin
  select * into c from contacts where id = new.contact_id;
  select * into e from events   where id = new.event_id;

  if c.workspace_id <> e.workspace_id then
    raise exception 'Contact et soirée appartiennent à des espaces différents';
  end if;
  if c.status in ('inactive', 'unsubscribed') then
    raise exception 'Contact @% non invitable (statut %)', c.instagram_handle, c.status;
  end if;
  if not has_consent(c.id, e.venue_id, 'invitations') then
    raise exception 'Aucun consentement actif d''invitation pour @% et cet établissement', c.instagram_handle;
  end if;
  if e.alcohol_offer and c.adult_verified_at is null then
    raise exception 'Majorité non vérifiée pour @% : invitation avec alcool interdite', c.instagram_handle;
  end if;
  if e.status not in ('draft', 'open') then
    raise exception 'La soirée est fermée aux nouvelles invitations';
  end if;
  return new;
end $$;

create trigger invitation_guard before insert on invitations
  for each row execute function trg_invitation_guard();

-- Transitions d'invitation : horodatages, relance unique, signalement des absences.
create or replace function trg_invitation_update() returns trigger
language plpgsql as $$
declare
  ws        workspaces;
  no_shows  int;
begin
  -- Le rôle "door" ne peut modifier QUE la présence.
  if app_uid() is not null
     and not exists (select 1 from events e where e.id = new.event_id
                     and is_member(e.workspace_id, '{owner,promoter}'))
     and (to_jsonb(new) - 'attendance' - 'checked_in_at' - 'checked_in_by')
      <> (to_jsonb(old) - 'attendance' - 'checked_in_at' - 'checked_in_by') then
    raise exception 'Le contrôle à l''entrée ne peut modifier que la présence';
  end if;

  if new.relance_count > old.relance_count then
    if old.status <> 'sent' then
      raise exception 'Relance possible uniquement sur une invitation envoyée sans réponse';
    end if;
    new.relanced_at := now();
  end if;

  if new.status = 'sent' and old.status = 'prepared' then
    new.sent_at := coalesce(new.sent_at, now());
  end if;
  if new.status in ('yes', 'no', 'question') and old.status <> new.status then
    new.responded_at := coalesce(new.responded_at, now());
  end if;
  if new.status = 'yes' and old.status <> 'yes' then
    new.confirmed_at := now();
  end if;

  if new.attendance <> old.attendance then
    if new.attendance = 'present' then
      new.checked_in_at := now();
      new.checked_in_by := app_uid();
    end if;

    -- Absence après confirmation : compte et applique le seuil réglable.
    if new.attendance = 'absent' and new.status = 'yes' then
      select w.* into ws from workspaces w
        join events e on e.workspace_id = w.id where e.id = new.event_id;
      select count(*) + 1 into no_shows
        from invitations i
        where i.contact_id = new.contact_id and i.status = 'yes'
          and i.attendance = 'absent' and i.id <> new.id;
      if no_shows >= ws.no_show_threshold then
        update contacts
          set status = case when ws.auto_deactivate then 'inactive'::contact_status
                            else 'flagged'::contact_status end,
              updated_at = now()
          where id = new.contact_id and status in ('active', 'flagged');
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger invitation_update before update on invitations
  for each row execute function trg_invitation_update();

-- Audit automatique des tables sensibles.
create or replace function trg_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ws  uuid;
  row jsonb := to_jsonb(coalesce(new, old));
begin
  ws := coalesce(
    (row->>'workspace_id')::uuid,
    (select e.workspace_id from events e where e.id = (row->>'event_id')::uuid),
    (select c.workspace_id from contacts c where c.id = (row->>'contact_id')::uuid)
  );
  perform log_action(ws, lower(tg_op), tg_table_name, (row->>'id')::uuid,
                     case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
                          else row end);
  return coalesce(new, old);
end $$;

create trigger audit_contacts    after insert or update or delete on contacts    for each row execute function trg_audit();
create trigger audit_consents    after insert or update or delete on consents    for each row execute function trg_audit();
create trigger audit_events      after insert or update or delete on events      for each row execute function trg_audit();
create trigger audit_invitations after insert or update or delete on invitations for each row execute function trg_audit();
create trigger audit_payments    after insert or update or delete on commission_payments for each row execute function trg_audit();

-- ===========================================================================
-- Actions métier (appelées par l'interface ET par JARVIS — mêmes garde-fous)
-- ===========================================================================

-- Relance unique.
create or replace function relance_invitation(inv uuid) returns invitations
language plpgsql as $$
declare r invitations;
begin
  update invitations set relance_count = relance_count + 1
    where id = inv returning * into r;
  if r.id is null then raise exception 'Invitation introuvable'; end if;
  return r;
end $$;

-- Désinscription : révoque les consentements et annule les invitations en cours.
create or replace function unsubscribe_contact(c uuid) returns void
language plpgsql as $$
begin
  update contacts set status = 'unsubscribed', updated_at = now() where id = c;
  update consents set revoked_at = now() where contact_id = c and revoked_at is null;
  update invitations i set status = 'cancelled'
    from events e
    where i.event_id = e.id and i.contact_id = c
      and i.status in ('prepared', 'sent', 'question', 'yes')
      and e.starts_at > now();
end $$;

-- ===========================================================================
-- Vues analytiques (security_invoker : la RLS des tables s'applique)
-- ===========================================================================

create view contact_stats with (security_invoker = true) as
select
  c.id as contact_id, c.workspace_id, c.instagram_handle, c.status,
  count(i.id) filter (where i.status <> 'prepared' and i.status <> 'cancelled') as invitations_received,
  count(i.id) filter (where i.status = 'yes')                                   as positive_replies,
  count(i.id) filter (where i.attendance = 'present')                           as attendances,
  count(i.id) filter (where i.status = 'yes' and i.attendance = 'absent')       as no_shows,
  case when count(i.id) filter (where i.status = 'yes' and i.attendance <> 'unknown') = 0 then null
       else round(count(i.id) filter (where i.attendance = 'present')::numeric
                  / count(i.id) filter (where i.status = 'yes' and i.attendance <> 'unknown'), 3)
  end as reliability,
  max(i.sent_at) as last_invited_at
from contacts c
left join invitations i on i.contact_id = c.id
group by c.id;

create view event_report with (security_invoker = true) as
with agg as (
  select
    e.id as event_id,
    count(i.id) filter (where i.status not in ('prepared', 'cancelled'))      as invited,
    count(i.id) filter (where i.status in ('yes', 'no', 'question'))          as replied,
    count(i.id) filter (where i.status = 'yes')                               as accepted,
    count(i.id) filter (where i.attendance = 'present')                       as present,
    count(i.id) filter (where i.status = 'yes' and i.attendance = 'absent')   as no_shows,
    count(i.id) filter (where i.relance_count > 0)                            as relanced
  from events e left join invitations i on i.event_id = e.id
  group by e.id
)
select
  e.id as event_id, e.workspace_id, e.venue_id, v.name as venue, e.title, e.starts_at, e.status,
  e.target_guests, a.invited, a.replied, a.accepted, a.present, a.no_shows, a.relanced,
  round(a.replied::numeric  / nullif(a.invited, 0), 3) as reply_rate,
  round(a.accepted::numeric / nullif(a.invited, 0), 3) as accept_rate,
  round(a.present::numeric  / nullif(a.invited, 0), 3) as presence_rate,
  round(a.present::numeric  / nullif(a.accepted, 0), 3) as show_up_rate,
  a.present / v.group_size                               as groups_filled,
  (a.present / v.group_size) * v.commission_per_group    as commission_due,
  coalesce((select sum(p.amount) from commission_payments p where p.event_id = e.id), 0) as commission_paid
from events e
join venues v on v.id = e.venue_id
join agg a on a.event_id = e.id;

-- Comparaison A/B : le gagnant se juge sur les PRÉSENCES, pas sur les réponses.
create view template_performance with (security_invoker = true) as
select
  t.id as template_id, t.workspace_id, t.name, t.variant,
  count(i.id) filter (where i.status not in ('prepared', 'cancelled'))  as sent,
  round(count(i.id) filter (where i.status in ('yes', 'no', 'question'))::numeric
        / nullif(count(i.id) filter (where i.status not in ('prepared', 'cancelled')), 0), 3) as reply_rate,
  round(count(i.id) filter (where i.status = 'yes')::numeric
        / nullif(count(i.id) filter (where i.status not in ('prepared', 'cancelled')), 0), 3) as accept_rate,
  round(count(i.id) filter (where i.attendance = 'present')::numeric
        / nullif(count(i.id) filter (where i.status not in ('prepared', 'cancelled')), 0), 3) as presence_rate
from message_templates t
left join invitations i on i.template_id = t.id
where t.kind = 'invitation'
group by t.id;

create view monthly_revenue with (security_invoker = true) as
select workspace_id, date_trunc('month', starts_at)::date as month,
       sum(groups_filled) as groups_filled,
       sum(commission_due) as commission_due,
       sum(commission_paid) as commission_paid
from event_report
group by workspace_id, date_trunc('month', starts_at);

-- ===========================================================================
-- Row Level Security : séparation stricte par espace de travail et par rôle
-- ===========================================================================
alter table workspaces          enable row level security;
alter table workspace_members   enable row level security;
alter table venues              enable row level security;
alter table contacts            enable row level security;
alter table consents            enable row level security;
alter table message_templates   enable row level security;
alter table events              enable row level security;
alter table invitations         enable row level security;
alter table messages            enable row level security;
alter table commission_payments enable row level security;
alter table audit_log           enable row level security;

-- Lecture : tout membre. Écriture : selon le rôle.
create policy ws_read   on workspaces        for select using (is_member(id));
create policy ws_update on workspaces        for update using (is_member(id, '{owner}'));
create policy wm_read   on workspace_members for select using (is_member(workspace_id));
create policy wm_write  on workspace_members for all    using (is_member(workspace_id, '{owner}'));

create policy venues_read  on venues for select using (is_member(workspace_id));
create policy venues_write on venues for all    using (is_member(workspace_id, '{owner}'));

-- Le rôle "door" (contrôle à l'entrée) ne voit pas la base contacts complète :
-- seulement les contacts invités à une soirée (via la vue/requête des invitations).
create policy contacts_read on contacts for select using (
  is_member(workspace_id, '{owner,promoter,analyst}')
  or (is_member(workspace_id, '{door}') and exists (
        select 1 from invitations i where i.contact_id = contacts.id and i.status = 'yes'))
);
create policy contacts_write on contacts for all
  using (is_member(workspace_id, '{owner,promoter}'))
  with check (is_member(workspace_id, '{owner,promoter}'));

create policy consents_rw on consents for all
  using (exists (select 1 from contacts c where c.id = contact_id and is_member(c.workspace_id, '{owner,promoter}')))
  with check (exists (select 1 from contacts c where c.id = contact_id and is_member(c.workspace_id, '{owner,promoter}')));

create policy templates_read  on message_templates for select using (is_member(workspace_id));
create policy templates_write on message_templates for all    using (is_member(workspace_id, '{owner,promoter}'));

create policy events_read  on events for select using (is_member(workspace_id));
create policy events_write on events for all    using (is_member(workspace_id, '{owner,promoter}'));

create policy inv_read on invitations for select using (
  exists (select 1 from events e where e.id = event_id and is_member(e.workspace_id)));
create policy inv_write on invitations for insert with check (
  exists (select 1 from events e where e.id = event_id and is_member(e.workspace_id, '{owner,promoter}')));
-- "door" peut mettre à jour (pointer les arrivées) ; le trigger encadre les transitions.
create policy inv_update on invitations for update using (
  exists (select 1 from events e where e.id = event_id and is_member(e.workspace_id, '{owner,promoter,door}')));
create policy inv_delete on invitations for delete using (
  exists (select 1 from events e where e.id = event_id and is_member(e.workspace_id, '{owner}')));

create policy msg_rw on messages for all using (
  exists (select 1 from contacts c where c.id = contact_id and is_member(c.workspace_id, '{owner,promoter}')));

create policy pay_read  on commission_payments for select using (
  exists (select 1 from events e where e.id = event_id and is_member(e.workspace_id, '{owner,analyst}')));
create policy pay_write on commission_payments for all using (
  exists (select 1 from events e where e.id = event_id and is_member(e.workspace_id, '{owner}')));

create policy audit_read on audit_log for select using (is_member(workspace_id, '{owner}'));
-- Pas de policy d'écriture : le journal n'est alimenté que par les triggers (security definer).
