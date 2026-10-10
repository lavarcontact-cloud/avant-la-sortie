-- Acceptation des CGV avant paiement : horodatage et version acceptée.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
