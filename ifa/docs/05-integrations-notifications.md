# Intégrations sociales et notifications

## Réseaux sociaux : ce qui est réellement possible

| Plateforme | Méthode autorisée | Ce qu'on peut récupérer | Statut dans le MVP |
|---|---|---|---|
| **YouTube** | YouTube Data API v3, clé API, données publiques | Les vidéos publiques de la chaîne officielle (titre, description, lien). Quota gratuit de 10 000 unités par jour ; une synchro coûte environ 2 unités | **Implémenté** (`lib/integrations.js`). Chaîne officielle **@ifapursang** déjà renseignée (sélection par pseudo, `forHandle`) ; il ne manque que `YOUTUBE_API_KEY` |
| **Instagram** | Instagram API avec connexion Instagram ou Facebook (Basic Display arrêtée le 4 décembre 2024) | Les publications **du compte professionnel d'Ifa (@ifa_pursang)**, avec son autorisation. Les stories ne sont lisibles que pendant 24 h et selon les permissions accordées (à confirmer dans la documentation Meta en vigueur) ; les insights demandent une validation de l'app par Meta | **Implémenté pour les publications** (`/me/media`), à partir d'un jeton longue durée fourni par l'équipe et renouvelé tous les 60 jours. Non testé faute de jeton |
| **TikTok** | Display API (Login Kit + scope `video.list`) | Les vidéos **du compte qui se connecte** (celui d'Ifa), après validation de l'app par TikTok | **Non implémenté** : demande une app TikTok for Developers validée et une connexion OAuth du compte d'Ifa. En attendant, ajout manuel avec lien |
| **Snapchat** | Aucune API publique de lecture des stories ou des Spotlight | Rien automatiquement | **Ajout manuel** avec lien vers l'original |
| Spotify, Apple Music, Deezer | Liens et intégrations officielles | Liens d'écoute | Liens saisis dans la régie |

**Principes appliqués :**
- **Aucun scraping**, aucun contournement de connexion, aucune collecte de données de tiers.
- Les imports arrivent en **brouillon** : l'équipe relit, classe (clip, freestyle…) puis publie.
- Les médias des plateformes **ne sont pas réhébergés** : on garde un lien vers l'original (droits, expiration des URL).
- Chaque contenu affiche sa provenance : *Publié dans Fréquence*, *Repris de …* (ajout manuel avec lien) ou *Importé de …* (intégration).
- L'appli fonctionne intégralement sans aucune intégration.

## Notifications

### Architecture
1. L'équipe crée un **signal** (catégorie, importance, titre, lien, heure d'envoi). Certains signaux sont automatiques : publication marquée « prévenir », ouverture d'un drop, lancement d'un défi, nouvelle date confirmée.
2. Le planificateur (toutes les 30 s, avec verrou Postgres) distribue le signal :
   - **boîte in-app** pour chaque compte actif qui a activé la catégorie (c'est la solution de repli universelle) ;
   - **push web** si les clés VAPID sont configurées, que la personne s'est abonnée sur cet appareil, que sa fréquence le permet (« tout » ou « important seulement ») et qu'on n'est pas dans ses heures calmes.
3. Les statistiques **réelles** sont enregistrées (boîtes, push envoyés, échecs, ignorés pour heures calmes ou fréquence, sans abonnement) et affichées dans la régie. Les abonnements expirés (404 ou 410) sont supprimés.

Rien n'est simulé : sans clés VAPID, l'abonnement est refusé avec un message clair, la régie affiche « push non configuré », et les statistiques indiquent `push_configured: false`.

### Activer le push
```bash
npm run vapid        # génère VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
# les ajouter aux variables d'environnement avec VAPID_SUBJECT=mailto:…, puis redémarrer
```
Coût : nul (les services de push d'Apple, Google et Mozilla sont gratuits). Il faut le HTTPS en production.

### Limites par plateforme

| Plateforme | Push web | Conditions et limites |
|---|---|---|
| **Android** (Chrome, Edge, Samsung Internet, Firefox) | Oui | Fonctionne dans le navigateur et en PWA installée. L'utilisateur doit accepter l'autorisation. Les économiseurs de batterie de certains constructeurs peuvent retarder la livraison |
| **iPhone / iPad** (iOS et iPadOS 16.4+) | Oui, **uniquement si la PWA est ajoutée à l'écran d'accueil** | Dans Safari « simple », pas de push. L'autorisation doit être demandée après un geste de l'utilisateur (c'est le cas : interrupteur dans les réglages). Pas d'invite d'installation automatique : l'appli affiche les instructions (Partager → « Sur l'écran d'accueil »). Le format des notifications est plus limité (pas d'image enrichie) |
| **iOS < 16.4** | Non | Boîte Signaux in-app uniquement |
| **Desktop** (Chrome, Edge, Firefox, Safari 16+ sur macOS 13+) | Oui | — |
| **Navigateurs intégrés** (Instagram, TikTok, Snapchat) | Non | Inviter à ouvrir dans Safari ou Chrome pour installer l'appli |

**Solution de repli :** la boîte **Signaux** est toujours remplie, et une pastille de non-lus est rafraîchie quand l'appli revient au premier plan. L'appli fonctionne pleinement sans push.

### Tests à faire sur appareils réels avant le lancement
- Android : Chrome (navigateur et PWA installée), Samsung Internet.
- iPhone : iOS 16.4, 17 et 18, PWA installée ; vérifier le clic sur la notification et l'ouverture de la bonne page.
- Heures calmes, fréquence « important seulement », désabonnement.
