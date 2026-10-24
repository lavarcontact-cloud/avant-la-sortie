# Fréquence · l'espace officiel d'Ifa

Application web progressive (PWA) pour l'artiste Ifa (Paris 19e) : actualités officielles, vidéos, avant-premières, communauté de fans et régie pour l'équipe.

> Prototype fonctionnel à présenter à Ifa et à son équipe. Comptes officiels câblés : Instagram et TikTok @ifa_pursang, YouTube @ifapursang, Snapchat.

## Dossier produit
| Document | Contenu |
|---|---|
| [docs/01-concept-strategie.md](docs/01-concept-strategie.md) | Nom, proposition de valeur, concept, direction artistique, rétention, modèle économique |
| [docs/02-ux-ui.md](docs/02-ux-ui.md) | Carte de navigation, molette, écrans, parcours (nouvel utilisateur, fan régulier, publication, avant-première, notification, administration) |
| [docs/03-architecture.md](docs/03-architecture.md) | Architecture, schéma de données, règles de sécurité et d'accès, tests |
| [docs/04-securite-mineurs.md](docs/04-securite-mineurs.md) | Mineurs, RGPD, règles françaises, modération, conservation |
| [docs/05-integrations-notifications.md](docs/05-integrations-notifications.md) | API Instagram / TikTok / Snapchat / YouTube, push web et limites iOS / Android |
| [docs/06-roadmap.md](docs/06-roadmap.md) | Feuille de route chiffrée (complexité, dépendances, coûts) |
| [docs/07-etat-du-mvp.md](docs/07-etat-du-mvp.md) | Fait, testé, à faire, dépendances externes |

## Pile
Node.js 22 · Express 5 · PostgreSQL 14+ · React 18 + Vite · service worker maison · Web Push (VAPID). Un seul service sert l'API et le front.

## Installation locale
Prérequis : Node.js 20 ou plus, PostgreSQL 14 ou plus.
```bash
cd ifa
npm install
createdb frequence                       # ou une base Postgres hébergée
export DATABASE_URL=postgres://user:pass@localhost:5432/frequence
npm run migrate                          # crée le schéma (également fait au démarrage)
npm run create-admin -- vous@exemple.fr votre_pseudo "mot-de-passe-long" admin
npm run seed:demo                        # facultatif : contenus d'EXEMPLE pour une démo
npm run dev                              # API :8787 + front :5173 (proxy /api)
```
Ouvrir http://localhost:5173, puis se connecter. La régie est à `/regie`, accessible aussi depuis Moi.

Rôles : `admin` (tout, rôles, profil officiel, intégrations), `editor` (publication, signaux, Labo, stats), `moderator` (modération, suspension de fans). Option `--official` pour donner le badge ✓ (comptes d'Ifa et de son équipe).

## Tests
```bash
createdb frequence_test
DATABASE_URL=postgres://user:pass@localhost:5432/frequence_test npm test   # 15 tests API (la base de test est réinitialisée)
npm run build && npm run seed:demo && npm run test:e2e                      # 16 parcours navigateur, captures dans tests/screens/
```
Le test e2e utilise Playwright et Chromium (`npm i -D playwright && npx playwright install chromium` s'ils ne sont pas déjà présents).

## En ligne
**https://frequence-ifa.vercel.app** — Vercel (projet `frequence-ifa`, région Paris) + Supabase Postgres (projet `frequence`, eu-west-3) + Vercel Blob privé (`frequence-medias`).

| Élément | Mise en œuvre sur Vercel |
|---|---|
| API | `api/index.js` : l'app Express dans une fonction (`vercel.json`) |
| Base | Pooler Supabase en mode transaction, utilisateur dédié `frequence_app` (propriétaire des tables, aucun droit pour les rôles publics de Supabase) ; `DATABASE_SSL=no-verify` |
| Fichiers | Vercel Blob **privé** : `/api/media/:id` vérifie les droits puis redirige vers une URL signée (60 s pour le Labo, 1 h sinon). Envoi direct navigateur → Blob (`/api/uploads/blob`), puis vérification de la signature binaire |
| Migrations, admin, démo | Au premier appel (`server/lib/bootstrap.js`) : migrations, compte admin depuis `ADMIN_EMAIL` / `ADMIN_PASSWORD`, démo si `DEMO_SEED=1` (comptes de démo **non connectables** en ligne) |
| Planificateur | Déclenché par le trafic (au plus une fois par minute) + tâche cron quotidienne (`/api/cron/tick`, protégée par `CRON_SECRET`). Limite : sans visite, une publication programmée attend la visite suivante (ou le cron du matin) |
| Push | Clés VAPID dans les variables du projet |

La branche de production du projet Vercel est `main`, alors que l'appli vit sur `ifa-frequence` : la production se redéploie à la demande (tableau de bord Vercel → *Redeploy*, ou outil de déploiement). Un push sur `ifa-frequence` crée un déploiement de prévisualisation.

**Avant l'ouverture au public :** mettre `DEMO_SEED=0`, supprimer la démo, configurer un SMTP pour l'accord parental, compléter les pages légales.

## Déploiement ailleurs
Hors Vercel, l'appli tourne comme un **processus Node permanent** (planificateur toutes les 30 s) avec une **base PostgreSQL** et un **volume persistant** pour les fichiers.

**Avec Docker (VPS, Scaleway, Fly.io, Railway, Render…)**
```bash
docker build -t frequence ifa/
docker run -d -p 8787:8787 --env-file ifa/.env -v frequence-data:/data frequence
```
Ensuite, un proxy HTTPS devant (Caddy, Traefik ou celui de l'hébergeur). Le HTTPS est indispensable pour le service worker et le push.

**Sans Docker** : `npm ci && npm run build && NODE_ENV=production node server/index.js`, sous un gestionnaire de processus (systemd, pm2).

Variables : voir [.env.example](.env.example). Avant l'ouverture au public, suivre la liste « À faire avant l'ouverture au public » de [docs/04-securite-mineurs.md](docs/04-securite-mineurs.md).

## Limites connues
- Fichiers sur disque local (volume) : prévoir stockage objet + CDN avant un fort trafic vidéo.
- Pas de transcodage vidéo : les vidéos sont servies telles qu'envoyées (limitées à 80 Mo pour les fans, 600 Mo pour l'équipe).
- Limiteur de débit en mémoire : à remplacer par Redis si plusieurs instances.
- Pas encore de réinitialisation du mot de passe par e-mail.
- Pages légales : document de travail, avec des champs à compléter et une relecture juridique à faire.

## Structure
```
ifa/
  server/      API (app.js, routes/, lib/)
  db/          migrations SQL
  web/         front React (src/screens, src/admin, src/components, public/ : manifeste, sw.js, icônes)
  scripts/     migrate, create-admin, seed-demo, vapid, icons, dev
  tests/       api.test.js, e2e.js, fixtures/
  docs/        dossier produit
  assets/photos/  photos officielles à intégrer
```
