# ATELIER RADAR — code de l'application

Application privée de recherche de local et de candidature, hébergée comme artifact claude.ai.

**Ce dossier ne contient que le code.** Aucune annonce, aucun profil, aucune candidature, aucun mot de passe.
Les données vivent dans la base privée de l'artifact (règle d'accès : lecture et écriture réservées au propriétaire et aux éditeurs).

> Ce dépôt (`avant-la-sortie`) est public. Le code est ici provisoirement, faute de pouvoir créer un dépôt depuis la session.
> À déplacer dans un dépôt privé dédié dès qu'il existe.

## Fonctionnement

- `atelier-radar.html` : page unique, sans dépendance hors polices Google.
- Capacités déclarées : `db` (base persistante), `user`, `sample` (Claude pour affiner les mails et qualifier la veille),
  `mcp` (Firecrawl `firecrawl_search` pour la veille lancée depuis l'application).
- Collections : `offres`, `profil/main`, `comptes`, `connecteurs`, `journal`, `meta/settings`, `meta/status`.

## Règles métier intégrées

- Barème /100 en 7 critères, recalculé à chaque affichage. Information inconnue = 0 point ; déclarative = points partiels.
- Coût mensuel calculé sur l'estimation haute (TVA à 20 % si elle n'est pas précisée), estimations séparées des montants confirmés.
- Espaces partagés classés « non conformes », jamais mélangés aux offres qualifiées.
- Bonus de classement (jusqu'à +5) pour lofts, ateliers américains, garages, lieux industriels, séparé du score.
- Détection de doublons : même lien, même référence, ou même ville + surface + prix proches.
- Aucun envoi automatique. Relance bloquée si un envoi n'est pas vérifié dans l'historique.
- Aucun champ mot de passe.
