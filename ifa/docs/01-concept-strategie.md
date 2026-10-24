# Livrable 1 — Concept et stratégie

## Nom de travail

**Fréquence** (retenu), sous-titre « 75.019 · Ifa ».

| Proposition | Idée | Pourquoi / pourquoi pas |
|---|---|---|
| **Fréquence** | On « se branche » sur la fréquence d'Ifa | Métaphore qui structure tout le produit (molette, signaux, ondes courtes, signal crypté). Fonctionne aussi pour d'autres artistes plus tard (« la fréquence de… »). |
| 75.019 | Le code postal comme fréquence radio | Très ancré dans le 19e, mais peu prononçable. Gardé comme signature visuelle. |
| Le QG | L'endroit où l'on se retrouve | Clair, mais générique, et c'est déjà le nom d'un espace. |
| Avant la sortie | Les fans entendent avant tout le monde | Fort pour le Labo, trop restrictif pour le produit entier. |
| Signal 19 | Ifa envoie un signal, les fans le captent | Bonne alternative si « Fréquence » est pris (marque à vérifier à l'INPI). |

À faire avant usage public : recherche d'antériorité INPI / EUIPO et disponibilité du nom de domaine.

## Proposition de valeur

> **Pour les fans :** si tu veux savoir ce qui se passe avec Ifa, c'est ici, en premier, et tu peux y participer.
> **Pour Ifa et son équipe :** un canal qui vous appartient, où vous parlez directement à votre communauté, sans algorithme entre vous, et où vous comprenez ce qui la fait vibrer.

## Concept distinctif

Une **radio pirate de nuit**. L'appli ne copie ni le fil infini de TikTok ni la grille d'Instagram :
- **La molette** : la navigation est une échelle de fréquences graduée, cinq stations (01 QG · 02 Immersion · 03 Labo · 04 Cercles · 05 Ifa) et une aiguille qui glisse. Elle se manie au pouce.
- **Le signal** : en haut du QG, la prochaine échéance réelle (sortie ou date confirmée) avec son compte à rebours. S'il n'y a rien de programmé, l'appli le dit (« Reste branché ») au lieu d'inventer de l'urgence.
- **Les ondes courtes** : stories de 24 h présentées en cartes verticales, avec une jauge de durée de vie (pas de cercles façon Instagram).
- **Le tunnel (Immersion)** : la vidéo par **pistes thématiques**, qu'on traverse de côté, avec les commandes en bas de l'écran. Pas de défilement vertical sans fin, donc pas d'effet machine à sous.
- **Le signal crypté (Labo)** : avant l'heure, le contenu est littéralement brouillé (glyphes animés), et le serveur n'envoie même pas le fichier. À l'heure dite, la porte s'ouvre.

## Direction artistique

| Élément | Choix | Raison |
|---|---|---|
| Fond | Bitume `#0A0A0B` | La nuit, la ville ; met la couleur et les visuels en valeur. |
| Texte | Craie `#EEE9DF` | Moins agressif que le blanc pur, évoque l'affiche et la craie. |
| Signal | Sodium `#FFB81C` | La lumière orangée des réverbères parisiens. Couleur de l'action principale et du « en direct ». |
| Exclusif | Ultraviolet `#8D6BFF` | Tout ce qui est crypté ou réservé (Labo). Le passage au violet dit « tu es dans un espace à part ». |
| Communauté | Canal `#35D9B8` | Clin d'œil au canal de l'Ourcq et au bassin de la Villette, couleur des Cercles et des défis. |
| Alerte | Brique `#FF5A3C` | Signalement, suppression. |
| Titres | Archivo en largeur 62, graisse 900, capitales | Typo d'affiche condensée et massive, très « pochette » sans copier une marque. |
| Texte | Archivo en largeur 100 | Une seule famille, cohérence et poids de page réduit. |
| Métadonnées | JetBrains Mono, espacé | Le registre « technique » de la radio : fréquences, horaires, sources. |
| Texture | Grain léger permanent, trames de balayage | Profondeur « affiche collée » et « écran de nuit ». |
| Animation | Aiguille de la molette, pulsation du signal, brouillage du Labo, jauges | Peu d'animations, mais chacune porte un sens. Toutes coupées si l'utilisateur demande moins de mouvement. |

**Ce qui reste à faire avec Ifa :** l'identité doit absorber son univers réel (photos officielles, typographie de ses pochettes, couleur dominante de son projet en cours). Le système de jetons (`web/src/styles.css`, `:root`) permet de changer la couleur sodium en une ligne pour chaque ère de projet.

## Pourquoi un fan reviendrait chaque jour

1. **Les ondes courtes disparaissent** : un rendez-vous quotidien naturel, sans pression artificielle.
2. **Le compte à rebours du signal** : la prochaine date ou sortie, toujours visible.
3. **Le Labo** : des portes qui s'ouvrent à heure fixe ; un signal prévient à l'ouverture.
4. **Ses créations** : savoir si elles ont été validées ou mises en avant par l'équipe.
5. **Les défis et les salles de sortie** : des temps forts communautaires bornés dans le temps.
6. **Les réactions officielles** : les commentaires des comptes ✓ remontent en tête.

Ce que l'on s'interdit : séries de connexion (« streaks ») punitives, classements de popularité, notifications de relance creuses, défilement infini. Le public a 12-22 ans : la rétention doit venir de la valeur, pas de la compulsion.

## Avantages pour Ifa et son équipe

- **Canal direct** : un signal arrive dans la boîte de chaque fan abonné à la catégorie, sans algorithme.
- **Contrôle total** des avant-premières : date d'ouverture et de fermeture, droits, public autorisé.
- **Connaissance** : contenus les plus vus, formats qui fonctionnent, votes, tranches d'âge, en agrégé.
- **Données à soi** : base de fans exportable, indépendante des plateformes.
- **Régie simple** : publier une annonce prend trente secondes, sans compétence technique.

## Modèle économique à moyen terme

Ordre recommandé, du moins risqué au plus engageant :
1. **Gratuit d'abord** (phase 1-2) : construire l'habitude et la base de fans.
2. **Billetterie et merch en lien** : renvoi vers les billetteries et la boutique officielles, avec liens suivis. Aucune commission à gérer.
3. **Préventes et accès anticipé** : accès anticipé à la billetterie réservé aux membres (débloqué par la participation, pas par l'argent).
4. **Pass soutien (18+, ou avec accord parental)** : abonnement optionnel (≈ 3-5 €/mois) donnant des coulisses étendues, sans jamais réserver l'information essentielle aux payants.
5. **Marque blanche** : la même plateforme, personnalisée pour d'autres artistes (licence ou abonnement SaaS). C'est le vrai potentiel de revenu.

Écartés pour un public de 12 à 17 ans : cadeaux virtuels payants vers l'artiste, monnaie virtuelle, mécaniques de hasard (« loot box »).
