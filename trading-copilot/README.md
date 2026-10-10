# Vigie — simulateur et copilote crypto explicable (MVP)

Application éducative : simulation de trading avec argent **fictif**, copilote qui sépare faits et hypothèses, radar à règles documentées, backtest avec protocole anti-surapprentissage, calculateur d'objectif honnête.

> Aucun ordre réel, aucun conseil personnalisé. Les crypto-actifs peuvent perdre toute leur valeur.

## Démarrer
```bash
cd trading-copilot
npm install
npm run dev          # http://localhost:5173
npm test             # tests unitaires (moteur, copilote, API)
npm run build && npm run e2e   # tests de bout en bout (Chromium, desktop + mobile)
npm run check        # typage + lint + tests unitaires
```
Variables d'environnement serveur (optionnelles) : `ANTHROPIC_API_KEY` (active la reformulation IA), `COPILOT_MODEL` (défaut `claude-opus-5-5`).

## Données
- Temps réel : API publique Coinbase Exchange (REST + WebSocket), sans clé.
- Repli : snapshot **réel** BTC-EUR / ETH-EUR (350 jours, collecté le 10/10/2026 13:20 UTC), avec source et horodatage dans `src/data/snapshot/*.json`.
- Aucune donnée synthétique n'est présentée comme réelle.

## Documentation
`docs/AUDIT.md` (A) · `docs/SPEC.md` (B) · `docs/ARCHITECTURE.md` (C) · `docs/TESTS.md` (E) · `docs/COSTS.md` (F) · `docs/REGULATION.md`

## Déploiement
Projet Vercel dédié, *Root Directory* = `trading-copilot`. Le site racine du dépôt ignore ce dossier (`.vercelignore`).
