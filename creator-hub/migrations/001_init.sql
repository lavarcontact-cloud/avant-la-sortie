-- Creator Business & PR Hub — schéma initial
-- Compatible PostgreSQL 15+ (Supabase) et PGlite (développement local).
-- Toutes les tables sont accédées côté serveur uniquement. Sur Supabase, la RLS
-- est activée sans aucune policy : l'API publique (anon / authenticated) n'a donc
-- accès à rien. Seule la connexion serveur (DATABASE_URL) lit et écrit.

create table if not exists settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists sectors (
  id serial primary key,
  name text not null unique,
  color text not null default '#64748b',
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Statuts du pipeline. "kind" pilote la logique métier :
-- open = en cours, won = gagné, lost = refus / sans réponse, dnc = ne plus contacter.
create table if not exists pipeline_stages (
  id serial primary key,
  key text not null unique,
  label text not null,
  position int not null,
  kind text not null default 'open' check (kind in ('open','won','lost','dnc'))
);

create table if not exists brands (
  id serial primary key,
  name text not null,
  website text,
  sector_id int references sectors(id) on delete set null,
  description text,
  country text,
  city text,
  company_size text,
  brand_type text,
  instagram text,
  linkedin text,
  tiktok text,
  contact_page text,
  public_email text,
  department text,
  source text,
  verified_at date,
  score int check (score between 0 and 100),
  score_notes text,
  opportunities text[] not null default '{}',
  stage_id int references pipeline_stages(id) on delete set null,
  do_not_contact boolean not null default false,
  next_follow_up date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brands_sector_idx on brands(sector_id);
create index if not exists brands_stage_idx on brands(stage_id);

create table if not exists contacts (
  id serial primary key,
  brand_id int not null references brands(id) on delete cascade,
  first_name text,
  last_name text,
  role text,
  role_type text,
  email text,
  linkedin text,
  instagram text,
  phone text,
  source text,
  opted_out boolean not null default false,
  opted_out_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists contacts_brand_idx on contacts(brand_id);

-- Démarches envoyées (premier contact et relances). L'envoi réel se fait
-- toujours manuellement par l'utilisateur : la ligne trace ce qui a été envoyé.
create table if not exists outreach (
  id serial primary key,
  brand_id int not null references brands(id) on delete cascade,
  contact_id int references contacts(id) on delete set null,
  channel text not null,
  kind text not null default 'initial' check (kind in ('initial','follow_up')),
  collab_type text,
  subject text,
  body text,
  sent_at timestamptz not null default now(),
  follow_up_at date,
  follow_up_done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists outreach_brand_idx on outreach(brand_id);
create index if not exists outreach_sent_idx on outreach(sent_at);

create table if not exists responses (
  id serial primary key,
  brand_id int not null references brands(id) on delete cascade,
  contact_id int references contacts(id) on delete set null,
  outreach_id int references outreach(id) on delete set null,
  channel text,
  received_at timestamptz not null default now(),
  content text,
  classification text not null check (classification in ('positive','negative','neutral','info_request','automatic')),
  intents text[] not null default '{}',
  confidence numeric(4,3),
  classified_by text not null default 'rules' check (classified_by in ('rules','manual','ai')),
  created_at timestamptz not null default now()
);
create index if not exists responses_brand_idx on responses(brand_id);

-- Appels, réunions, notes, documents, propositions…
create table if not exists interactions (
  id serial primary key,
  brand_id int not null references brands(id) on delete cascade,
  contact_id int references contacts(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists interactions_brand_idx on interactions(brand_id);

-- Prestations / collaborations. Le facturé et l'encaissé proviennent des
-- factures liées (source unique). Le gifting a sa propre valeur, jamais comptée en CA.
create table if not exists deals (
  id serial primary key,
  brand_id int not null references brands(id) on delete cascade,
  title text not null,
  collab_type text not null,
  service_category text not null,
  status text not null default 'proposed' check (status in ('proposed','signed','in_progress','delivered','cancelled','lost')),
  planned_price numeric(12,2),
  negotiated_price numeric(12,2),
  gift_value numeric(12,2),
  signed_at date,
  production_hours numeric(8,2),
  estimated_costs numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deals_brand_idx on deals(brand_id);

create table if not exists expenses (
  id serial primary key,
  label text not null,
  category text,
  amount numeric(12,2) not null check (amount >= 0),
  spent_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- Devis et factures. Le numéro n'est attribué qu'à l'émission (pas de trou
-- dans la séquence à cause de brouillons supprimés).
create table if not exists documents (
  id serial primary key,
  kind text not null check (kind in ('quote','invoice')),
  number text unique,
  status text not null default 'draft' check (status in ('draft','sent','accepted','paid','partially_paid','overdue','cancelled')),
  brand_id int references brands(id) on delete set null,
  deal_id int references deals(id) on delete set null,
  client_name text not null,
  client_address text,
  client_siret text,
  client_vat text,
  client_email text,
  issue_date date,
  due_date date,
  lines jsonb not null default '[]'::jsonb,
  deposit numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  paid_at date,
  notes text,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_brand_idx on documents(brand_id);

create table if not exists document_counters (
  kind text not null,
  year int not null,
  last_value int not null default 0,
  primary key (kind, year)
);

create table if not exists notifications (
  id serial primary key,
  type text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  title text not null,
  body text,
  brand_id int references brands(id) on delete cascade,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id serial primary key,
  slot text not null check (slot in ('morning','midday','evening')),
  report_date date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (slot, report_date)
);

-- Liste d'opposition : emails ou domaines qui ne doivent plus être sollicités.
create table if not exists suppression_list (
  id serial primary key,
  value text not null unique,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id serial primary key,
  action text not null,
  entity text,
  entity_id int,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  id serial primary key,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- Demandes entrantes depuis le formulaire public.
create table if not exists inbound_requests (
  id serial primary key,
  company text not null,
  name text not null,
  email text not null,
  collab_type text,
  budget text,
  message text not null,
  brand_id int references brands(id) on delete set null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Données de départ (aucune donnée d'activité : uniquement la configuration).
insert into sectors (name, color, position) values
  ('Tech & Creator Economy', '#3b82f6', 1),
  ('Fashion & Streetwear', '#a855f7', 2),
  ('Sport & Performance', '#22c55e', 3),
  ('Food & Lifestyle', '#f59e0b', 4),
  ('Music & Entertainment', '#ef4444', 5)
on conflict (name) do nothing;

insert into pipeline_stages (key, label, position, kind) values
  ('to_study', 'Marque à étudier', 1, 'open'),
  ('qualified', 'Marque qualifiée', 2, 'open'),
  ('contact_found', 'Contact identifié', 3, 'open'),
  ('to_contact', 'Premier contact à envoyer', 4, 'open'),
  ('contacted', 'Contacté', 5, 'open'),
  ('replied', 'Réponse reçue', 6, 'open'),
  ('interested', 'Intérêt potentiel', 7, 'open'),
  ('negotiation', 'Négociation', 8, 'open'),
  ('proposal_sent', 'Proposition envoyée', 9, 'open'),
  ('confirmed', 'Collaboration confirmée', 10, 'won'),
  ('in_progress', 'Prestation en cours', 11, 'won'),
  ('invoice_sent', 'Facture envoyée', 12, 'won'),
  ('payment_pending', 'Paiement en attente', 13, 'won'),
  ('paid', 'Paiement reçu', 14, 'won'),
  ('refused', 'Refus', 15, 'lost'),
  ('no_answer', 'Sans réponse', 16, 'lost'),
  ('do_not_contact', 'Ne plus contacter', 17, 'dnc')
on conflict (key) do nothing;

-- Verrouillage Supabase : RLS activée, aucune policy (accès serveur uniquement).
do $$
declare t text;
begin
  foreach t in array array['settings','sectors','pipeline_stages','brands','contacts','outreach','responses',
    'interactions','deals','expenses','documents','document_counters','notifications','reports',
    'suppression_list','audit_log','push_subscriptions','inbound_requests']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
