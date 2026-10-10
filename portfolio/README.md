# Portfolio Sébastien Fula-Pitu

Portfolio vidéo et photo, univers d'artistes, demandes de devis, paiement d'acompte et de solde (Stripe Checkout), mesure d'audience avec consentement, tableau de bord privé.

Ce dossier est indépendant du site de candidature "Avant la sortie" (racine du dépôt), qui n'est pas modifié.

## Démarrer

```bash
cd portfolio
npm install
cp .env.example .env.local      # puis remplir ADMIN_PASSWORD_HASH et SESSION_SECRET :
npm run admin:hash -- "un mot de passe long"
npm run dev                     # http://localhost:3000
```

Sans `DATABASE_URL`, une base PostgreSQL embarquée (PGlite) est créée dans `.data/` : rien d'autre à installer.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` puis `npm start` | build et serveur de production |
| `npm run lint` | vérification TypeScript |
| `npm test` | tests unitaires et d'intégration (PostgreSQL de test requis : `TEST_DATABASE_URL`) |
| `npm run test:e2e` | tests navigateur Playwright (serveur lancé sur `E2E_BASE_URL`, défaut http://localhost:3100) |
| `npm run db:migrate` | applique `db/migrations/*.sql` sur `DATABASE_URL` |
| `npm run media:posters` | génère les affiches et remet les MP4 en "faststart" |
| `npm run admin:hash -- "..."` | génère l'empreinte du mot de passe admin et un secret de session |

## Ajouter du contenu

Tout le contenu éditorial est dans `content/*.json`, validé au build par `src/lib/content/schema.ts` : un champ manquant ou un artiste inconnu fait échouer le build plutôt que de casser une page.

- **Nouveau projet** : déposer les médias dans `public/media/photos` ou `public/media/videos`, lancer `npm run media:posters`, puis ajouter une entrée dans `content/projects.json` (copier une entrée existante). `inFeed: true` le fait apparaître dans le flux.
- **Vidéo** : fournir le MP4 (H.264) et générer la version WebM :
  `ffmpeg -i x.mp4 -an -c:v libvpx-vp9 -crf 38 -b:v 0 x.webm`
- **Nouvel artiste** : entrée dans `content/artists.json` (`relation` = le lien réel, sans exagération).
- **Prestation / tarif** : `content/services.json` (`priceFromCents: null` = sur devis).
- **Vérification** : chaque projet porte `verification` et `rights`. L'admin (`/admin/contenus`) liste tout ce qui reste à confirmer.

## Déploiement (Vercel)

1. Créer un projet Vercel pointant sur ce dépôt avec **Root Directory = `portfolio`**.
2. Créer une base PostgreSQL en région UE (Supabase Paris `eu-west-3` ou Neon Francfort), puis `DATABASE_URL=... npm run db:migrate`.
3. Saisir les variables de `.env.example` dans Vercel.
4. Stripe (mode test) : créer un endpoint webhook vers `https://<domaine>/api/stripe/webhook` avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, et copier son secret dans `STRIPE_WEBHOOK_SECRET`.
5. Vérifier le parcours complet en mode test (carte `4242 4242 4242 4242`) avant toute clé live.

La documentation du projet est dans `docs/` (audit, recherche, cahier des charges, conformité, plan de marquage, rapport final).
