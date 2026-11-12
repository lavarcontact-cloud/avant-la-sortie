-- Phase 2 : veille commerciale, prévisions, valeur d'audience.
-- Migration strictement additive : aucune table ni donnée supprimée.

-- Mots-clés de veille par secteur (modifiables dans Paramètres).
alter table sectors add column if not exists keywords text[] not null default '{}';
update sectors set keywords = array['caméra hybride','objectif photo','microphone créateur','éclairage vidéo','drone','smartphone','logiciel montage vidéo','accessoires vidéo']
  where name = 'Tech & Creator Economy' and keywords = '{}';
update sectors set keywords = array['streetwear','sneakers','marque de vêtements','nouvelle collection','accessoires mode']
  where name = 'Fashion & Streetwear' and keywords = '{}';
update sectors set keywords = array['équipement sportif','football','basketball','fitness','vêtements de sport']
  where name = 'Sport & Performance' and keywords = '{}';
update sectors set keywords = array['restaurant','concept culinaire','boisson','marque de boissons','lieu événementiel']
  where name = 'Food & Lifestyle' and keywords = '{}';
update sectors set keywords = array['label musique','festival','plateforme musicale','salle de concert','production musicale']
  where name = 'Music & Entertainment' and keywords = '{}';

-- Historique des statuts : base des taux de transformation réels du pipeline.
create table if not exists brand_stage_history (
  id serial primary key,
  brand_id int not null references brands(id) on delete cascade,
  stage_id int references pipeline_stages(id) on delete set null,
  stage_key text,
  changed_at timestamptz not null default now()
);
create index if not exists brand_stage_history_brand_idx on brand_stage_history(brand_id);

create or replace function log_brand_stage() returns trigger as $$
begin
  if (tg_op = 'INSERT') or (new.stage_id is distinct from old.stage_id) then
    insert into brand_stage_history (brand_id, stage_id, stage_key)
    values (new.id, new.stage_id, (select key from pipeline_stages where id = new.stage_id));
  end if;
  return new;
end
$$ language plpgsql;

drop trigger if exists brands_stage_history on brands;
create trigger brands_stage_history after insert or update of stage_id on brands
  for each row execute function log_brand_stage();

-- Reprise de l'existant : le statut actuel devient la première entrée d'historique.
insert into brand_stage_history (brand_id, stage_id, stage_key, changed_at)
  select b.id, b.stage_id, s.key, b.updated_at from brands b left join pipeline_stages s on s.id = b.stage_id
  where not exists (select 1 from brand_stage_history h where h.brand_id = b.id);

-- Veille commerciale
create table if not exists watch_runs (
  id serial primary key,
  provider text not null,
  trigger text not null default 'manual',
  status text not null default 'running' check (status in ('running','done','failed','skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  queries jsonb not null default '[]'::jsonb,
  results int not null default 0,
  new_brands int not null default 0,
  new_contacts int not null default 0,
  updated int not null default 0,
  known int not null default 0,
  error text
);

-- Une ligne par marque ou interlocuteur découvert. dedup_key unique : jamais deux fois la même découverte.
create table if not exists watch_candidates (
  id serial primary key,
  kind text not null check (kind in ('brand','contact')),
  dedup_key text not null unique,
  status text not null default 'new' check (status in ('new','known','accepted','dismissed')),
  first_run_id int references watch_runs(id) on delete set null,
  last_run_id int references watch_runs(id) on delete set null,
  brand_id int references brands(id) on delete set null,
  parent_id int references watch_candidates(id) on delete cascade,
  sector_id int references sectors(id) on delete set null,
  name text,
  domain text,
  url text not null,
  title text,
  snippet text,
  person_name text,
  person_role text,
  company text,
  platform text,
  signals text[] not null default '{}',
  opportunities text[] not null default '{}',
  score int,
  score_breakdown jsonb,
  contact_quality text,
  source_query text,
  source_provider text,
  previous jsonb,
  changed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count int not null default 1,
  verified_at date
);
create index if not exists watch_candidates_status_idx on watch_candidates(status, kind);
create index if not exists watch_candidates_domain_idx on watch_candidates(domain);

-- Audience : comptes séparés par entité (personnel, La Var Media…), jamais additionnés entre entités.
create table if not exists social_accounts (
  id serial primary key,
  owner text not null default 'personal',
  platform text not null,
  handle text not null,
  url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner, platform, handle)
);

create table if not exists social_snapshots (
  id serial primary key,
  account_id int not null references social_accounts(id) on delete cascade,
  captured_on date not null,
  followers int,
  views_30d bigint,
  views_90d bigint,
  reach_30d bigint,
  impressions_30d bigint,
  engagements_30d bigint,
  posts_30d int,
  avg_story_views int,
  audience_geo text,
  audience_age text,
  audience_gender text,
  top_content text,
  source text not null,
  source_detail text,
  created_at timestamptz not null default now(),
  unique (account_id, captured_on)
);

-- Historique des prévisions (une par jour, par mois cible et par scénario) pour mesurer leur précision.
create table if not exists forecast_snapshots (
  id serial primary key,
  kind text not null check (kind in ('business','audience')),
  made_on date not null,
  target_month text not null,
  scenario text not null check (scenario in ('prudent','central','ambitious')),
  contracts numeric(10,2),
  revenue numeric(12,2),
  weighted numeric(12,2),
  collected numeric(12,2),
  followers bigint,
  confidence text,
  assumptions jsonb,
  created_at timestamptz not null default now(),
  unique (kind, made_on, target_month, scenario)
);

do $$
declare t text;
begin
  foreach t in array array['brand_stage_history','watch_runs','watch_candidates','social_accounts','social_snapshots','forecast_snapshots']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
