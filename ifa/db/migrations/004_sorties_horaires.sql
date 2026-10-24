-- Heure précise de sortie (la date seule ne suffit pas : single à minuit, clip à 20 h).
alter table releases add column release_at timestamptz;
update releases set release_at = (release_date::timestamp at time zone 'Europe/Paris') where release_at is null and release_date is not null;

-- Contenus officiels livrés avec le code (assets/official/content.json), importés une seule fois chacun.
create table official_imports (
  key         text primary key,
  imported_at timestamptz not null default now()
);
