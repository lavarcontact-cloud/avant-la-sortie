# ATLAS — Module Entreprise : étude comparative des statuts

Version 1 — 11/11/2026. Étude préalable à la création, **aucune démarche n'a été effectuée**.

- Calculs : moteur officiel de l'URSSAF (`modele-social` 11.1.0, celui de mon-entreprise.urssaf.fr), reproductible avec `simulateur/simulate.mjs`. Résultats complets : `simulateur/resultats.md` et `resultats.csv`.
- Règles : sources officielles quand elles étaient accessibles (service-public.fr, URSSAF via son moteur), sinon sources secondaires signalées. Détail en §11 et dans `../VERIFICATIONS.md`.
- **Ce document n'est pas un conseil juridique ou comptable.** Il prépare le rendez-vous avec un expert-comptable et ta CAF ; il ne le remplace pas.

---

## 1. La décision en une page

**Il n'y a pas de bon statut dans l'absolu. Une question tranche presque tout : quelle part de ton chiffre d'affaires repart en dépenses (prestataires, locations, matériel) ?**

| Ton modèle d'activité | Meilleur statut au départ | Pourquoi |
|---|---|---|
| Tu vends surtout **ton propre travail** (photo, cadrage, montage, contenu, dev), avec peu de frais | **Micro-entreprise** | Cotisations proportionnelles, zéro comptable, gestion simple. Elle laisse le plus de revenu jusqu'à ≈ 83 600 € de CA |
| Tu vends des **productions complètes** (clip clés en main) et tu **payes une équipe** avec cet argent | **EI au réel** | En micro, tu payes cotisations, impôt **et RSA perdu** sur de l'argent qui part aux prestataires. Au-delà d'environ **15–25 % de charges (BNC)** ou **31–39 % (BIC)**, l'EI au réel gagne |
| Gros bénéfices stables (> 50–60 k€/an), associés, levée de fonds pour une application | **SASU** (ou EI à l'IS) | Pas avant. Aux niveaux de CA étudiés, la SASU laisse **toujours moins** de revenu que les deux autres |

**Ma recommandation provisoire :** démarrer en **micro-entreprise**, *à condition* d'organiser les productions de clips pour que **les prestataires facturent directement le client** (ou que le budget technique soit payé à part). Si tu dois porter toi-même les budgets d'équipe, partir directement en **EI au réel**.

**Ne pas créer tout de suite :** trois informations manquantes peuvent inverser la recommandation (§2). Il faut une semaine pour les rassembler, et la date de création compte pour l'ACRE (§6.2).

---

## 2. Ce que je sais, ce qui manque

### Données réelles disponibles dans le projet
| Donnée | Valeur | Source |
|---|---|---|
| Situation | Allocataire du RSA, entreprise non créée | Ton message |
| Activités | Photo, réalisation, clips, cadrage, montage, contenu, promotion événementielle, mise en relation, dev d'applications | Ton message |
| Matériel | Sony A7R IV, FX3, Canon R10, 28-70, DJI Mic 2, RS3 Pro, 3 × Neewer 660, V-Mount, softbox… + registre de 33 unités (valeurs non encore estimées) | Cahier des charges, registre Excel |
| Plans drone | Le site présente des plans drone tournés par toi | `index.html` (section Origins) |
| Association | Tu gères LA VAR (loi 1901) | Cahier des charges |

**Je ne dispose d'aucun chiffre réel de revenus, de prix, de clients ni de dépenses.** Toutes les simulations reposent donc sur des **scénarios** de CA, pas sur des prévisions.

### Informations manquantes, par ordre d'impact
| # | Information | Pourquoi elle compte |
|---|---|---|
| 1 | **Part des budgets reversée à des prestataires** sur un clip type | C'est la variable qui fait basculer micro ↔ réel (§4.3) |
| 2 | **Prix et volume réalistes** : tarifs, nombre de missions/mois, clients déjà prêts à commander | Fixe la ligne de CA à regarder dans les tableaux |
| 3 | **Type de clients** : particuliers / artistes indépendants vs labels et entreprises | Au-delà de 37 500 € de CA, la TVA (+20 %) est neutre pour une entreprise et coûte au particulier |
| 4 | Logement (APL ? hébergé ?), situation familiale, montant RSA actuel | Change le RSA et la prime d'activité (forfait logement, composition du foyer) |
| 5 | Revenus déjà perçus pour ces activités et sous quelle forme (facture, salaire, cachet, défraiement associatif) | Détermine le point de départ et ce qui doit être régularisé ou non |
| 6 | Valeur du matériel (registre des 33 unités) | Au réel, le matériel apporté s'amortit et réduit le bénéfice imposable |
| 7 | Ton rôle exact dans LA VAR (président, trésorier…) et ce que LA VAR achète comme prestations | Risque de conflit d'intérêts (§7) |
| 8 | Commune de domiciliation | CFE ; certaines aides locales, dont celles liées aux quartiers prioritaires |
| 9 | Projet d'application : seul ou avec des associés ? financement extérieur ? | Seul déclencheur sérieux d'une SASU à court terme |
| 10 | Usage du drone pour des clients ? certificats ? | Activité réglementée (§7) |

---

## 3. Classement de tes activités

Le régime dépend de la **nature** de chaque activité. Une seule micro-entreprise peut regrouper plusieurs activités, mais leurs recettes se déclarent **séparément**, chacune avec son taux.

| Activité | Nature probable | Cotisations micro 2026 | Abattement impôt / CAF | Points d'attention |
|---|---|---|---|---|
| Photographie de commande (portrait, événement, pochette, plateau) | **BIC prestation artisanale** (immatriculation au répertoire des métiers, CMA) [à confirmer à l'immatriculation] | 21,2 % (+ CFP 0,3 %) | 50 % | La photo d'art cédée en droits d'auteur relève du régime des **artistes-auteurs**, pas de la micro |
| Cadrage, montage, étalonnage, production vidéo | **BNC** libéral non réglementé | 25,6 % (+ CFP 0,2 %) | 34 % | Si une boîte de prod t'engage comme technicien sur un tournage, elle doit souvent te **salarier** (intermittent). Risque de requalification si tu factures en étant subordonné |
| Réalisation de clips | **BNC** pour la prestation technique ; **droits d'auteur** pour la part création | 25,6 % | 34 % | Le réalisateur est un auteur : sa rémunération d'auteur ne peut pas passer par la micro. À clarifier avec l'expert (§10) |
| Création de contenu, communication digitale, community management | **BNC** | 25,6 % | 34 % | — |
| Développement d'applications | **BNC** | 25,6 % | 34 % | Propriété du code : contrats de cession ; associés éventuels → société |
| Promotion événementielle | **BIC commercial** ou BNC selon les cas | 21,2 % | 50 % | **Au-delà de 6 représentations par an**, organiser des spectacles exige la déclaration d'**entrepreneur de spectacles** (récépissé valant licence) |
| Mise en relation commerciale (apport d'affaires) | **BNC** si occasionnelle, **BIC commercial** si habituelle | 25,6 % ou 21,2 % | 34 % ou 50 % | Contrat écrit avec commission. Pour les artistes, l'activité d'agent artistique a ses propres règles [à vérifier] |

**Conséquence pratique :** ton activité est mixte (BIC + BNC). La micro-entreprise le permet, avec un **plafond commun de 83 600 €** pour les services.

---

## 4. Simulations chiffrées

### 4.1 Méthode et hypothèses
- **Cotisations, IS, IR** : moteur URSSAF `modele-social` 11.1.0, règles 2026 (taux micro, ACRE à 25 %, barème IR 2026, IS 15 %/25 %, cotisations TNS et assimilé salarié).
- **Personne seule, sans enfant, sans autre revenu imposable** [à confirmer]. Le RSA et la prime d'activité ne sont pas imposables.
- **Frais fixes** : 1 500 €/an (logiciels, assurance RC pro, téléphone/internet pro) [hypothèse].
- **Comptabilité** : micro 0 €, EI au réel 900 €/an, SASU 2 000 €/an + 180 € de banque [hypothèses, à remplacer par des devis].
- **Deux profils** : *léger* (aucune sous-traitance) et *production* (35 % du CA reversé à des prestataires ou en locations).
- **SASU** en deux variantes : tout en salaire de président, ou zéro salaire et tout en dividendes (PFU 2026 : 31,4 %).
- **Non inclus** : TVA (même règle pour tous les statuts, §5.4), CFE (exonérée l'année de création), amortissement du matériel (favorable au réel, non chiffrable sans valeurs), mutuelle et prévoyance facultatives.
- « **Disponible** » = CA − cotisations − impôts − frais, **avant aides CAF**.

### 4.2 Profil léger (tu vends ton temps) — BNC, régime de croisière (sans ACRE)
Revenu disponible **par mois** :

| CA / mois | CA / an | Micro | EI au réel | SASU salaire | SASU dividendes |
|---:|---:|---:|---:|---:|---:|
| 500 € | 6 000 € | **246 €** | 158 € | 76 € | 113 € |
| 1 000 € | 12 000 € | **617 €** | 559 € | 358 € | 404 € |
| 2 000 € | 24 000 € | **1 359 €** | 1 275 € | 922 € | 987 € |
| 3 000 € | 36 000 € | **2 014 €** | 1 865 € | 1 485 € | 1 570 € |
| 4 000 € | 48 000 € | **2 626 €** | 2 376 € | 1 964 € | 2 143 € |
| 5 000 € | 60 000 € | **3 170 €** | 2 834 € | 2 437 € | 2 658 € |

Avec peu de frais, **la micro gagne à tous les niveaux**. En BIC (photo artisanale), l'écart est plus grand encore : 2 206 €/mois à 3 000 € de CA, contre 2 014 € en BNC.

### 4.3 Profil production (35 % du CA reversé à une équipe) — BNC, sans ACRE

| CA / mois | CA / an | Micro | EI au réel | SASU salaire | SASU dividendes |
|---:|---:|---:|---:|---:|---:|
| 1 000 € | 12 000 € | 267 € | **285 €** | 160 € | 200 € |
| 2 000 € | 24 000 € | 659 € | **774 €** | 527 € | 579 € |
| 3 000 € | 36 000 € | 964 € | **1 239 €** | 893 € | 958 € |
| 5 000 € | 60 000 € | 1 420 € | **2 000 €** | 1 606 € | 1 716 € |

Dès qu'une partie du budget sert à payer d'autres personnes, **la micro devient le pire choix** : elle taxe un chiffre d'affaires qui ne t'appartient pas.

### 4.4 Point de bascule micro → EI au réel
Part du CA en charges réelles (frais fixes + sous-traitance) à partir de laquelle l'EI au réel laisse plus de revenu :

| CA / mois | Activité BNC | Activité BIC services |
|---:|---:|---:|
| 1 000 € | 37 % | 62 % |
| 1 500 € | 25 % | 39 % |
| 2 000 € | 21 % | 35 % |
| 3 000 € | 15 % | 31 % |
| 5 000 € | 15 % | 32 % |

Le seuil BNC est bas parce que le taux micro BNC est passé à **25,6 % en 2026** : il est désormais proche du coût du réel. Le tableau de bord surveille ce ratio et alerte (§9).

### 4.5 Première année avec ACRE (cotisations réduites de 25 %)
Micro BNC, profil léger : **681 €** au lieu de 617 € à 1 000 €/mois ; **1 487 €** au lieu de 1 359 € à 2 000 €/mois ; **2 206 €** au lieu de 2 014 € à 3 000 €/mois. L'ACRE ne change pas le classement des statuts.

---

## 5. RSA, prime d'activité, ACRE et autres aides

### 5.1 Comment la CAF compte tes revenus
- **Micro-entreprise** : déclaration **trimestrielle** du chiffre d'affaires encaissé, par nature d'activité. La CAF retient le CA **après abattement** : 34 % en BNC, 50 % en BIC services, 71 % en vente. Les sources divergent sur le chiffre à saisir (brut ou après abattement) : **le libellé du formulaire caf.fr fait foi**.
- **EI au réel** : la première année, tu es traité comme un micro-entrepreneur. Ensuite, la CAF se base sur le bénéfice annuel.
- **SASU** : le salaire compte comme un revenu d'activité. Des dividendes comptent comme revenus du capital, **sans prime d'activité**. La situation d'un dirigeant de société sans salaire mais allocataire du RSA doit être vérifiée avec ta CAF [à vérifier].

### 5.2 Ce que tu touches au total (micro, profil léger, estimation)
Barème au 01/04/2026 : RSA 651,69 €, forfait logement 78,20 € (s'il s'applique à toi), prime d'activité 638,28 € + 59,85 % des revenus pro + bonification.

| CA / mois | Nature | Disponible (activité) | RSA estimé | Prime d'activité estimée | **Total / mois** |
|---:|---|---:|---:|---:|---:|
| 0 € | — | 0 € | 573 € | 0 € | **573 €** |
| 500 € | BNC | 246 € | 243 € | 186 € | **675 €** |
| 1 000 € | BNC | 617 € | 0 € | 297 € | **914 €** |
| 1 000 € | BIC | 655 € | 73 € | 287 € | **1 016 €** |
| 2 000 € | BNC | 1 359 € | 0 € | 186 € | **1 545 €** |
| 3 000 € | BNC | 2 014 € | 0 € | 0 € | **2 014 €** |

À retenir :
1. **Les petits débuts rapportent peu de plus** : 500 € de CA par mois n'ajoutent qu'environ **100 €** au total, une fois les frais, les cotisations et la baisse du RSA déduits. Ce n'est pas une raison de ne pas créer, mais l'objectif réaliste est de dépasser rapidement **1 000 à 1 500 € de CA par mois**.
2. **La prime d'activité prend le relais du RSA** : elle reste versée jusqu'à environ 2 000–3 000 € de CA mensuel selon la nature d'activité.
3. **Profil production en micro** : la CAF compte 66 % du CA comme ton revenu, alors que 35 % est parti aux prestataires. À 2 000 €/mois, total **846 € en micro contre 1 041 € en EI au réel**. À 3 000 €/mois : **964 € contre 1 437 €**.
4. **Décalage** : la CAF raisonne par trimestre. Un gros encaissement fait baisser l'aide du trimestre suivant : il faut le **provisionner**.
5. Ces montants sont des **estimations** (formule CAF codée dans le simulateur). Le **simulateur officiel de la CAF** fait foi.

### 5.3 ACRE
- Allocataire du RSA = **éligible** (service-public.fr, vérifié le 01/07/2026).
- **25 % d'exonération** : cotisations micro à 75 % du taux normal.
- **Elle n'est plus automatique** : demande à l'URSSAF **dans les 60 jours** après le début d'activité, avec le justificatif de création et une attestation RSA. Pour un micro-entrepreneur, l'absence de réponse sous 30 jours vaut accord.
- Durée en micro : jusqu'à la **fin du 3e trimestre civil suivant le début d'activité**. Démarrer **en début de trimestre** (ex. 1er janvier ou 1er avril) donne environ 12 mois, contre 10 en démarrant en fin de trimestre.
- En EI au réel ou SASU : 12 mois, exonération pleine jusqu'à 36 045 € de revenu, dégressive jusqu'à 48 060 €.

### 5.4 Autres points financiers
- **ARCE** : non applicable sans allocations chômage (ARE).
- **Versement libératoire** : **déconseillé** tant que ton foyer n'est pas imposable : il ferait payer 2,2 % (BNC) ou 1,7 % (BIC) même quand l'impôt serait nul. Simulations : IR nul jusqu'à environ 2 000 € de CA mensuel en BNC et un peu moins de 3 000 € en BIC, grâce à l'abattement et à la décote.
- **Franchise de TVA** : 37 500 € de CA (seuil majoré 41 250 €) pour les services, **quel que soit le statut**. Une SASU ou une EI au réel peut aussi en bénéficier.
- **Prêts d'honneur, accompagnement** (Initiative France, France Active, BGE, dispositifs du département pour les allocataires du RSA) [à vérifier localement].
- **CAE (coopérative d'activité et d'emploi)** : une vraie alternative pour **tester sans créer**. Tu factures via la coopérative et tu es salarié de la CAE. Elle fournit l'accompagnement et la comptabilité, avec un statut lisible pour la CAF. Contrepartie : une contribution d'environ 10 % du CA ou de la marge [à vérifier selon la CAE]. Non chiffré ici.

---

## 6. Évolution vers une société

### 6.1 Quand reconsidérer le statut (déclencheurs suivis par ATLAS)
| Déclencheur | Action |
|---|---|
| Charges réelles > seuil de bascule (§4.4) pendant 2 trimestres | Simuler à nouveau ; passer en **EI au réel** (option, sans créer de nouvelle entreprise) |
| CA > 37 500 € (services) | Facturer la TVA. Revoir les prix pour les clients particuliers |
| CA proche de 83 600 € | Sortie obligatoire de la micro après 2 années de dépassement → réel ou société |
| Bénéfice > 50–60 k€/an stable, besoin de garder de la trésorerie dans l'entreprise | **EI à l'IS** ou **SASU/EURL** (IS 15 % jusqu'à 42 500 € de bénéfice) |
| Associé, investisseur ou levée de fonds (application) | **SAS** dédiée au projet numérique, pas forcément pour l'audiovisuel |
| Contrats à risque (grosses productions, responsabilité élevée) | Société + assurances. L'EI protège déjà le patrimoine personnel depuis 2022, sauf fautes de gestion graves |

### 6.2 Passage concret
1. **Micro → EI au réel** : simple option fiscale et sociale auprès des impôts et de l'URSSAF, même SIREN.
2. **EI → société** : création de la société, éventuel apport de l'activité et du matériel, cessation de l'EI. À faire avec un expert-comptable, idéalement au 1er janvier.

---

## 7. Obligations légales et activités sensibles

### Obligations dès la création (micro)
- Immatriculation sur le **guichet unique** (formalites.entreprises.gouv.fr), qui transmet au répertoire des métiers / registre national des entreprises.
- **Livre des recettes** chronologique (intégré au tableau de bord). Factures avec mentions obligatoires : « EI » + nom, SIREN, date, numérotation continue, « TVA non applicable, art. 293 B du CGI » tant que tu es en franchise.
- **Déclaration du CA à l'URSSAF** chaque mois ou trimestre, **même à 0 €**.
- **Compte bancaire dédié** obligatoire si le CA dépasse 10 000 € deux années de suite. Recommandé dès le départ pour la séparation exigée par ATLAS.
- **Facturation électronique** : **réception** obligatoire pour toutes les entreprises depuis le **01/09/2026** (donc dès ta création) ; **émission** au **01/09/2027** pour les micro-entreprises. Il faudra choisir une **plateforme agréée** [calendrier issu de sources secondaires, à confirmer sur impots.gouv.fr].
- **CFE** : exonérée l'année de création, puis due (exonération de la cotisation minimale sous 5 000 € de CA [à vérifier]).
- **Déclaration trimestrielle CAF** : continuer, en ajoutant le CA par nature.

### Activités qui demandent une attention particulière
| Sujet | Risque | Ce qu'il faut faire |
|---|---|---|
| **Drone** | Prise de vue pour un client = activité encadrée (enregistrement exploitant sur AlphaTango, formation télépilote, catégorie ouverte ou spécifique) | Vérifier tes certificats **avant** toute vente de plans drone. Assurance spécifique |
| **Organisation d'événements** | Licence / récépissé d'entrepreneur de spectacles au-delà de 6 représentations par an | Déclaration via la plateforme du ministère de la Culture si tu passes ce seuil |
| **Cadreur / monteur pour une boîte de prod** | Présomption de salariat ou requalification | Si tu es intégré à une équipe sous ordres, demander un **CDDU** (intermittent) plutôt que facturer |
| **Réalisation de clips et photo d'auteur** | Les droits d'auteur ne passent pas par la micro | Contrats séparant prestation technique et cession de droits. Affiliation artiste-auteur si besoin |
| **Droit à l'image, RGPD** | Photos et vidéos de personnes, fichiers clients | Autorisations écrites, mentions RGPD, durée de conservation |
| **LA VAR** | Conflit d'intérêts : ton entreprise facturant l'association que tu diriges | Jamais sans décision du bureau prise sans toi, au prix du marché, documentée. Impact possible sur le caractère désintéressé de l'association [à vérifier avec un conseil]. **Comptes et budgets totalement séparés** |
| **Mise en relation / promotion d'artistes** | Activité d'agent artistique, commissions | Contrat écrit ; vérifier les règles applicables avant de toucher des commissions sur des cachets |

---

## 8. Recommandation argumentée

1. **Statut de départ : micro-entreprise**, activité mixte. Photographie de commande en BIC artisanal si la CMA le confirme ; audiovisuel, contenu et dev en BNC.
   - Elle maximise ton revenu disponible **tant que tes charges restent sous ≈ 15–25 % du CA en BNC** (≈ 31 % en BIC).
   - Elle est compatible avec le RSA puis la prime d'activité, avec une déclaration trimestrielle simple.
   - Pas de comptable obligatoire : le tableau de bord ATLAS suffit au début.
2. **Condition** : les clips avec équipe sont montés en **facturation directe** (chaque prestataire facture l'artiste ou le label), ou avec un budget technique payé à part. Sinon, l'**EI au réel** est meilleure dès le départ (§4.3) : ne pas créer en micro par réflexe.
3. **Pas de SASU maintenant** : elle coûte 1 500 à 2 200 €/an de plus en frais et laisse 20 à 40 % de revenu en moins à ces niveaux de CA. À rouvrir pour le projet d'application avec associés, ou au-delà de 50–60 k€ de bénéfice.
4. **ACRE à demander** dans les 60 jours, création **en début de trimestre**.
5. **Pas de versement libératoire** tant que tu n'es pas imposable.
6. **Alternative à étudier avant de signer** : 3 à 6 mois en CAE pour tester les prix et le volume sans créer.

**Niveau de confiance** : élevé sur les cotisations et les impôts (moteur URSSAF), moyen sur les aides CAF (formule codée, à confirmer par le simulateur CAF), faible sur le CA (aucune donnée réelle).

---

## 9. Plan d'action progressif

Aucune de ces étapes n'est réalisée par ATLAS sans ton accord. Les démarches officielles sont faites **par toi**.

| Étape | Quoi | Qui | Validation requise |
|---|---|---|---|
| 1. Données (semaine 1) | Remplir les 10 informations manquantes (§2), en commençant par la part de sous-traitance et les prix | Toi + ATLAS | — |
| 2. Re-simulation | Relancer `simulate.mjs` avec tes vrais chiffres | ATLAS | — |
| 3. Vérifications officielles | Simulateur CAF ; rendez-vous avec ton référent RSA / conseiller France Travail pour déclarer le projet de création ; CMA pour la qualification de l'activité photo | Toi | — |
| 4. Expert | Un rendez-vous avec un expert-comptable (souvent gratuit en premier contact, ou via BGE / CCI / CMA) avec les questions du §10 | Toi | — |
| 5. Décision | Choix du statut, de la date de début (début de trimestre) et de l'organisation des clips | **Toi** | **Oui** |
| 6. Préparation | ATLAS prépare le dossier : activités, codes, pièces, modèle de facture, mentions, demande d'ACRE pré-remplie | ATLAS | Relecture |
| 7. Création | Immatriculation sur le guichet unique | **Toi** | **Oui** |
| 8. Dans les 60 jours | Demande d'ACRE ; compte dédié ; plateforme de facturation électronique (réception) ; déclaration du changement de situation à la CAF ; assurance RC pro | **Toi** | **Oui** |
| 9. Pilotage | Tableau de bord : recettes, factures, dépenses, provisions, déclarations URSSAF et CAF préparées | ATLAS | Chaque déclaration |
| 10. Revue trimestrielle | Point de bascule, seuils TVA et plafond, re-simulation | ATLAS | — |

---

## 10. Questions à poser (expert-comptable, CAF, CMA)

1. Photographie de commande : artisanale (CMA, BIC) ou libérale (BNC) pour mon cas ? Quelle activité déclarer comme principale ?
2. Réalisation de clips : comment séparer la prestation technique et la rémunération d'auteur ? Faut-il une affiliation artiste-auteur en parallèle ?
3. Pour un clip avec équipe : facturation directe des prestataires par le client, ou EI au réel ?
4. CAF : pour la déclaration trimestrielle, je saisis le CA brut ou net ? Comment sont traités les mois sans encaissement ?
5. CAF : effet sur le RSA du statut de dirigeant de société sans rémunération (si SASU un jour) ?
6. Mon rôle dans LA VAR est-il compatible avec des prestations facturées par mon entreprise à l'association ?
7. Matériel déjà possédé : peut-il être apporté et amorti si je passe au réel ?
8. CFE de ma commune et exonérations applicables ?

---

## 11. Sources (consultées le 11/11/2026)

**Officielles**
- [Service-public — régime micro-social, taux 2026 (F36232)](https://entreprendre.service-public.gouv.fr/vosdroits/F36232) — vérifié le 01/01/2026
- [Service-public — plafonds micro, versement libératoire (F23267)](https://entreprendre.service-public.gouv.fr/vosdroits/F23267) — vérifié le 13/05/2026
- [Service-public — ACRE (F11677)](https://entreprendre.service-public.gouv.fr/vosdroits/F11677) — vérifié le 01/07/2026
- [Service-public — franchise en base de TVA (F21746)](https://entreprendre.service-public.gouv.fr/vosdroits/F21746) — vérifié le 01/01/2026
- [Service-public — artiste et micro-entreprise (F22428)](https://entreprendre.service-public.gouv.fr/vosdroits/F22428)
- [URSSAF — moteur `modele-social` 11.1.0 (mon-entreprise.urssaf.fr)](https://mon-entreprise.urssaf.fr/d%C3%A9veloppeur/biblioth%C3%A8que-de-calcul), publié en juillet 2026
- [economie.gouv.fr — prime d'activité](https://www.economie.gouv.fr/particuliers/vie-en-entreprise/prime-dactivite-pouvez-vous-en-beneficier)
- [CAF — travailleur indépendant](https://www.caf.fr/allocataires/caf-de-loire-atlantique/offre-de-service/vie-professionnelle/travailleur-independant/travailleur-independant-demarches-caf)
- [Ministère de la Culture — plateforme des entrepreneurs de spectacles](https://www.culture.gouv.fr/thematiques/theatre-spectacles/pour-les-professionnels/plateforme-des-entrepreneurs-de-spectacles-vivants-platesv)
- [DGAC — exploitation en catégorie spécifique](https://www.ecologie.gouv.fr/politiques-publiques/exploitation-drones-categorie-specifique)

**Secondaires (à reconfirmer sur source officielle avant usage décisionnel)**
- RSA 651,69 € et forfait logement 78,20 € au 01/04/2026 : [Wizbii](https://money.wizbii.com/advices/rsa-revalorise-1er-avril-2026), [Weblex](https://www.weblex.fr/weblex-actualite/prestation-sociales-revalorisation-au-1er-avril-2026)
- Prime d'activité 638,28 €, 59,85 %, bonification : [Previssima](https://www.previssima.fr/actualite/prime-dactivite-quels-sont-les-nouveaux-montants-au-1er-avril-2026.html)
- PFU 31,4 % : [Actu-Juridique](https://www.actu-juridique.fr/fiscalite/fiscal-finances/la-csg-en-hausse-sur-les-revenus-du-capital/)
- Barème IR 2026 : [Service-public — actualité A18045](https://www.service-public.gouv.fr/particuliers/actualites/A18045)
- Facturation électronique : [Keobiz](https://www.keobiz.fr/le-mag/facturation-electronique-calendrier-2026-2027/), [Cegid](https://www.cegid.com/fr/facture-electronique-obligatoire/calendrier-facture-electronique/)
- Photographe artisan / auteur : [Keobiz](https://www.keobiz.fr/le-mag/auteur-photographe-statut/)
- Entrepreneur de spectacles : [Bpifrance Création](https://bpifrance-creation.fr/activites-reglementees/entrepreneur-spectacles)
- Drone : [Bpifrance Création](https://bpifrance-creation.fr/activites-reglementees/pilote-drone-aeronef)
