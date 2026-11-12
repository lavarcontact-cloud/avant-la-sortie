# Statut

Légende : ✅ fonctionnel et testé · 🟡 développé, non testé en conditions réelles · 🔌 nécessite une API / clé · 🔐 nécessite une autorisation externe · ⏳ à développer

## Phase 1 — CRM et gestion commerciale
- ✅ Accès privé, CRM marques / interlocuteurs, pipeline 17 statuts, historique, recherche globale
- ✅ Préparation des messages, démarches, relances limitées, réponses + classification par règles corrigeable
- ✅ Notifications internes, dashboard (périodes Aujourd'hui / 7 / 30 / 90 j / personnalisée), secteurs, interlocuteurs, heatmap
- ✅ Prestations, gifting hors CA, dépenses, devis / factures PDF numérotés, blocage sans mentions légales
- ✅ Site public, Media Kit, formulaire de collaboration, export JSON, journal d'audit
- ⏳ Avoirs (factures rectificatives)

## Phase 2 — intelligence commerciale
- ✅ Migration additive `002_intelligence.sql` (testée sur base neuve et sur une base existante contenant des données : aucune perte)
- ✅ Veille : import manuel → déduplication, signaux, exclusions éthiques, score /100 détaillé, profils publics, changements de poste détectés, filtres (secteur, collaboration, qualité du contact, score, découvertes du jour)
- ✅ Préparation multi-sélection et validation une par une vers le CRM (interlocuteur sourcé, case « j'ai vérifié »)
- 🟡 🔌 Veille **automatique** quotidienne via Firecrawl Search : code en place et testé avec une réponse API simulée en test unitaire, **jamais exécuté contre l'API réelle** (clé `FIRECRAWL_API_KEY` absente). Sans clé, la veille s'arrête avec le statut « skipped » — rien n'est simulé
- ✅ Business Forecast : contrats potentiels / probables / signés, CA potentiel / pondéré / facturé / encaissé, 3 scénarios avec hypothèses, confiance et risques, projection mensuelle, secteurs, tendance, recommandations
- ✅ Historique quotidien des prévisions (bouton + tâche planifiée)
- 🟡 Apprentissage (comparaison prévu / réel, facteur d'ajustement) : testé en unitaire avec des historiques fictifs ; en réel, il faudra au moins un mois complet de prévisions archivées
- ✅ Audience Value : comptes par entité séparés, relevés manuels et CSV avec source, engagement + formule, grille tarifaire production + diffusion, potentiel théorique / accessible / réalisé, projection 6 mois provisoire sans croissance inventée
- ✅ Bilans matin / midi / soir enrichis (veille, prévision du jour, tendance, secteurs, recommandations)

## Nécessite une API, une clé ou une autorisation
- 🔌 `FIRECRAWL_API_KEY` : veille automatique quotidienne (compte Firecrawl, payant à l'usage)
- 🔐 Statistiques sociales automatiques : API Instagram Graph (compte Business + app Meta validée), TikTok Business API, YouTube Analytics (OAuth Google), Snapchat : non connectées. Aujourd'hui : saisie ou import CSV de vos exports
- 🔐 Gmail OAuth (détection des réponses) : non développé
- 🔌 Clés VAPID (push) ; `CRON_SECRET` + planificateur ; `DATABASE_URL` Supabase et hébergement : non configurés, rien n'a été déployé

## À développer
- ⏳ Assistant IA (rédaction contextualisée, résumé d'activité d'une marque) — les messages actuels sont des modèles personnalisés par les signaux et vos données
- ⏳ Connexions API sociales officielles et Gmail
- ⏳ Avoirs, propositions commerciales avancées, Media Kit dynamique alimenté par les relevés
