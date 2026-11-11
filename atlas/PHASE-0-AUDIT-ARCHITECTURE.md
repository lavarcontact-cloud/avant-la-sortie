# ATLAS — Phase 0 : audit, architecture, roadmap, coûts, limites

Rédigé le 11/11/2026. **Document de conception, à valider avant tout développement.**

Les affirmations techniques et réglementaires sont sourcées et datées dans `VERIFICATIONS.md`. Tout ce qui n'a pas pu être vérifié est marqué **[à vérifier]**. Les coûts sont des **ordres de grandeur estimés**, jamais des devis.

---

## 0. Résumé en 10 lignes

1. Il n'existe **aucun code ATLAS** aujourd'hui : on part d'une feuille blanche, sans architecture à préserver.
2. On construit d'abord **le noyau** : entités séparées, base de données, provenance des données, permissions, journal d'audit, moteur d'automatisation, notifications, écran « Aujourd'hui avec ATLAS ».
3. Stack recommandée : **Next.js (PWA) + Supabase (Postgres, Auth 2FA, stockage chiffré, cron) en région UE + API Claude**.
4. **Un seul assistant** avec des outils et des « casquettes » (admin, juridique, finance, production), pas une flotte d'agents autonomes.
5. **CAF, RSA, France Travail, impôts : aucune API n'est ouverte aux particuliers.** ATLAS sera un assistant de démarches (rappels, préparation, lecture des emails et courriers), pas un connecteur officiel.
6. **Nickel** expose une API DSP2 officielle, accessible seulement à des prestataires agréés : on passe par un agrégateur, ou on commence par l'import CSV.
7. **Qonto** a une API publique (OAuth, virements SEPA avec authentification forte) : c'est la meilleure cible pour les paiements prestataires.
8. La voix (3 appels par jour) est faisable (Twilio + STT/TTS + Claude) pour environ **30 à 120 €/mois** [estimation], en priorité 3.
9. Apple Watch, enceintes et TV demandent des applications natives ou des intégrations spécifiques : priorité 4, à l'exception des **Raccourcis Siri**, quasi gratuits.
10. Budget de fonctionnement du noyau : environ **50 à 90 €/mois** [estimation]. Avec la banque et la voix : **120 à 300 €/mois** selon l'agrégateur bancaire.

---

## 1. Audit de l'existant

| Élément | Constat |
|---|---|
| Dépôt `avant-la-sortie` | Site statique de candidature (un `index.html`, médias, Vercel). **Aucun lien avec ATLAS.** |
| Code ATLAS | Inexistant. Aucun schéma, aucun backend, aucune authentification. |
| Données ATLAS existantes | Registre Excel des 33 unités / ensembles de matériel (hors dépôt). Les 9 éléments de préremplissage du module 05. |
| Connecteurs disponibles dans cet environnement Claude | Gmail, Google Calendar, Supabase, Vercel, Airtable, ElevenLabs, Metricool, GitHub. Ce sont des outils de l'assistant de développement : ils ne sont **pas** des connecteurs d'ATLAS en production. |

**Conséquences :**
- Rien à casser, mais rien à réutiliser côté code.
- **Créer un dépôt privé `atlas`** avant la Phase 1. Ce dossier de conception y sera déplacé.
- Ne jamais versionner de données réelles. Le registre Excel sera importé dans la base, pas commité.

### Recherche Movento.dev (module 12)

`https://movento.dev/` a été consulté le 11/11/2026. La page est rendue côté client : l'outil de lecture n'a obtenu que le titre (« Prompts IA pour créer un site internet — Movento »). **Je n'ai pas pu consulter les catégories Fintech, SaaS, AI/SaaS, Dashboard, Components ou Landing Page, ni aucun template.** Je ne présente donc aucune référence Movento comme consultée.

À faire en Phase 1 : ouvrir le site dans un vrai navigateur (Playwright) ou que Sébastien partage les captures et prompts qui l'intéressent. Les trois directions artistiques seront alors comparées sur pièces.

---

## 2. Architecture cible

### 2.1 Vue d'ensemble

```
 iPhone (PWA) · Windows · Mac · tablette          Téléphone (appels)     Raccourcis Siri
          │                                              │                      │
          ▼                                              ▼                      ▼
 ┌──────────────────────── Next.js (Vercel, région UE) ────────────────────────────┐
 │  UI : Aujourd'hui · Argent · Démarches · Structures · Production · Patrimoine   │
 │       · ATLAS · Réglages                                                         │
 │  API serveur : actions, webhooks (banque, Twilio, Qonto), endpoints Raccourcis   │
 │  Assistant : API Claude + outils typés (lecture / préparation / demande d'accord)│
 └──────────────────────────────────┬───────────────────────────────────────────────┘
                                    │  (secrets uniquement côté serveur)
 ┌──────────────────────────────────▼───────────────────────────────────────────────┐
 │ Supabase (région UE)                                                             │
 │  Postgres + RLS · Auth (mot de passe + TOTP) · Storage chiffré (documents)       │
 │  pg_cron (planification) · file de tâches (outbox) · Edge Functions (workers)   │
 └──────────────────────────────────┬───────────────────────────────────────────────┘
                                    │
   Connecteurs : agrégateur DSP2 (Nickel…) · Qonto · Gmail (plusieurs boîtes) · Google Calendar
                 · Stripe / plateforme commerciale · YouTube / Instagram (pro) · Twilio · STT/TTS
```

### 2.2 Choix techniques et justification

| Besoin | Choix recommandé | Pourquoi | Alternative |
|---|---|---|---|
| Interface web + PWA iPhone | **Next.js (App Router) + TypeScript** | Un seul code pour desktop, mobile et PWA ; écosystème graphique riche | SvelteKit |
| Base relationnelle | **Postgres (Supabase)** | Relationnel strict, contraintes, RLS, JSONB pour les métadonnées | Postgres auto-hébergé |
| Authentification | **Supabase Auth + TOTP obligatoire** | 2FA natif, mono-utilisateur, sessions courtes | Passkeys en complément |
| Documents | **Supabase Storage (bucket privé)** + chiffrement applicatif des pièces sensibles | URLs signées courtes, jamais publiques | S3 UE |
| Tâches planifiées | **pg_cron + table d'outbox + worker** | Planification, rejouabilité, journal dans la même base | Trigger.dev / Inngest |
| IA | **API Claude**, appel serveur, outils typés | Lecture de documents (PDF/photos), raisonnement, *tool use* | — |
| Notifications | **Web Push (VAPID)** sur la PWA + email de secours | Gratuit, iOS ≥ 16.4 sur PWA installée | App native (APNs) en P4 |
| Graphiques | **Recharts ou visx** + **Motion** pour les transitions | Graphiques interactifs, animations sobres | ECharts |
| Hébergement | **Vercel (région UE)** | Déjà utilisé par Sébastien | Fly.io / VPS |

**Région UE obligatoire** pour la base et le stockage (données CAF, identité, banque).

### 2.3 Le noyau (Phase 1) — six briques dont tout le reste dépend

1. **Entités et provenance**
   Toute ligne métier porte `entity_id` (Moi, Entreprise, LA VAR, Patrimoine) et une **provenance** : `bank_sync`, `file_import`, `manual`, `estimated`, `computed`, `email_extracted`, `ai_extracted`. Elle porte aussi `source_ref`, `observed_at` et `confidence`.
   Les chiffres calculés gardent la liste des lignes qui les justifient. C'est ce qui rend chaque graphique traçable.

2. **Journal d'audit immuable**
   Chaque création, modification, suppression logique, action d'IA, exécution d'automatisation et validation y est inscrite (qui, quoi, avant/après, pourquoi). Aucune suppression physique de transaction : uniquement des corrections.

3. **Permissions et validations** (module 23), voir §3.

4. **Bus d'événements**
   Une table `events` reçoit les faits métier (`invoice.paid`, `document.uploaded`, `balance.below_threshold`, `deadline.approaching`…). Les modules **communiquent uniquement par ces événements**.
   Exemple demandé : facture pro payée → stats pro, fiche prestataire / client et trésorerie prévisionnelle se mettent à jour.

5. **Moteur d'automatisation** (module 16), voir §4.

6. **Notifications et briefings**
   Un générateur unique produit les briefings matin / midi / soir à partir des données réelles. Il les livre selon les canaux choisis (push, email, appel en P3).
   Les briefings sont **déterministes pour les chiffres** (calculés en SQL) et ne s'appuient sur l'IA **que pour la rédaction et la priorisation**. L'IA ne fabrique donc aucun chiffre.

Et **un écran** : « **Aujourd'hui avec ATLAS** » (3 priorités, échéances toutes entités, finances par entité, décisions en attente).

### 2.4 Agents : un assistant, plusieurs casquettes

Le cahier des charges demande de ne pas multiplier les agents. Proposition :

- **Un seul orchestrateur** (Claude) qui dispose d'**outils typés** : `lire_transactions`, `lister_echeances`, `preparer_virement`, `rediger_email`, `classer_document`, `creer_tache`, `demander_validation`…
- Des **profils** (prompts système et sources autorisées), et non des processus autonomes : *Administratif* (CAF/RSA/FT/impôts), *Juridique & veille*, *Finance & patrimoine*, *Production* (prestataires, matériel).
- Chaque outil déclare son **niveau de permission requis**. Le serveur, pas le modèle, applique la règle : l'IA ne peut ni s'auto-autoriser ni se tromper de niveau.
- Les tâches de veille (juridique, financière) sont des **automatisations planifiées** qui appellent l'assistant avec le bon profil. Leurs résultats sont stockés avec leur source et leur date de vérification.

### 2.5 Mémoire

- **Mémoire structurée** : faits explicites (`memory_facts` : sujet, valeur, source, date, validé oui/non), modifiables et supprimables par Sébastien depuis l'interface.
- **Comptes rendus** de conversations et d'appels : décisions, tâches promises, sujets à suivre, actions en attente. Chaque élément devient une ligne (tâche, décision, demande de validation), pas seulement du texte.
- Pas de « mémoire » opaque : tout ce qu'ATLAS « sait » est consultable.

---

## 3. Permissions (module 23)

| Niveau | Nom | Exemples | Validation |
|---|---|---|---|
| 1 | Observer | Lire comptes, documents, emails | Accordé par connecteur |
| 2 | Conseiller | Alertes, recommandations, briefings | Aucune |
| 3 | Préparer | Brouillon d'email, ordre de virement en attente, formulaire pré-rempli | Aucune (rien ne sort) |
| 4 | Exécuter sous autorisation | Envoyer l'email, exécuter le virement | **Validation explicite à chaque fois** |
| 5 | Automatiser sans risque | Classer un document, créer une tâche, mettre à jour un tableau de bord | Autorisation **permanente et révocable**, uniquement pour des actions **réversibles** |

**Liste rouge** : jamais au niveau 5, toujours au niveau 4 avec validation unitaire. Elle comprend les paiements, virements, déclarations administratives, signatures, investissements, achats, transmissions de documents sensibles, appels commerciaux et engagements juridiques.

Implémentation :
- Table `permission_grants` (périmètre : outil × entité × connecteur, niveau, date, expiration, révocation).
- Table `action_requests` : toute action de niveau 4 crée une demande avec un **aperçu exact** (montant, IBAN masqué, destinataire, texte). La validation exige une session 2FA récente. Pour les paiements, l'authentification forte de la banque s'ajoute.
- **Validation = clic dans l'application.** Une phrase dite au téléphone (« oui vas-y ») **ne suffit pas** pour la liste rouge : l'appel crée la demande et la validation se fait dans l'app.
- Page **Autorisations** : liste, historique, révocation immédiate.

---

## 4. Moteur d'automatisation (module 16)

Modèle : **DÉCLENCHEUR → CONDITIONS → ACTIONS → VALIDATION → EXÉCUTION**

- **Déclencheurs** : planifié (cron), événement (`events`), seuil (requête sur une métrique), manuel.
- **Conditions** : expressions sur les données (constructeur visuel, stockées en JSON validé par un schéma).
- **Actions** : catalogue fermé d'actions typées. Chacune a un niveau de permission (niveau 5 si réversible, sinon une demande de validation est créée).
- **Exécution** : idempotente (clé d'idempotence par exécution), relances limitées, erreurs visibles.
- Chaque automatisation a un nom, une description, un statut (active / en pause / désactivée), une fréquence, un historique et un journal d'exécution avec les erreurs.
- **Garde-fou** : une automatisation ne peut jamais appeler une action au-delà de ses autorisations. Le moteur vérifie au moment de l'exécution, pas à la création.

Automatisations livrées avec le noyau (désactivées par défaut, activées une à une) :
1. Échéance administrative dans J-7 / J-1 → notification + checklist des pièces.
2. Charges des 7 prochains jours > disponible → alerte trésorerie.
3. Document expirant dans 60 jours → tâche de renouvellement.
4. Facture client échue non payée → brouillon de relance → **validation** → envoi.
5. Nouvelle transaction récurrente détectée → proposition « abonnement ? » à confirmer.
6. Paiement CAF attendu non reçu à J+3 → alerte écart attendu / reçu.

---

## 5. Faisabilité des connecteurs (modules 02, 13, 15, 18)

| Service | Possibilité réelle | Plan ATLAS | Priorité |
|---|---|---|---|
| **Nickel** | API DSP2 officielle (Berlin Group, AIS + PIS) réservée aux **prestataires agréés**. Un particulier ne peut pas s'y brancher directement. | 1) Import CSV / relevés dès la P1. 2) Agrégateur DSP2 (Powens, Bridge, Enable Banking…) **après vérification que Nickel est couvert** [à vérifier]. | P1 (CSV) / P2 (synchro) |
| **Qonto** | API Business publique : OAuth, lecture, **virements SEPA** (scope `payment.write`, authentification forte sauf bénéficiaire de confiance), vérification du bénéficiaire (VoP), sandbox. | Connecteur direct dès l'ouverture du compte pro. Virements prestataires préparés, puis validés dans ATLAS et dans Qonto. | P2 |
| **Powens / Bridge** | Agrégateurs agréés (AISP/PISP). Tarifs sur devis, orientés entreprises [à vérifier pour un usage individuel]. | Demander un devis ; comparer avec Enable Banking. GoCardless Bank Account Data **n'accepte plus de nouvelles inscriptions**. | P2 |
| **CAF / RSA** | **Pas d'API pour les particuliers.** API Particulier est réservée aux administrations et organismes en mission de service public. | Calendrier, rappels, préparation de la déclaration trimestrielle, lecture des emails et courriers CAF, suivi attendu / reçu à partir des relevés bancaires. Déclaration faite **par Sébastien** sur caf.fr. | P1 |
| **France Travail** | Les API francetravail.io visent les partenaires, pas l'actualisation d'un demandeur [à vérifier]. | Même principe : rappels d'actualisation, préparation, suivi des emails. | P1 |
| **Impôts** | Pas d'API particulier. | Calendrier fiscal, préparation, lecture des avis importés. | P1 |
| **Gmail (plusieurs boîtes)** | API Gmail via OAuth, une autorisation par boîte. Scopes « restreints » pour la lecture. Pour une app personnelle non vérifiée : écran d'avertissement, et en mode « test » les jetons expirent au bout de 7 jours [à vérifier]. | Lecture seule au départ ; étiquetage par usage (perso / pro / association / admin) ; détection CAF, FT, impôts, banques, factures. | P2 (P1 possible en lecture) |
| **Google Calendar** | API officielle. | Échéances et rendez-vous synchronisés, sans doublons. | P1 |
| **Apple Calendar** | Pas d'API web simple ; abonnement ICS possible. | Flux ICS exporté par ATLAS (lecture côté Apple). | P2 |
| **Instagram** | Graph API uniquement pour les comptes **professionnels** (Business/Creator) [à vérifier]. | Comptes pro uniquement, sans simulation pour les comptes perso. Option : passer par Metricool. | P3 |
| **Snapchat** | Pas d'API publique de statistiques organiques identifiée ; l'API Marketing concerne les publicités [à vérifier]. | Saisie manuelle / import, jusqu'à preuve du contraire. | P3 |
| **TikTok / YouTube** | YouTube Data + Analytics API : OK via OAuth. TikTok : API soumises à validation [à vérifier]. | YouTube d'abord. | P3 |
| **Stripe / plateforme commerciale** | API + webhooks Stripe. | Webhooks → `events` (`invoice.paid`…). Contrat d'API défini dès la P1 pour ne pas bloquer. | P2 |
| **Twilio / Vonage** | Appels sortants programmables. Numéro français soumis à justificatifs réglementaires. | Voir §6. | P3 |

**Règle d'affichage :** un connecteur en erreur affiche ses données en mode **« périmé depuis le … »**, jamais comme actuelles.

---

## 6. ATLAS Voice (module 17)

**Chaîne technique :** planification (pg_cron) → Twilio appelle le numéro de Sébastien → flux audio temps réel → reconnaissance vocale (STT) → Claude (profil briefing + outils en lecture / préparation) → synthèse vocale (TTS) → récapitulatif écrit enregistré + notification.

Options d'assemblage, à comparer en P3 :
- **Plateforme d'agent vocal clé en main** (ex. ElevenLabs Agents, avec numéro Twilio) : plus rapide, moins de contrôle.
- **Framework open source** (ex. Pipecat, LiveKit Agents) + Twilio + STT/TTS au choix : plus de contrôle, plus de travail. *(Candidats non audités, voir §9.)*

Règles :
- Le briefing vocal lit des **chiffres calculés**, jamais générés par le modèle.
- **Interruption** (barge-in) et questions libres : oui. **Actions de la liste rouge : jamais validées à la voix**, une demande est créée dans l'app.
- **Enregistrement désactivé par défaut.** Transcription et compte rendu conservés selon une durée choisie, effaçables. Pour des appels avec des tiers (clients), information préalable et base légale obligatoires.
- **Appels clients** : architecture prévue (profils, scripts, transfert vers Sébastien, liste d'opposition), mais **aucun appel réel** avant la phase de simulation des 8 scénarios, une grille d'évaluation et l'accord explicite de Sébastien. ATLAS se présente toujours comme une IA.

---

## 7. Multi-appareils (module 19)

| Support | Faisable | Comment | Priorité |
|---|---|---|---|
| iPhone | Oui | PWA installée (écran d'accueil), **push web iOS ≥ 16.4**, raccourcis | P1 |
| Windows / Mac / tablette | Oui | Même application web, notifications navigateur | P1 |
| Siri / HomePod / CarPlay (voix) | Partiel | **Raccourcis Siri** appelant des endpoints ATLAS (« Dis Siri, briefing ATLAS »), réponse lue par Siri | P2 (peu coûteux) |
| Apple Watch | Partiel | Les notifications de l'iPhone peuvent s'y afficher [à tester avec la PWA]. Une vraie app Watch exige une **app native watchOS** (Swift, compte Apple Developer 99 $/an) | P4 |
| Enceintes (Alexa / Google) | Partiel | Skills / Actions spécifiques ; écosystèmes changeants | P4 |
| TV connectée | Limité | Page « briefing » en plein écran via navigateur ou AirPlay | P4 |

Aucune compatibilité universelle n'est promise.

---

## 8. Roadmap

La priorité 1 du cahier des charges est découpée pour que **chaque étape livre quelque chose d'utilisable et testé**.

### Priorité 1 — Noyau et vie quotidienne
| Étape | Contenu | Critère de « terminé » |
|---|---|---|
| 1.1 Fondations | Dépôt privé, Supabase UE, Auth + TOTP, entités, provenance, journal d'audit, RLS, sauvegardes, export | Connexion 2FA testée ; une donnée créée apparaît dans le journal ; export complet fonctionne |
| 1.2 Permissions + événements + automatisations | `permission_grants`, `action_requests`, `events`, moteur, 6 automatisations de base | Une automatisation de niveau 4 crée bien une demande et n'exécute rien sans validation |
| 1.3 Notifications + « Aujourd'hui avec ATLAS » | Web push, email, briefings matin / midi / soir texte | Push reçu sur iPhone (PWA installée) ; briefing basé sur des données réelles |
| 1.4 Argent (sans banque) | Comptes, cartes, transactions manuelles, import CSV Nickel, charges récurrentes, détection d'abonnements | Import d'un vrai relevé CSV, détection d'un abonnement confirmée à la main |
| 1.5 Documents + démarches | Coffre, import photo / PDF, extraction IA proposée, CAF/RSA/FT/impôts : calendrier, checklists, attendu vs reçu | Un courrier importé est résumé, daté, classé après confirmation |
| 1.6 Prestataires + matériel | Base prestataires, projets, missions, coûts, import du registre des 33 équipements | Coût total et marge d'un projet test recalculés automatiquement |
| 1.7 Assistant conversationnel | Chat avec outils de lecture / préparation, mémoire structurée | Répond « je ne sais pas » quand la donnée manque ; ne produit aucun chiffre non traçable |

### Priorité 2 — Connexions et structures
Agrégateur bancaire (Nickel), Qonto (lecture puis virements validés), plusieurs boîtes Gmail, Google Calendar, comptabilité pro et associative séparées, paiements prestataires, connexion à la plateforme commerciale, profils Administratif et Juridique, Raccourcis Siri.

### Priorité 3 — Voix et veille
ATLAS Voice (3 appels), mémoire des appels, veille juridique et financière planifiée, investissements de niche (fiches sourcées), réseaux sociaux (comptes pro).

### Priorité 4 — Extension
Simulation puis appels commerciaux, Apple Watch native, enceintes, TV, automatisations avancées, patrimoine approfondi.

Les modules V1 « Patrimoine / simulateur immobilier » (06) et « Actualités » (07) passent en P3–P4, conformément à la nouvelle priorisation V2.

---

## 9. Recherche GitHub / skills (module 21) — méthode

**Pas encore réalisée.** Elle se fera au début de chaque priorité, pour les seuls besoins de cette priorité, avec la grille d'audit du cahier des charges (nom, URL, fonction, langage, licence, dernière mise à jour, activité, compatibilité, dépendances, risques de sécurité, coût, utilité).

Pistes à auditer, citées comme **candidats non vérifiés** :
- Gestion documentaire / OCR : paperless-ngx (référence de conception) ; Claude lit déjà PDF et photos, un OCR séparé n'est peut-être pas nécessaire.
- Finances personnelles : Actual Budget, Firefly III (modèles de données, règles de catégorisation : inspiration, pas intégration).
- Voix : Pipecat, LiveKit Agents.
- Workflows : n8n (attention à sa licence « fair-code »). Le moteur interne suffit probablement pour le besoin décrit.

Règles : rien n'est installé sans audit écrit ; lecture des scripts d'installation, des permissions et des accès réseau ; préférence pour une dépendance bien maintenue plutôt que dix petites.

---

## 10. Coûts (ordres de grandeur, novembre 2026)

**Estimations à confirmer sur les grilles officielles au moment de la souscription.** USD convertis approximativement.

### Coûts récurrents mensuels

| Poste | Hypothèse | Estimation |
|---|---|---|
| Supabase | Plan Pro (sauvegardes quotidiennes ; le plan gratuit se met en pause et n'a pas de sauvegardes) | ~25 $ |
| Vercel | Hobby (usage personnel) ou Pro | 0 à 20 $ |
| API Claude | 3 briefings/jour + chat + lecture de documents + veille | 15 à 60 € [estimation] |
| Notifications push web | VAPID | 0 € |
| Emails transactionnels | Petit volume | 0 à 10 € |
| Nom de domaine | — | ~1 € (≈ 15 €/an) |
| **Sous-total noyau (P1)** | | **≈ 50 à 90 €/mois** |
| Agrégateur bancaire | Powens / Bridge sur devis ; alternatives possiblement gratuites en usage perso [à vérifier] | 0 à 150 € [inconnu tant que pas de devis] |
| Qonto API | Incluse dans l'abonnement Qonto [à vérifier selon offre] | 0 € en plus |
| Voix : téléphonie | 3 appels × 5 min × 30 j ≈ 450 min ; Twilio vers mobile FR ≈ 0,04 $/min depuis l'EEE, ≈ 0,15 $/min sinon ; + numéro | 20 à 75 $ |
| Voix : STT + TTS + LLM temps réel | ≈ 0,05 à 0,15 $/min [estimation] | 25 à 70 $ |
| **Total P1 + P2 + P3** | | **≈ 120 à 300 €/mois** |

### Coûts d'installation

| Poste | Estimation |
|---|---|
| Comptes (Supabase, Vercel, Anthropic, Twilio) | 0 € (crédits prépayés possibles) |
| Numéro français Twilio | Dossier réglementaire (justificatifs d'identité / adresse) ; coût faible, délai de validation [à vérifier] |
| Apple Developer Program (seulement si app native / Watch, P4) | 99 $/an |
| Agrégateur bancaire | Frais de mise en place éventuels [sur devis] |

**Levier d'économie** : briefings calculés en SQL et rédigés par un modèle plus léger ; modèle plus puissant seulement pour les analyses ; mise en cache des contextes répétés.

---

## 11. Dépendances et limitations (à lire avant de coder)

**Dépendances bloquantes**
1. Dépôt privé `atlas` et projet Supabase en région UE.
2. Clé API Anthropic (côté serveur).
3. P2 : réponse d'un agrégateur bancaire couvrant Nickel ; compte Qonto ouvert.
4. P3 : compte Twilio avec numéro validé.

**Limitations réelles**
- **CAF, RSA, France Travail, impôts** : pas de connexion officielle. ATLAS rappelle, prépare et explique ; Sébastien déclare. Les règles RSA en cas de création d'activité doivent être **vérifiées sur les sources officielles au moment du calcul** et présentées comme estimation, jamais comme décision.
- **Banque** : données DSP2 rafraîchies quelques fois par jour, **pas en temps réel** ; consentement à renouveler périodiquement (DSP2) [durée à vérifier] ; l'initiation de paiement passe toujours par l'authentification forte de la banque.
- **Gmail** : scopes restreints, avertissement « application non vérifiée », possible ré-autorisation périodique.
- **Réseaux sociaux** : comptes personnels Instagram et Snapchat très probablement inaccessibles par API.
- **iOS** : push web uniquement si la PWA est installée sur l'écran d'accueil ; pas de vraie app Watch sans natif.
- **IA** : peut se tromper. Sur le juridique, la fiscalité, la CAF et l'argent, chaque réponse cite sa source et sa date, et signale quand un professionnel est nécessaire.
- **Juridique** : la veille ne garantit aucune conformité.

---

## 12. Décisions attendues de Sébastien

1. **Valider la stack** (Next.js + Supabase UE + Claude + Vercel).
2. **Créer le dépôt privé `atlas`** (ou m'autoriser à le préparer) et y déplacer ce dossier.
3. **Statut actuel de l'activité pro** : micro-entreprise déjà créée ou non ? (impacte TVA, URSSAF, facturation électronique, RSA).
4. **Banque** : accepter de commencer par l'import CSV Nickel, le temps d'obtenir des devis d'agrégateurs ?
5. **Horaires des 3 briefings** (texte d'abord, voix en P3).
6. **Movento** : partager les captures ou prompts retenus, ou m'autoriser à l'explorer via un navigateur automatisé.
7. Fournir le **registre Excel des 33 équipements** pour l'import en P1.6.
