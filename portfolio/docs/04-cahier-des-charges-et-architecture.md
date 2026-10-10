# 04 · Cahier des charges, architecture et plan de développement

## 1. Fonctionnalités retenues et priorités

| Priorité | Fonctionnalité | Pourquoi | État |
|---|---|---|---|
| P0 | Flux vidéo vertical | cœur de l'expérience, preuve du travail | livré |
| P0 | Profil + grille filtrable + bulles | crédibilité en 10 secondes | livré |
| P0 | Pages projet et artiste | profondeur, référencement, partage | livré |
| P0 | Demande de devis | conversion principale (les clips se vendent sur devis) | livré |
| P0 | Consentement + pages légales | obligation, et préalable à toute mesure | livré (textes à valider) |
| P1 | Admin : demandes, commandes, KPI | piloter l'activité | livré |
| P1 | Paiement acompte et solde (Stripe Checkout) | encaisser après accord sur le devis | développé, à tester avec des clés de test Stripe |
| P1 | Mesure d'audience first-party | comprendre l'usage sans outil tiers | livré |
| P2 | Galerie photo | complément du portfolio | livré |
| P2 | Rétractation en ligne | obligation pour la vente aux particuliers (depuis le 19/06/2026) | livré (e-mail d'accusé à brancher) |
| P3 | CMS visuel (édition sans fichier JSON) | confort d'édition | non développé, voir §6 |
| P3 | Vidéo via CDN dédié (Mux, Cloudflare Stream) | streaming adaptatif HD | non développé, à décider |
| P3 | Réservation de créneaux, offres à prix fixe | aucun tarif n'est défini | non développé |

**Modèle commercial choisi** : devis, accord, **lien de paiement unique par commande**, acompte puis solde. Un panier ou un catalogue à prix fixe a été écarté : les prestations (clip, DA) sont chiffrées au cas par cas, et un prix affiché sans validation serait une information inventée. Le modèle accepte déjà des offres à prix fixe (`priceFromCents` dans `content/services.json`).

## 2. Architecture technique

| Couche | Choix | Alternatives écartées et raison |
|---|---|---|
| Framework | **Next.js 16.4 (App Router) + React 19.3 + TypeScript** | Astro : excellent en statique, mais l'admin, les actions serveur et les webhooks y sont moins intégrés. SPA Vite : mauvais référencement et pas de rendu serveur |
| Style | **Tailwind CSS 4** + composants CSS maison (`globals.css`) | CSS Modules seuls : moins rapide à décliner en responsive |
| Animation | **CSS + API View Transitions** (`<ViewTransition>` de React) | Motion/GSAP : poids sans gain ici. WebGL : coût GPU mobile |
| Contenu | **Fichiers JSON validés par Zod**, pages pré-rendues | CMS hébergé (Sanity, Contentful) : un compte, un coût et une dépendance pour quelques dizaines d'entrées |
| Données transactionnelles | **PostgreSQL** (requêtes SQL paramétrées, pilote `postgres`) ; **PGlite** embarqué en développement | ORM (Drizzle, Prisma) : retiré, 8 tables ne le justifiaient pas |
| Paiement | **Stripe Checkout** (page hébergée) + webhooks signés | Payment Element intégré : élargit le périmètre PCI. PayPal : frais plus élevés (`05-paiement-analytics-comparatif.md`) |
| Analytics | **First-party** dans notre base | GA4 : consentement obligatoire et transfert de données hors UE. Plausible et Matomo restent possibles plus tard |
| Auth admin | **Mot de passe scrypt + session HMAC** | NextAuth, Clerk : surdimensionnés pour un seul utilisateur |
| Hébergement | Vercel (région `cdg1`) + PostgreSQL UE | à valider (§7) |

**Rendu** : toutes les pages publiques sont **statiques** (SSG) : rapides, cachées par le CDN, et indépendantes de la base de données. Seuls `/devis` (lecture des paramètres d'URL), `/paiement/*`, `/retractation`, `/admin/*` et `/api/*` sont dynamiques.

**Dépendances de production (7)** : `next`, `react`, `react-dom`, `zod`, `postgres`, `@electric-sql/pglite`, `stripe`, plus `server-only`. Audit `npm audit` : 0 vulnérabilité au 10/10/2026.

## 3. Modèle de données (`db/migrations/*.sql`)

| Table | Rôle | Points clés |
|---|---|---|
| `quotes` | demandes de devis | statut (nouveau à archivé), notes internes ; purge à 3 ans sans commande |
| `orders` | commandes | montants en **centimes entiers**, `pay_token` aléatoire de 192 bits, type de client, `waiver_at` (demande d'exécution immédiate), `terms_version` et `terms_accepted_at` |
| `payments` | échéances (acompte, solde, total) | `stripe_session_id` unique, montant remboursé, `livemode` ; **aucune donnée de carte** |
| `stripe_events` | idempotence | un événement Stripe n'est appliqué qu'une fois |
| `events` | mesure d'audience | id fourni par le client (anti-doublon), **pas d'IP**, référent réduit au domaine, `internal`, `server_side` |
| `consents` | preuve des choix | id aléatoire, choix, version, action, famille de navigateur |
| `rate_limits` | anti-abus | clé = empreinte HMAC de l'IP, fenêtre fixe |
| `withdrawals` | rétractations | référence, horodatage |

## 4. Intégrations externes

| Service | Usage | Configuré ? |
|---|---|---|
| Stripe | Checkout, webhooks, remboursements | **non** : clés de test à fournir |
| PostgreSQL UE | données transactionnelles | non en production (local uniquement) |
| Resend | e-mail de notification des devis et rétractations | facultatif, non configuré : les demandes restent visibles dans l'admin |
| Vercel Cron | purge quotidienne des données expirées | prêt (`vercel.json`), `CRON_SECRET` à définir |

## 5. Parcours de paiement

1. Sébastien accepte une demande dans `/admin/demandes` et saisit le total et l'acompte : une commande et son lien `/paiement/<jeton>` sont créés.
2. Le client ouvre le lien : récapitulatif (identité du prestataire, prestation, prix TTC, déjà réglé, à régler), case d'acceptation des CGV (obligatoire), plus pour un particulier la demande expresse d'exécution avant la fin du délai de rétractation (art. L221-25), horodatée.
3. Le serveur crée l'échéance (acompte, solde ou total) **avec le montant relu en base** et redirige vers Stripe Checkout (`idempotencyKey`, expiration à 1 h).
4. Stripe envoie `checkout.session.completed` (ou `async_payment_*` pour le SEPA, ou `expired`). Le webhook **vérifie la signature**, contrôle que le montant correspond à l'échéance, met à jour le paiement puis la commande, et écrit l'événement serveur `payment_succeeded`.
5. La page de retour "succès" n'affirme rien : elle indique que la confirmation arrive. Seul le webhook change un statut.
6. Remboursement depuis l'admin (confirmation "REMBOURSER") : appel à l'API Stripe, puis mise à jour par le webhook `charge.refunded` (partiel ou total).
7. Garde-fou : une clé `sk_live_` est **refusée** tant que `STRIPE_LIVE_APPROVED=true` n'est pas positionné.

## 6. Gestion des contenus

Aujourd'hui : on ajoute un projet en éditant `content/projects.json` (ou en demandant à Claude Code), puis le build valide tout. C'est fiable et versionné, mais ce n'est pas encore "sans toucher au code" pour un non-développeur.

**Recommandation (étape suivante)** : brancher **Keystatic** sur ces mêmes fichiers. C'est un éditeur visuel `/keystatic`, gratuit, qui fait des commits dans le dépôt, et il n'impose aucune migration des données. Il n'a pas été intégré dans cette passe pour garder le périmètre testable ; il demande la création d'une GitHub App (votre accord est requis).

## 7. Exigences de sécurité (implémentées)

- Validation serveur de toutes les entrées (Zod), requêtes SQL paramétrées uniquement.
- Routes API publiques : contrôle d'origine (CSRF), limitation de débit en base, champ piège et délai minimal anti-robots.
- Admin : `proxy.ts` comme filtre rapide, plus `requireAdmin()` dans **chaque** page et action serveur ; cookie HttpOnly, Secure, SameSite=Strict, 8 h ; 5 tentatives de connexion par 15 minutes ; en-tête `noindex` et `no-store`.
- En-têtes : CSP stricte (`default-src 'self'`, `frame-ancestors 'none'`, `form-action` limité à Stripe), HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP ; `X-Powered-By` retiré.
- Secrets uniquement côté serveur (`server-only`), `.env*` ignorés par git, `.env.example` sans valeur.
- **Limite connue** : la CSP autorise `'unsafe-inline'` pour les scripts. Un nonce imposerait le rendu dynamique de toutes les pages et ferait perdre le statique ; arbitrage documenté.

## 8. Critères de validation par fonctionnalité

| Fonctionnalité | Critère d'acceptation | Vérifié par |
|---|---|---|
| Flux | la vidéo visible joue, la suivante au clavier change l'URL, un lien partagé ouvre la bonne vidéo | E2E |
| Bulles et navigation | bulle, artiste, projet, devis pré-rempli | E2E (en mouvement réduit) |
| Galerie | ouverture, flèches, Échap | E2E |
| Devis | erreurs par étape en français, envoi enregistré en base avec référence `D-AAAA-XXXXX` et événement serveur | E2E + base |
| Consentement | refus : 0 requête et 0 ligne ; accord : événements en base ; retrait : identifiants effacés ; preuve enregistrée | E2E + base |
| Analytics | événements inconnus et robots rejetés, doublons ignorés, trafic interne marqué | unitaires + E2E |
| Admin | accès refusé sans session ou avec une session falsifiée, mauvais mot de passe refusé, création de commande et de lien | E2E + unitaires |
| Paiement | échéancier acompte/solde, webhook idempotent, montant incohérent rejeté, SEPA différé, expiration, remboursements partiel et total, signature | unitaires (base réelle) + E2E (signature HTTP) |
| Accessibilité | 0 violation grave ou critique axe-core (WCAG 2.1 AA) sur 7 pages, mobile et desktop | E2E |
| Performance | Lighthouse mobile ≥ 85, CLS = 0 | Lighthouse (voir rapport final) |

## 9. Plan de développement

L'ordre suggéré dans le brief a été adapté. Le consentement est passé avant l'analytics (aucune mesure sans lui), et le paiement a été construit sur le modèle de devis plutôt que sur un catalogue.

| Étape | Contenu | État |
|---|---|---|
| 1 | Socle Next.js, design system, contenus réels validés | fait |
| 2 | Expérience : profil, flux, constellation, navigation, transitions | fait |
| 3 | Pages projet, artiste, photo, à propos, médias (affiches, faststart, WebM) | fait |
| 4 | Consentement, pages légales (brouillons), sécurité de base | fait |
| 5 | Devis de bout en bout, admin des demandes | fait |
| 6 | Commandes, paiement Stripe (test), webhooks, remboursements, rétractation | développé, test Stripe réel en attente des clés |
| 7 | Mesure d'audience, tableau de bord KPI, purge | fait |
| 8 | Tests unitaires, E2E, accessibilité, Lighthouse, corrections | fait |
| 9 | **Validation des contenus et des droits par Sébastien**, textes juridiques par un avocat | à faire (vous) |
| 10 | Provisionnement (base UE, projet Vercel, Stripe test), recette, mise en ligne | à faire, après accord |
| 11 | CMS visuel (Keystatic), exports vidéo HD + CDN vidéo, liens réseaux sociaux | proposé |
