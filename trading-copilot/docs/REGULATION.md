# Analyse réglementaire préliminaire (France / UE)

> Ce document est une cartographie des questions, **pas un avis juridique**. Un avertissement affiché ne rend pas un produit conforme. Les points marqués ⚖️ exigent la validation d'un avocat spécialisé avant tout lancement public.

## Ce que fait le MVP — et ce qu'il ne fait pas
| Activité | MVP | Qualification probable |
|---|---|---|
| Éducation financière (cours, quiz, définitions) | Oui | Hors services réglementés |
| Outils d'analyse génériques (indicateurs, radar à règles publiques, calculateurs) | Oui | En principe hors service réglementé tant que non personnalisés ⚖️ |
| Simulation avec argent fictif | Oui | Hors service sur actifs (aucun actif, aucun ordre réel) ; attention à la communication (voir plus bas) |
| Recommandation personnalisée (« achète X ») | **Non, refusée explicitement** | Conseil en crypto-actifs = service sur crypto-actifs (MiCA, art. 3(1)(16)(h)) ; conseil en investissement pour instruments financiers (MiFID II) |
| Réception-transmission / exécution d'ordres | Non | Services MiCA (art. 3(1)(16)(c), (g)) |
| Conservation | Non | Service MiCA (art. 3(1)(16)(a)) |

## Points de vigilance
1. **Frontière entre analyse générique et conseil personnalisé** ⚖️ — Le copilote croise des données de marché avec le portefeuille simulé et les limites de l'utilisateur (ex. « Le risque dépasse ta limite »). Il se limite volontairement à des calculs sur des paramètres choisis par l'utilisateur, refuse de dire quoi acheter, et ne connaît pas sa situation financière réelle. La qualification doit être confirmée, surtout si le produit évolue vers des comptes réels.
2. **MiCA et régime français** — En France, la période transitoire permettant aux PSAN enregistrés d'opérer sans agrément MiCA a pris fin le **1er juillet 2026** (communication AMF). Toute fonction future de transmission d'ordres, d'exécution, de conservation ou de conseil sur crypto-actifs exigerait un agrément de prestataire de services sur crypto-actifs (CASP), ou un partenariat avec un CASP agréé ⚖️.
3. **Communication et publicité** — Le Code de la consommation encadre la publicité en faveur des services sur actifs numériques, et la loi n° 2023-451 encadre l'influence commerciale ⚖️. Le scénario « 100 000 € en trois mois » ne doit **jamais** être présenté comme un objectif atteignable. Dans le produit, il n'apparaît que dans un calculateur qui démontre son irréalisme.
4. **Marchés connexes (actions, ETF, dérivés)** — Les recommandations d'investissement sont encadrées par MAR (art. 20) et le conseil par MiFID II. Les CFD et produits à effet de levier font l'objet de restrictions de commercialisation ESMA/AMF pour les clients de détail ⚖️.
5. **IA** — Le règlement (UE) 2024/1689 (AI Act) impose des obligations de transparence aux systèmes qui interagissent avec des personnes : l'interface indique qu'une réponse est calculée ou reformulée par IA. La classification exacte du produit est à confirmer ⚖️.
6. **Données personnelles (RGPD)** — Le MVP ne collecte rien côté serveur. La mémoire locale exige un consentement et peut être révoquée. La reformulation IA transmet la question et l'analyse à un sous-traitant (Anthropic), ce qui exige une information des utilisateurs, un DPA, et une analyse des transferts hors UE avant activation ⚖️.
7. **Données de marché** — Les conditions d'utilisation de l'API Coinbase pour un usage commercial et un affichage public doivent être vérifiées ⚖️. Il en va de même pour la licence de chaque futur fournisseur d'actualités.
8. **Accessibilité** — Si le service est commercialisé, la directive (UE) 2019/882 (European Accessibility Act, applicable depuis juin 2025) peut s'appliquer à certains services bancaires et financiers grand public. Le MVP suit les bonnes pratiques WCAG, sans audit formel.

## Questions à soumettre à un avocat avant lancement public
1. Le copilote, qui croise le portefeuille simulé et les limites choisies par l'utilisateur, constitue-t-il un « conseil » au sens de MiCA ou de MiFID II ?
2. Quelles mentions et quel format faut-il pour l'avertissement de risque, l'information sur la simulation et les performances passées ?
3. Quel cadre s'applique à une future connexion d'exchange en lecture seule (données de compte réelles) ?
4. Quel modèle de monétisation (abonnement, affiliation à un exchange) est compatible avec la publicité sur actifs numériques et l'absence de conflit d'intérêts ?
5. Quelles conditions contractuelles et quelle base RGPD retenir pour le traitement IA via un fournisseur américain ?

Sources consultées le 10/10/2026 : [AMF — fin de la période transitoire le 1er juillet 2026](https://www.amf-france.org/en/news-publications/news/amf-reminds-digital-asset-service-providers-transitional-period-allowing-them-continue-providing) ; [De Gaulle Fleurance — fin de la période transitoire MiCA](https://www.degaullefleurance.com/en/actualites/end-of-the-mica-transitional-period-esma-and-the-amf-call-on-non-authorised-casps-to-anticipate-an-orderly-exit-from-the-european-market/). Les autres références (articles de MiCA, MiFID II, MAR, AI Act, loi 2023-451) viennent de connaissances générales et doivent être vérifiées sur les textes en vigueur.
