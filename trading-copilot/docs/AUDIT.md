# Livrable A — Audit initial (10/10/2026)

## État réel du dépôt (faits vérifiés)
- `lavarcontact-cloud/avant-la-sortie`, branche `main`, arbre propre. **Contenu : site statique de candidature** (`index.html` de 86 Ko, ~31 Mo de médias, `vercel.json`, `HANDOFF.md`). Aucun code fintech, aucun `package.json`, aucun test, aucune CI.
- Déploiement : Vercel en statique (`cleanUrls`). Aucune variable d'environnement applicative.
- Décision : **ne pas toucher au site existant**. Le MVP vit dans `trading-copilot/`, sur la branche `claude/trading-copilot-mvp`. Recommandation : dépôt et projet Vercel dédiés (voir « Décisions incertaines »).

## Ressources disponibles (vérifiées)
| Ressource | Statut | Usage |
|---|---|---|
| Node 22, npm, pnpm, Python 3.13 | disponibles | build, tests |
| Chromium + Playwright | disponibles (`/opt/pw-browsers`) | tests de bout en bout desktop et mobile |
| Réseau du conteneur vers Coinbase, Binance, Kraken, CoinGecko | **bloqué (403 proxy)** | impossible de tester le temps réel ici |
| Firecrawl (MCP) | disponible | a permis de collecter **350 bougies journalières réelles** BTC-EUR et ETH-EUR (Coinbase) et de vérifier la documentation WebSocket |
| Recherche web | disponible | prix et réglementation (sources citées) |
| Clé API IA pour l'application | **absente** | copilote déterministe ; adaptateur LLM prêt mais désactivé |
| Source d'actualités vérifiée | **absente** | aucune actualité affichée (abstention explicite) |
| MCP Vercel, Supabase, GitHub | disponibles | non utilisés pour des actions externes sans accord (déploiement, création de projet) |

## Contraintes
- Pas de temps réel testable depuis le conteneur. Le code temps réel (WebSocket, REST, proxy) est écrit et testé unitairement sur le format documenté, **mais pas contre le service réel**.
- L'application doit fonctionner sans clé ni base de données : architecture côté client, journal local.

## Risques majeurs
1. **Réglementaire** : la frontière entre outil d'analyse et conseil personnalisé (MiCA, MiFID II). → Refus explicite du conseil, simulation uniquement. Voir REGULATION.md.
2. **Confiance** : des chiffres inventés par un LLM. → Moteur déterministe, garde-fou numérique côté serveur.
3. **Données** : licence d'usage commercial des API publiques ; CORS non vérifié depuis un navigateur. → Proxy serveur de repli et snapshot réel.
4. **Message marketing « 100 000 € en 3 mois »** : présenté uniquement dans un calculateur qui en démontre l'irréalisme (×230 de levier requis, données réelles).
5. **Surapprentissage** dans le backtest. → Protocole chronologique et avertissements automatiques.

## Choix d'architecture
| Choix | Justification |
|---|---|
| Vite + React + TypeScript (SPA) | Chargement rapide, code-splitting, hébergement statique ; pas besoin de rendu serveur |
| Moteur pur en TS | Testable, réutilisable côté serveur, indépendant de l'IA |
| Journal d'événements local | Auditabilité et reproductibilité, sans base de données |
| lightweight-charts (Apache 2.0) | Graphiques financiers performants, chargés à la demande |
| Web Worker pour le backtest | Fil principal libre |
| 2 fonctions Vercel | Seulement ce qui exige un serveur (secret IA, CORS/cache) |
| Polices auto-hébergées | Pas d'appel à Google Fonts (RGPD) |

## Décisions incertaines (à trancher par vous)
- Dépôt dédié vs sous-dossier de ce dépôt (recommandé : dépôt dédié).
- Activation de la reformulation IA et choix du modèle (coût ×30 à ×40 entre Opus 5.5 et Haiku 5.5).
- Fournisseur de données sous licence pour le lancement public.

## Plan priorisé (réalisé dans cette session)
1. Données réelles + moteur financier + tests ✅
2. Simulation (temps réel et replay) ✅
3. Cockpit, fil, radar ✅
4. Copilote + garde-fou IA ✅
5. Espace pro (backtest, risque, exports), objectif ✅
6. Tests E2E, sécurité, performance, documentation ✅ (voir TESTS.md)
