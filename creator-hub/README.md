# Creator Business & PR Hub

Plateforme personnelle de prospection, de relations marques, de campagnes UGC et de gestion commerciale.

- **Site public** (`/`, `/media-kit`) : présentation, offres, chiffres vérifiés, références, formulaire de collaboration.
- **Business & PR Hub** (`/hub`, privé) : dashboard, CRM marques, interlocuteurs, pipeline 17 statuts, préparation des messages, démarches, relances, réponses, prestations, finances, devis/factures PDF, notifications, bilans.

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
| `settings` | Profil public, informations légales, préférences |

Règles métier clés :
- **Signé ≠ facturé ≠ encaissé ≠ gifting.** Le CA signé vient des prestations signées (hors gifting) ; le facturé et l'encaissé viennent **uniquement** des factures émises ; la valeur des produits reçus est affichée à part.
- **Taux de réponse = démarches ayant reçu une réponse ÷ démarches envoyées**, par créneau, jour, canal, secteur et type d'interlocuteur. Pas de recommandation sous 5 envois par case.
- Un interlocuteur n'est marqué « sans réponse » qu'après 3 tentatives sur au moins 21 jours.
- Relances limitées (2 par défaut) ; arrêt automatique sur refus, opposition ou statut « Ne plus contacter ».
- Facture : émission impossible tant que les mentions légales ne sont pas renseignées (PDF en filigrane « BROUILLON »). Une facture émise n'est plus modifiable.

## Tests

```bash
npm test          # 21 tests unitaires : classification, calculs de facture, stats, éthique, dates, PDF
npm run typecheck
# Test navigateur des 10 parcours MVP (serveur lancé sur :3100) :
BASE=http://localhost:3100 PASS=<ADMIN_PASSWORD> node tests/e2e.mjs
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
