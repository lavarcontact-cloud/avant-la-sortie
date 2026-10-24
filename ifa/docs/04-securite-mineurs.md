# Sécurité, mineurs et conformité

> Analyse de travail rédigée pour cadrer le produit. **Elle ne remplace pas l'avis d'un avocat ou d'un DPO**, à obtenir avant toute ouverture au public, en particulier pour les moins de 15 ans.

## Cadre applicable (état connu en octobre 2026, à revérifier)

| Texte | Ce qu'il implique pour Fréquence |
|---|---|
| **RGPD**, art. 5 (minimisation), 6 (base légale), 8 (consentement des enfants), 12 (information claire), 17 (effacement), 20 (portabilité), 25 (protection dès la conception) | Collecte minimale, information lisible par un ado, export et suppression en libre-service |
| **Loi Informatique et Libertés, art. 45** | En France, pour un traitement fondé sur le consentement, un mineur peut consentir seul **à partir de 15 ans** ; en dessous, consentement **conjoint** du mineur et d'un titulaire de l'autorité parentale |
| **Recommandations de la CNIL sur les droits numériques des mineurs** (2021) | Paramètres protecteurs par défaut, pas de profilage commercial, information adaptée, vérification de l'âge proportionnée |
| **DSA (règlement 2022/2065), art. 28** | Plateforme accessible aux mineurs : niveau élevé de confidentialité, de sûreté et de sécurité ; **pas de publicité fondée sur le profilage** des mineurs. Art. 16 et 17 : mécanisme de signalement et motivation des décisions de modération |
| **Loi n° 2023-566 du 7 juillet 2023 (« majorité numérique »)** | Prévoit l'accord parental sous 15 ans pour l'inscription aux réseaux sociaux. Son entrée en vigueur dépend de textes d'application et de sa compatibilité avec le droit européen : **à vérifier**. Le produit applique déjà la règle des 15 ans par prudence |
| **Loi SREN (2024)** et référentiel Arcom sur la vérification d'âge | Vise surtout les contenus pornographiques ; non applicable en l'état, à surveiller |
| **Code de la propriété intellectuelle** | Droits sur les musiques, vidéos et images publiées ; licence explicite pour les créations des fans |
| **Droit à l'image** (art. 9 du Code civil) | Accord des personnes visibles, et des parents pour les mineurs |

## Ce que le MVP met en œuvre

**Inscription et âge**
- Âge minimum configurable (`MIN_AGE=12`), avec refus explicite en dessous.
- Seuls le **mois et l'année** de naissance sont demandés, jamais la date complète.
- **Moins de 15 ans** (`PARENTAL_CONSENT_AGE=15`) : e-mail d'un parent obligatoire, lien unique de consentement (jeton dont seul le haché est stocké). Le compte reste en **lecture seule** (pas de publication, commentaire, vote, réaction ni notification) jusqu'à l'accord. En cas de refus, le compte est supprimé. Sans réponse au bout de 30 jours, il est supprimé automatiquement.
- Limite assumée : il s'agit d'une auto-déclaration. Une vérification d'âge forte (pièce d'identité, estimation faciale) serait disproportionnée et collecterait plus de données ; c'est d'ailleurs la position de la CNIL hors contenus à risque.

**Minimisation**
- Ni nom, ni adresse, ni téléphone, ni géolocalisation, ni carnet de contacts.
- **Pas de photo de profil** pour les fans : avatar généré (couleur + symbole). Aucune photo de mineur n'est exposée par défaut, et aucune modération d'avatar n'est nécessaire.
- Statistiques **agrégées** uniquement ; aucun traceur ni outil d'analyse tiers.

**Protection contre les contacts abusifs**
- **Aucune messagerie privée** entre utilisateurs : c'est la décision la plus structurante. Elle supprime le principal vecteur de prédation et de harcèlement.
- Filtre automatique des insultes **et des coordonnées** (téléphone, e-mail, « ajoute-moi sur snap : … ») dans tous les espaces publics.
- Blocage en un geste : les contenus de la personne bloquée disparaissent pour celle qui bloque.
- Signalement sur chaque contenu et chaque profil, avec neuf motifs, dont « met un mineur en danger ». Masquage automatique d'un commentaire au troisième signalement, en attendant une revue humaine.
- Numéros d'aide affichés dans la feuille de signalement (3018, 17, 112).
- Comptes officiels ✓ : non blocables, non usurpables (pseudos contenant « ifa », « officiel », « admin » ou « modo » refusés à l'inscription).

**Modération**
- **Pré-modération** de toutes les photos et vidéos de fans. Refus toujours motivé, motif transmis à l'auteur (DSA, art. 17).
- File de signalements groupés par contenu, avec aperçu, historique de l'auteur et actions graduées (rien à signaler, retirer, retirer et suspendre).
- Un modérateur ne peut pas agir sur un compte de l'équipe.
- Journal d'audit de chaque décision.

**Notifications**
- Heures calmes par défaut : **21 h - 8 h pour les mineurs**, 22 h - 8 h pour les adultes, en heure de Paris.
- Découverte personnalisée **désactivée par défaut pour les mineurs**.
- Pas de notification de relance ni de mécanique de série.

**Rencontres et événements**
- Seuls les événements **officiels** apparaissent, avec un champ « âge / accès » obligatoire dans la pratique éditoriale (ex. « -16 ans accompagnés »).
- Aucune fonction ne permet à des fans d'organiser une rencontre entre eux.

**Droits des personnes**
- Export JSON et suppression immédiate du compte en libre-service.

## Durées de conservation proposées

| Donnée | Durée |
|---|---|
| Compte actif | Durée d'utilisation ; proposer une purge après 3 ans d'inactivité (à implémenter, voir la feuille de route) |
| Compte sans accord parental | 30 jours, purge automatique |
| Sessions | 30 jours |
| Signalements, journal d'audit | 12 mois (récidives, réquisitions) ; purge à implémenter |
| Créations refusées | À purger au bout de 30 jours (à implémenter) |

## À faire avant l'ouverture au public
1. Désigner l'éditeur du service et un contact données personnelles ; compléter les champs entre crochets de `web/src/screens/Legal.jsx`.
2. Faire relire la politique de confidentialité, les conditions et la charte par un juriste.
3. Rédiger le registre des traitements et, compte tenu du public mineur, une **analyse d'impact (AIPD)**.
4. Signer des contrats de sous-traitance (art. 28 RGPD) avec l'hébergeur et le fournisseur d'e-mails ; privilégier un hébergement dans l'UE.
5. Former l'équipe de modération (charte interne, escalade, signalement PHAROS, conservation des preuves) et fixer un délai de traitement des signalements.
6. Obtenir les autorisations écrites sur les morceaux et extraits diffusés dans le Labo (label, éditeur, coproducteurs).
