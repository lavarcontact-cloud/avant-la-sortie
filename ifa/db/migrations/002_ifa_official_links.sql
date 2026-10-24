-- Comptes officiels d'Ifa, confirmés par le porteur du projet le 24/10/2026.
-- Liens nettoyés de leurs paramètres de suivi. Les valeurs déjà saisies dans
-- la régie restent prioritaires (l'opérateur || garde la valeur de droite).
update artist_profile set
  links = jsonb_build_object(
    'instagram', 'https://www.instagram.com/ifa_pursang',
    'youtube',   'https://www.youtube.com/@ifapursang',
    'tiktok',    'https://www.tiktok.com/@ifa_pursang',
    'snapchat',  'https://snapchat.com/t/WcmhANW1'
  ) || links,
  updated_at = now()
where id = 1;
