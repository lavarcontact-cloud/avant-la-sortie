# Livrable 2 — UX / UI

## Carte de navigation

```
                    ┌─────────────── barre du haut ───────────────┐
                    │ FRÉQUENCE 75.019 · IFA      [Signaux] [Moi] │
                    └─────────────────────────────────────────────┘
 ACCUEIL (/)      CLIPS (/immersion)  [+]  COMMU (/cercles)   LABO (/labo)      IFA (/ifa, via la bulle « ifa »)
 /                /immersion         /labo             /cercles            /ifa
 ├ Signal         ├ Pistes :          ├ Ouvert          ├ Défis ouverts     ├ Profil officiel ✓
 ├ Ondes courtes  │  Pour toi         ├ À venir         │  └ /cercles/defi/:id ├ Écouter · suivre
 │  (visionneuse) │  Clips & frees.   │  (compte à      ├ Cercles            ├ Agenda (#agenda)
 ├ Au Labo        │  Coulisses        │   rebours)      │  └ /cercles/:slug  ├ Discographie
 ├ Défi en cours  │  Ondes courtes    ├ Refermé         ├ Créations         ├ Clips & vidéos
 ├ Fil officiel   │  Sélection        └ /labo/:id       │  └ /cercles/creation/:id ├ Annonces
 │  └ /qg/:id     │  Créations fans      (lecteur,      └ [+ Publier]        └ Comptes officiels
 │  └ /qg/archives│  Défis                vote)            /cercles/publier
 └ Sélection fans └ commentaires (feuille)

 Hors molette : /signaux (boîte) · /moi · /moi/signaux · /moi/confidentialite · /u/:pseudo
                /bienvenue (inscription) · /parent/:jeton · /legal/(confidentialite|charte|conditions)
 Équipe :       /regie (tableau de bord, publications, signaux, labo, sorties, agenda,
                défis & cercles, modération, comptes, stats, profil officiel, journal)
```

## Disposition des onglets

Barre d'onglets classique en bas : **Accueil · Clips · [+] · Commu · Labo**. Le « + » central ouvre la publication d'une création. Le profil officiel d'Ifa est accessible depuis la bulle « ifa » des stories et depuis la carte de sortie ; les notifications et « Moi » sont en haut à droite. Les onglets Clips et Labo passent l'appli en sombre.

## Écrans principaux (captures dans [`docs/captures/`](captures/), régénérées dans `tests/screens/` par `npm run test:e2e`)

| Écran | Rôle | Éléments clés |
|---|---|---|
| QG | Savoir ce qui se passe | Signal + compte à rebours réel, ondes courtes, aperçu du Labo, défi en cours, fil officiel avec badge ✓ et source de chaque contenu |
| Publication | Lire, réagir | Source + lien vers l'original, réactions, commentaires (officiels en tête) |
| Immersion | Regarder | Plein écran, pistes, tap sur les bords pour avancer, actions en bas |
| Labo | Accéder aux exclus | Cartes cryptées, comptes à rebours, verrous explicites (« Réservé aux détenteurs du badge… ») |
| Drop ouvert | Écouter, voter | Lecteur audio maison sans téléchargement, vote avec résultats après le vote |
| Cercles | Participer | Défis, cercles (permanents ou temporaires), grille de créations, bouton Publier |
| Ifa | Référence officielle | Grand nom, bio validée, liens vérifiés uniquement, agenda, discographie |
| Moi | Son espace | Avatar-signal, badges, statut de ses créations, favoris, réglages |
| Régie | Piloter | Tableau de bord « ce qui demande ton attention », formulaires d'une action |

## Parcours

### Nouvel utilisateur
1. Arrivée sur le QG en visiteur : tout le public est lisible sans compte.
2. Action engageante (réagir, Labo, publier) → `/bienvenue`.
3. Écran 1, l'univers : « Branche-toi sur Ifa », puis Créer un compte.
4. Écran 2, le compte : avatar-signal (couleur + symbole, pas de photo), pseudo, **mois et année** de naissance, e-mail, mot de passe, acceptation des conditions et de la charte.
   - moins de 12 ans : refus explicite ;
   - 12 à 14 ans : champ « e-mail d'un parent » ; compte en lecture seule jusqu'à l'accord ;
   - 15 ans et plus : compte actif, badge « Première onde ».
5. Écran 3, les signaux : choix des catégories (pour les mineurs, rappel des heures calmes 21 h - 8 h).
6. Retour à la page d'origine.

### Fan régulier
Ouverture → le QG montre le signal et les nouvelles ondes courtes → la pastille Signaux indique les nouveautés → Labo si une porte vient de s'ouvrir → réaction ou commentaire → Immersion pour regarder la piste du jour.

### Publication d'une vidéo (fan)
Cercles → **Publier** → choix du fichier (photo ou vidéo, 80 Mo max, contrôle du format) → aperçu → légende (filtrée : insultes et coordonnées refusées) → choix facultatif d'un défi ou d'un cercle → **case de droits obligatoire** (sa création, accord des personnes visibles, licence d'affichage) → « Envoyer en validation » → écran « C'est reçu » → modérateur : Publier / Refuser avec motif → signal personnel « Ta création est en ligne » (+ badges Créateur et, le cas échéant, Relevé) ou motif du refus.

### Accès à une avant-première
L'équipe programme le drop (fichier confidentiel, ouverture, fermeture, public, droits) → avant l'heure, les fans voient le teaser, le visuel flouté, le brouillage et le compte à rebours ; l'API ne renvoie ni le fichier ni son identifiant → à l'heure dite, le planificateur envoie le signal « Le Labo s'ouvre » → au clic, la page se recharge d'elle-même et affiche le lecteur → le flux est servi `private, no-store`, après vérification de la session, de la fenêtre et des droits (badge ou cercle) → à la fermeture, accès coupé.

### Consultation d'une notification
Push reçu (si activé, hors heures calmes) → clic → le service worker ouvre ou réutilise l'appli sur l'URL du signal. Sans push (iOS non installé, push non configuré, refusé) : le même signal est dans la boîte **Signaux**, avec sa pastille de non-lus.

### Administration
Connexion avec un compte d'équipe → Moi → « Ouvrir la régie » → **Tableau de bord** : créations à valider, signalements, actifs, état des services → « Publier en un geste » (Annonce, Onde courte, Clip, Avant-première, Date, Signal) → formulaire d'une action, avec choix « Maintenant / Programmer » et « Prévenir les fans » → la liste montre l'état réel (en ligne, programmé, brouillon) → Signaux : résultat réel d'envoi (boîtes, push envoyés, échecs, heures calmes).

## Principes d'interface
- Une action principale par écran, en sodium.
- Toujours dire la vérité sur l'état : « Push non configuré », « En validation », « Pas de signal programmé ».
- Chaque contenu porte sa provenance (créé dans l'appli, repris de…, importé de…) et un lien vers l'original.
- Les contenus de démonstration portent l'étiquette hachurée **EXEMPLE**.
- Accessibilité : contrastes AA sur fond bitume, cibles de 40 px minimum, `aria-label` sur les icônes, navigation clavier dans Immersion, `prefers-reduced-motion` respecté.
