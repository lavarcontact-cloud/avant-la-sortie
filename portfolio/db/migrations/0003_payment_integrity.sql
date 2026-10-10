-- Une seule échéance "en attente" à la fois par commande : empêche deux
-- sessions Checkout payables en parallèle (double clic, deux onglets).
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_open_per_order ON payments (order_id) WHERE status = 'cree';
-- Date d'encaissement réelle (le chiffre d'affaires ne doit pas suivre updated_at).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at timestamptz;
