# Livrable 4 — Architecture technique

## Vue d'ensemble

```
 Téléphone (PWA installée ou navigateur)
   React 18 + Vite · service worker (cache coquille, push, clic notif.)
        │  HTTPS, cookie de session httpOnly + en-tête anti-CSRF x-frq
        ▼
 Node.js 22 · Express 5  (un seul processus : API + front compilé)
   ├ routes/      auth · content (QG, Immersion, Ifa) · labo · community · interact · notifs · media · admin
   ├ lib/access   règles d'accès du Labo (point unique de vérité)
   ├ lib/notify   distribution des signaux (boîte in-app + Web Push VAPID)
   ├ lib/scheduler tâches toutes les 30 s, verrou consultatif Postgres (pas de double envoi)
   ├ lib/storage  fichiers sur volume persistant, type vérifié par signature binaire
   └ lib/moderation filtre de 1er niveau (insultes, coordonnées)
        │
        ├── PostgreSQL 14+ (schéma : db/migrations/001_init.sql)
        ├── Volume /data/uploads (médias ; jamais servis en statique)
        ├── Services de push des navigateurs (Apple, Google, Mozilla) — gratuit, clés VAPID
        ├── SMTP (accord parental) — facultatif mais nécessaire pour les moins de 15 ans
        └── API YouTube Data v3 / Instagram — facultatives, imports en brouillon
```

**Pourquoi cette pile :** un seul service à déployer et à surveiller ; des coûts identifiables (un petit serveur, une base Postgres managée, un volume) ; aucune dépendance propriétaire ; une base Postgres qui accepte la charge et les migrations. Le passage à l'échelle se fait par étapes : stockage objet S3/R2 et CDN pour les vidéos, Redis pour le limiteur de débit, réplicas en lecture.

## Modèle de données (résumé)

| Domaine | Tables |
|---|---|
| Comptes | `users` (rôle, statut, compte officiel, année et mois de naissance, consentement parental), `sessions` |
| Médias | `media` (visibilité `public` / `protected`) |
| Officiel | `artist_profile` (singleton), `posts` (type, provenance, statut, programmation, expiration), `releases`, `events` |
| Labo | `drops` (fenêtre d'ouverture, accès membres / badge / cercle, droits), `drop_options`, `drop_votes` |
| Communauté | `circles`, `circle_members`, `challenges`, `fan_posts` (pré-modération, droits acceptés), `comments`, `reactions` |
| Sécurité | `reports`, `blocks`, `audit_log` |
| Récompenses | `badges`, `user_badges` |
| Notifications | `notification_prefs`, `push_subscriptions`, `notifications` (boîte), `broadcasts` (signaux programmés + statistiques réelles) |
| Mesure | `daily_activity` (agrégé par jour), `content_views` (agrégé par contenu et par jour) |

Le schéma commenté est dans `db/migrations/001_init.sql`. Les migrations sont appliquées automatiquement au démarrage (`scripts/migrate.js`, une fois chacune, dans une transaction).

## Règles de sécurité et d'accès

| Règle | Où |
|---|---|
| Mots de passe hachés avec scrypt (sel aléatoire, comparaison à temps constant) | `lib/auth.js` |
| Session : jeton aléatoire de 256 bits, seul son SHA-256 est stocké ; cookie httpOnly, SameSite=Lax, Secure en production, 30 jours | `lib/auth.js` |
| Anti-CSRF : toute écriture exige l'en-tête `x-frq: 1`, qu'un autre site ne peut pas poser | `app.js` |
| Rôles cumulatifs **admin ⊃ éditeur ⊃ modérateur**, avec deux exceptions voulues : le modérateur ne publie pas et n'écoute pas les inédits | `routes/admin.js`, `lib/access.js` |
| Participation (publier, commenter, voter, réagir) réservée aux comptes `active` : pas aux comptes en attente parentale, ni aux suspendus | `requireActive` |
| Labo : avant l'ouverture, l'API ne renvoie ni le fichier, ni son identifiant, ni le texte ; le flux vérifie session, fenêtre et droits à chaque requête, avec `Cache-Control: private, no-store` | `lib/access.js`, `routes/media.js`, `routes/labo.js` |
| Un fichier d'avant-première doit être téléversé comme `protected` ; une avant-première ne se publie pas sans mention des droits | `routes/admin.js` |
| Créations de fans : invisibles (et leur fichier introuvable) tant qu'elles ne sont pas approuvées, sauf pour l'auteur et l'équipe | `routes/media.js`, `lib/content.js` |
| Contenus repris d'une plateforme : plateforme et lien d'origine obligatoires | `routes/admin.js` |
| Fichiers : type vérifié par signature binaire, nom aléatoire, taille plafonnée, aucun accès statique | `lib/storage.js` |
| Limitation de débit (connexion, inscription, commentaires, publications, signalements) | `lib/ratelimit.js` |
| E-mails visibles des seuls administrateurs ; les modérateurs voient une tranche d'âge, pas l'âge | `routes/admin.js` |
| Journal d'audit de toutes les actions de l'équipe | `lib/audit.js` |
| En-têtes : `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy | `app.js` |

## Variables d'environnement

Voir `.env.example` (chaque variable y est commentée). Seules `DATABASE_URL`, `PUBLIC_URL` et `UPLOAD_DIR` sont indispensables. Les intégrations absentes sont désactivées proprement, et la régie les affiche « Non configuré ».

## Tests

| Commande | Ce qui est vérifié |
|---|---|
| `npm test` | 15 tests d'intégration sur une vraie base Postgres : inscription et âges, consentement parental, CSRF, rôles, publication immédiate / programmée / story expirée, règle de source, **verrouillage du Labo** (aucune fuite avant l'ouverture, refermeture, modérateur exclu), accès par badge, ouverture notifiée une seule fois, vote unique, pré-modération et vérification des types, filtre, masquage automatique, blocage, suspension, préférences de notification, heures calmes (fuseau de Paris), refus honnête du push non configuré, **requête Web Push chiffrée et signée VAPID**, export et suppression RGPD |
| `npm run test:e2e` | 16 parcours dans Chromium en vue mobile (iPhone 13) : visiteur, inscription d'un ou d'une ado de 14 ans, Labo verrouillé puis ouvert, vote, commentaire filtré, publication puis validation par un modérateur, annonce publiée avec signal et reçue par un fan, statistiques, manifeste et service worker. Captures dans `tests/screens/` |
