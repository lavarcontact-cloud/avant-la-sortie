# ATLAS — Module Entreprise (création et pilotage)

| Élément | Rôle |
|---|---|
| `ETUDE-STATUTS.md` | **Le livrable** : comparaison micro / EI au réel / SASU, RSA et ACRE, obligations, recommandation, plan d'action |
| `simulateur/` | Simulation reproductible avec le moteur officiel URSSAF (`modele-social` 11.1.0). `npm install && npm run simulate` régénère `resultats.md` et `resultats.csv` |
| `tableau-de-bord/ATLAS-Entreprise-Tableau-de-bord.xlsx` | Tableau de bord **vide** : clients, factures, livre des recettes, dépenses, provisions, déclarations CAF, alertes |
| `tableau-de-bord/generer.py` | Régénère le classeur (`python3 generer.py`) |
| `../schema/entreprise.sql` | Tables du module pour l'application ATLAS. Extension **additive** du noyau, qui n'est pas modifié |

## Utiliser le tableau de bord

1. Copier le classeur **hors du dépôt git** (ex. iCloud / Google Drive privé) : il contiendra des données réelles.
2. Onglet **Paramètres** : renseigner l'année, la date de début d'activité et l'ACRE (« Oui » seulement après accord de l'URSSAF).
3. Saisir au fil de l'eau : **Clients** → **Factures** → **Recettes** (chaque encaissement) → **Dépenses**.
4. **Provisions** indique ce qu'il faut mettre de côté chaque mois, et le CA brut par nature à déclarer à la CAF chaque trimestre.
5. **Tableau de bord** : synthèse et alertes (TVA, plafond, point de bascule, justificatifs manquants, fin d'ACRE).

Les taux et seuils sont dans **Paramètres**, avec leur source et leur date de vérification. Ils sont à revérifier chaque 1er janvier et 1er juillet.

Les formules ont été testées le 11/11/2026 sur une copie remplie de données fictives, recalculée avec LibreOffice : zéro erreur, et les résultats concordent avec un calcul manuel. Le fichier livré ne contient **aucune donnée**.
