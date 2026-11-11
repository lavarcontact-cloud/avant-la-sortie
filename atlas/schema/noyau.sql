-- ATLAS — brouillon du schéma du noyau (Postgres / Supabase)
-- STATUT : brouillon de conception, NON appliqué, à valider avec Sébastien.
-- Principes : chaque ligne métier a une entité et une provenance ; rien n'est supprimé
-- physiquement (soft delete + journal) ; les montants sont en centimes (bigint).

create extension if not exists pgcrypto;

-- ─────────────────────────────── Entités (séparation juridique) ───────────────────────────────
create type entity_kind as enum ('personne_physique', 'entreprise', 'association', 'patrimoine');

create table entities (
  id           uuid primary key default gen_random_uuid(),
  kind         entity_kind not null,
  name         text not null,                 -- « Moi », « LA VAR », …
  legal_ids    jsonb not null default '{}',   -- SIREN, SIRET, RNA… (à vérifier, jamais inventés)
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);

-- ─────────────────────────────── Provenance ───────────────────────────────
create type data_origin as enum (
  'bank_sync', 'file_import', 'manual', 'estimated', 'computed',
  'email_extracted', 'ai_extracted', 'connector'
);

-- Colonnes de provenance répétées sur chaque table métier :
--   origin data_origin, source_ref text, observed_at timestamptz, confidence numeric,
--   verified_by_user boolean

-- ─────────────────────────────── Connecteurs ───────────────────────────────
create type connector_status as enum ('connected', 'error', 'expired', 'revoked', 'pending');

create table connectors (
  id             uuid primary key default gen_random_uuid(),
  service        text not null,                -- 'qonto', 'gmail', 'aggregator:powens', …
  account_label  text not null,                -- « Gmail pro », « Nickel perso »
  entity_id      uuid references entities(id),
  scopes         text[] not null default '{}',
  status         connector_status not null default 'pending',
  last_sync_at   timestamptz,
  last_error     text,
  secret_ref     text,                         -- référence vers le coffre de secrets, jamais le secret
  created_at     timestamptz not null default now()
);

-- ─────────────────────────────── Comptes, cartes, transactions ───────────────────────────────
create type account_kind as enum ('courant', 'epargne', 'investissement', 'especes', 'autre');

create table accounts (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id),
  institution   text not null,                 -- 'Nickel', 'Qonto', …
  kind          account_kind not null,
  label         text not null,
  iban_masked   text,
  currency      char(3) not null default 'EUR',
  connector_id  uuid references connectors(id),
  archived_at   timestamptz
);

-- Une carte n'a PAS de solde : elle débite un compte.
create table cards (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id),
  label       text not null,
  last4       char(4)
);

create table balances (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id),
  amount_cents bigint not null,
  as_of        timestamptz not null,           -- date réelle du solde, pas date de synchro
  origin       data_origin not null,
  source_ref   text
);

create table transactions (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references accounts(id),
  card_id          uuid references cards(id),
  booked_on        date not null,
  amount_cents     bigint not null,             -- négatif = sortie
  label_raw        text not null,
  counterparty     text,
  category         text,
  category_origin  data_origin,                 -- catégorie proposée par l'IA ou choisie à la main
  recurring_id     uuid,                         -- lien vers une charge récurrente confirmée
  origin           data_origin not null,
  source_ref       text,                         -- id bancaire, nom de fichier CSV + ligne…
  dedupe_key       text unique,
  deleted_at       timestamptz                   -- jamais de suppression physique
);

-- Transferts entre entités : toujours explicites, deux transactions liées.
create table inter_entity_transfers (
  id               uuid primary key default gen_random_uuid(),
  from_tx          uuid not null references transactions(id),
  to_tx            uuid not null references transactions(id),
  nature           text not null,               -- 'apport', 'remboursement_frais', 'refacturation'
  justification_doc uuid
);

create type recurring_status as enum ('proposee', 'active', 'resiliee');

create table recurring_charges (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id),
  account_id     uuid references accounts(id),
  name           text not null,
  amount_cents   bigint not null,
  frequency      text not null,                 -- 'mensuelle', 'annuelle', RRULE…
  next_due_on    date,
  renewal_on     date,
  category       text,
  manage_url     text,
  status         recurring_status not null default 'proposee',
  origin         data_origin not null
);

-- ─────────────────────────────── Documents et échéances ───────────────────────────────
create table documents (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id),
  category       text not null,                 -- 'identite', 'caf', 'rsa', 'france_travail', 'impots', …
  organism       text,
  issued_on      date,
  expires_on     date,
  renew_on       date,
  status         text not null default 'a_classer',
  storage_path   text not null,                 -- bucket privé, jamais public
  summary_plain  text,                          -- résumé « français simple » proposé par l'IA
  extraction     jsonb,                         -- champs extraits + confiance
  verified_by_user boolean not null default false,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create table deadlines (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id),
  domain         text not null,                 -- 'caf', 'france_travail', 'impots', 'urssaf', 'association', …
  title          text not null,
  due_at         timestamptz not null,
  checklist      jsonb not null default '[]',
  document_id    uuid references documents(id),
  source_url     text,                          -- texte officiel
  verified_on    date,                          -- date de vérification de la règle
  status         text not null default 'a_venir'
);

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid references entities(id),
  title       text not null,
  due_at      timestamptz,
  priority    smallint,
  status      text not null default 'ouverte',
  origin      data_origin not null,
  origin_ref  text                               -- appel, conversation, automatisation…
);

-- ─────────────────────────────── Événements (communication entre modules) ───────────────────────────────
create table events (
  id           bigserial primary key,
  type         text not null,                  -- 'invoice.paid', 'document.uploaded', …
  entity_id    uuid references entities(id),
  payload      jsonb not null,
  occurred_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- ─────────────────────────────── Permissions et validations ───────────────────────────────
create table permission_grants (
  id           uuid primary key default gen_random_uuid(),
  tool         text not null,                  -- 'classer_document', 'preparer_virement', …
  entity_id    uuid references entities(id),   -- null = toutes
  connector_id uuid references connectors(id),
  level        smallint not null check (level between 1 and 5),
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz,
  revoked_at   timestamptz
);

create type request_status as enum ('en_attente', 'validee', 'refusee', 'expiree', 'executee', 'echec');

create table action_requests (
  id            uuid primary key default gen_random_uuid(),
  tool          text not null,
  entity_id     uuid references entities(id),
  preview       jsonb not null,                -- ce qui sera exactement fait (montant, destinataire, texte)
  red_list      boolean not null,              -- paiement, déclaration, contrat… : validation unitaire
  requested_by  text not null,                 -- 'assistant', 'automation:<id>', 'voice:<call_id>'
  status        request_status not null default 'en_attente',
  decided_at    timestamptz,
  executed_at   timestamptz,
  result        jsonb,
  expires_at    timestamptz not null
);

-- ─────────────────────────────── Automatisations ───────────────────────────────
create type automation_status as enum ('active', 'pause', 'desactivee');

create table automations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  trigger      jsonb not null,                 -- {type: 'cron'|'event'|'threshold'|'manual', …}
  conditions   jsonb not null default '[]',
  actions      jsonb not null,                 -- catalogue fermé d'actions typées
  status       automation_status not null default 'desactivee',
  created_at   timestamptz not null default now()
);

create table automation_runs (
  id               uuid primary key default gen_random_uuid(),
  automation_id    uuid not null references automations(id),
  idempotency_key  text not null unique,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  outcome          text,                        -- 'ok', 'validation_demandee', 'erreur', 'ignoree'
  log              jsonb not null default '[]',
  error            text
);

-- ─────────────────────────────── Notifications, mémoire, audit ───────────────────────────────
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,                   -- 'briefing_matin', 'alerte_tresorerie', …
  title       text not null,
  body        text not null,
  channels    text[] not null,                 -- 'push', 'email', 'voice'
  data_refs   jsonb not null default '[]',     -- lignes sources justifiant les chiffres
  sent_at     timestamptz,
  read_at     timestamptz
);

create table memory_facts (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,
  value       jsonb not null,
  origin      data_origin not null,
  source_ref  text,
  confirmed   boolean not null default false,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor       text not null,                   -- 'user', 'assistant', 'automation:<id>', 'connector:<id>'
  action      text not null,
  table_name  text,
  row_id      text,
  before      jsonb,
  after       jsonb,
  reason      text
);
-- Le rôle applicatif n'a que INSERT sur audit_log (pas d'UPDATE / DELETE).

-- ─────────────────────────────── Production (P1.6) ───────────────────────────────
create table vendors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  trades         text[] not null default '{}', -- 'cadreur', 'monteur', 'vfx', …
  email          text,
  phone          text,
  usual_rate_cents     bigint,
  negotiated_rate_cents bigint,
  admin_info     jsonb not null default '{}',   -- SIRET, IBAN masqué… (chiffré côté appli)
  notes          text
);

create table projects (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid not null references entities(id),
  name         text not null,
  client       text,
  revenue_cents bigint,
  status       text not null default 'en_cours'
);

create table missions (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id),
  vendor_id        uuid references vendors(id), -- null = Sébastien lui-même
  role             text not null,
  description      text,
  budget_cents     bigint,
  agreed_cents     bigint,
  due_on           date,
  status           text not null default 'prevue',
  invoice_doc_id   uuid references documents(id),
  paid_tx_id       uuid references transactions(id) -- « payée » uniquement avec une transaction réelle
);

create table equipment (
  id                uuid primary key default gen_random_uuid(),
  entity_id         uuid not null references entities(id),
  atlas_ref         text unique,                -- identifiant du registre (ex. ATLAS-EQ-001)
  category          text not null,
  brand             text,
  model             text,
  serial_number     text,
  purchase_on       date,
  purchase_cents    bigint,
  est_value_cents   bigint,
  est_value_method  text,                       -- hypothèses + date ; vide tant que non estimé
  condition_func    text,
  condition_look    text,
  accessories       text,
  location          text,
  owner_confirmed   boolean not null default false,
  verified_by_user  boolean not null default false, -- préremplissage ≠ inventaire certifié
  origin            data_origin not null
);
