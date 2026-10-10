# Livrable F — Coûts et viabilité

**Lecture** : « vérifié » = prix lu le 10/10/2026 dans une source citée. « À confirmer » = estimation ou source non officielle. Conversion USD→EUR supposée entre 0,85 et 0,95 (à confirmer au moment du paiement). Hors TVA sauf mention.

## Hypothèses d'usage
| Scénario | Utilisateurs actifs / mois | Reformulations IA / utilisateur / mois | Trafic |
|---|---|---|---|
| Prototype | ≤ 50 (équipe, testeurs) | 20 | négligeable |
| Lancement | ~500 | 30 | ~50 Go/mois |
| Croissance | ~20 000 | 30 (plafonné) | ~1–2 To/mois |

Le copilote **déterministe** fonctionne sans IA et sans coût variable. La reformulation IA est optionnelle : on peut la plafonner, la réserver à une offre payante ou la désactiver.

## Postes
| Poste | Fournisseur envisagé | Prix | Statut | Fixe | Variable | Risque de dépassement |
|---|---|---|---|---|---|---|
| Développement (outil) | Claude Pro (déjà utilisé) | ~18–22 €/mois TTC | à confirmer | oui | non | faible |
| Développement (humain) | Freelance / équipe | 400–700 €/jour en France | estimation à confirmer | — | 30–60 jours pour la mise en production : 12 k–42 k € | **élevé** (périmètre) |
| Hébergement | Vercel Pro (le plan Hobby est réservé à un usage non commercial) | 20 $/membre/mois, avec crédit d'usage inclus ; ~0,60 $ par million d'invocations au-delà (sources tierces) | à confirmer sur vercel.com/pricing | 20–60 $/mois | trafic, fonctions | moyen (WebSocket côté navigateur, donc pas de coût serveur) |
| Base de données | Aucune dans le MVP → Supabase Pro dès qu'il y aura des comptes | 25 $/mois/organisation, dont 10 $ de crédit compute (sources tierces) | à confirmer | 0 → 25 $ | stockage, egress, compute | moyen |
| Données de marché | API publique Coinbase Exchange | 0 € | gratuit et sans clé ; **conditions d'usage commercial à vérifier** | 0 | 0 | **élevé si la licence impose un fournisseur payant** |
| Données étendues (actualités, on-chain, multi-exchanges) | Fournisseurs sous licence (CoinGecko, Kaiko, Amberdata, agrégateurs d'actualités…) | de quelques dizaines à plusieurs milliers d'€/mois | à confirmer | selon offre | selon appels | **élevé** |
| IA (option A, défaut) | Claude Opus 5.5 | 4 $/M tokens en entrée, 20 $/M en sortie | vérifié (référence API Anthropic, 06/10/2026) | 0 | ~0,01–0,03 $ par reformulation (1 500 tokens en entrée, 300–800 en sortie) | moyen, plafonnable |
| IA (option B, économique) | Claude Haiku 5.5 | 0,10 $/M en entrée, 0,50 $/M en sortie | vérifié (même source) | 0 | ~0,0005 $ par reformulation | faible |
| Stockage | Navigateur (MVP) | 0 | — | 0 | 0 | nul |
| Monitoring | Logs Vercel (inclus) + Sentry | Sentry Team ~26 $/mois (sources tierces) ; offre gratuite pour développeur | à confirmer | 0–26 $ | volume d'événements | faible |
| Sécurité | Dependabot (gratuit) + test d'intrusion avant lancement | 3 k–10 k € par audit | estimation à confirmer | ponctuel | — | moyen |
| Juridique / réglementaire | Avocat spécialisé fintech/crypto | 3 k–15 k € pour l'analyse initiale | estimation à confirmer | ponctuel | — | **élevé** si le périmètre évolue vers du conseil ou des ordres réels |
| Domaine | Registraire | ~10–20 €/an | à confirmer | oui | — | nul |

## Scénarios mensuels (hors développement et frais ponctuels)
| Poste | Prototype | Lancement (~500 utilisateurs) | Croissance (~20 000 utilisateurs) |
|---|---|---|---|
| Hébergement | 0 € (Hobby, usage non commercial) – 20 $ | 20–60 $ | 60–400 $ (selon trafic et membres) |
| Base de données | 0 | 0–25 $ | 25–150 $ |
| Données de marché | 0 | 0 € (si licence OK) | 0 – plusieurs k€ (licence probable) |
| IA, Opus 5.5 (1 000 / 15 000 / 600 000 reformulations) | ~10–30 $ | ~150–450 $ | ~6 k–18 k $ |
| IA, Haiku 5.5 (mêmes volumes) | < 1 $ | ~5–10 $ | ~200–400 $ |
| Monitoring | 0 | 0–26 $ | 26–80 $ |
| **Total indicatif** | **~0–50 €** | **~50–550 €** | **~0,5 k–20 k €** (dominé par l'IA et les données) |

## Postes qui font varier le budget
1. **Choix du modèle IA et plafonds** : un facteur 30 à 40 entre Opus 5.5 et Haiku 5.5. Recommandation : garder le moteur déterministe comme cœur, puis mesurer la qualité des reformulations sur un échantillon avant de choisir. La variable `COPILOT_MODEL` permet de changer sans toucher au code.
2. **Licence des données de marché** : c'est le poste le plus incertain.
3. **Conformité réglementaire** si le produit franchit la frontière du conseil ou des ordres réels.
4. **Effectif développeur** (sièges Vercel, temps humain).

Sources consultées le 10/10/2026 (tierces, non officielles pour Vercel, Supabase et Sentry) : [Vercel Pro (docs)](https://examples.vercel.com/docs/accounts/plans/pro), [MakerKit — coût Vercel 2026](https://makerkit.dev/blog/saas/vercel-cost), [MakerKit — tarifs Supabase 2026](https://makerkit.dev/blog/saas/supabase-pricing), [Toolradar — Supabase 2026](https://toolradar.com/blog/supabase-pricing-2026), [Costbench — Sentry](https://costbench.com/software/developer-tools/sentry), [Toolradar — Sentry](https://toolradar.com/tools/sentry/pricing).
