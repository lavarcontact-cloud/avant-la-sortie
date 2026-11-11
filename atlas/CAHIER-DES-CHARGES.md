# ATLAS — Cahier des charges consolidé (V1 + V2)

Version : V2 consolidée — 11/11/2026
Source : cahier des charges V1 (modules 01–12) et extension V2 (modules 13–23) rédigés par Sébastien.
Ce document **intègre** la V2 dans la V1 : ATLAS reste **une seule application**, avec un seul centre de commandement et des agents spécialisés derrière.

Les textes d'origine font foi en cas de doute. Ce document les dédoublonne, les regroupe par domaine et rend explicites les règles transverses.

---

## 1. Vision

ATLAS est le directeur des opérations personnel de Sébastien : administratif, juridique, financier et opérationnel.

- Il **anticipe** (échéances, obligations, problèmes de trésorerie).
- Il **prépare** (documents, formulaires, paiements, messages).
- Il **vient vers lui** (trois briefings quotidiens, notifications, appels).
- Il **ne décide jamais à sa place** sur ce qui engage.

Application **privée, mono-utilisateur** (ajout d'un autre accès possible plus tard, jamais par défaut).

## 2. Les quatre environnements (« entités »)

| Entité | Nature juridique | Exemples de contenu |
|---|---|---|
| **Moi** | Personne physique | CAF, RSA, France Travail, impôts, documents d'identité, Nickel, épargne |
| **Activité pro / future entreprise** | EI / micro-entreprise / société (à créer) | Clients, devis, factures, prestataires, TVA, URSSAF, Qonto |
| **LA VAR** | Association loi 1901 | Statuts, RNA, bureau, AG, adhérents, subventions, comptes associatifs |
| **Patrimoine / investissements** | Rattaché juridiquement à « Moi » (ou à une future structure) | Placements, immobilier, actifs alternatifs, matériel |

Règles :
1. **Chaque donnée appartient à exactement une entité.** Jamais de transaction, compte, document ou facture sans entité.
2. **Aucun mouvement d'argent entre entités n'est implicite.** Un apport, un remboursement de frais ou une refacturation est un objet explicite, à deux écritures, visible des deux côtés.
3. **Vue consolidée = lecture seule et agrégée**, jamais une fusion de comptabilités. Elle affiche toujours la répartition par entité.
4. **L'argent de LA VAR n'apparaît jamais dans « argent disponible » personnel.**

## 3. Domaines fonctionnels (regroupement des 23 modules)

Le cahier des charges contient 23 modules. Ils sont regroupés en **8 domaines** pour éviter une application à 40 entrées de menu.

| Domaine | Modules d'origine | Écran(s) |
|---|---|---|
| **A. Aujourd'hui** (centre de commandement) | 01, 09, 10, partie de 08 | « Aujourd'hui avec ATLAS » : 3 priorités, échéances, finances, décisions en attente |
| **B. Argent** | 02, 03, 04, 06, 11, partie de 15 (paiements) | Comptes, transactions, charges, budgets, achats prévus, trésorerie prévisionnelle |
| **C. Démarches & documents** | 13, 14 (partie admin) | Coffre documentaire, CAF/RSA, France Travail, impôts, calendrier administratif |
| **D. Structures** | 14 | Une fiche par entité : obligations, gouvernance (LA VAR), juridique, comptabilité |
| **E. Production** | 05, 15, 11 | Projets, missions, prestataires, matériel, coûts et marges |
| **F. Patrimoine & veille** | 06, 07, 20, 14 (veille juridique) | Portefeuille, simulateurs, veille financière, veille juridique, opportunités |
| **G. ATLAS (assistant)** | 08, 16, 17, 21 | Conversation, voix, appels, automatisations, mémoire, agents |
| **H. Réglages & confiance** | 12, 18, 19, 22, 23 | Connecteurs, permissions, journal d'audit, appareils, notifications, export/suppression |

## 4. Exigences par domaine

### A. Aujourd'hui (01, 09, 10)
- Situation à trois horizons : **aujourd'hui** (disponible réel), **ce mois-ci** (revenus/dépenses/épargne), **3 / 6 / 12 mois** (prévisionnel).
- Indicateurs : disponible par compte, épargne, revenus et dépenses du mois, charges à venir, argent réservé, objectifs, patrimoine estimé, investissements, achats prévus, alertes.
- **Trois priorités du jour**, échéances (toutes entités), décisions en attente de validation.
- Indicateur de santé financière fondé sur des données concrètes (trésorerie, charges fixes, épargne, dettes, revenus), avec sa formule affichée.
- Trois briefings (matin, midi, soir) en notification, texte et — plus tard — appel vocal. Horaires configurables.
- Objectifs avec progression visuelle et récompenses symboliques. **Interdits :** fausses urgences, notifications artificielles, mécanismes manipulateurs.

### B. Argent (02, 03, 04, 06, 11, 15)
- Comptes multiples par entité et par établissement (Nickel, Qonto, autres), types : courant, épargne, investissement, espèces, autre.
- **Carte ≠ compte** : une carte est rattachée à un compte ; seuls les comptes portent un solde.
- Saisie manuelle, import CSV, synchronisation bancaire (DSP2 via agrégateur).
- Catégorisation automatique **toujours corrigeable**, jamais de suppression définitive sans retour arrière.
- Détection d'abonnements (récurrence + montant) → **proposition à confirmer**, détection des hausses de prix et des abonnements oubliés.
- Charges récurrentes : nom, montant, date, fréquence, catégorie, compte, renouvellement, statut, lien de gestion/résiliation.
- Alerte « X € de charges dans les 7 prochains jours ».
- Achats prévus : analyse ACHETER MAINTENANT / ATTENDRE / OCCASION / NE PAS ACHETER, chiffrée, qui ne conclut jamais « intéressant » au seul motif que le solde le permet.
- Paiements prestataires : ordre préparé → validation explicite → exécution (si l'API le permet) → **facture « payée » seulement sur confirmation bancaire ou justificatif**, jamais à la création de l'ordre.
- Connexion future à la plateforme commerciale (CA, factures, acomptes, coûts, marges) par API sécurisée ; ATLAS ne doit pas en dépendre pour fonctionner.

### C. Démarches & documents (13)
- Coffre documentaire : identité, passeport, domicile, CAF, RSA, France Travail, impôts, attestations, contrats, banque, courriers, mutuelle, assurances.
- Métadonnées : catégorie, entité, organisme, dates d'émission / d'expiration / de renouvellement, statut, historique, rappel associé.
- Import PDF / photo depuis le téléphone ; l'IA identifie le type, extrait les dates, **propose** un classement, résume un courrier en français simple.
- **CAF / RSA** : déclarations trimestrielles, ressources, paiements attendus vs reçus (écart signalé), notifications, demandes de justificatifs, changements de situation, réexamens, historique.
- Simulation de l'effet d'une création d'activité sur le RSA, avec trois statuts visibles : **règle applicable (sourcée)**, **estimation ATLAS**, **décision officielle CAF**.
- **France Travail** : inscription, actualisation mensuelle, rendez-vous, documents, indemnités, historique.
- **Impôts** : calendrier fiscal (déclaration annuelle, avis, prélèvement à la source, échéances, taxe foncière, obligations des structures).
- ATLAS prépare et pré-remplit **quand c'est techniquement et légalement possible** ; toute déclaration engageante exige la **validation finale** de Sébastien et est transmise par lui.
- **Ne jamais prétendre disposer d'une connexion officielle CAF / France Travail / impôts** (voir `VERIFICATIONS.md` : aucune API n'est ouverte aux particuliers pour ces services).

### D. Structures (14)
- Espaces séparés : personnel, future entreprise audiovisuelle, LA VAR, futures structures.
- **LA VAR** : statuts, récépissé, RNA, bureau, AG, PV, adhérents, subventions, conventions, assurances, recettes/dépenses, comptabilité, bilans, justificatifs de financement, obligations liées aux subventions et à d'éventuelles activités économiques.
- **Entreprise** : statuts, SIREN/SIRET, Kbis si applicable, comptes, contrats, assurances, factures, TVA, déclarations de CA, cotisations, échéances, documents comptables, relation expert-comptable.
- **Veille juridique** (agent) : chaque évolution présentée en 7 points — règle actuelle, évolution, date d'entrée en vigueur, structures concernées, conséquences, actions, lien officiel — et **date de vérification**. Sources prioritaires : Légifrance, Service-Public, URSSAF, impots.gouv.fr, BOFiP, CNIL, EUR-Lex.
- Aucune garantie de conformité ; ATLAS signale les questions à soumettre à un expert-comptable ou un avocat.

### E. Production (05, 15)
- Inventaire matériel : catégories, marque, modèle, photo, achat (date, prix), valeur estimée, état, n° de série, garantie, facture, accessoires, usage, maintenance, remplacement.
- **Préremplissage à confirmer** (jamais certifié) : Sony A7R IV, Sony FX3, Canon R10, 28-70 mm et optiques compatibles, DJI Mic 2, DJI Ronin RS3 Pro, 3 × Neewer 660 RGB, batterie V-Mount 99 Wh, softbox 30 × 120 cm avec grille.
- **Registre des 33 unités / ensembles** déjà établi (fichier Excel) : à importer comme source de vérité de l'inventaire, en conservant la distinction confirmé / à vérifier ; la valeur estimée reste vide tant qu'elle n'a pas été recherchée.
- Consommables (batteries, cartes SD, SSD, câbles, pieds, fixations, adaptateurs) avec seuils, et kits de tournage (équipements manquants).
- Prestataires : coordonnées, métier, compétences, tarifs (habituel / négocié), disponibilité, missions, factures, paiements, évaluations internes, portfolio, informations administratives.
- Projets et missions multi-intervenants : date, description, responsable, budget, montant négocié, livraison, statut, facture, paiement.
- Par prestataire : total payé, à payer, nb de missions, coût moyen, dernier paiement, factures en attente.
- Par projet : coût total réel et **marge réelle**.

### F. Patrimoine & veille (06, 07, 20)
- Portefeuille : épargne, actions, ETF, obligations, crypto (optionnel), immobilier, autres, dettes. Montant investi, valeur, évolution, plus/moins-value, répartition, revenus, concentration.
- Simulateur immobilier complet (coût total, mensualité, rendements brut/net, cash-flow, effort d'épargne, multi-années, scénarios pessimiste / réaliste / optimiste) et comparateur.
- Veille financière personnalisée (titre, date, source, lien, résumé, importance, impact sur les objectifs). Jamais d'actualité ancienne présentée comme récente.
- Investissements de niche (royalties musicales, catalogues, licences, collection, non coté…) : nature, ticket, durée, liquidité, frais, fiscalité, risques, historique, sources, scénarios, **possibilité de perte totale**. Classement : réglementé / spéculatif / illiquide / entrepreneurial / achat-revente / long terme. Jamais de rendement inventé.

### G. ATLAS assistant (08, 16, 17, 21)
- Conversation naturelle avec accès aux données enregistrées et **mémoire structurée** (revenus, charges, objectifs, matériel, projets, priorités) modifiable par Sébastien.
- Recommandations au format en 9 points (constat, données, décision, raisons, avantages, risques, conséquences chiffrées, moment, liens).
- Capacité à dire « je n'ai pas assez d'informations ».
- **Moteur d'automatisation** : DÉCLENCHEUR → CONDITIONS → ACTIONS → VALIDATION → EXÉCUTION ; récurrent, conditionnel, événementiel ; nom, description, statut, fréquence, historique, journal, erreurs, pause, désactivation. **Aucune automatisation ne contourne les permissions.**
- **Voix** : trois appels quotidiens configurables (matin / midi / soir), interruption possible, actions autorisées, récapitulatif écrit, comptes rendus retrouvables, consentement et conservation des enregistrements maîtrisés.
- **Appels clients (futur)** : phase de simulation obligatoire (8 scénarios), transfert des cas sensibles, auto-évaluation de fiabilité, **aucun appel réel sans autorisation**, IA qui se présente comme IA, conformité RGPD et prospection.
- **Recherche de skills / dépôts GitHub** : audit (nom, URL, fonction, langage, licence, dernière mise à jour, activité, compatibilité, dépendances, risques, coût, utilité) **avant** toute installation ; jamais d'installation en masse.

### H. Réglages & confiance (12, 18, 19, 22, 23)
- **Connecteurs** multi-comptes (banques, emails par usage, réseaux sociaux par type de compte, calendriers, stockage, Stripe, Qonto, GitHub…) avec page : service, compte, autorisations, dernière synchro, état, erreurs, déconnexion. Jamais de connexion simulée.
- **Multi-appareils** : iPhone (PWA puis éventuellement natif), Windows, Mac, tablette ; Apple Watch, enceintes et TV plus tard, avec limites réelles documentées.
- **Design** : sombre, élégant, original (pas de copie de films), data au centre, motion design sobre qui aide à comprendre.
- **Transparence** : chaque chiffre traçable jusqu'à ses sources ; chaque estimation affiche hypothèses, période, méthode, incertitude, date ; distinction visuelle réel / estimé / prévisionnel ; données d'un connecteur en panne marquées comme périmées.
- **Permissions** à 5 niveaux (voir Phase 0) ; opérations sensibles toujours soumises à accord ; autorisations consultables et révocables à tout moment.
- Sécurité : 2FA, secrets côté serveur, jamais d'identifiants bancaires stockés, chiffrement des documents, sauvegardes, export, suppression sur demande.

## 5. Règles fondamentales (inchangées, complétées)

1. Application qui appartient à Sébastien et centralise sa vie financière, administrative et professionnelle.
2. Données fiables, sourcées, datées. **Jamais de faux chiffres** dans l'environnement réel.
3. Séparation stricte des entités.
4. Rien d'engageant sans validation explicite (paiements, déclarations, contrats, investissements, achats, transmissions de documents sensibles, appels commerciaux).
5. Modules livrés un par un, **testés** avant d'être déclarés terminés.
6. Aucune IA ne garantit zéro défaillance : contrôles, sources officielles, journaux, sauvegardes, alertes d'incertitude.
