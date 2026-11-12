# Creator Business & PR Hub

Plateforme personnelle de prospection, de relations marques, de campagnes UGC et de gestion commerciale.

- **Site public** (`/`, `/media-kit`) : présentation, offres, chiffres vérifiés, références, formulaire de collaboration.
- **Business & PR Hub** (`/hub`, privé) : dashboard de pilotage, **veille commerciale**, **Business Forecast**, **Audience Value**, CRM marques, interlocuteurs, pipeline 17 statuts, préparation des messages, démarches, relances, réponses, prestations, finances, devis/factures PDF, notifications, bilans.

Stack : Next.js 16 (App Router, server actions) · TypeScript · Tailwind CSS 4 · PostgreSQL (Supabase en production, PGlite embarqué en local) · pdf-lib · zod.

> Principe : l'outil **prépare et organise**, vous gardez le contrôle. Aucun message n'est envoyé automatiquement, aucune donnée n'est inventée.

---

## Démarrer en local (5 minutes)

```bash
cd creator-hub
npm install
cp .env.example .env.local
# Renseignez ADMIN_PASSWORD et SESSION_SECRET (openssl rand -hex 32)
npm run build && npm start        # ou : npm run dev
```

Ouvrez http://localhost:3000/hub et connectez-vous avec `ADMIN_PASSWORD`.
Sans `DATABASE_URL`, les données sont stockées dans `creator-hub/.data/pglite` (ignoré par git). Sauvegarde : Paramètres → Exporter toutes les données.

## Mise en production (Vercel + Supabase)

1. **Supabase** : créez un projet, copiez la chaîne de connexion *Transaction pooler* (port 6543).
   Les tables sont créées automatiquement au premier accès (migrations versionnées dans `migrations/`, suivies par `schema_migrations`).
   Vous pouvez aussi les appliquer à la main via le SQL Editor (`migrations/001_init.sql`).
2. **Vercel** : importez le dépôt, **Root Directory = `creator-hub`**, puis définissez les variables d'environnement :
   `ADMIN_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL`, `CRON_SECRET` (+ VAPID si push).
   Sur Vercel, l'application refuse de démarrer sans `DATABASE_URL` (le disque y est éphémère).
3. **Bilans planifiés** : appelez `GET /api/cron/reports` toutes les heures avec `Authorization: Bearer $CRON_SECRET`.
   Un workflow GitHub Actions prêt à l'emploi est fourni (`.github/workflows/creator-hub-reports.yml`) : ajoutez les secrets `HUB_URL` et `CRON_SECRET` au dépôt.
   (Vercel Cron en offre Hobby est limité à une exécution par jour : non adapté aux trois bilans.)
4. **Push (facultatif)** : `npx web-push generate-vapid-keys`, renseignez les 3 variables VAPID, puis Notifications → « Activer les notifications push ».

## Phase 2 — intelligence commerciale

| Module | Où | Principe |
|---|---|---|
| Veille commerciale | `/hub/watch` | Requêtes quotidiennes par secteur (mots-clés modifiables, rotation journalière) → déduplication par domaine / profil → signaux (lancement, collection, programme ambassadeur, recherche UGC, contact presse…) → score /100 expliqué critère par critère. Interlocuteurs extraits des **résultats publics** des moteurs de recherche (LinkedIn/Instagram jamais visités), toujours « poste à confirmer ». Import manuel avec le même pipeline. |
| Préparation des démarches | `/hub/watch/prepare` | Sélection multiple, présentation (extrait de la source), raison, interlocuteur, proposition, idée de campagne, email / DM / LinkedIn / relance. Validation une par une → fiche CRM. Aucun envoi. |
| Business Forecast | `/hub/forecast` | Probabilités de signature **par étape mesurées sur votre historique** (table `brand_stage_history`, alimentée par trigger), lissées par une hypothèse a priori explicite ; scénarios prudent / central / ambitieux = intervalle statistique ~80 % ; capacité de production plafonnante ; encaissements décalés du délai de paiement réel ; prévision par secteur ; tendance 30 j ; recommandations justifiées. |
| Apprentissage | `/hub/forecast` | La prévision est archivée chaque jour (`forecast_snapshots`) ; chaque mois écoulé est comparé au réel (écart €, %, précision, explications) ; la médiane réel/prévu corrige les prévisions suivantes à partir de 2 mois. |
| Audience Value | `/hub/audience` | Comptes par **entité** (personnel / La Var Media, jamais additionnés), relevés sourcés et datés, import CSV ; engagement avec formule ; tarifs = production (temps × taux) + diffusion (vues réelles par publication × CPM), jamais le seul nombre d'abonnés ; potentiel théorique / accessible / réalisé ; projection 6 mois sans croissance inventée (central = stagnation tant qu'il n'y a qu'un relevé). |

Toutes les valeurs non issues de vos données (taux horaire, CPM, panier moyen, délais, probabilités a priori, capacité) sont des **hypothèses** affichées comme telles et modifiables dans Paramètres → Hypothèses de prévision.

La tâche planifiée `/api/cron/reports` (horaire) exécute aussi : archivage quotidien des prévisions, veille quotidienne à l'heure configurée (si `FIRECRAWL_API_KEY`), et bilans enrichis (veille, prévision du jour, tendance, secteurs, recommandations).

## Sécurité

- Toutes les routes `/hub/*` et `/api/hub/*` sont protégées par `src/proxy.ts` **et** chaque page / server action revérifie la session (`requireAuth`).
- Session : cookie `httpOnly`, `sameSite=lax`, `secure` en production, signé HMAC-SHA256, 14 jours. Limitation des tentatives de connexion.
- Validation serveur systématique (zod), requêtes SQL paramétrées.
- Supabase : **RLS activée sur toutes les tables sans aucune policy** → l'API publique (clé anon) n'a accès à rien ; seule la connexion serveur lit/écrit.
- Aucun secret dans le code : tout passe par les variables d'environnement (`.env.example`).
- `/api/cron/reports` exige `CRON_SECRET`. Le formulaire public a un honeypot, une limite de débit et le filtre éthique.

## Schéma de données

| Table | Rôle |
|---|---|
| `sectors` | Secteurs commerciaux (modifiables, extensibles, archivables) |
| `pipeline_stages` | 17 statuts du pipeline (libellés modifiables ; `kind` = open / won / lost / dnc) |
| `brands` | Fiche marque : identité, canaux officiels, **source + date de vérification**, score /100 + justification, opportunités, statut, opposition |
| `contacts` | Interlocuteurs pros (fonction, type, coordonnées pros, **source obligatoire si email/téléphone**, opposition) |
| `outreach` | Démarches envoyées manuellement (canal, premier contact / relance, date de relance) |
| `responses` | Réponses reçues, classification (positive / négative / neutre / demande d'infos / automatique), intentions, confiance, origine (règles / manuel) |
| `interactions` | Appels, réunions, notes, propositions, documents, produits reçus |
| `deals` | Prestations : type de collaboration, catégorie, statut, prix prévu / négocié, **valeur gifting séparée**, temps, coûts |
| `documents` + `document_counters` | Devis / factures, lignes JSON, acompte, paiements ; numérotation séquentielle à l'émission (`F-2026-0001`, `D-2026-0001`) |
| `expenses` | Dépenses professionnelles |
| `notifications`, `push_subscriptions` | Centre de notifications, abonnements push |
| `reports` | Bilans matin / midi / soir (un par créneau et par jour) |
| `suppression_list` | Liste d'opposition (emails ou domaines) |
| `inbound_requests` | Demandes reçues via le site public |
| `audit_log` | Journal des actions importantes |
| `brand_stage_history` | Historique des statuts (trigger) — base des taux de transformation |
| `watch_runs`, `watch_candidates` | Exécutions de veille ; marques et interlocuteurs découverts (clé de dédoublonnage unique, source, signaux, score détaillé, changements détectés) |
| `social_accounts`, `social_snapshots` | Comptes par entité et relevés de statistiques (source obligatoire) |
| `forecast_snapshots` | Prévisions archivées chaque jour, par mois cible et scénario |
| `settings` | Profil public, informations légales, préférences |

Règles métier clés :
- **Signé ≠ facturé ≠ encaissé ≠ gifting.** Le CA signé vient des prestations signées (hors gifting) ; le facturé et l'encaissé viennent **uniquement** des factures émises ; la valeur des produits reçus est affichée à part.
- **Taux de réponse = démarches ayant reçu une réponse ÷ démarches envoyées**, par créneau, jour, canal, secteur et type d'interlocuteur. Pas de recommandation sous 5 envois par case.
- Un interlocuteur n'est marqué « sans réponse » qu'après 3 tentatives sur au moins 21 jours.
- Relances limitées (2 par défaut) ; arrêt automatique sur refus, opposition ou statut « Ne plus contacter ».
- Facture : émission impossible tant que les mentions légales ne sont pas renseignées (PDF en filigrane « BROUILLON »). Une facture émise n'est plus modifiable.

## Tests

```bash
npm test          # 36 tests unitaires : classification, factures, stats, éthique, dates, PDF, veille, scoring, prévisions, audience, apprentissage
npm run typecheck
# Test navigateur des 10 parcours MVP (serveur lancé sur :3100) :
BASE=http://localhost:3100 PASS=<ADMIN_PASSWORD> node tests/e2e.mjs
BASE=http://localhost:3100 PASS=<ADMIN_PASSWORD> CRON=<CRON_SECRET> node tests/e2e-intel.mjs   # phase 2
```
⚠️ Le test E2E écrit des données de test (marques fictives, identité légale « TEST E2E ») : lancez-le sur une base dédiée (`PGLITE_DIR=/tmp/e2e-db`), jamais sur vos vraies données.

## Prospecter dès maintenant

1. **Paramètres → Profil public** : nom, pitch en une phrase, liens portfolio / Media Kit, signature, statistiques vérifiées (avec source et date).
2. **Paramètres → Facturation** : vos vraies informations légales (sinon devis/factures restent en brouillon).
3. **+ Ajouter une marque** : site officiel, page contact / programme créateurs, source, date de vérification, score justifié, opportunités.
4. Ajoutez l'interlocuteur identifié publiquement (avec la source).
5. **Préparer la prospection** : choisissez le type de collaboration, écrivez l'angle réel, copiez l'email / DM / LinkedIn, envoyez-le **vous-même**.
6. **Enregistrer → Démarche envoyée** : la relance est planifiée à J+7.
7. Quand la marque répond : **Réponse reçue**, collez le message → classification automatique (corrigeable), notifications, pipeline mis à jour.
8. Collaboration signée → **Prestation** → **Devis / facture** → PDF → suivi du paiement.

## Statut des fonctionnalités

Voir `STATUS.md`.
