-- Sécurité (recommandation Supabase) : chemin de recherche fixe pour la fonction du trigger.
alter function log_brand_stage() set search_path = public;
