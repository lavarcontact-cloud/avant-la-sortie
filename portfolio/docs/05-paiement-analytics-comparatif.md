# 05 — Comparatif paiement & analytics

> **Date de vérification des tarifs et sources : 9 octobre 2026.** Les tarifs publics changent souvent : revérifier avant mise en production. Ce qui n'a pas été lu sur une source officielle est marqué **« non vérifié »**. Contexte juridique (consentement, rétractation, facturation) : voir `06-conformite-juridique.md`.

---

## A. Paiement en ligne (acompte + solde) pour un prestataire solo en France

### A.1 Besoin
- Encaisser un **acompte** à la réservation puis le **solde** à la livraison (ou avant remise des fichiers HD).
- Clients majoritairement **professionnels** (labels, marques : souvent cartes **professionnelles/premium**) et quelques particuliers.
- Zéro donnée de carte sur notre infrastructure ; confirmation fiable par **webhook** ; fonctionnement compatible avec un parcours B2C (case de demande expresse, CGV acceptées) et avec la facturation (doc 06 §12).

### A.2 Tarifs relevés (sources officielles, 09/10/2026)

| | **Stripe** (tarif standard France) | **PayPal** (France) | **Mollie** (France) |
|---|---|---|---|
| Source | https://stripe.com/fr/pricing | https://www.paypal.com/fr/business/paypal-business-fees (« Dernière mise à jour : 15 juillet 2026 ») | https://www.mollie.com/fr/pricing |
| Cartes **standard EEE** | **1,5 % + 0,25 €** | Paiement via compte PayPal (« toutes les autres transactions commerciales ») : **2,90 % + 0,35 €** ; paiement par carte « sans compte PayPal » : 1,20 % + 0,35 € ; **Paiements par carte bancaire avancés** (sur demande et approbation) : **1,20 % + 0,35 €** (structure regroupée) ; solution hébergée : 2,30 % + 0,35 € | Cartes consommateur EEE : **1,80 % + 0,25 €** |
| Cartes **premium / commerciales** EEE | **2,8 % + 0,25 €** (premium EEE) | inclus dans la structure regroupée (1,20 % + 0,35 € en cartes avancées) ; Amex 3,50 % | Cartes commerciales EEE : **2,90 % + 0,25 €** |
| Cartes britanniques | 2,5 % + 0,25 € | + 1,29 % (expéditeur Royaume-Uni) | — |
| Cartes internationales | 3,15 % + 0,25 € (+ 2 % si conversion) | + 1,99 % (autres marchés) | 3,25 % + 0,25 € |
| Prélèvement SEPA | 0,35 € | 0,35 € (standard) / 0,40 € (instantané) | 0,35 € ; virement SEPA 0,25 € |
| Wallets | Apple Pay / Google Pay / Link proposés dans Checkout (tarif carte) — **liste exacte des moyens activables en France non relue ce jour** | Apple Pay via liens de paiement POS : 1,2 % + 0,35 € | Apple Pay : « taux défini par la carte utilisée » ; PayPal via Mollie : frais PayPal + 0,10 € |
| Litiges | 20,00 € par litige reçu (+ 20,00 € si réponse manuelle) | Opposition bancaire 16,00 € ; frais de résolution de litiges 14,00 € (standard) | non relevé |
| Liens de paiement / factures | Payment Links inclus ; factures « post-paiement » Checkout/Payment Links : 0,4 % (max 2,00 $US) ; Stripe Invoicing : 0,4 % par facture payée | Liens de paiement POS : 2,9 % + 0,35 € (PayPal) / 1,2 % + 0,35 € (cartes) | Liens de paiement inclus |
| Versements | Standard inclus (non détaillé) ; Instant Payouts : 1 % (min. 0,50 €) | Transfert vers compte bancaire local : aucuns frais (hors conversion) | non relevé |
| Abonnement | aucun (tarif standard) | aucun (sauf PayPal Intégral Évolution 25 €/mois) | 0 €/mois |

**Exemple chiffré — acompte de 500 € par carte standard EEE** (calcul à partir des grilles ci-dessus) :
- Stripe : 500 × 1,5 % + 0,25 = **7,75 €** (carte premium : 14,25 €)
- PayPal via compte PayPal : 500 × 2,90 % + 0,35 = **14,85 €** ; PayPal cartes avancées : **6,35 €** (sous réserve d'approbation)
- Mollie : 500 × 1,80 % + 0,25 = **9,25 €** (carte commerciale : 14,75 €)

### A.3 Fonctionnalités clés

| Critère | Stripe | PayPal | Mollie |
|---|---|---|---|
| Page de paiement hébergée (pas de carte sur nos serveurs) | **Checkout** / **Payment Links** | Boutons PayPal / solution hébergée | Hosted checkout / Payment Links |
| Périmètre PCI | Checkout hébergé : formulaire chez Stripe, données de carte jamais sur notre serveur. Le guide Stripe consulté indique que les intégrations « à faible risque » réduisent les obligations PCI ; la mention **SAQ A** pour Checkout est l'usage courant mais **n'a pas été relevée mot pour mot** sur la page consultée ce jour | similaire avec boutons hébergés (**non vérifié**) | similaire (**non vérifié**) |
| Acompte + solde | 2 sessions Checkout distinctes (acompte à la réservation, solde à la livraison) liées à un même `booking_id` via `metadata` ; ou Payment Link / facture pour le solde | 2 commandes/2 liens | 2 paiements / liens |
| Webhooks signés | **Oui** : en-tête `Stripe-Signature`, secret `whsec_…`, horodatage signé (anti-rejeu), rotation du secret (https://docs.stripe.com/webhooks) | Oui (vérification par API — **non vérifié ce jour**) | Oui (modèle « fetch » par ID — **non vérifié ce jour**) |
| Remboursement partiel (rétractation proportionnée) | Oui (API/dashboard) | Oui ; les frais initiaux ne sont pas remboursés | Oui (**non vérifié**) |
| Moyens adaptés aux pros (virement/SEPA) | SEPA Direct Debit 0,35 € ; virement bancaire (**non vérifié**) | SEPA | Virement SEPA 0,25 € |
| Éligibilité entrepreneur individuel FR | Comptes pour entreprises individuelles — **non vérifié ce jour** (vérification d'identité KYC à prévoir) | Compte Professionnel | **non vérifié** |
| Données / transferts | Stripe Payments Europe (Irlande) et Stripe Inc. (US) — **entités et DPF non vérifiés** | PayPal (Europe) S.à r.l. (Luxembourg) — **non vérifié** | Société néerlandaise (UE) — **non vérifié** |

### A.4 Recommandation
**Stripe Checkout (page hébergée) + webhooks signés**, avec **Payment Links** pour les soldes envoyés manuellement, et PayPal éventuellement ajouté plus tard comme moyen secondaire si des clients le demandent.

Raisons :
1. **Frais les plus bas sur les cartes standard EEE** (1,5 % + 0,25 €) parmi les grilles relevées sans négociation ni approbation préalable.
2. Page hébergée → aucune donnée de carte sur le site, périmètre PCI minimal ; CSP simple (`https://checkout.stripe.com`, `https://*.stripe.com`).
3. Acompte/solde simples à modéliser (deux sessions liées par `metadata.booking_id`, statut mis à jour **uniquement** par webhook vérifié — jamais par la page de retour).
4. Remboursements partiels pour la rétractation proportionnée (C. conso. L221-25).

Points de vigilance :
- **Cartes premium à 2,8 % + 0,25 €** : les labels/marques payant avec des cartes corporate coûteront plus cher → proposer **virement SEPA** ou **prélèvement SEPA** pour les gros montants B2B.
- Les **factures légales** ne doivent pas dépendre de Stripe seul (facturation électronique via plateforme agréée dès le 01/09/2027 — doc 06 §12) ; conformité de Stripe Invoicing au dispositif français **non vérifiée**.
- Mollie est une alternative européenne crédible (1,80 % + 0,25 €, société UE) si l'on veut éviter un acteur américain.
- PayPal « cartes avancées » à 1,20 % + 0,35 € est compétitif mais soumis à **éligibilité/approbation** ; le paiement via compte PayPal (2,90 % + 0,35 €) est nettement plus cher.

### A.5 Implémentation (résumé)
- `POST /api/checkout/deposit` : crée la session Checkout (mode `payment`, montant d'acompte, `metadata: { booking_id, kind: 'deposit', cgv_version, customer_type }`, `customer_email`), URL de succès/annulation.
- `POST /api/checkout/balance` (admin) : crée un Payment Link / une session pour le solde.
- `POST /api/stripe/webhook` : lecture du **corps brut**, `stripe.webhooks.constructEvent(raw, sig, whsec)`, idempotence sur `event.id`, traitement de `checkout.session.completed`, `checkout.session.async_payment_succeeded/failed`, `charge.refunded`, `charge.dispute.created`.
- Événements analytics `checkout_*` dérivés **côté serveur** de ces webhooks (pas de traceur côté navigateur).
- Variables : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (jamais dans le dépôt).

---

## B. Analytics : options et conformité CNIL

### B.1 Rappel des règles (CNIL)
- Exemption de consentement uniquement si la mesure est **strictement limitée à la mesure d'audience pour le compte exclusif de l'éditeur**, produit des **statistiques anonymes**, sans recoupement, sans transmission de données non anonymes à des tiers, sans suivi inter-sites (page du 04/07/2025).
- Recommandations : information, **cookie ≤ 13 mois non prorogé**, **données ≤ 25 mois**, réexamen périodique.
- Outil d'auto-évaluation (juillet 2025) : **au plus 3 types d'événements** (page vue ; utilisation d'une fonctionnalité — clic bouton/lien ; temps de chargement/défilement/temps passé), **pas d'UTM ni d'identifiant de campagne**, référent limité au domaine, IP pseudonymisée (au moins le dernier octet retiré), pas de session replay, pas de cohortes/A-B tests, pas de marquage de formulaires, rapports agrégés **arrondis à la dizaine**, opposition par lien/bouton dans la politique de confidentialité + mémorisation du refus.
- Les fournisseurs qui **réutilisent les données pour leur propre compte** sont hors exemption.
- Sources : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience ; https://www.cnil.fr/sites/default/files/2025-07/outil_d_auto-evaluation_mesure_d_audience.pdf

> La CNIL **ne publie plus de « liste » de solutions exemptées** sur cette page : elle renvoie à une **auto-évaluation par le fournisseur**, qui ne peut pas se dire « certifiée » ou « validée par la CNIL ». La responsabilité de l'éditeur reste engagée en cas de contrôle.

### B.2 Comparatif

| Option | Hébergement / données | Exemption possible ? | Points forts | Limites |
|---|---|---|---|---|
| **First-party maison** (endpoint `/api/e` → table Postgres UE) | Chez nous (Vercel région UE + Supabase UE — **à vérifier**) | **Oui si configuré selon §B.1** (nous sommes à la fois éditeur et « solution ») — documenter notre propre auto-évaluation avec le modèle CNIL | Contrôle total ; aucun tiers ; événements métier sur mesure ; tableau de bord admin intégré | À développer et maintenir ; rigueur nécessaire (arrondis, troncature IP, purge 25 mois) |
| **Matomo** (On-Premise ou Cloud) | Auto-hébergé ou cloud Matomo | **Oui selon l'auto-évaluation publiée par Matomo** (page matomo.org, guide d'avril 2026) : « CNIL compliance mode » qui désactive les fonctions incompatibles ; rétention fixée à **759 jours** (≈ 25 mois) — *déclaration du fournisseur, non vérifiée par la CNIL* | Mature, outil d'opposition fourni, nombreuses fonctionnalités | Lourd à auto-héberger ; en mode exempté, beaucoup de fonctions désactivées |
| **Plausible** | Hébergement UE annoncé par Plausible (« uses only EU-based service providers ») | **Non vérifié** : aucune auto-évaluation au format CNIL 2025 relevée ce jour ; sans cookie mais utilise un hash journalier (à analyser) | Léger, simple, sans cookie | Tarifs **non vérifiés** ; UTM/sources collectés par défaut → à désactiver pour rester dans l'exemption ; vérifier la DPA |
| **PostHog** | Cloud UE ou US / auto-hébergeable (**non vérifié ce jour**) | **Plutôt non par défaut** : session replay, feature flags, A/B tests, identification utilisateurs = hors exemption ; un mode très réduit pourrait l'être (**non vérifié**) | Puissant (funnels, replay, expérimentations) | À réserver à la catégorie « consentement » |
| **Google Analytics 4** | Google (US/UE) | **Non** : Google réutilise des données pour son propre compte → **consentement requis** en France | Gratuit, standard du marché | Bandeau obligatoire, données perdues en cas de refus, transferts hors UE (certification DPF de Google **non vérifiée ce jour**) |

### B.3 Recommandation
**Analytics first-party maison configuré pour l'exemption CNIL**, stocké dans la base UE du projet, affiché dans le tableau de bord admin ; **aucun outil tiers d'analytics** au lancement. Matomo (mode CNIL) reste le plan B si l'on ne veut pas maintenir le collecteur.

**Mesuré sans consentement (exemption)** — sous réserve de validation :
- `page_view` (chemin sans paramètres de requête, titre/type de page, référent = domaine seulement, appareil = mobile/desktop, navigateur/OS en version majeure, pays/ville à partir de l'IP puis IP tronquée et jamais stockée en clair) ;
- `artist_bubble_click` (label = slug artiste), `cta_click` (label du CTA, destination), `video_play` (id vidéo) ;
- `scroll_depth`, temps passé, temps de chargement (Web Vitals) ;
- `quote_submit` comme **simple compteur** (aucun contenu).

**Mesuré côté serveur à partir des données métier (sans traceur)** : nombre de devis reçus (table `quotes`), checkout démarrés/terminés (sessions Stripe + webhooks), chiffre d'affaires, taux de conversion devis → acompte. Ces données relèvent de la gestion de l'activité (base contractuelle), pas de la mesure d'audience — affichage agrégé dans l'admin.

**Uniquement après consentement (`audience_extended` / `marketing`)** : progression/complétion vidéo détaillée (zone grise — par prudence), sources d'acquisition UTM, attribution de campagnes, heatmaps/session replay, A/B tests, pixels publicitaires, GA4/PostHog éventuels.

### B.4 Spécification technique du collecteur first-party
- Script inline < 2 Ko, `navigator.sendBeacon` vers `/api/e` (même domaine).
- Identifiant : cookie first-party `als_aid` (UUID aléatoire), **durée fixe 13 mois non renouvelée** ; ou mode sans cookie (hash quotidien salé avec le domaine, rotation du sel chaque jour) — choisir un seul mode et le documenter.
- **Opposition** : bouton dans la politique de confidentialité → cookie `als_optout=1` (13 mois) → le script n'envoie plus rien ; respect du signal GPC recommandé.
- Serveur : rejet de tout champ non listé (liste blanche d'événements et de propriétés), suppression des paramètres d'URL (`?utm_*`, `gclid`, `fbclid`…), troncature IP **avant** toute écriture, version majeure du user-agent, aucun champ libre saisi par l'utilisateur.
- Stockage : table `analytics_events (id, ts, event, path, label, aid_hash, device, browser_major, os_major, country, city, referrer_host, value_ms)` ; purge quotidienne > **25 mois**.
- Tableau de bord admin : agrégats uniquement, **arrondis à la dizaine** pour les comptages par segment ; pas de vue « parcours d'un visiteur ».
- Documentation : remplir pour nous-mêmes le **modèle d'auto-évaluation CNIL** (annexe du PDF) et le conserver dans `docs/`.

---

## C. Gestionnaire de consentement
Spécification complète (catégories, stockage, journal de preuve, conservation, nouvelle demande à 6 mois, lien de retrait dans le pied de page, tests e2e) : voir **`06-conformite-juridique.md` §13**.

Résumé :
- Catégories : `necessary` (toujours), `audience_exempt` (actif, avec opposition), `audience_extended`, `media`, `marketing` (inactifs par défaut).
- Bandeau : « Tout accepter » / « Tout refuser » / « Personnaliser » au même niveau et même aspect (FAQ CNIL du 29/04/2026).
- Choix conservé **6 mois** (bonne pratique CNIL), expiration fixe, nouvelle demande ensuite ou si la politique change.
- Journal serveur `consent_log` : `consent_id` aléatoire, horodatage, action, choix par catégorie, `policy_version`, `banner_version`, source, langue, navigateur majeur ; conservation proposée 13 mois (**à valider**).
- Lien permanent « Gérer mes cookies » dans le pied de page ; lien d'opposition analytics dans la politique de confidentialité.

---

## Sources (consultées le 09/10/2026)
- Stripe, tarifs : https://stripe.com/fr/pricing
- Stripe, webhooks : https://docs.stripe.com/webhooks ; guide de sécurité : https://docs.stripe.com/security/guide
- PayPal, frais marchands France (MAJ 15/07/2026) : https://www.paypal.com/fr/business/paypal-business-fees
- Mollie, tarifs : https://www.mollie.com/fr/pricing
- CNIL, mesure d'audience (04/07/2025) : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience
- CNIL, outil d'auto-évaluation (juillet 2025) : https://www.cnil.fr/sites/default/files/2025-07/outil_d_auto-evaluation_mesure_d_audience.pdf
- CNIL, FAQ cookies (29/04/2026) : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ
- Matomo, configuration pour l'exemption CNIL (déclaration fournisseur) : https://matomo.org/faq/how-to/how-do-i-configure-matomo-without-tracking-consent-for-french-visitors-cnil-exemption/
- Plausible, article juridique (déclaration fournisseur) : https://plausible.io/blog/legal-assessment-gdpr-eprivacy

**Non vérifiés** : SumUp, Lydia Pro, Qonto (non comparés faute de grille consultée) ; tarifs Plausible/PostHog/Matomo Cloud ; certification DPF de Stripe, Google, Vercel ; mention SAQ A mot pour mot ; moyens de paiement exacts activables dans Stripe Checkout en France.
