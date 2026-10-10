# Livrable C — Architecture technique

## Principes
1. **Le moteur financier est pur et séparé** : aucune dépendance au DOM, au réseau ou à React (`src/engine/`). Il est testé seul.
2. **Le copilote consomme le moteur** : il ne calcule rien par génération de texte. Un modèle de langage, s'il est activé, ne fait que reformuler une analyse déjà calculée, et un garde-fou rejette tout nombre absent de cette analyse.
3. **Aucune donnée inventée** : temps réel (Coinbase), sinon snapshot réel horodaté, sinon abstention. Jamais de données synthétiques présentées comme réelles.
4. **Simplicité** : SPA statique + 2 fonctions serveur. Pas de base de données, de microservice ni de cache distribué tant qu'il n'y a ni comptes ni données partagées.

## Structure
```
trading-copilot/
├─ api/                      Fonctions serveur Vercel (Node, API Web Request/Response)
│  ├─ _lib.ts                JSON, limitation de débit en mémoire, journal structuré
│  ├─ candles.ts             Proxy lecture seule Coinbase (liste blanche, cache CDN 60 s)
│  └─ copilot.ts             Reformulation IA optionnelle (SDK Anthropic) + garde-fou
├─ src/
│  ├─ engine/                Moteur déterministe
│  │  ├─ types.ts            Types, hypothèses d'exécution et limites par défaut
│  │  ├─ ledger.ts           Journal d'événements, ordres marché/limite, valorisation
│  │  ├─ risk.ts             Taille de position, gap, exposition, drawdown, stress, VaR, limites
│  │  ├─ indicators.ts       SMA, EMA, RSI, ATR, Donchian, volatilité, corrélation
│  │  ├─ radar.ts            Détecteurs documentés, invalidation de scénarios
│  │  ├─ backtest.ts         Exécution t+1, coûts, liquidité, protocole train/valid/test
│  │  ├─ goal.ts             Calculateur d'objectif vs historique
│  │  └─ debrief.ts          Bilan par règles explicites
│  ├─ copilot/               Copilote déterministe (intentions → sections) + garde-fou numérique
│  ├─ data/                  Snapshot réel (JSON + provenance), client REST/WebSocket
│  ├─ state/                 Store React, persistance validée, exercices de replay
│  ├─ workers/               Backtest hors fil principal
│  ├─ ui/ & screens/         Interface (8 écrans, code-splitting)
├─ e2e/                      Tests Playwright (desktop + mobile)
└─ docs/                     Livrables
```

## Modèle de données
Tout est **événementiel** et local (navigateur) :

| Entité | Champs clés | Remarque |
|---|---|---|
| `LedgerEvent` | `init` (capital, hypothèses d'exécution) · `place` (ordre) · `fill` (prix, prix de référence, frais, coût implicite, source de la cotation, horodatage) · `cancel` | L'état est TOUJOURS reconstruit par `replay(events)` : audit et reproductibilité |
| `LedgerState` (dérivé) | liquidités, liquidités bloquées, positions (qté, prix moyen, qté bloquée, stop), ordres ouverts, opérations clôturées, réalisé brut, frais, coûts implicites | Jamais stocké, toujours recalculé |
| `Persisted` (v1) | profil (niveau, couleur, actifs suivis, consentement mémoire), limites, hypothèses d'exécution, livre temps réel, livre replay, scénarios, quiz | Validé au chargement ; `localStorage` seulement avec consentement, sinon `sessionStorage` |
| `Series` | bougies clôturées, bougie partielle, source, `fetchedAt`, `kind` (live/snapshot) | La bougie en cours est exclue des indicateurs |

Identités vérifiées par les tests : `capital = initial + réalisé brut + latent − frais` ; prix moyen pondéré ; frais d'entrée imputés au prorata des ventes.

## Contrats d'API
`GET /api/candles?product=BTC-EUR|ETH-EUR&granularity=86400|3600`
→ `200 {product, granularity, source, fetchedAt, candles: [[t, low, high, open, close, volume], …]}` · `400` paramètre hors liste blanche · `429` · `502/504` source indisponible (sans détail interne). Cache `s-maxage=60`.

`GET /api/copilot` → `{llm: boolean, model: string|null}`
`POST /api/copilot` `{question ≤ 500 car., level: debutant|confirme|expert, answer: Answer}` → `{text, model}` ou `{fallback: true, reason, invented?}` · `400/413/429/503`. Limite : 10 req/min/IP (en mémoire, par instance).

Source temps réel (navigateur) : `wss://ws-feed.exchange.coinbase.com`, canal `ticker` (format vérifié dans la documentation Coinbase le 10/10/2026) ; REST `GET /products/{id}/candles`.

## Moteur financier — règles d'exécution
- **Marché** : prix = (ask, sinon dernier × (1 + spread/2)) × (1 + glissement) à l'achat ; symétrique à la vente. Refus si la cotation a plus de 30 s.
- **Limite** : réserve liquidités (prix × qté × (1 + frais)) ou quantité. En replay, exécuté sur la bougie suivante si le bas (achat) / le haut (vente) touche la limite, au meilleur entre limite et ouverture (gestion des gaps). En temps réel, sur ask ≤ limite / bid ≥ limite.
- **Frais** : taux unique par exécution (paramètre, défaut 0,6 %, *non vérifié auprès d'une plateforme*).
- **Interdits** : levier, vente à découvert, quantités > 8 décimales, montants non finis.

## Copilote
`classify` (règles regex FR, testées) → fonction par intention → `Answer` en 7 sections (faits, données, hypothèses, scénarios, risques/invalidation, incertitude, horodatage). Abstention explicite sans source (actualités, événements). Refus encadré des demandes de conseil personnalisé. Humeur de l'avatar dérivée de l'état réel (fraîcheur, limites, alertes).

## Données, cache, mises à jour
- Historique : REST direct → proxy `/api/candles` → snapshot réel (BTC-EUR, ETH-EUR, 350 jours, collecté le 10/10/2026 13:20 UTC).
- Cotations : WebSocket, reconnexion exponentielle (1 s → 30 s, gigue ±20 %, abandon après 8 essais), limitation à 4 mises à jour/s/actif.
- Fraîcheur : < 15 s = temps réel ; < 120 s = retardé ; au-delà = périmé → ordres bloqués, avatar en réserve.
- Le replay et le backtest utilisent toujours le snapshot figé : résultats reproductibles.

## Sécurité
- Aucun secret côté client ; `ANTHROPIC_API_KEY` uniquement côté serveur.
- En-têtes (`vercel.json`) : CSP stricte (`connect-src` limité à Coinbase), `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Proxy sans relais arbitraire (liste blanche), délais d'expiration, erreurs génériques.
- Entrées validées côté serveur (taille, types, énumérations) ; stockage local validé au chargement.
- Aucune authentification dans le MVP : aucune donnée utilisateur côté serveur, donc pas de surface IDOR. **À ajouter avant tout stockage serveur** : authentification, autorisations par ligne (RLS), tests d'isolation.
- Jamais de demande de seed phrase, clé privée ou mot de passe d'exchange.

## Tests et déploiement
- `npm test` : Vitest (moteur, copilote, garde-fou, API avec client simulé).
- `npm run e2e` : Playwright (Chromium, desktop 1360×900 + Pixel 7).
- Déploiement cible : projet Vercel dédié avec *Root Directory* = `trading-copilot` (build `npm run build`, sortie `dist`, fonctions `api/`). Variables : `ANTHROPIC_API_KEY` (optionnelle), `COPILOT_MODEL` (optionnelle, défaut `claude-opus-5-5`).
