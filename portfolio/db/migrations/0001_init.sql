-- Schéma initial. Les montants sont en centimes (entiers), jamais en
-- flottants. Aucune donnée de carte bancaire n'est stockée : Stripe s'en
-- charge, on ne conserve que les identifiants de session / paiement.

CREATE TABLE IF NOT EXISTS quotes (
  id            uuid PRIMARY KEY,
  ref           text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'nouveau',
  service       text NOT NULL,
  project_ref   text,
  name          text NOT NULL,
  email         text NOT NULL,
  phone         text,
  company       text,
  client_role   text NOT NULL,
  client_type   text NOT NULL,
  description   text NOT NULL,
  date_wish     text,
  budget_range  text NOT NULL,
  location      text,
  utm_source    text,
  admin_notes   text
);
CREATE INDEX IF NOT EXISTS quotes_created_idx ON quotes (created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id                   uuid PRIMARY KEY,
  ref                  text NOT NULL UNIQUE,
  quote_id             uuid REFERENCES quotes(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  customer_name        text NOT NULL,
  customer_email       text NOT NULL,
  client_type          text NOT NULL,
  label                text NOT NULL,
  total_cents          integer NOT NULL CHECK (total_cents > 0),
  deposit_cents        integer NOT NULL CHECK (deposit_cents >= 0),
  currency             text NOT NULL DEFAULT 'eur',
  status               text NOT NULL DEFAULT 'en_attente_acompte',
  pay_token            text NOT NULL UNIQUE,
  terms_version        text NOT NULL,
  waiver_at            timestamptz,
  CHECK (deposit_cents <= total_cents)
);

CREATE TABLE IF NOT EXISTS payments (
  id                     uuid PRIMARY KEY,
  order_id               uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind                   text NOT NULL,
  amount_cents           integer NOT NULL CHECK (amount_cents > 0),
  status                 text NOT NULL DEFAULT 'cree',
  stripe_session_id      text UNIQUE,
  stripe_payment_intent  text,
  refunded_cents         integer NOT NULL DEFAULT 0,
  livemode               boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);

-- Idempotence des webhooks : un événement Stripe n'est traité qu'une fois.
CREATE TABLE IF NOT EXISTS stripe_events (
  id           text PRIMARY KEY,
  type         text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now()
);

-- Mesure d'audience first-party. L'id vient du client : un renvoi du même
-- lot est ignoré (ON CONFLICT DO NOTHING). Pas d'adresse IP stockée.
CREATE TABLE IF NOT EXISTS events (
  id               uuid PRIMARY KEY,
  name             text NOT NULL,
  ts               timestamptz NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now(),
  sid              text,
  vid              text,
  path             text,
  props            jsonb NOT NULL DEFAULT '{}'::jsonb,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  referrer_domain  text,
  device           text,
  country          text,
  internal         boolean NOT NULL DEFAULT false,
  server_side      boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS events_name_ts_idx ON events (name, ts DESC);
CREATE INDEX IF NOT EXISTS events_ts_idx ON events (ts DESC);

-- Preuve du consentement : identifiant aléatoire, choix, version, date.
CREATE TABLE IF NOT EXISTS consents (
  seq          bigserial PRIMARY KEY,
  consent_id   text NOT NULL,
  version      text NOT NULL,
  choices      jsonb NOT NULL,
  action       text NOT NULL,
  ua_family    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consents_id_idx ON consents (consent_id);

-- Limitation de débit partagée entre instances serverless.
CREATE TABLE IF NOT EXISTS rate_limits (
  key           text PRIMARY KEY,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL
);

-- Demandes de rétractation (bouton de rétractation en ligne, C. conso).
CREATE TABLE IF NOT EXISTS withdrawals (
  id          uuid PRIMARY KEY,
  ref         text NOT NULL UNIQUE,
  order_ref   text,
  name        text NOT NULL,
  email       text NOT NULL,
  message     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
