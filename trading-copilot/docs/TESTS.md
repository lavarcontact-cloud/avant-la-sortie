# Livrable E — Tests et preuves (exécutés le 10/10/2026)

## Résultats réels
| Vérification | Commande | Résultat |
|---|---|---|
| Typage strict (app + fonctions serveur) | `npx tsc -b` | ✅ 0 erreur |
| Lint | `npx eslint .` | ✅ 0 erreur, 3 avertissements « fast refresh » (sans effet en production) |
| Tests unitaires | `npm test` | ✅ **74 / 74** (4 fichiers) |
| Tests de bout en bout (Chromium, desktop 1360×900 + Pixel 7, **sous la CSP de production**) | `npm run build && npm run e2e` | ✅ **14 / 14** en 17,7 s |
| Dépendances | `npm audit` | ✅ 0 vulnérabilité (après la mise à jour vers vite 8 / vitest 5 ; avant : 6 alertes, toutes dans l'outillage de dev) |
| Build | `npm run build` | ✅ |

### Couverture fonctionnelle des tests unitaires
- **Registre** : prix moyen pondéré, frais, P&L réalisé et frais au prorata, identité comptable `capital = initial + réalisé + latent − frais`, spread et glissement, refus (liquidités, découvert, cotation périmée, quantités invalides, cotation absente), ordres limite (réservation, gap d'ouverture, libération, annulation, temps réel), rejeu déterministe, conservation du stop d'un ordre au marché (régression trouvée en revue visuelle).
- **Risque** : taille de position (perte au stop = risque visé, frais inclus), plafonnement, stop invalide, gap, drawdown, stress test, exposition, contrôles de limites, VaR (refus sous 30 observations).
- **Indicateurs** : SMA/EMA/RSI/ATR/Donchian/corrélation ; **absence de regard vers le futur** (modifier les données après l'index i ne change rien avant i).
- **Données** : provenance du snapshot, continuité journalière, exclusion de la bougie en cours, conversion du format Coinbase, analyse du message `ticker` documenté, fraîcheur.
- **Radar** : détection et règle exposée, silence sur série calme, invalidation de scénario, spread, tri, déduplication des conditions persistantes.
- **Backtest** : achat-conservation sans coût = rendement de l'actif, les coûts réduisent toujours la performance, exécution à t+1, découpage sans chevauchement, protocole complet sur données réelles.
- **Objectif / bilan / persistance / exercices**.
- **Copilote** : 10 intentions classées, abstention sans source d'actualités, chiffres du choc identiques au moteur, refus du conseil personnalisé, aucune « probabilité ».
- **Garde-fou IA et API** : extraction des nombres au format français, rejet d'une reformulation qui invente un chiffre, proxy en liste blanche, erreurs sans fuite, validation des entrées, corps trop volumineux, refus du modèle, limitation de débit, paramètres envoyés (`fallbacks: 'default'`, `effort: 'low'`) — **avec un client simulé**.

### Parcours de bout en bout
1. Accueil : acquittement obligatoire ; bannière « Simulation » ; **repli honnête** : sans réseau vers Coinbase, la pastille indique « Snapshot » et les ordres sont bloqués.
2. Replay : achat avec stop, confirmation de dépassement de limite, frais affichés, positions, avance de 5 séances, bilan, historique.
3. Copilote : 7 sections, abstention, IA indiquée « indisponible », refus du conseil.
4. Objectif 100 000 € en 90 jours → « Hors de tout ce qui a été observé ».
5. Backtest dans un Web Worker.
6. Fil avec fin explicite ; radar avec seuils.
7. Les 8 écrans : **aucun débordement horizontal, aucune erreur console**.

## Problèmes trouvés et corrigés pendant la vérification
| Problème | Détecté par | Correction |
|---|---|---|
| L'intention « conseil » captait « Quels frais dois-je payer ? » | test unitaire | expression régulière restreinte aux verbes d'action |
| Bouton « Commencer » inatteignable sur mobile, page dézoomée (barre supérieure de 431 px pour 412 px d'écran) | test E2E mobile + diagnostic | barre supérieure adaptative ; défilement de la fenêtre d'accueil |
| Polices bloquées par la CSP (intégrées en `data:` par Vite) | test E2E « aucune erreur console » | `font-src 'self' data:` |
| Stop d'un ordre au marché perdu, le bilan affichait « Aucun stop » | revue visuelle des captures | stop porté par l'exécution + test de régression |
| Nombres au format anglais dans certains messages | revue visuelle | formatage `fr-FR` |
| Alertes « marché calme » répétées chaque jour | sonde sur données réelles | seule l'apparition d'une condition est signalée |

## Performances mesurées
Mesures locales (`vite preview`, Chromium sans bridage réseau ni CPU : **pas représentatives d'un mobile 4G**).

| Mesure | Desktop | Mobile (Pixel 7 émulé) |
|---|---|---|
| DOMContentLoaded | 52 ms | 45 ms |
| LCP | 280–696 ms (2 mesures) | 192–200 ms |
| JS transféré au chargement | 92 Ko | 92 Ko |
| Total transféré au chargement | 221 Ko | 221 Ko |
| Bundle initial (gzip) | 91,5 Ko, dont React + moteur + snapshot réel (~40 Ko brut) | — |
| Graphiques (chargés à la demande, gzip) | 51 Ko | — |
| Protocole de backtest complet (9 configurations, Worker) | 4–5 ms | 4 ms |
| Tâches longues au chargement | 1 × 50–55 ms | 0–1 × 50 ms |

## Sécurité — constats
- ✅ Aucun secret dans le client ; clé IA uniquement côté serveur (absente ici).
- ✅ CSP stricte vérifiée par E2E (aucune violation), en-têtes de sécurité dans `vercel.json`.
- ✅ Proxy en liste blanche (pas de SSRF), erreurs génériques, délais d'expiration.
- ✅ Stockage local validé au chargement (données corrompues rejetées, test).
- ⚠️ La limitation de débit est en mémoire et par instance : insuffisante en production multi-instance → règles du pare-feu Vercel ou store partagé.
- ⚠️ Pas d'authentification : acceptable tant qu'aucune donnée n'est stockée côté serveur.
- ⚠️ `style-src 'unsafe-inline'` nécessaire aux styles en ligne ; risque faible (pas de script inline autorisé).

## Non testé (limites honnêtes)
- **Flux temps réel Coinbase réel** (REST, WebSocket, CORS) : le réseau du conteneur bloque ces hôtes. Seuls le format documenté et le repli ont été testés.
- **Appel réel à l'API Claude** : aucune clé. Testé avec un client simulé uniquement.
- **Fonctions Vercel déployées** : testées comme fonctions locales, pas sur la plateforme.
- Navigateurs autres que Chromium ; lecteurs d'écran réels ; performance sur appareil bas de gamme ou réseau lent.

## Reproduire
```bash
cd trading-copilot
npm ci
npx tsc -b && npx eslint . && npm test
npm run build && npm run e2e     # PW_CHROMIUM=/chemin/chromium si nécessaire
npm audit
```
