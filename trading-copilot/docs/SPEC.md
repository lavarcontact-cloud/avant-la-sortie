# Livrable B — Spécification fonctionnelle (MVP)

## Utilisateurs cibles
| Profil | Besoin | Ce que Vigie lui apporte |
|---|---|---|
| Débutant complet | Comprendre sans risquer d'argent | Argent fictif, mini-cours, quiz, explications pas à pas, refus de « conseils » |
| Investisseur occasionnel | Mesurer frais et risques | Estimation des coûts avant chaque ordre, taille de position, stress test |
| Trader expérimenté | Tester une idée vite et honnêtement | Replay sans regard vers le futur, backtest avec protocole, radar à règles explicites, exports |

## Parcours
**Débutant** : accueil (niveau, consentement mémoire, acquittement « simulation éducative ») → Cockpit (capital fictif, Vigie explique l'état des données) → Fil (mini-cours, quiz, exercice « Le choc de février 2026 ») → Replay : ordre avec stop, « Taille selon mon risque » → séances suivantes → Bilan (décisions efficaces / à corriger).
**Professionnel** : Marché (chandeliers, SMA 50, canal 20 j) → Radar (règles et mesures) → scénario surveillé avec niveau d'invalidation → Espace pro (protocole de backtest, sensibilité, stress test) → export JSON/CSV.

## Inclus dans le MVP
- Cockpit : capital, liquidités disponibles/bloquées, réalisé brut / latent / frais séparés, coûts implicites, courbe net vs brut vs BTC acheté-conservé, repli, exposition, concentration, positions, historique horodaté avec source de chaque prix.
- Simulation : temps réel (si cotations fraîches) et replay historique (4 exercices sur données réelles) ; ordres marché et limite, annulation, frais, spread, glissement ; contrôle des limites avec confirmation explicite ; remise à zéro.
- Copilote Vigie : 12 intentions, réponses en 7 sections, abstention, refus du conseil personnalisé, avatar dont l'humeur dépend de l'état réel ; reformulation IA optionnelle sous garde-fou.
- Radar : 9 détecteurs documentés + invalidation de scénarios ; hiérarchisation ; une condition persistante n'alerte qu'une fois ; masquage.
- Fil : cartes ordonnées par importance pour l'utilisateur, fin explicite (« Tu es à jour »).
- Espace pro : backtest (2 stratégies + référence), protocole 60/20/20, sensibilité, outils de risque, exports.
- Objectif : calculateur confronté aux fenêtres historiques, levier implicite, risque de ruine.

## Reporté (et pourquoi)
| Fonction | Raison |
|---|---|
| Actualités vérifiées, calendrier, on-chain | Aucune source fiable et licenciée connectée ; ne pas afficher de contenu non sourcé |
| Comptes, synchronisation multi-appareils | Nécessite authentification, RGPD complet, base de données |
| Connexion exchange (lecture seule) | Sécurité des clés API, analyse réglementaire |
| Ordres réels | Hors périmètre : service réglementé (MiCA), voir REGULATION.md |
| Stop exécuté automatiquement | Le stop sert au calcul du risque et au bilan ; l'exécution auto viendra avec un moteur d'ordres conditionnels testé |
| Notifications push | Risque d'urgence artificielle ; à concevoir avec plafonds et heures calmes |
| Autres marchés (actions, FX) | Données sous licence payante |

## États d'interface
| État | Comportement |
|---|---|
| Chargement | Snapshot affiché immédiatement, remplacé si le temps réel répond ; écrans paresseux avec indicateur « Chargement… » |
| Temps réel indisponible | Pastille rouge « Snapshot · date », ordres bloqués avec explication, replay proposé |
| Données retardées (15–120 s) | Pastille orange ; ordres marché encore permis jusqu'à 30 s d'ancienneté de cotation |
| Données manquantes (un actif) | Valeur exclue du total, avertissement explicite |
| Stockage local corrompu | Nouvelle simulation + message |
| IA non configurée | Bouton désactivé « Reformulation IA indisponible » |
| Reformulation qui invente un chiffre | Rejetée, message, version vérifiée conservée |

## Règles de calcul
- Taille de position : `q = C × r ÷ [(E − S) + f × (E + S)]` (sans gap ; risque de gap affiché séparément).
- P&L : réalisé brut `(sortie − prix moyen) × q` ; frais d'entrée imputés au prorata ; net = brut − frais.
- Drawdown : `valeur / plus haut − 1`. Concentration : indice de Herfindahl des poids (liquidités incluses).
- VaR historique 95 % : quantile empirique, refusée sous 30 observations.
- Objectif : `(O/C)^(1/mois) − 1` ; frais `1 − (1 − f)^(transactions)` ; comparaison aux rendements glissants sur la même durée (fréquence, pas probabilité).
- Aucun « score » ni « probabilité de gain » : pas de calibration disponible.

## Données et coûts
| Besoin | Source | Coût |
|---|---|---|
| Cours BTC/ETH en EUR, historique et temps réel | API publique Coinbase Exchange | 0 € (sans clé, limites de débit publiques ; conditions d'usage à valider pour un usage commercial) |
| Reformulation IA | API Claude (optionnelle) | Variable, voir COSTS.md |
| Actualités / on-chain | Non branché | À budgéter (fournisseurs sous licence) |
