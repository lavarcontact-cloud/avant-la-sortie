-- Détail des relevés d'audience (additif, aucune donnée supprimée).
alter table social_snapshots add column if not exists insights jsonb;
alter table social_snapshots add column if not exists derived boolean not null default false;
alter table social_snapshots add column if not exists period text;

-- Performances par contenu (échantillon saisi ou importé depuis les statistiques de la plateforme).
create table if not exists social_content (
  id serial primary key,
  account_id int not null references social_accounts(id) on delete cascade,
  posted_on date,
  kind text not null check (kind in ('post','reel','story','video','live')),
  title text not null,
  views int,
  reach int,
  likes int,
  comments int,
  shares int,
  reposts int,
  saves int,
  replies int,
  source text not null,
  captured_on date not null,
  created_at timestamptz not null default now(),
  unique (account_id, posted_on, kind, title)
);
create index if not exists social_content_account_idx on social_content(account_id);

alter table social_content enable row level security;
