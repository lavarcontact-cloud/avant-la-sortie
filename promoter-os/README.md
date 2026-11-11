# PROMOTER OS

Système d'exploitation commercial pour la promotion événementielle. Premier établissement : **Little Room**.
Nom de produit : PROMOTER OS (pas NightFlow).

> Statut au 11/11/2026 : **étapes 1 à 5 de la méthode faites + schéma de base testé.**
> Aucune interface n'est encore construite. Rien dans ce dossier ne doit être présenté comme « fonctionnel » au-delà de ce qui est listé dans « Ce qui est réellement fait ».

---

## 1. Audit du dépôt

| Constat | Conséquence |
|---|---|
| Le dépôt `avant-la-sortie` est le site de candidature A&R Studios (HTML statique, déployé sur Vercel). | PROMOTER OS **ne doit pas vivre ici** à terme : mélanger un CRM (données personnelles) et un portfolio public est une mauvaise idée. Ce dossier `promoter-os/` est provisoire. |
| Le dépôt est **public**. | Aucune donnée réelle de contact ne doit jamais y être commitée. Les tests utilisent uniquement des données fictives (`guest_1`…). |
| Il existe un dépôt privé `nightcrew` (dernier push 05/11). | À vérifier : s'il s'agit d'une première version de ce projet, il faut repartir de là plutôt que de zéro. Je n'ai pas pu y accéder dans cette session. |
| Environnement : Node 22, PostgreSQL 16 disponible localement. | Le schéma a pu être testé sur un vrai PostgreSQL. |

## 2. Architecture

```
iPhone / ordinateur (PWA Next.js, mode sombre)
        │
        ▼
Next.js (TypeScript) — Route handlers / Server actions
  ├─ UI : Dashboard · Contacts · Messagerie · Soirées · Data
  ├─ /api/jarvis      → orchestrateur IA (outils = fonctions SQL ci-dessous)
  ├─ /api/webhooks/instagram → DM entrants (API officielle Meta, fenêtre 24 h)
  └─ jobs programmés (relance J-1, rappel, bilan post-soirée)
        │
        ▼
Supabase (région UE, Francfort ou Paris)
  ├─ PostgreSQL : tables + règles métier en triggers + RLS
  ├─ Auth (lien magique / passkey)
  └─ Realtime (compteur d'arrivées 0/10 → 10/10 en direct)
```

**Principe central : les règles vivent dans la base, pas dans l'interface.**
Relance unique, doublons, consentement, majorité, seuil d'absence, cloisonnement : tout est appliqué par PostgreSQL. L'interface, un script ou JARVIS passent par les mêmes garde-fous et ne peuvent pas les contourner.

### JARVIS (priorité 2)
Un seul agent conversationnel (API Claude, facturée séparément de l'abonnement Claude Pro) avec des **outils** qui appellent la base :
`lister_soirees`, `bilan_soiree`, `contacts_fiables(n)`, `preparer_invitations(soiree, contacts, variante)`, `relancer(invitation)`, `performance_messages`, `revenus(periode)`.
Les « spécialistes » (HUNTER, RELATION, FLOOR MANAGER, ANALYST) sont des groupes d'outils et de consignes, pas six bots séparés. JARVIS ne peut **que** lire les vues et appeler les fonctions autorisées ; il ne peut jamais envoyer un DM froid lui-même : il prépare, tu valides.

### Instagram
- **Entrant** (la personne écrit « INVITATION ») : webhook officiel Meta → contact créé avec source `inbound_dm` + preuve de consentement → réponse automatique possible dans la fenêtre de 24 h.
- **Sortant** (prise de contact initiale) : file de travail. L'appli prépare le message, ouvre la conversation (`ig.me/m/pseudo`) et le message est copié ; tu envoies toi-même, puis l'appli enregistre l'envoi. Pas de robot, pas de scraping.

## 3. Schéma de base de données

Fichier : [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)

| Table | Rôle |
|---|---|
| `workspaces` | Ton activité. Contient le **seuil d'absence** et l'option de désactivation automatique. |
| `workspace_members` | Qui a accès, avec quel rôle. |
| `venues` | Établissements (Little Room, puis Bridge, Arc…), taille de groupe, **commission par groupe** (300 € par défaut, modifiable). |
| `contacts` | Fiche contact : Instagram (unique, insensible à la casse), provenance, majorité vérifiée, statut. |
| `consents` | Consentement **par établissement et par finalité**, avec preuve. Un consentement Little Room ne vaut pas pour le Bridge. |
| `message_templates` | Modèles et variantes A/B. |
| `events` | Soirées : date, objectif, tables, offre alcool. |
| `invitations` | Une ligne par contact × soirée : statut, relance, confirmation, présence, groupe. |
| `messages` | Historique des messages entrants/sortants et leur classification. |
| `commission_payments` | Encaissements réels. |
| `audit_log` | Historique de toutes les actions, alimenté automatiquement. |

Vues : `contact_stats` (fiabilité, absences), `event_report` (tunnel + commission due/encaissée), `template_performance` (A/B jugé sur les **présences**), `monthly_revenue`.

### Règles métier appliquées par la base
1. Pas deux contacts avec le même Instagram.
2. Pas deux invitations pour la même personne à la même soirée.
3. Impossible d'inviter sans consentement actif pour cet établissement.
4. Impossible d'inviter à une soirée avec alcool sans majorité vérifiée.
5. Une seule relance, et seulement sur une invitation envoyée restée sans réponse.
6. Absence après confirmation comptée ; au seuil réglable, le contact est **signalé** (ou désactivé si l'option est activée). Jamais supprimé automatiquement.
7. Désinscription : consentements révoqués, invitations futures annulées, historique passé conservé.
8. Commission = groupes **complets** de présentes réelles × tarif de l'établissement (9 présentes = 0 groupe).

## 4. Rôles et permissions

| Rôle | Voit | Peut faire |
|---|---|---|
| `owner` (toi) | Tout son espace | Tout, y compris paramètres, encaissements, journal d'audit |
| `promoter` | Contacts, soirées, messages | Créer contacts, soirées, invitations ; pas les encaissements |
| `door` (entrée) | Uniquement les personnes confirmées | **Uniquement** pointer présent/absent |
| `analyst` | Stats, encaissements | Lecture seule |

Deux espaces (deux promoteurs) ne voient jamais les données l'un de l'autre. Testé.

## 5. Parcours utilisateurs (MVP Little Room)

1. **Créer la soirée** — date, Little Room, objectif 10, tables, offre alcool.
2. **Sélectionner** — liste triée par fiabilité (`contact_stats.reliability`), avec les non-invitables masqués (désinscrits, sans consentement, mineurs/non vérifiés, désactivés) et la raison affichée.
3. **Préparer** — choix de la variante A/B, message personnalisé, file de travail « Ouvrir la conversation → Copier → Marquer envoyé ».
4. **Réponses** — boutons OUI / NON / Question (puis classification IA en priorité 2). Compteur de confirmations en direct.
5. **Relance unique** — bouton visible uniquement pour les invitations éligibles.
6. **Confirmation** — message de confirmation avec les infos et conditions.
7. **Entrée** — écran téléphone du rôle `door` : liste des confirmées, un tap = arrivée, compteur 0/10 → 10/10.
8. **Bilan** — tunnel, absences, groupes complets, commission due ; saisie de l'encaissement.

## Ce qui est réellement fait

- [x] Schéma PostgreSQL complet avec RLS.
- [x] 14 groupes de tests sur les règles métier, qui passent sur PostgreSQL 16 (`supabase/tests/run.sh`).
- [x] Vérifié que les tests échouent bien si une règle est cassée (ex. autoriser 2 relances → le test échoue).

## Ce qui n'est PAS fait

- [ ] Application Next.js (aucun écran).
- [ ] Projet Supabase réel (non créé : à faire en région UE).
- [ ] JARVIS / API Claude.
- [ ] Intégration Instagram (nécessite compte pro + app Meta validée).
- [ ] Textes juridiques (mentions d'information, registre, accord avec Little Room sur le responsable du fichier).

## Lancer les tests

```bash
# avec un PostgreSQL local (utilisateur ayant le droit de créer une base)
PGADMINURL=postgres:///postgres ./promoter-os/supabase/tests/run.sh
```
