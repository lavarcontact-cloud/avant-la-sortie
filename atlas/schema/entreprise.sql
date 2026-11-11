-- ATLAS — module Entreprise (création et pilotage)
-- STATUT : brouillon, NON appliqué. Extension ADDITIVE de schema/noyau.sql :
-- aucune table du noyau n'est modifiée. À appliquer après noyau.sql.

-- ─────────────────────────────── Paramètres réglementaires datés ───────────────────────────────
-- Chaque taux / seuil utilisé dans un calcul vient d'ici, avec sa source et sa période de validité.
create table regulatory_params (
  id            uuid primary key default gen_random_uuid(),
  key           text not null,                -- 'micro.cotisations.bnc', 'tva.franchise.services', …
  value         numeric not null,
  unit          text not null,                -- 'taux', 'eur_an', 'eur_mois'
  valid_from    date not null,
  valid_to      date,
  source_url    text not null,
  verified_on   date not null,
  unique (key, valid_from)
);

-- ─────────────────────────────── Profil de l'entreprise ───────────────────────────────
create type business_status as enum ('projet', 'micro', 'ei_reel', 'sasu', 'eurl', 'autre');
create type activity_nature as enum ('bnc', 'bic_services', 'vente', 'artiste_auteur');

create table business_profiles (
  entity_id          uuid primary key references entities(id),
  status             business_status not null default 'projet',
  started_on         date,                     -- date de début d'activité (justificatif)
  acre_requested_on  date,
  acre_granted       boolean,
  acre_ends_on       date,
  vfl                boolean not null default false,
  vat_franchise      boolean not null default true,
  siren              text,                      -- vide tant que non immatriculé, jamais inventé
  notes              text
);

create table business_activities (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id),
  label       text not null,                  -- 'Photographie', 'Montage', 'Développement d'applications'
  nature      activity_nature not null,
  is_main     boolean not null default false,
  regulated   text                             -- 'drone', 'entrepreneur de spectacles', …
);

-- ─────────────────────────────── Clients, devis, factures ───────────────────────────────
create type client_kind as enum ('particulier', 'artiste', 'label', 'entreprise', 'association', 'collectivite', 'autre');

create table clients (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id),
  name        text not null,
  kind        client_kind not null,
  email       text,
  phone       text,
  siren       text,
  address     text,
  source      text,
  notes       text,
  deleted_at  timestamptz
);

create type invoice_status as enum ('brouillon', 'emise', 'partielle', 'payee', 'annulee');

create table invoices (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id),
  number        text not null,                 -- séquence continue, sans trou
  client_id     uuid not null references clients(id),
  project_id    uuid references projects(id),
  activity_id   uuid references business_activities(id),
  issued_on     date not null,
  due_on        date,
  amount_ht_cents  bigint not null,
  vat_cents        bigint not null default 0,
  status        invoice_status not null default 'brouillon',
  document_id   uuid references documents(id), -- PDF / facture électronique
  unique (entity_id, number)
);

-- Livre des recettes : un encaissement réel, rattaché à une transaction bancaire quand elle existe.
-- Une facture n'est « payée » que par la somme de ses encaissements, jamais par simple déclaration.
create table receipts (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id),
  received_on    date not null,
  invoice_id     uuid references invoices(id),
  client_id      uuid references clients(id),
  nature         activity_nature not null,
  amount_cents   bigint not null check (amount_cents > 0),
  payment_method text not null,
  transaction_id uuid references transactions(id),
  origin         data_origin not null
);

-- ─────────────────────────────── Provisions et déclarations ───────────────────────────────
create table provisions (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references entities(id),
  period          date not null,                -- 1er jour du mois
  kind            text not null,                -- 'cotisations', 'vfl', 'ir_estime', 'tva', 'securite'
  amount_cents    bigint not null,
  computed_from   jsonb not null,               -- ids des receipts + regulatory_params utilisés
  origin          data_origin not null default 'computed',
  unique (entity_id, period, kind)
);

create table declarations (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id),
  organism      text not null,                  -- 'urssaf', 'caf', 'impots'
  period_start  date not null,
  period_end    date not null,
  figures       jsonb not null,                 -- montants préparés par nature
  prepared_at   timestamptz not null default now(),
  action_request_id uuid references action_requests(id), -- validation de Sébastien
  submitted_by_user_at timestamptz,             -- déclarée par Sébastien lui-même
  proof_document_id uuid references documents(id)
);

-- ─────────────────────────────── Comparaison des statuts ───────────────────────────────
create table status_simulations (
  id            uuid primary key default gen_random_uuid(),
  run_at        timestamptz not null default now(),
  engine        text not null,                  -- 'modele-social@11.1.0'
  assumptions   jsonb not null,
  results       jsonb not null
);
