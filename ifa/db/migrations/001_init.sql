-- Fréquence — schéma initial
-- Conventions : uuid partout, horodatage timestamptz, statuts en texte contraint.
-- Toutes les règles d'accès sont appliquées côté API (server/lib/access.js) ;
-- la base ne fait confiance à aucun client.

create extension if not exists citext;

-- ---------------------------------------------------------------- comptes
create table users (
  id               uuid primary key default gen_random_uuid(),
  email            citext not null unique,
  password_hash    text not null,
  handle           citext not null unique check (handle ~ '^[a-zA-Z0-9_.]{3,24}$'),
  display_name     text check (char_length(display_name) <= 40),
  bio              text check (char_length(bio) <= 160),
  avatar_media_id  uuid,                                   -- réservé aux comptes officiels
  -- les fans n'envoient pas de photo de profil : avatar généré (couleur + glyphe),
  -- aucune photo de mineur exposée, aucune modération d'avatar nécessaire
  avatar_style     text not null default 'sodium:◉',
  role             text not null default 'fan' check (role in ('fan','moderator','editor','admin')),
  is_official      boolean not null default false,          -- compte officiel vérifié (Ifa / équipe)
  -- minimisation : année + mois de naissance seulement, jamais la date complète
  birth_year       int not null,
  birth_month      int not null check (birth_month between 1 and 12),
  status           text not null default 'active'
                   check (status in ('active','pending_parent','suspended','deleted')),
  parent_email     citext,
  parent_token_hash text,
  parent_consent_at timestamptz,
  terms_version    text not null,
  terms_accepted_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz
);

create table sessions (
  token_hash  text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index on sessions(user_id);

-- ---------------------------------------------------------------- médias
-- Les fichiers ne sont jamais servis en statique : tout passe par
-- /api/media/:id, qui vérifie la visibilité et, pour les fichiers
-- 'protected', les droits et la fenêtre d'ouverture du contenu associé.
create table media (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references users(id) on delete set null,
  kind        text not null check (kind in ('image','video','audio')),
  mime        text not null,
  size_bytes  bigint not null,
  storage_key text not null unique,
  visibility  text not null default 'public' check (visibility in ('public','protected')),
  created_at  timestamptz not null default now()
);
alter table users add constraint users_avatar_fk foreign key (avatar_media_id) references media(id) on delete set null;

-- ---------------------------------------------------------------- profil officiel
create table artist_profile (
  id              int primary key default 1 check (id = 1),
  name            text not null default 'Ifa',
  tagline         text,
  bio             text,
  avatar_media_id uuid references media(id) on delete set null,
  banner_media_id uuid references media(id) on delete set null,
  -- liens vérifiés uniquement, saisis par l'équipe : {"instagram": "...", "spotify": "..."}
  links           jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);
insert into artist_profile (id) values (1);

-- ---------------------------------------------------------------- contenus officiels (Le QG)
create table posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid references users(id) on delete set null,
  kind            text not null check (kind in
                  ('news','announcement','release','clip','freestyle','video','backstage','story','event')),
  title           text not null check (char_length(title) <= 140),
  body            text check (char_length(body) <= 5000),
  media_id        uuid references media(id) on delete set null,
  -- provenance : créé dans l'app / ajouté à la main par l'équipe / importé par une intégration autorisée
  source_type     text not null default 'app' check (source_type in ('app','manual','integration')),
  source_platform text check (source_platform in ('instagram','tiktok','snapchat','youtube','spotify','deezer','apple_music','press','other')),
  source_url      text,
  external_id     text unique,                     -- dédoublonnage des imports
  status          text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  publish_at      timestamptz,
  expires_at      timestamptz,                     -- stories temporaires
  is_pinned       boolean not null default false,
  is_featured     boolean not null default false,  -- mis en avant dans Immersion
  notify          boolean not null default false,  -- envoyer un signal à la publication
  notified_at     timestamptz,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on posts(status, publish_at desc);

-- ---------------------------------------------------------------- discographie & agenda
create table releases (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  kind           text not null check (kind in ('single','ep','album','mixtape','clip','freestyle')),
  release_date   date,
  cover_media_id uuid references media(id) on delete set null,
  description    text,
  links          jsonb not null default '{}'::jsonb,
  is_published   boolean not null default true,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now()
);

create table events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kind        text not null check (kind in ('concert','showcase','release_party','appearance','live','qa','meetup')),
  venue       text,
  city        text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  ticket_url  text,
  -- seul un événement confirmé est affiché aux fans
  status      text not null default 'confirmed' check (status in ('draft','confirmed','postponed','cancelled')),
  age_policy  text,                   -- ex. "16+ accompagné", "tous publics"
  description text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on events(starts_at);

-- ---------------------------------------------------------------- communauté
create table circles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null,
  description text,
  kind        text not null default 'permanent' check (kind in ('permanent','release_room')),
  ends_at     timestamptz,             -- salles temporaires de sortie
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);
create table circle_members (
  circle_id uuid not null references circles(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table badges (
  code        text primary key,
  name        text not null,
  description text not null,
  glyph       text not null default '◆'
);
create table user_badges (
  user_id    uuid not null references users(id) on delete cascade,
  badge_code text not null references badges(code) on delete cascade,
  awarded_at timestamptz not null default now(),
  reason     text,
  primary key (user_id, badge_code)
);

create table challenges (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  brief          text not null,
  rules          text,
  cover_media_id uuid references media(id) on delete set null,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  reward_badge   text references badges(code) on delete set null,
  is_published   boolean not null default true,
  notified_at    timestamptz,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- Le Labo (avant-premières)
create table drops (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  teaser             text,                        -- visible avant ouverture
  body               text,                        -- visible après ouverture seulement
  kind               text not null check (kind in ('preview','vote','process','experience')),
  cover_media_id     uuid references media(id) on delete set null,   -- visuel public
  media_id           uuid references media(id) on delete set null,   -- fichier confidentiel (protected)
  opens_at           timestamptz not null,
  closes_at          timestamptz,
  access             text not null default 'members' check (access in ('members','badge','circle')),
  required_badge     text references badges(code) on delete set null,
  required_circle_id uuid references circles(id) on delete set null,
  rights_note        text,                        -- ex. "Extrait autorisé par le label jusqu'au 12/11"
  is_published       boolean not null default false,
  notify_on_open     boolean not null default true,
  notified_at        timestamptz,
  is_demo            boolean not null default false,
  created_by         uuid references users(id) on delete set null,
  created_at         timestamptz not null default now()
);
create table drop_options (
  id        uuid primary key default gen_random_uuid(),
  drop_id   uuid not null references drops(id) on delete cascade,
  label     text not null,
  media_id  uuid references media(id) on delete set null,
  position  int not null default 0
);
create table drop_votes (
  drop_id   uuid not null references drops(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  option_id uuid not null references drop_options(id) on delete cascade,
  voted_at  timestamptz not null default now(),
  primary key (drop_id, user_id)
);

-- ---------------------------------------------------------------- créations des fans
create table fan_posts (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references users(id) on delete cascade,
  circle_id         uuid references circles(id) on delete set null,
  challenge_id      uuid references challenges(id) on delete set null,
  caption           text check (char_length(caption) <= 500),
  media_id          uuid not null references media(id) on delete cascade,
  -- pré-modération systématique : rien n'est public avant validation
  status            text not null default 'pending' check (status in ('pending','approved','rejected','removed')),
  moderation_note   text,
  moderated_by      uuid references users(id) on delete set null,
  moderated_at      timestamptz,
  is_featured       boolean not null default false,
  rights_accepted_at timestamptz not null,
  created_at        timestamptz not null default now()
);
create index on fan_posts(status, created_at desc);

create table comments (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post','fan_post')),
  target_id   uuid not null,
  author_id   uuid not null references users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  status      text not null default 'visible' check (status in ('visible','hidden','removed')),
  created_at  timestamptz not null default now()
);
create index on comments(target_type, target_id, created_at);

create table reactions (
  user_id     uuid not null references users(id) on delete cascade,
  target_type text not null check (target_type in ('post','fan_post')),
  target_id   uuid not null,
  kind        text not null check (kind in ('like','save')),
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id, kind)
);
create index on reactions(target_type, target_id, kind);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete set null,
  target_type text not null check (target_type in ('post','fan_post','comment','user')),
  target_id   uuid not null,
  reason      text not null check (reason in ('harassment','hate','sexual','violence','spam','personal_info','copyright','minor_safety','other')),
  details     text check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create table blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ---------------------------------------------------------------- notifications
create table notification_prefs (
  user_id      uuid primary key references users(id) on delete cascade,
  categories   jsonb not null,   -- {"news":true,"drop":true,...}
  frequency    text not null default 'all' check (frequency in ('all','important','off')),
  quiet_start  int not null default 22 check (quiet_start between 0 and 23),
  quiet_end    int not null default 8  check (quiet_end between 0 and 23),
  personalized boolean not null default true,
  updated_at   timestamptz not null default now()
);

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  broadcast_id uuid,
  category   text not null,
  title      text not null,
  body       text,
  url        text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index on notifications(user_id, created_at desc);

-- un "signal" programmé par l'équipe, puis distribué (in-app + push si configuré)
create table broadcasts (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('news','drop','release','event','challenge','exclusive','announcement')),
  importance  text not null default 'normal' check (importance in ('normal','important')),
  title       text not null check (char_length(title) <= 80),
  body        text check (char_length(body) <= 200),
  url         text,
  send_at     timestamptz not null,
  status      text not null default 'scheduled' check (status in ('scheduled','sending','sent','cancelled','failed')),
  origin      text not null default 'manual',     -- manual | post:<id> | drop:<id> | challenge:<id>
  stats       jsonb,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index on broadcasts(status, send_at);

-- ---------------------------------------------------------------- mesure & traçabilité
-- Mesure d'audience agrégée, sans profil publicitaire.
create table daily_activity (
  user_id uuid not null references users(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
create table content_views (
  target_type text not null,
  target_id   uuid not null,
  day         date not null,
  views       int not null default 0,
  primary key (target_type, target_id, day)
);

create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references users(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- données de référence (non fictives)
insert into badges (code, name, description, glyph) values
  ('premiere_onde', 'Première onde', 'A rejoint Fréquence pendant la phase de lancement.', '◉'),
  ('createur',      'Créateur',      'Une création publiée après validation par l''équipe.', '▲'),
  ('selection',     'Sélection',     'Une création mise en avant par l''équipe d''Ifa.', '★'),
  ('votant',        'Voix comptée',  'A participé à un vote du Labo.', '◆'),
  ('defi',          'Relevé',        'A participé à un défi.', '✚'),
  ('cercle',        'Dans le cercle','A rejoint un cercle.', '○');
