# 06 — Conformité juridique, confidentialité et sécurité

> **Statut du document** : note de travail technique, **pas un avis juridique**. Elle liste des **obligations potentielles**, les **mesures** envisagées sur le site et les **points à faire valider** par un avocat et/ou un expert-comptable. Le site n'est **pas** présenté comme « conforme ».
>
> **Date de vérification des sources : 9 octobre 2026.** Les sources ont été consultées en ligne ce jour (Légifrance, CNIL, Service-Public Entreprendre, economie.gouv.fr / DGCCRF, impots.gouv.fr, Commission européenne, Stripe, PayPal, Mollie, Matomo). Ce qui n'a pas pu être lu directement est marqué **« non vérifié »**.
>
> **Hypothèses** : Sébastien Fula-Pitu, personne physique en France, activité de réalisateur / photographe / monteur. **Statut juridique inconnu** (probablement entrepreneur individuel, éventuellement micro-entrepreneur — **à confirmer**). Clientèle surtout professionnelle (B2B : artistes, managers, labels, marques), avec une part possible de consommateurs (B2C).

---

## Sommaire

0. [Synthèse : les mesures à implémenter dans le code](#0-synthèse--mesures-prioritaires-à-implémenter-dans-le-code)
1. [RGPD](#1-rgpd)
2. [Cookies et traceurs (CNIL)](#2-cookies-et-traceurs-cnil)
3. [Loi Informatique et Libertés, article 82](#3-loi-informatique-et-libertés--article-82)
4. [Mentions légales (LCEN)](#4-mentions-légales-lcen)
5. [Politique de confidentialité et politique cookies](#5-politique-de-confidentialité-et-politique-cookies)
6. [CGV et conditions de réservation](#6-cgv-et-conditions-de-réservation-prestations-de-services)
7. [Droit de la consommation](#7-droit-de-la-consommation-b2c-et-différences-b2b)
8. [Propriété intellectuelle, droit à l'image, musique](#8-propriété-intellectuelle-droit-à-limage-droit-dauteur-licences-musicales)
9. [Sécurité des formulaires, anti-spam, violations de données](#9-sécurité-des-formulaires-anti-spam-violations-de-données)
10. [Accessibilité](#10-accessibilité-rgaa--acte-européen-sur-laccessibilité)
11. [Prospection et newsletter](#11-prospection-et-newsletter)
12. [Fiscalité et facturation](#12-fiscalité-et-facturation)
13. [Spécification du gestionnaire de consentement (CMP)](#13-spécification-du-gestionnaire-de-consentement-cmp)
14. [Questions à poser à l'avocat et à l'expert-comptable](#14-questions-à-poser-à-lavocat-et-à-lexpert-comptable)
15. [Liste des sources consultées](#15-liste-des-sources-consultées)

Le comparatif des moyens de paiement et des outils d'analytics se trouve dans `05-paiement-analytics-comparatif.md`.

---

## 0. Synthèse : mesures prioritaires à implémenter dans le code

| # | Mesure | Fondement principal |
|---|--------|---------------------|
| 1 | **Aucun traceur non exempté avant consentement** : bandeau avec « Tout accepter » / « Tout refuser » / « Personnaliser » au même niveau et même aspect ; scripts tiers (YouTube/Vimeo, réseaux sociaux, pixels, GA4) bloqués par défaut ; vidéos tierces derrière une façade « clic pour charger ». | Art. 82 loi I&L ; FAQ CNIL (29/04/2026) |
| 2 | **Mesure d'audience first-party configurée « exemptée »** : uniquement 3 types d'événements (page vue, clic sur une fonctionnalité, temps de chargement/défilement/temps passé), IP tronquée (au moins le dernier octet), pas d'UTM ni d'identifiant de campagne, référent limité au domaine, pas de session replay, stats affichées agrégées (arrondi à la dizaine), cookie ≤ 13 mois non prorogé, données ≤ 25 mois, lien d'opposition dans la politique de confidentialité. | Page CNIL « solutions pour les outils de mesure d'audience » (04/07/2025) + outil d'auto-évaluation (juillet 2025) |
| 3 | **Journal de preuve du consentement** côté serveur (horodatage, version de la politique, choix par finalité, identifiant pseudonyme) + choix conservé 6 mois puis nouvelle demande + lien « Gérer mes cookies » permanent dans le pied de page. | FAQ CNIL ; RGPD art. 7.1 |
| 4 | **Formulaire de devis minimisé et sécurisé** : champs strictement nécessaires (téléphone facultatif), mention d'information sous le formulaire, case opt-in **non pré-cochée** et **séparée** pour la newsletter, honeypot + limitation du débit + CAPTCHA respectueux (exempt si sa seule finalité est la sécurité), validation côté serveur, HTTPS/HSTS, en-têtes de sécurité, purge automatique des devis selon la durée de conservation. | RGPD art. 5, 13, 25, 32 ; CNIL prospection (10/06/2026) |
| 5 | **Paiement par page hébergée** (Stripe Checkout / Payment Links) : aucune donnée de carte ne transite par le site ; webhooks vérifiés par signature (`Stripe-Signature`) ; CSP autorisant uniquement les domaines Stripe nécessaires. | Guide sécurité Stripe |
| 6 | **Parcours de commande B2C** : informations précontractuelles avant paiement (prix TTC ou mention 293 B, caractéristiques, délais, rétractation, médiateur), **case de demande expresse d'exécution anticipée + reconnaissance de perte du droit de rétractation**, **fonctionnalité de rétractation en ligne** (« Renoncer au contrat ici » → « Confirmer la rétractation » → accusé de réception sur support durable), en vigueur depuis le **19 juin 2026**. | C. conso. L221-5, L221-25, L221-28, **L221-21 (version du 19/06/2026)** |
| 7 | **Pages légales accessibles depuis toutes les pages** : Mentions légales (LCEN art. 1-1), Politique de confidentialité, Politique cookies, CGV/conditions de réservation, Médiation, Crédits/droits ; tableau de bord admin protégé (authentification forte, pas d'indexation, journalisation des accès). | LCEN art. 1-1 ; C. conso. L612-1 |
| 8 | **Registre des droits d'image et des autorisations** pour chaque clip, photo et extrait musical affiché ; possibilité de retirer rapidement un contenu (champ `rights_status` / `takedown`). | C. civ. art. 9 ; CPI L122-4, L213-1 |

---

## 1. RGPD

**Sources (vérifiées le 09/10/2026)**
- Loi n° 78-17, art. 4 (principes : licéité, finalité, minimisation, exactitude, limitation de la conservation, sécurité), version en vigueur depuis le 01/06/2019 ; données Légifrance mises à jour le 01/10/2026 : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037822953
- CNIL, « Adéquation des États-Unis : les premières questions-réponses » : https://www.cnil.fr/fr/adequation-des-etats-unis-les-premieres-questions-reponses
- CNIL, « Transferts de données vers les États-Unis : la Commission européenne adopte une nouvelle décision d'adéquation » (10/07/2023) : https://www.cnil.fr/fr/transferts-de-donnees-vers-les-etats-unis-la-commission-europeenne-adopte-une-nouvelle-decision
- Commission européenne, page « Adequacy decisions » (liste incluant les États-Unis pour les organisations participant au DPF ; dernière actualité affichée : 23/07/2026) : https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en
- Décision d'exécution (UE) 2023/1795 : https://eur-lex.europa.eu/eli/dec_impl/2023/1795/oj (lien relevé sur la page de la Commission, texte non relu intégralement)

**Obligations potentielles**
- Sébastien est **responsable de traitement** pour : les demandes de devis, la gestion des clients/commandes/factures, la mesure d'audience, la newsletter éventuelle, l'administration du site.
- **Bases légales envisagées** (à valider) :

| Traitement | Base légale envisagée | Données | Durée de conservation proposée (à valider) |
|---|---|---|---|
| Demande de devis | Mesures précontractuelles à la demande de la personne (art. 6.1.b) | nom, email, téléphone (facultatif), description du projet, fourchette de budget | 3 ans après le dernier contact si pas de suite (référence usuelle CNIL pour les prospects — **non revérifiée dans ce document**), sinon bascule en « client » |
| Exécution de la prestation, paiement | Contrat (6.1.b) | identité, coordonnées, commande, statut de paiement (pas de numéro de carte) | durée de la relation + prescription ; pièces comptables 10 ans (**à confirmer par l'expert-comptable**) |
| Facturation / comptabilité | Obligation légale (6.1.c) | mentions de facture | selon obligations comptables/fiscales (**à confirmer**) |
| Mesure d'audience exemptée | Intérêt légitime (6.1.f) + exemption art. 82 | identifiant pseudonyme first-party, page, événement, IP tronquée | cookie ≤ 13 mois, données ≤ 25 mois (recommandation CNIL) |
| Analytics non exemptés / marketing | Consentement (6.1.a) | selon outil | selon outil, choix conservé 6 mois |
| Newsletter B2C | Consentement | email | jusqu'au désabonnement (+ liste repoussoir) |
| Prospection B2B | Intérêt légitime + droit d'opposition | email pro | 3 ans après le dernier contact (**à valider**) |
| Journal de consentement | Obligation de preuve (art. 7.1) / intérêt légitime | id pseudonyme, choix, horodatage, version | durée de validité du choix + délai de preuve raisonnable (**à valider**, proposition : 13 mois) |
| Sécurité / logs | Intérêt légitime | IP, user-agent, horodatage | courte (proposition : 6 à 12 mois, **à valider**) |

- **Droits des personnes** (accès, rectification, effacement, limitation, opposition, portabilité, directives post-mortem, réclamation CNIL) : réponse sous **un mois** (rappelé par la CNIL sur sa page prospection du 10/06/2026).
- **Sous-traitants** (art. 28 RGPD) : hébergeur (Vercel ?), base de données (Supabase ?), service d'email transactionnel, prestataire de paiement, outil d'analytics hébergé. Un contrat de sous-traitance (DPA) doit exister avec chacun.
  - Point d'attention : **Stripe et PayPal** sont en partie **responsables de traitement autonomes** (lutte contre la fraude, obligations LCB-FT) — à décrire comme destinataires dans la politique de confidentialité.
- **Transferts hors UE** : un hébergeur ou un prestataire américain (ex. Vercel, Stripe Inc.) implique un transfert ou un accès potentiel depuis les États-Unis. Selon la CNIL, les transferts vers les organismes **certifiés DPF** « peuvent s'effectuer librement » ; « avant de procéder au transfert, les organismes doivent s'assurer que l'organisme destinataire figure sur cette liste » (dataprivacyframework.gov) et vérifier que **l'entité et les catégories de données** sont couvertes. À défaut : clauses contractuelles types (art. 46).
  - **Non vérifié** : présence actuelle de Vercel Inc., Stripe Inc., Supabase, Resend, etc. sur la liste DPF (le site dataprivacyframework.gov n'a pas été consulté). **Non vérifié** : état d'un éventuel pourvoi devant la CJUE contre la décision DPF (contentieux « Latombe »). La page de la Commission consultée le 09/10/2026 liste toujours les États-Unis parmi les pays adéquats.
- **AIPD** : a priori non obligatoire pour ce périmètre (pas de traitement à grande échelle ni de données sensibles) — **à confirmer**.
- **Registre des traitements** : à tenir (même simplifié) ; c'est aussi la base de la politique de confidentialité.

**Mesures techniques / documentaires sur le site**
- Minimisation du formulaire de devis : `name`, `email`, `phone?`, `project_type`, `message`, `budget_range` (fourchettes, pas de montant libre), `deadline?`. Pas de date de naissance, pas d'adresse postale au stade du devis.
- Texte d'information court sous le formulaire + lien vers la politique.
- Tâche planifiée de **purge** (cron) : suppression/anonymisation des devis expirés, des événements analytics > 25 mois, des logs > durée retenue.
- Région d'hébergement **UE** pour la base de données et les fonctions serveur lorsque c'est possible (ex. région `fra1`/`cdg1` côté Vercel, région UE côté Supabase — **à vérifier dans les offres**).
- Endpoint ou procédure documentée d'exercice des droits (adresse email dédiée), export JSON des données d'une personne depuis l'admin.
- Chiffrement en transit (TLS ≥ 1.2), secrets en variables d'environnement, principe du moindre privilège sur la base (RLS si Supabase).

**À valider par un avocat**
- Bases légales et durées définitives ; rédaction de la politique ; qualification de Stripe/PayPal (responsables autonomes vs sous-traitants) ; encadrement des transferts (DPF vs CCT) pour chaque prestataire réellement retenu.

---

## 2. Cookies et traceurs (CNIL)

**Sources (vérifiées le 09/10/2026)**
- CNIL, « Questions-réponses sur les lignes directrices modificatives et la recommandation "cookies et autres traceurs" », **mise à jour du 29 avril 2026** : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ
- CNIL, « Cookies : solutions pour les outils de mesure d'audience », **04 juillet 2025** : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience
- CNIL, « Outil d'auto-évaluation relatif à la mise en œuvre d'une solution de mesure d'audience exemptée de consentement », **juillet 2025** (PDF) : https://www.cnil.fr/sites/default/files/2025-07/outil_d_auto-evaluation_mesure_d_audience.pdf
- Lignes directrices modificatives et recommandation (2020) : page de présentation référencée par la CNIL : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/lignes-directrices-modificatives-et-recommandation (**texte intégral de la délibération non relu dans ce document**)

**Ce que dit la CNIL (extraits relevés)**
- **Refus aussi simple que l'acceptation** : « l'intégration, au stade du premier niveau d'information de l'internaute, d'un bouton « tout refuser », au même niveau et avec le même aspect que le bouton « tout accepter », constitue un moyen clair et simple pour permettre à l'utilisateur d'exprimer ses choix. »
- **Durée de conservation du choix** : « Généralement, une conservation des choix pendant une durée de 6 mois constitue une bonne pratique. »
- **Retrait** : « Le principe général est qu'il doit être aussi simple de retirer son consentement que de le donner », par exemple via « un lien accessible à tout moment […] « gérer mes cookies » » ou une icône « cookie » sur toutes les pages.
- **Preuve** : la recommandation « vient proposer des modalités pratiques par lesquelles les responsables […] peuvent apporter la preuve du consentement ».
- **Cookie wall** : appréciation au cas par cas — **à éviter** sur ce site.
- **Traceurs pouvant être exemptés** (liste non exhaustive de la FAQ) : mesure d'audience sous conditions, sécurisation de l'authentification / lutte contre la fraude, CAPTCHA « lorsqu'ils ont pour seule finalité la sécurisation du site ou d'un mécanisme d'authentification au bénéfice des utilisateurs », etc. Les traceurs strictement nécessaires (session d'admin, panier/checkout, mémorisation du choix de consentement) relèvent de l'exemption de l'art. 82.

### 2.1 Conditions exactes de l'exemption « mesure d'audience » (page CNIL du 04/07/2025)

**Les traceurs doivent :**
1. « être utilisés pour une finalité strictement limitée à la seule mesure de l'audience du site ou de l'application (mesure des performances, détection de problèmes de navigation, optimisation des performances techniques ou de son ergonomie, estimation de la puissance des serveurs nécessaires, analyse des contenus consultés), pour le compte exclusif de l'éditeur » ;
2. « servir à produire des données statistiques anonymes uniquement ».

**Les traceurs ne doivent pas :**
3. « conduire à un recoupement des données avec d'autres traitements ou à ce que les données non anonymes soient transmises à des tiers » ;
4. « permettre le suivi global de la navigation de la personne utilisant différentes applications ou naviguant sur différents sites web. Toute solution utilisant un même identifiant à travers plusieurs sites […] pour croiser, dédoublonner ou mesurer un taux de couverture (« reach ») unifié d'un contenu est exclue. »

**Recommandations CNIL complémentaires :**
- informer les utilisateurs (ex. politique de confidentialité) ;
- **durée de vie des traceurs limitée**, « comme c'est le cas d'une durée de treize mois », **non prorogée automatiquement** lors des nouvelles visites ;
- informations collectées conservées **25 mois maximum** ;
- **réexamen périodique** de ces durées.
- En pratique : les offres dont le fournisseur **réutilise les données pour son propre compte** sont hors exemption (sauf désactivation possible) ; attention aux **transferts hors UE**.

### 2.2 Critères détaillés de l'outil d'auto-évaluation (juillet 2025) — à reprendre dans notre implémentation first-party

- **Finalités autorisées uniquement** : performances, problèmes de navigation, ergonomie, dimensionnement serveurs, contenus consultés. **Désactivées** : toute mesure marketing (performance des canaux de conversion, campagnes, canaux d'acquisition, fraude publicitaire) et toute **cohorte** pour présenter des contenus différenciés (donc **pas d'A/B test** sous exemption).
- **Au plus trois types d'événements** : (a) présence sur une page + infos de la page ; (b) utilisation d'une fonctionnalité (clic bouton, clic lien) + infos associées (destination, label) ; (c) temps de chargement, défilement, temps passé.
- En-têtes HTTP minimisés (version **majeure** du navigateur/OS).
- **Aucun import de données externes** : pas d'identifiant client/CRM, **pas d'UTM ni d'identifiant de campagne**, référent limité au **domaine** ; aucune intégration avec des outils tiers.
- Identifiant : cookie **first-party** ; **IP** utilisée au plus pour une localisation à l'échelle de la ville puis pseudonymisée en **retirant au moins le dernier octet** ; empreinte éventuelle salée avec le domaine et une composante temporelle.
- **Aucun marquage permettant de récupérer des informations personnelles (ex. formulaires)**.
- **Pas de session replay** ; pas de suivi de la navigation d'un utilisateur unique.
- Rapports **anonymes** quels que soient les filtres : « Agrégation et présentation à la dizaine la plus proche » (sinon analyse d'anonymat justifiée).
- **Opposition** : bouton/lien dans la politique de confidentialité ; refus mémorisé dans la durée (cookie d'opposition ou liste repoussoir).
- Si un prestataire est utilisé : DPA art. 28, pas de mise en commun entre clients, aucune réutilisation pour son propre compte, point de contact.

**Conséquences pour nos événements** (analyse interne, **à valider**) :

| Événement prévu | Sous exemption ? | Commentaire |
|---|---|---|
| `page_view` | Oui | type (a) |
| `artist_bubble_click` | Oui | type (b), label = slug artiste |
| `cta_click` | Oui | type (b) |
| `video_play` | Oui (probable) | clic sur le bouton lecture = type (b) |
| `video_progress` / `video_complete` (25/50/75/100 %) | **Zone grise** | se rapproche du « temps passé » (c) ; à valider ; proposer de le placer en catégorie « mesure d'audience avancée » soumise au consentement par prudence |
| `quote_submit` | Oui **uniquement** comme compteur sans contenu | jamais le contenu du formulaire ; le décompte réel des devis vient de la base métier |
| `checkout_started` / `checkout_completed` | **Plutôt non** comme « mesure de conversion » | à mesurer **côté serveur à partir des données métier** (sessions Stripe, webhooks), base contractuelle, sans traceur |
| Source d'acquisition (UTM, campagne) | **Non** | uniquement après consentement |
| Heatmaps, session replay, A/B tests | **Non** | uniquement après consentement, ou pas du tout |

**Mesures sur le site** : voir §13 (CMP) et le comparatif analytics (doc 05).

**À valider par un avocat** : classement des événements vidéo et checkout ; formulation de la politique cookies ; durée du journal de preuve.

---

## 3. Loi Informatique et Libertés — article 82

**Source (vérifiée le 09/10/2026)** : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037813978 (version entrée en vigueur au 01/06/2019, toujours affichée comme en vigueur).

**Texte (extrait)** : l'utilisateur doit être informé « 1° De la finalité de toute action tendant à accéder […] à des informations déjà stockées dans son équipement terminal […] ou à inscrire des informations dans cet équipement ; 2° Des moyens dont il dispose pour s'y opposer. » Ces accès « ne peuvent avoir lieu qu'à condition que l'abonné ou la personne utilisatrice ait exprimé, après avoir reçu cette information, son consentement ». Exceptions : accès ou inscription qui « 1° Soit, a pour finalité exclusive de permettre ou faciliter la communication par voie électronique ; 2° Soit, est strictement nécessaire à la fourniture d'un service de communication en ligne à la demande expresse de l'utilisateur. »

**Obligation potentielle** : s'applique à **tout** accès au terminal (cookies, `localStorage`, `sessionStorage`, IndexedDB, pixels, empreinte), pas seulement aux cookies.

**Mesures** : inventaire des traceurs dans le code (`docs/` + test e2e vérifiant qu'aucune requête vers un domaine tiers ni écriture de stockage non exempté n'a lieu avant consentement) ; les embeds YouTube/Vimeo/Instagram passent par une façade (miniature locale + bouton « Charger la vidéo (dépôt de cookies par X) ») ou par un hébergement vidéo propre.

**À valider** : statut des vidéos auto-hébergées vs plateformes (les vidéos servies depuis notre domaine ne déposent pas de traceur tiers).

---

## 4. Mentions légales (LCEN)

**Sources (vérifiées le 09/10/2026)**
- **LCEN, art. 1-1**, créé par la loi n° 2024-449 du 21 mai 2024 (SREN), art. 48, **en vigueur depuis le 23/05/2024** : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614
  - ⚠️ **Changement récent** : les obligations d'identification de l'éditeur, historiquement citées comme « LCEN art. 6-III », figurent désormais à **l'art. 1-1**. Beaucoup de modèles en ligne sont obsolètes.
- Service-Public Entreprendre, F31228 « Mentions obligatoires sur le site internet d'un entrepreneur individuel » — **vérifié le 31/07/2023** par la DILA (fiche ancienne, antérieure à la loi SREN ; à recouper) : https://entreprendre.service-public.gouv.fr/vosdroits/F31228

**Texte LCEN art. 1-1, I (extraits)** : l'éditeur met à disposition du public, dans un standard ouvert :
- « 1° S'il s'agit de personnes physiques, leurs nom, prénoms, domicile et numéro de téléphone et, si elles sont assujetties aux formalités d'inscription au registre du commerce et des sociétés ou au registre national des entreprises en tant qu'entreprise du secteur des métiers et de l'artisanat, le numéro de leur inscription » ;
- « 3° Le nom du directeur ou du codirecteur de la publication » ;
- « 4° Le nom, la dénomination ou la raison sociale, l'adresse et le numéro de téléphone du fournisseur de services d'hébergement » ;
- « 5° Le cas échéant, […] les personnes […] qui assurent, même à titre gratuit, le stockage de données traitées directement par elles dans le cadre de l'édition du service. »
- Le II (anonymat) ne vaut que pour une édition **à titre non professionnel** — **non applicable** ici (site commercial).

**Contenu proposé de la page « Mentions légales »** (selon le statut réel) :
- Nom, prénom de Sébastien Fula-Pitu + **« Entrepreneur individuel » ou « EI »** (Service-Public F31228) ;
- adresse (« domicile » selon l'art. 1-1 ; possibilité d'adresse de domiciliation — **à valider par l'avocat**, le texte vise le domicile pour une personne physique) ;
- téléphone et email ;
- **SIREN/SIRET** ; numéro d'inscription au RNE si assujetti (une activité de vidéaste/photographe n'est pas forcément artisanale — **à vérifier**) ;
- numéro de TVA intracommunautaire s'il existe, sinon mention de la franchise ;
- directeur de la publication : Sébastien Fula-Pitu ;
- **hébergeur** : dénomination, adresse, téléphone (ex. Vercel Inc. — **coordonnées à relever sur le site de l'hébergeur au moment de la mise en ligne**) ; idem pour le stockage (Supabase, stockage vidéo) au titre du 5° ;
- médiateur de la consommation (§7) ; crédits (photos/vidéos, artistes).
- Pour un site marchand, la LCEN **art. 19** (cité par la fiche F31228) impose aussi des informations d'identification aux personnes qui exercent le commerce électronique — **texte de l'art. 19 non relu**, à vérifier.

**Sanction relevée (F31228)** : manquement aux obligations d'information des mentions légales : jusqu'à **1 an d'emprisonnement et 75 000 € d'amende** (personne physique) — chiffre issu de la fiche de 2023, **à reconfirmer** au regard de la loi SREN.

**Mesures** : page `/mentions-legales` liée depuis le pied de page de toutes les pages ; contenu piloté par un fichier de configuration unique (`content/legal.ts`) pour éviter les incohérences entre pages ; champs vides bloquant la mise en production (test).

**À valider** : statut exact (EI/micro), mention du domicile vs domiciliation, nécessité d'un numéro RNE/RCS, coordonnées hébergeur(s).

---

## 5. Politique de confidentialité et politique cookies

**Sources** : RGPD art. 13 (non relu sur EUR-Lex dans ce document — **non vérifié mot à mot**) ; liste des informations obligatoires rappelée par Service-Public F31228 (vérifié 2023) : identité et coordonnées du responsable, finalité, base légale, caractère obligatoire ou facultatif, destinataires, durée de conservation, droits, droit de réclamation auprès de la CNIL, transferts hors UE ; pages CNIL citées au §2.

**Contenu minimal proposé — Politique de confidentialité**
1. Responsable de traitement et contact (email dédié).
2. Tableau des traitements (repris du §1) : finalité, base légale, données, caractère obligatoire, destinataires, durée.
3. Destinataires et sous-traitants par nom (hébergeur, base de données, email transactionnel, paiement, analytics) + pays + garantie de transfert (DPF / CCT).
4. Droits et modalités d'exercice ; réclamation CNIL.
5. **Mesure d'audience exemptée** : description, durée du cookie (≤ 13 mois), durée de conservation (≤ 25 mois), **bouton d'opposition** (exigé par l'outil d'auto-évaluation CNIL).
6. Sécurité (grandes lignes).
7. Date de dernière mise à jour et **numéro de version** (réutilisé dans le journal de consentement).

**Politique cookies** : tableau des traceurs (nom, émetteur, finalité, catégorie, durée), lien « Gérer mes cookies » qui rouvre le panneau.

**Mesures** : pages statiques versionnées (`policyVersion` en config) ; changement de version → nouvelle demande de consentement pour les catégories concernées.

**À valider par un avocat** : rédaction finale.

---

## 6. CGV et conditions de réservation (prestations de services)

**Sources (vérifiées le 09/10/2026)** : Service-Public F31228 (2023) ; C. conso. L221-5, L221-21, L221-25, L221-28 (§7) ; Service-Public F23208 « Tout savoir sur la facturation », **vérifié le 07/08/2026** : https://entreprendre.service-public.gouv.fr/vosdroits/F23208

**Obligations potentielles**
- **B2C** : selon F31228, les CGV « doivent figurer obligatoirement sur votre site » avec notamment : caractéristiques essentielles, **prix TTC**, modalités d'exécution, modalités de paiement, **droit de rétractation**, garanties légales (pour les services : conformité des contenus/services numériques le cas échéant — **à vérifier**), durée du contrat, règlement des litiges et **lien vers la médiation de la consommation**. Amende relevée : 3 000 € (personne physique) pour défaut d'information.
- **B2B** : CGV facultatives sur le site mais à communiquer sur demande (barème HT, conditions de paiement, **pénalités de retard**, **indemnité forfaitaire de 40 €**). Amende relevée en cas de refus de communication : 15 000 €.

**Clauses à prévoir (prestations audiovisuelles)** — à rédiger par l'avocat :
- Devis → bon pour accord → **acompte** (pourcentage, caractère d'arrhes ou d'acompte : la qualification change les conséquences d'une annulation — **point juridique clé**), solde à la livraison ou avant remise des fichiers HD.
- Annulation / report (tournage), intempéries, indisponibilité de l'artiste, frais engagés (location matériel, déplacements).
- Nombre d'allers-retours de montage inclus, délais de livraison, formats.
- **Cession de droits d'auteur** sur les œuvres livrées (étendue, supports, territoire, durée, rémunération) — formalisme de l'art. L131-3 CPI (**non relu**), et **réserve d'usage portfolio** par Sébastien (avec accord du client et des artistes).
- Droit à l'image des personnes filmées : responsabilité du client pour ses artistes/figurants ou modèle de release fourni.
- Musique : responsabilité du client pour les droits de la musique synchronisée (§8).
- Pénalités de retard et indemnité de 40 € (B2B uniquement).
- Médiation (B2C), droit applicable, juridiction (clause attributive inopposable au consommateur — **à valider**).

**Mesures sur le site**
- Page `/conditions` versionnée ; case « J'ai lu et j'accepte les CGV (version X) » **avant** paiement ; enregistrement en base de la version acceptée, de l'horodatage et de l'identifiant de commande.
- Envoi automatique d'un email de confirmation contenant les CGV (support durable) et le récapitulatif.
- Distinction dans le parcours : « Je suis un professionnel » / « Je suis un particulier » (affichage HT/TTC, rétractation, médiation).

---

## 7. Droit de la consommation (B2C) et différences B2B

**Sources (vérifiées le 09/10/2026, Légifrance)**
- **L221-21** (version **en vigueur depuis le 19/06/2026**) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053310520
- **L221-25** : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563179
- **L221-28** : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226820
- Section rétractation (L221-18 et s.) : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032221365/
- **L612-1** : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032224805
- L111-1 et L221-5 : **non relus dans le texte** lors de cette session (références classiques des informations précontractuelles ; contenu ci-dessous issu de F31228 et de L221-25 qui renvoie au « 9° de l'article L. 221-5 ») — **non vérifié mot à mot**.

**Obligations potentielles (B2C uniquement)**
- **Informations précontractuelles** (L111-1 / L221-5) : caractéristiques essentielles, prix TTC, délais d'exécution, identité et coordonnées du professionnel, conditions, délai et modalités du droit de rétractation, formulaire type, médiation…
- **Rétractation de 14 jours** pour les contrats à distance (L221-18).
- **Exécution avant la fin du délai** (L221-25) : si le consommateur veut que la prestation commence avant la fin du délai et que le contrat l'oblige à payer, « le professionnel recueille sa demande expresse par tout moyen pour les contrats conclus à distance » et « demande au consommateur de reconnaître qu'après qu'il aura entièrement exécuté le contrat, celui-ci ne disposera plus du droit de rétractation ». En cas de rétractation, le consommateur paie « un montant correspondant au service fourni jusqu'à la communication de sa décision de se rétracter ; ce montant est proportionné au prix total ». **Aucune somme n'est due** si la demande expresse n'a pas été recueillie ou si l'information du 9° de L221-5 n'a pas été donnée.
- **Exception** (L221-28, 1°) : pas de droit de rétractation pour les services « pleinement exécutés avant la fin du délai de rétractation et, si le contrat soumet le consommateur à une obligation de payer, dont l'exécution a commencé avec son accord préalable et exprès et avec la reconnaissance par lui de la perte de son droit de rétractation ».
- **Nouveau — fonctionnalité de rétractation en ligne (depuis le 19/06/2026)** : « Pour les contrats conclus à distance au moyen d'une interface en ligne, le professionnel met à la disposition du consommateur, sans frais pour ce dernier, une fonctionnalité lui permettant d'exercer gratuitement son droit de rétractation avant l'expiration du délai […]. Un décret fixe les modalités de présentation et d'utilisation de cette fonctionnalité, de nature à garantir un accès facile, direct et permanent » (L221-21). Selon une source secondaire (Village de la Justice, **non officielle**), le décret n° 2026-3 crée un art. D221-5 : mention explicite du type « renoncer au contrat ici », accessibilité pendant tout le délai, bouton « confirmer la rétractation », accusé de réception sans délai sur support durable — **texte du décret non vérifié sur Légifrance**.
- **Remboursement** sous 14 jours maximum à compter de l'information de la rétractation (texte relevé dans la section L221-18 et s.).
- **Médiation** (L612-1) : « Tout consommateur a le droit de recourir gratuitement à un médiateur de la consommation […]. A cet effet, le professionnel garantit au consommateur le recours effectif à un dispositif de médiation de la consommation. » → adhérer à un médiateur (payant pour le professionnel) et afficher ses coordonnées. Clause imposant une médiation préalable obligatoire au consommateur : **interdite**.

**B2B** : pas de droit de rétractation légal ni de médiation de la consommation obligatoire ; prix HT possibles ; pénalités de retard + indemnité de 40 € ; liberté contractuelle plus large. Attention : un artiste indépendant non professionnel de la musique pourrait être considéré comme consommateur — **qualification à valider par l'avocat**.

**Mesures sur le site**
- Sélecteur B2B/B2C en début de commande ; affichage du prix **TTC** pour les particuliers (ou montant + « TVA non applicable, art. 293 B du CGI » si franchise).
- Page de récapitulatif avant paiement avec toutes les informations précontractuelles.
- Case **non pré-cochée** : « Je demande que la prestation commence avant la fin du délai de rétractation de 14 jours et je reconnais perdre mon droit de rétractation une fois la prestation entièrement exécutée. » Stocker `express_request_at`, `waiver_ack_at`, version du texte.
- **Page `/retractation`** accessible depuis le pied de page et depuis l'email de confirmation : formulaire (n° de commande, email) → bouton « Confirmer la rétractation » → accusé de réception automatique par email (support durable) → notification admin → calcul du montant proportionné éventuel.
- Bloc « Médiation de la consommation » (nom, site, adresse du médiateur) dans CGV et mentions légales.

**À valider** : choix du médiateur ; calcul du montant proportionné ; application des exceptions au cas des tournages programmés ; texte du décret 2026-3.

---

## 8. Propriété intellectuelle, droit à l'image, droit d'auteur, licences musicales

**Sources (vérifiées le 09/10/2026, Légifrance)**
- **CPI L122-4** : « Toute représentation ou reproduction intégrale ou partielle faite sans le consentement de l'auteur ou de ses ayants droit ou ayants cause est illicite. […] » : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278911
- **CPI L213-1** : « L'autorisation du producteur de phonogrammes est requise avant toute reproduction, mise à la disposition du public par la vente, l'échange ou le louage, ou communication au public de son phonogramme autres que celles mentionnées à l'article L. 214-1. » : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006279050
- **Code civil art. 9** (« Chacun a droit au respect de sa vie privée ») : **non relu sur Légifrance lors de cette session** — **non vérifié**. Fondement jurisprudentiel du droit à l'image.
- Droits des artistes-interprètes (L212-3) et des producteurs de vidéogrammes (L215-1) : **non relus** — **non vérifié**.

**Analyse (à valider par un avocat spécialisé)**
Un clip de rap contient plusieurs couches de droits :
1. **L'œuvre audiovisuelle** (le clip) : Sébastien est (co)auteur en tant que réalisateur, mais le **producteur** du clip (label, artiste autoproduit) détient généralement les droits d'exploitation par contrat.
2. **La musique** : composition et texte (auteurs-compositeurs, éditeurs, gestion SACEM) + **enregistrement** (producteur du phonogramme — L213-1) + **interprétation** (artiste-interprète).
3. **L'image des personnes** filmées (artiste, figurants) : droit à l'image.
4. Éventuels éléments tiers (marques, œuvres visibles, lieux).

→ Diffuser un clip, même en extrait, sur son portfolio est une **représentation** au sens de L122-4 : il faut l'**autorisation** des titulaires (producteur du clip, label/producteur du phonogramme pour la bande-son, artistes). Les « sync rights » de la musique accordés pour le clip ne couvrent pas automatiquement un usage portfolio sur un site commercial.

**Mesures sur le site**
- **Registre des autorisations** (table `media_rights`) par média : titulaires, type d'autorisation (écrite/email), périmètre (site, réseaux, durée), date, preuve (fichier), statut (`ok`, `pending`, `refused`, `takedown`).
- Publication d'un média uniquement si `rights_status = ok` (garde-fou côté build/admin).
- Option technique : extraits **muets** ou avec musique libre de droits lorsque l'autorisation musicale manque ; ou **intégration de la vidéo officielle** (YouTube de l'artiste) derrière une façade consentement — l'embed officiel réduit le risque de reproduction mais n'efface pas toutes les questions (**à valider**).
- Crédits visibles (artiste, label, réalisateur, DOP, etc.) et adresse de contact pour demande de retrait, traitement rapide.
- Clause portfolio type dans les devis/contrats futurs.

**À valider** : modèles d'autorisation (artistes, labels, figurants), clause de cession/réserve portfolio, usage des bulles d'artistes (noms, photos = droit à l'image et éventuellement droit des marques pour les noms de scène).

---

## 9. Sécurité des formulaires, anti-spam, violations de données

**Sources (vérifiées le 09/10/2026)**
- CNIL, « Notifier une violation de données personnelles » (page datée du 24/05/2018, toujours en ligne) : https://www.cnil.fr/fr/services-en-ligne/notifier-une-violation-de-donnees-personnelles
- Loi 78-17 art. 4, 6° (sécurité) — lien §1.
- Stripe, guide de sécurité d'intégration : https://docs.stripe.com/security/guide ; webhooks : https://docs.stripe.com/webhooks
- FAQ CNIL cookies (CAPTCHA exemptés si seule finalité de sécurité) — §2.

**Obligations potentielles**
- Sécurité appropriée (art. 32 RGPD / art. 4-6° loi I&L).
- **Violation** : notification à la CNIL « dans un délai de 72 heures si possible à la suite de la constatation de la violation présentant un risque » (motiver le retard au-delà) ; **information des personnes** en cas de risque élevé ; **documentation interne de toutes les violations** (nature, catégories et nombre approximatif de personnes et d'enregistrements, conséquences probables, mesures prises). Téléservice : https://notifications.cnil.fr/notifications/

**Mesures techniques**
- HTTPS partout, HSTS, en-têtes `Content-Security-Policy` (domaines Stripe listés par Stripe : `https://checkout.stripe.com`, `https://*.stripe.com` pour les images…), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `frame-ancestors 'none'` hors besoins.
- Formulaire de devis : validation stricte côté serveur (schéma), taille maximale, échappement à l'affichage dans l'admin (XSS), **honeypot**, **rate limiting** par IP tronquée/empreinte courte, délai minimal de remplissage, CAPTCHA respectueux de la vie privée en dernier recours (exempt de consentement s'il ne sert qu'à la sécurité ; vérifier le fournisseur).
- Pas de pièces jointes au départ (ou analyse/limitation de type et taille, stockage privé).
- **Webhooks Stripe** : vérification de la signature `Stripe-Signature` avec le secret `whsec_…`, contrôle de l'horodatage (anti-rejeu), idempotence par `event.id`, TLS, rotation périodique du secret ; Stripe recommande aussi d'autoriser ses IP.
- **Admin** : authentification forte (passkey/TOTP), session courte en cookie `HttpOnly; Secure; SameSite=Lax/Strict` (traceur strictement nécessaire), `noindex`, journal des accès et des exports, principe du moindre privilège, sauvegardes chiffrées.
- Dépendances à jour (audit npm), secrets hors dépôt.
- **Registre des violations** (même vide) et procédure écrite de 1 page (qui, quoi, délai 72 h).

**À valider** : procédure de violation, contrats des sous-traitants (délais de notification du sous-traitant vers Sébastien).

---

## 10. Accessibilité (RGAA / Acte européen sur l'accessibilité)

**Sources (vérifiées le 09/10/2026)**
- Loi n° 2005-102, **art. 47**, version en vigueur depuis le 08/09/2023 : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037388867/
- DGCCRF, « Professionnels : vos produits et services doivent être conformes à la directive "Accessibilité" » : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite
- DGCCRF, « La nouvelle directive européenne "Accessibilité"… » : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/la-nouvelle-directive-europeenne-accessibilite-pour-des-produits-et-des-services-accessibles-aux-personnes-en-situation
- Directive (UE) 2019/882 (EAA) — **texte EUR-Lex non relu** ; date d'application au 28/06/2025 issue de la connaissance générale — **non vérifiée dans une source consultée ce jour**. Décret n° 2019-768 : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000038811937 (seuil de chiffre d'affaires de l'art. 47 4° — **valeur non relue**, réputée 250 M€).

**Analyse**
- **Art. 47** : s'applique notamment aux « entreprises dont le chiffre d'affaires excède un seuil défini par le décret » → **a priori non applicable** à un entrepreneur individuel.
- **EAA / directive Accessibilité** (commerce électronique = service visé) : selon la DGCCRF, les entreprises de **moins de 10 salariés** avec un **CA annuel ou total de bilan inférieur à 2 M€** : « aucune obligation en matière d'accessibilité ne s'impose aux prestataires de services ». → **Sébastien serait exempté** s'il reste microentreprise au sens européen.

**Obligation potentielle** : **aucune obligation légale identifiée** à ce stade pour ce site ; mais **bonne pratique fortement recommandée** (clients institutionnels/marques, SEO, qualité), et l'exemption tombe si l'activité grandit.

**Mesures (volontaires)** : viser les critères principaux RGAA/WCAG 2.1 AA : contrastes, navigation clavier, focus visible, textes alternatifs, **sous-titres** pour les vidéos avec parole, contrôle de la lecture automatique (pas d'autoplay avec son, bouton pause), `prefers-reduced-motion` pour les animations des bulles, labels de formulaire et messages d'erreur explicites, bandeau de consentement accessible (focus piégé dans la modale, `aria`). **Ne pas** afficher « site conforme RGAA » ; éventuellement une page « Accessibilité » décrivant l'effort réalisé.

**À valider** : effectif et CA réels ; évolution de la transposition française (code de la consommation) — **non vérifiée**.

---

## 11. Prospection et newsletter

**Sources (vérifiées le 09/10/2026)**
- CNIL, « La prospection commerciale par courrier électronique, SMS-MMS et automate d'appel », **10 juin 2026** : https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique-sms-mms-et-automate-dappel
- CPCE art. L34-5 (lien Légifrance donné par la CNIL : https://www.legifrance.gouv.fr/codes/id/LEGIARTI000042155961/2020-07-26/) — **texte non relu directement**, contenu résumé d'après la CNIL.

**Règles (CNIL)**
- **B2C** : **consentement préalable** « libre, spécifique, éclairé et univoque », action positive, case dédiée **non pré-cochée** ; l'acceptation des CGU ne suffit pas. Exceptions : client existant + produits/services **similaires** (inapplicable si aucune vente/prestation n'a eu lieu) ; prospection non commerciale.
- **B2B** : possible sur la base de l'intérêt légitime si l'objet est **en rapport avec la profession** de la personne ; information + **opposition simple et gratuite**. La CNIL recommande une case (décochée par défaut) pour permettre l'opposition.
- **Chaque message** : identité de l'émetteur + moyen simple de refuser les envois suivants.
- Adresses génériques de personnes morales (contact@, info@) non soumises à ces principes.
- Droits à traiter sous un mois.

**Mesures**
- Formulaire de devis : case optionnelle séparée « Je souhaite recevoir les actualités de Sébastien (sorties de clips, disponibilités) — désinscription en 1 clic » ; jamais de case pré-cochée ; stocker `marketing_consent_at`, source, texte affiché (version).
- Email transactionnel ≠ email marketing (outils/listes séparés).
- Lien de désinscription en 1 clic + en-tête `List-Unsubscribe` ; **liste repoussoir** (hash de l'email) pour respecter l'opposition.
- Pas de pixel de suivi d'ouverture sans consentement (la CNIL a publié une recommandation sur les **pixels dans les courriels** et une FAQ le 22/07/2026 — **contenu non lu dans cette session, à examiner avant toute newsletter**).

---

## 12. Fiscalité et facturation

**Sources (vérifiées le 09/10/2026)**
- Service-Public Entreprendre, F21746 « Franchise en base de TVA », **vérifié le 01/01/2026** : https://entreprendre.service-public.fr/vosdroits/F21746
- Service-Public Entreprendre, F23208 « Tout savoir sur la facturation », **vérifié le 07/08/2026** : https://entreprendre.service-public.gouv.fr/vosdroits/F23208
- economie.gouv.fr, « Tout savoir sur la facturation électronique pour les entreprises » : https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises
- impots.gouv.fr, Fiche 1 « Que va-t-il se passer pour mon entreprise… » : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fiche-1_que-va-t-il-se-passer-pour-mon-entreprise.pdf
- impots.gouv.fr, guide pratique de démarrage au 1er septembre 2026 (PDF) : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf
- CGI art. 293 B : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048826700/ (lien relevé sur F21746, texte non relu)

### 12.1 Franchise en base de TVA — seuils 2026

Selon F21746 : « **Pour l'année 2026**, les seuils de franchise en base de TVA française applicables restent **inchangés**. La proposition issue de la loi de finances pour 2025 visant à instaurer un seuil unique de franchise en base de TVA de 25 000 € a été abandonnée. »

| Activité | Seuil de base (CA N-1) | Seuil majoré (CA N, sortie au 1er jour de dépassement) |
|---|---|---|
| **Prestations de services** (cas général) | **37 500 €** | **41 250 €** |
| Commerce / hébergement | 85 000 € | 93 500 € |
| Auteur d'une œuvre de l'esprit / artiste-interprète — **livraisons d'œuvres et cessions de droits d'auteur** | 50 000 € | 55 000 € |
| Auteur / artiste-interprète — **autres activités** | 35 000 € | 38 500 € |

⚠️ **Point important pour l'expert-comptable** : l'activité de Sébastien mêle potentiellement des **prestations de services** (tournage, montage, photo de commande) et des **cessions de droits d'auteur** (réalisateur/photographe auteur). Le régime applicable (BNC, régime artiste-auteur/URSSAF artistes-auteurs, micro-entreprise BNC, seuils « auteur ») dépend de la qualification — **à déterminer impérativement**. Démarrage en cours d'année : seuil apprécié au **prorata**.

Mention sur chaque facture en franchise : « **TVA non applicable, art. 293 B du CGI** » (F21746 précise que l'absence de mention expose à un redressement pour non-respect du formalisme).

### 12.2 Mentions obligatoires d'une facture (F23208, vérifié le 07/08/2026)
Date d'émission ; numéro unique chronologique et continu ; date de la prestation (ou de versement de l'**acompte**) ; identité du prestataire (**nom + « Entrepreneur individuel » ou « EI »**, adresse, **SIREN**) ; identité du client ; n° de bon de commande le cas échéant ; n° de TVA (sauf facture ≤ 150 € HT) ; désignation et décompte détaillé (quantité, prix unitaire HT, taux de TVA ou mention d'exonération) ; totaux HT/TTC ; réductions ; date d'échéance et conditions d'escompte (« Escompte pour paiement anticipé : néant ») ; **taux des pénalités de retard** ; **indemnité forfaitaire de 40 €** (client professionnel) ; mention 293 B si franchise.
- **B2C** : note obligatoire si la prestation dépasse **25 € TTC** ; en dessous, sur demande.
- **Quatre nouvelles mentions** obligatoires pour les PME/micro-entreprises à compter du **1er septembre 2027** : SIREN du client (entreprise), adresse de livraison si différente, **nature des opérations** (biens / services / mixte), mention « Option pour le paiement de la taxe d'après les débits » le cas échéant.
- **Acompte + solde** : une facture d'acompte puis une facture de solde (déduisant l'acompte) — **schéma exact à valider par l'expert-comptable**.

### 12.3 Facturation électronique — calendrier (economie.gouv.fr, impots.gouv.fr)
- **Depuis le 1er septembre 2026** : **toutes les entreprises** doivent pouvoir **recevoir** des factures électroniques (via une **plateforme agréée**) ; GE/ETI émettent.
- **1er septembre 2027** : **PME et micro-entreprises** doivent **émettre** électroniquement leurs factures B2B (entreprises assujetties à la TVA établies en France) et transmettre leurs données d'**e-reporting**.
- Les entreprises en **franchise en base** sont concernées ; leurs factures « continueront de porter la mention "TVA non applicable, article 293 B du CGI" » (Fiche 1 impots.gouv.fr).
- Un PDF envoyé par email ne sera plus une facture électronique conforme pour les opérations B2B entrant dans le champ de la réforme (Fiche 1).
- La CNIL a publié le 10/09/2026 « Facturation électronique : quels enjeux pour la protection des données personnelles ? » — **non lu**, à consulter.

**Mesures sur le site**
- Le site **ne génère pas** lui-même les factures légales (éviter un logiciel de facturation « maison » non conforme) : utiliser un outil de facturation connecté à une **plateforme agréée** dès 2027 ; le site stocke seulement les références (n° de facture, statut).
- Stripe Invoicing peut servir de support de paiement, mais sa conformité au format/plateformes agréées françaises n'a **pas été vérifiée**.
- Affichage des prix : configuration `vatMode: 'franchise' | 'standard'` qui pilote l'affichage TTC/HT et la mention 293 B partout (devis, checkout, emails).

**À valider par l'expert-comptable** : statut (micro-BNC / artiste-auteur / autre), seuils applicables, schéma acompte/solde, choix de la plateforme agréée, conservation des pièces.

---

## 13. Spécification du gestionnaire de consentement (CMP)

> Objectif : **aucun événement ni script non essentiel avant consentement**, preuve du choix, retrait aussi simple que l'acceptation.

### 13.1 Catégories
| Catégorie | Défaut | Exemples | Base |
|---|---|---|---|
| `necessary` (non désactivable) | actif | session admin, mémorisation du choix de consentement, sécurité anti-abus du formulaire, session de checkout | exemption art. 82 |
| `audience_exempt` (opposable) | actif, **avec opposition** dans la politique | analytics first-party configuré selon §2.2 | exemption art. 82 + intérêt légitime |
| `audience_extended` | **inactif** | progression vidéo détaillée (si jugée hors exemption), UTM/source, GA4/PostHog éventuels | consentement |
| `media` | **inactif** | lecteurs YouTube/Vimeo/Instagram/SoundCloud, polices ou scripts tiers | consentement |
| `marketing` | **inactif** | pixels Meta/TikTok/Google Ads, retargeting | consentement |

### 13.2 Interface
- Premier niveau : texte court + boutons **« Tout accepter »**, **« Tout refuser »**, **« Personnaliser »** — même taille, même style, même niveau ; fermeture « × » = refus (ou absence de choix = rien n'est déposé).
- Second niveau : un interrupteur par catégorie (désactivés par défaut sauf `necessary`), description, liste des traceurs, durée.
- Accessible (clavier, lecteur d'écran), ne bloque pas la navigation (pas de cookie wall).
- **Lien permanent « Gérer mes cookies »** dans le pied de page de toutes les pages → rouvre le panneau ; et lien d'**opposition à la mesure d'audience** dans la politique de confidentialité.

### 13.3 Stockage du choix côté navigateur
- Cookie first-party `als_consent` (ou `localStorage` équivalent) : `{ v: <schemaVersion>, policy: <policyVersion>, id: <uuid v4 aléatoire>, ts: <ISO>, c: { audience_extended: bool, media: bool, marketing: bool }, optout_audience: bool }`.
- Attributs : `Secure; SameSite=Lax; Path=/`, durée **6 mois** (expiration fixe à partir du choix, **non prorogée** à chaque visite).
- Si `optout_audience = true` → le collecteur first-party n'envoie plus rien (cookie d'opposition, exigé par l'outil CNIL « pour prendre en compte le refus dans la durée »).

### 13.4 Journal de preuve (serveur) — table `consent_log`
| Champ | Description |
|---|---|
| `id` | identifiant de l'entrée |
| `consent_id` | UUID aléatoire du navigateur (pseudonyme, pas d'email) |
| `created_at` | horodatage serveur UTC |
| `action` | `accept_all` / `reject_all` / `custom` / `withdraw` / `renew` / `optout_audience` |
| `choices` | JSON par catégorie |
| `policy_version` | version de la politique cookies affichée |
| `banner_version` | version du texte/UI du bandeau (preuve de l'information donnée) |
| `source` | `banner` / `footer_link` / `privacy_page` |
| `locale` | langue affichée |
| `ua_major` | navigateur + version majeure seulement |
| `ip_trunc` | IP tronquée (facultatif ; **à valider** — peut être omis) |

- Écriture via un endpoint `POST /api/consent` (sans cookie tiers), idempotent.
- **Conservation proposée** : 13 mois (durée de validité du choix + marge de preuve) — **à valider par l'avocat**.
- Jamais d'utilisation du journal à d'autres fins.

### 13.5 Règles de comportement
1. Au premier chargement : seuls les scripts `necessary` et `audience_exempt` (si pas d'opposition) se chargent ; **aucune requête vers un domaine tiers non essentiel**.
2. Les scripts de catégories consenties sont injectés **après** le choix (chargement dynamique), et retirés/neutralisés après retrait (suppression des cookies posés sur notre domaine ; rechargement de la page si nécessaire).
3. **Nouvelle demande** quand : 6 mois écoulés, `policy_version` modifiée de manière substantielle, ajout d'une nouvelle catégorie/finalité.
4. Après un **refus**, ne pas redemander avant 6 mois (bonne pratique CNIL pour la conservation des choix).
5. Signal navigateur **Global Privacy Control** : peut être traité comme un refus des catégories non essentielles (bonne pratique, non exigée par les textes consultés).
6. Tests e2e (Playwright) : (a) aucune requête tierce avant choix ; (b) « Tout refuser » → aucune requête tierce ; (c) retrait via le pied de page → plus aucun envoi ; (d) expiration à 6 mois → bandeau réaffiché.

---

## 14. Questions à poser à l'avocat et à l'expert-comptable

**Avocat**
1. Statut et contenu des mentions légales (domicile vs domiciliation ; RNE/RCS ; art. 19 LCEN).
2. Qualification **acompte vs arrhes** et clauses d'annulation/report de tournage.
3. Clients artistes indépendants : consommateurs ou professionnels ?
4. Application de l'exception L221-28 1° et calcul du montant proportionné (L221-25) ; conformité de la fonctionnalité de rétractation au décret n° 2026-3.
5. Choix du médiateur de la consommation.
6. Modèles d'autorisation : artistes (image), labels/producteurs (clip + phonogramme), figurants ; clause portfolio ; cession de droits d'auteur dans les CGV.
7. Classement des événements analytics (vidéo, checkout) au regard de l'exemption CNIL ; durée du journal de consentement.
8. Encadrement des transferts (DPF/CCT) pour chaque prestataire retenu ; DPA.

**Expert-comptable**
1. Statut (micro-entreprise BNC, artiste-auteur, autre) et régime social.
2. Seuil de franchise applicable (services 37 500 € / auteur 50 000 € ou 35 000 €) ; ventilation des recettes.
3. Schéma de facturation acompte + solde ; facturation via Stripe ; plateforme agréée pour la réception (dès le 01/09/2026) et l'émission (01/09/2027).
4. Traitement comptable des frais Stripe/PayPal et des remboursements.

---

## 15. Liste des sources consultées

| Source | URL | Date affichée par la source | Consultée |
|---|---|---|---|
| CNIL — mesure d'audience exemptée | https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience | 04/07/2025 | 09/10/2026 |
| CNIL — outil d'auto-évaluation (PDF) | https://www.cnil.fr/sites/default/files/2025-07/outil_d_auto-evaluation_mesure_d_audience.pdf | juillet 2025 | 09/10/2026 |
| CNIL — FAQ cookies | https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ | 29/04/2026 | 09/10/2026 |
| CNIL — prospection électronique | https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique-sms-mms-et-automate-dappel | 10/06/2026 | 09/10/2026 |
| CNIL — notifier une violation | https://www.cnil.fr/fr/services-en-ligne/notifier-une-violation-de-donnees-personnelles | 24/05/2018 | 09/10/2026 |
| CNIL — adéquation États-Unis (Q/R) | https://www.cnil.fr/fr/adequation-des-etats-unis-les-premieres-questions-reponses | 2023 | 09/10/2026 |
| Commission européenne — décisions d'adéquation | https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en | actualité 23/07/2026 | 09/10/2026 |
| Légifrance — loi 78-17 art. 82 | https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037813978 | en vigueur depuis 01/06/2019 | 09/10/2026 |
| Légifrance — loi 78-17 art. 4 | https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037822953 | idem | 09/10/2026 |
| Légifrance — LCEN art. 1-1 | https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614 | en vigueur depuis 23/05/2024 | 09/10/2026 |
| Légifrance — C. conso. L221-21 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053310520 | en vigueur depuis 19/06/2026 | 09/10/2026 |
| Légifrance — C. conso. L221-25 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563179 | — | 09/10/2026 |
| Légifrance — C. conso. L221-28 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226820 | — | 09/10/2026 |
| Légifrance — C. conso. L612-1 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032224805 | — | 09/10/2026 |
| Légifrance — CPI L122-4 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278911 | — | 09/10/2026 |
| Légifrance — CPI L213-1 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006279050 | — | 09/10/2026 |
| Légifrance — loi 2005-102 art. 47 | https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037388867/ | en vigueur depuis 08/09/2023 | 09/10/2026 |
| DGCCRF — directive Accessibilité | https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite | — | 09/10/2026 |
| Service-Public — franchise TVA (F21746) | https://entreprendre.service-public.fr/vosdroits/F21746 | vérifié 01/01/2026 | 09/10/2026 |
| Service-Public — facturation (F23208) | https://entreprendre.service-public.gouv.fr/vosdroits/F23208 | vérifié 07/08/2026 | 09/10/2026 |
| Service-Public — mentions site EI (F31228) | https://entreprendre.service-public.gouv.fr/vosdroits/F31228 | vérifié 31/07/2023 (ancienne) | 09/10/2026 |
| economie.gouv.fr — facturation électronique | https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises | — | 09/10/2026 |
| impots.gouv.fr — Fiche 1 facturation électronique | https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fiche-1_que-va-t-il-se-passer-pour-mon-entreprise.pdf | — | 09/10/2026 |
| Stripe — guide sécurité / webhooks | https://docs.stripe.com/security/guide ; https://docs.stripe.com/webhooks | — | 09/10/2026 |
| Source secondaire (non officielle) — décret 2026-3 / D221-5 | https://www.village-justice.com/articles/fonction-retractation-ligne-entre-vigueur-juin-2026-que-change-ordonnance-2026,57910.html | — | 09/10/2026 |

**Non vérifiés dans cette session** : texte intégral du RGPD (EUR-Lex) ; directive 2019/882 et sa transposition ; C. civ. art. 9 ; CPI L131-3, L212-3, L215-1 ; C. conso. L111-1 et L221-5 (texte) ; CPCE L34-5 (texte) ; LCEN art. 19 ; décret 2026-3 ; liste DPF des prestataires ; contentieux DPF devant la CJUE ; recommandation CNIL « pixels dans les courriels » (2026) ; page CNIL facturation électronique (10/09/2026).
