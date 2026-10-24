# Livrable 5 — Plan d'évolution

Estimations indicatives pour une équipe de 1 à 2 développeurs, en jours de travail. Coûts récurrents en ordre de grandeur, octobre 2026, à reconfirmer chez les fournisseurs.

## Phase 1 — Lancement du QG (MVP actuel, puis 2-3 semaines)
Objectif : un produit qu'Ifa utilise vraiment.

| Chantier | Complexité | Dépendances | Coût récurrent |
|---|---|---|---|
| Mise en ligne (domaine, HTTPS, Postgres managé, volume) | Faible · 1-2 j | Choix de l'hébergeur | ≈ 10-30 €/mois (petit VPS ou Railway/Render/Fly + Postgres managé) |
| Contenus réels : photos officielles, bio validée, liens vérifiés, discographie | Faible · 1 j | **Ifa et son équipe** | — |
| Push activé et testé sur Android et iPhone réels | Faible · 1-2 j | Appareils de test | 0 € |
| SMTP pour l'accord parental | Faible · 0,5 j | Compte Brevo / Mailjet / Scaleway | 0-15 €/mois |
| Relecture juridique, AIPD | Moyenne | Juriste ou DPO | Ponctuel |
| Réinitialisation du mot de passe par e-mail | Faible · 1 j | SMTP | — |
| Purges automatiques (créations refusées, journaux à 12 mois, inactivité à 3 ans) | Faible · 1 j | — | — |

## Phase 2 — Communauté
| Évolution | Complexité | Dépendances | Coûts récurrents |
|---|---|---|---|
| **Stockage objet + CDN pour les vidéos** (S3/R2, URL signées courtes pour le Labo) | Moyenne · 3-4 j | Compte Cloudflare R2 ou Scaleway | R2 : ≈ 0,015 $/Go stocké, sortie gratuite |
| **Transcodage vidéo** (formats adaptés au mobile, vignettes) | Moyenne · 3-5 j | Mux, Cloudflare Stream ou ffmpeg en tâche de fond | Stream ≈ 5 $/1 000 min stockées + 1 $/1 000 min vues |
| Aide à la modération automatique des images et vidéos (nudité, violence) | Moyenne · 2-3 j | API de modération (ex. Hive, AWS Rekognition) | ≈ 1 $/1 000 images |
| Stories créées par l'équipe depuis le téléphone (régie mobile optimisée) | Moyenne · 3 j | — | — |
| Rendez-vous communautaires (salles de sortie avec programme horaire) | Moyenne · 3 j | — | — |
| Badges saisonniers liés aux projets | Faible · 1-2 j | Visuels | — |

## Phase 3 — Exclusivité et proximité
| Évolution | Complexité | Dépendances | Coûts récurrents |
|---|---|---|---|
| **Questions-réponses avec Ifa** (questions déposées et votées par les fans, réponses vidéo enregistrées) | Moyenne · 4-5 j | Temps d'Ifa | — |
| **Messages vidéo enregistrés** par Ifa pour un cercle ou un palier | Faible · 2 j | Transcodage (phase 2) | — |
| **Lives programmés** (diffusion, chat modéré à débit limité, rediffusion) | Élevée · 8-12 j | Mux Live, Cloudflare Stream Live ou YouTube Live intégré | Mux ≈ 0,03-0,04 $/min diffusée + visionnage ; YouTube Live : 0 € |
| Chat de live pour les mineurs : mode lent, mots filtrés, modérateurs dédiés | Moyenne · 3 j | Équipe de modération présente | Humain |
| **Rencontres et événements** : inscription, tirage au sort transparent, billet nominatif, autorisation parentale signée pour les mineurs, aucun contact privé | Élevée · 6-8 j | Organisateur, assurance, cadre légal | Billetterie ≈ 1-3 % si payant |
| **Avant-premières musicales complètes** (écoute intégrale limitée en nombre d'écoutes ou dans le temps, filigrane audio par utilisateur) | Élevée · 6-10 j | Accord du label ; service de filigrane | Variable (filigrane ≈ sur devis) |

## Phase 4 — Mesure, revenus, autres artistes
| Évolution | Complexité | Dépendances | Coûts récurrents |
|---|---|---|---|
| **Statistiques avancées** : cohortes de rétention, entonnoirs d'inscription, performance des signaux (taux d'ouverture), export CSV | Moyenne · 4-6 j | — | 0 € (calcul en base) |
| Récompenses transparentes : points gagnés gratuitement, échangeables contre des accès (prévente, rencontre tirée au sort), **sans achat** | Moyenne · 4-5 j | Règlement du programme | — |
| Cadeaux virtuels | Élevée | Conformité, protection des mineurs | **Déconseillé pour les moins de 18 ans** ; si mis en place, réservé aux majeurs, plafonné, frais de paiement ≈ 1,5 % + 0,25 € (Stripe EU) |
| **Pass soutien** payant (majeurs, ou mineurs avec accord parental), sans contenu essentiel réservé | Moyenne · 5-7 j | Stripe, CGV, TVA | ≈ 1,5 % + 0,25 €/transaction ; frais des stores si appli native (15-30 %) |
| **Accueil d'autres artistes (marque blanche)** : ajouter `artist_id` aux tables de contenu, thème par artiste (jetons CSS), domaine par artiste, rôles par artiste | Élevée · 10-15 j | Décision de produit | Hébergement mutualisé, coûts par artiste marginaux |
| Applis natives (stores) si nécessaire : surcouche Capacitor autour de la PWA | Moyenne · 5-8 j | Comptes développeur Apple et Google | Apple 99 $/an, Google 25 $ une fois |

## Indicateurs à suivre dès le lancement
- Actifs par jour et par semaine (DAU/WAU), rétention à 7 et 30 jours.
- Taux d'abonnement au push, taux d'ouverture des signaux.
- Participation : votes, créations envoyées et validées, participations aux défis.
- Délai moyen de modération et taux de signalements par contenu (santé de la communauté).
