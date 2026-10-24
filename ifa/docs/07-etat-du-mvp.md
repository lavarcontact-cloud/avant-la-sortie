# État du MVP — ce qui est fait, testé, à faire, externe

Dernière vérification : 24 octobre 2026.

## Terminé et testé automatiquement
| Fonction | Test |
|---|---|
| Inscription, connexion, déconnexion, sessions sécurisées | API + e2e |
| Règles d'âge : moins de 12 ans refusé, 12-14 ans en attente d'accord parental et en lecture seule, accord et refus du parent | API + e2e |
| QG : signal à compte à rebours réel, ondes courtes de 24 h, fil officiel, épinglage, archives filtrables, source et lien de chaque contenu | API + e2e |
| Publication immédiate, programmée, brouillon, archivage, expiration des stories | API + e2e |
| Immersion : pistes, lecture automatique, actions, commentaires, signalement | e2e |
| Labo : fenêtres d'ouverture et de fermeture, accès membres / badge / cercle, aucune fuite avant l'ouverture, flux protégé, droits obligatoires | API + e2e |
| Votes : un par compte, résultats après le vote | API + e2e |
| Cercles, défis, créations de fans en pré-modération, vérification des formats | API + e2e |
| Commentaires filtrés (insultes, coordonnées), réactions, favoris, partage | API + e2e |
| Signalements, masquage automatique, blocage, suspension | API |
| Badges (participation, jamais de classement) | API |
| Signaux : boîte in-app, catégories, fréquence, heures calmes (Paris), signaux automatiques, statistiques réelles | API + e2e |
| Push web : abonnement, requête chiffrée et signée VAPID, nettoyage des abonnements expirés, refus honnête sans configuration | API (livraison réelle sur téléphone : à tester sur appareil) |
| Régie : tableau de bord, publications, signaux, Labo, sorties, agenda, défis et cercles, modération, comptes et rôles, statistiques, profil officiel, intégrations, journal | e2e (principaux écrans) |
| RGPD : export JSON et suppression du compte | API |
| PWA : manifeste, icônes, service worker (coquille hors-ligne, push, clic sur notification), invite d'installation Android et instructions iOS | e2e (manifeste + service worker) |

## Fait mais non testé en conditions réelles (dépend d'un accès externe)
| Fonction | Ce qu'il manque |
|---|---|
| Livraison des push sur iPhone et Android | Clés VAPID en production, HTTPS, appareils de test |
| Envoi de l'e-mail au parent | `SMTP_URL` (sinon le compte reste en attente ; en développement, le lien s'affiche dans la console du serveur) |
| Import YouTube | `YOUTUBE_API_KEY` (chaîne @ifapursang déjà renseignée) |
| Import Instagram | Jeton de l'API Instagram du compte professionnel @ifa_pursang |

## Non fait (volontairement hors MVP)
- TikTok (app à faire valider par TikTok), Snapchat (pas d'API) : ajout manuel avec lien.
- Lives, messages vidéo, questions-réponses, rencontres, paiements : voir `06-roadmap.md`.
- Réinitialisation du mot de passe par e-mail (nécessite SMTP) : prévue en phase 1.
- Stockage objet / CDN et transcodage vidéo : prévus en phase 2 (disque local actuellement).
- Purges planifiées des journaux et des créations refusées.

## Dépend d'Ifa et de son équipe
- **Comptes officiels** : confirmés par le porteur du projet le 24/10/2026 et câblés sur le profil Ifa (migration `002_ifa_official_links.sql`) : Instagram [@ifa_pursang](https://www.instagram.com/ifa_pursang), YouTube [@ifapursang](https://www.youtube.com/@ifapursang), TikTok [@ifa_pursang](https://www.tiktok.com/@ifa_pursang), Snapchat ([lien de profil](https://snapchat.com/t/WcmhANW1)). Restent à fournir : liens Spotify, Apple Music, Deezer.
- **Photos officielles** : à déposer dans `ifa/assets/photos/` ou via la régie (Profil officiel).
- Bio, discographie, dates confirmées, autorisations de diffusion des extraits.
- Désignation de l'éditeur du service et d'un contact pour les données personnelles (pages légales).

## Contenu de démonstration
`npm run seed:demo` crée des gabarits **marqués « Exemple »** (visuels abstraits générés, aucun fait sur Ifa) et des comptes de démo (`@demo.frequence.local`, mot de passe `frequence-demo`). `npm run seed:demo -- --remove` les supprime tous. **À ne jamais lancer en production publique.**
