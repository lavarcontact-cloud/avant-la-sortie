-- Plateformes de streaming d'Ifa (confirmées le 24/10/2026) et galerie officielle.
update artist_profile set
  links = jsonb_build_object(
    'spotify',     'https://open.spotify.com/artist/3vffzNIGMEMk9veDh4nDHx',
    'deezer',      'https://www.deezer.com/fr/artist/460512',
    'apple_music', 'https://music.apple.com/fr/artist/ifa/1871096388'
  ) || links,
  updated_at = now()
where id = 1;

-- Galerie : photos officielles affichées sur le profil (ordre conservé).
alter table artist_profile add column gallery uuid[] not null default '{}';
-- Date d'import des photos fournies avec le code (assets/photos), pour ne le faire qu'une fois.
alter table artist_profile add column photos_imported_at timestamptz;
