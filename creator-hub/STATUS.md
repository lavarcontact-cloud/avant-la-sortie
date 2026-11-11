# Statut — MVP

## Fonctionnel et testé (tests unitaires + test navigateur de bout en bout)
- Accès privé par mot de passe, session signée, routes protégées, limitation des tentatives
- CRM marques : création, fiche, modification, suppression, filtres (secteur, statut, collaboration, pays, ville, taille, type, score), tri
- Charte éthique : refus des secteurs exclus (casino, trading/forex/CFD, MLM, crypto spéculative, promesses financières)
- Interlocuteurs : ajout avec source obligatoire, opposition (liste d'opposition + arrêt des relances), suppression
- Préparation des messages (email, DM Instagram, LinkedIn, relance, idée UGC) personnalisés uniquement avec les données saisies, champs manquants signalés, copie en un clic
- Démarches : enregistrement, relance planifiée (J+7 par défaut), page Relances, limite de relances
- Réponses : saisie, rapprochement automatique avec la dernière démarche, classification par règles + intentions + confiance, reclassement manuel, effets sur le pipeline
- Notifications internes : réponse positive (mise en avant), demande de tarifs / Media Kit / RDV / partenariat, refus, opposition, facture payée / en retard, relances du jour, demandes entrantes
- Dashboard : KPIs avec comparaison 7 / 30 / 90 jours / période personnalisée, argent, performance par secteur, interlocuteurs, heatmap des meilleurs moments (taux, pas volume)
- Prestations et gifting (valeur séparée du CA), dépenses, porte-monnaie, revenus par prestation
- Devis et factures : lignes, remises, TVA multi-taux ou franchise (art. 293 B), acompte, numérotation séquentielle à l'émission, blocage sans mentions légales, PDF (aperçu + téléchargement), email d'envoi préparé, statuts, paiement partiel / total
- Bilans matin / midi / soir via endpoint planifiable protégé, pas de bilan sans changement
- Site public + Media Kit + formulaire de collaboration (→ notification + création de fiche CRM)
- Export JSON complet, journal d'audit, recherche globale

## Fonctionnel mais non testé en conditions réelles
- Connexion à PostgreSQL / Supabase via `DATABASE_URL` (même SQL que PGlite, testé uniquement sur PGlite)
- Mise en page mobile : vérifiée visuellement sur le site public et le dashboard (iPhone 13, sans débordement) ; autres pages privées non vérifiées sur mobile
- Factures en retard détectées automatiquement par la tâche planifiée

## En attente de configuration
- Hébergement (Vercel) + base Supabase : variables `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`
- Bilans planifiés : `CRON_SECRET` + secrets GitHub `HUB_URL` / `CRON_SECRET` (workflow fourni)
- Notifications push : clés VAPID (le code d'abonnement et d'envoi est en place, jamais testé de bout en bout)
- Vos informations légales, votre profil, vos statistiques vérifiées

## Prévu pour une phase ultérieure (roadmap)
1. Brand Finder enrichi (recherche assistée de marques et de pages officielles)
2. Qualification / scoring assisté
3. Intégration Gmail OAuth (lecture des réponses, rapprochement automatique) — jamais de mot de passe stocké
4. Détection automatique des réponses depuis la boîte mail
5. Notifications push réelles (après configuration VAPID)
6. Rapports planifiés envoyés en push / email
7. Assistant IA de prospection (rédaction, idées de campagnes), toujours avec validation humaine
8. Propositions commerciales avancées
9. Media Kit dynamique (statistiques importées des plateformes)
10. Automatisations et analyses avancées
