# 03 · Expérience, parcours et design system

Complète la recherche (`02-recherche-references.md`). Ce document décrit ce qui est **effectivement construit** dans `portfolio/`.

## 1. Direction artistique retenue : "Salle de montage"

Le site se lit comme une salle de montage ouverte : les clips sont des rushes, les projets des bobines, les artistes des contrechamps, la demande de devis une feuille de service. Deux idées tirées de la recherche structurent tout le reste :

1. **Réseau social pour la navigation, cinéma pour l'image.** Les codes d'Instagram (profil, bulles "stories", grille) et de TikTok (flux vertical) ne demandent aucun apprentissage. Le grain, le timecode, les noirs profonds et la typographie de titrage relèvent du cinéma.
2. **Vendre, contrairement aux maisons de production.** Iconoclast, Partizan et Nabil montrent le travail sans jamais le vendre ; un indépendant doit convertir. Chaque écran a donc une sortie vers le devis : bouton "+" du rail dans le flux, encart sur les pages projet et artiste, écran "Fin de bobine", "Devis" permanent dans l'en-tête.

**Continuité avec "Avant la sortie"** : même noir `#0B0B0F`, même corail `#FF5B3C`, mêmes familles typographiques, le grain et le timecode. Le portfolio est reconnaissable comme venant de la même main.

**Le corail comme voyant REC** : il marque ce qui est "en direct". C'est l'action principale (devis), l'onglet actif, la vidéo qui joue (point du timecode) et la progression du formulaire. Jamais en décoration.

## 2. Où va le verre, et pourquoi

| Usage | Fonction |
|---|---|
| Dock de navigation | il flotte au-dessus des vidéos plein écran : le flou garde la vidéo perceptible derrière tout en rendant les libellés lisibles |
| Rail d'actions du flux, bouton lecture, timecode | contrôles posés sur une image en mouvement |
| Légendes sur vidéos (carte "Dans le flux", visionneuse) | même raison |
| Bulles d'artistes ("lentilles") | pas de flou : reflet spéculaire, lueur teintée par la photo, vignettage. La métaphore est l'objectif photo, en CSS pur et sans coût de `backdrop-filter` |
| Bandeau cookies | verre **dense** (90 % d'opacité) : un panneau de texte doit rester lisible. Constat fait en test : à 58 %, le texte devenait illisible sur la grille de photos |

Partout ailleurs, les surfaces sont pleines. Il y a un repli opaque si `backdrop-filter` n'est pas supporté ou si l'utilisateur a choisi "réduire la transparence".

## 3. Expérience mobile et desktop

**Mobile (conçu en premier, testé sur Pixel 7 émulé et en 390 px)**
- Dock à 5 onglets en bas (Profil, Flux, Artistes, Travaux, Prestations), comme une app native, avec zone de sécurité iOS.
- Flux plein écran, accrochage vertical, rail d'actions à droite à portée de pouce.
- Constellation d'artistes en nid d'abeille sur 3 colonnes (la spirale chevauchait sous 640 px).
- Cibles tactiles de 44 px minimum ; champs en 16 px pour éviter le zoom automatique d'iOS.

**Desktop (1440 px)**
- Profil : titre géant, extrait vertical incliné à droite (redressé au survol).
- Flux : vidéo centrée dans son format d'origine sur un fond flou issu de sa propre affiche, flèches haut/bas visibles (pas de swipe à la souris), raccourcis clavier ↑ ↓ J K, espace et Échap.
- Vignettes : aperçu vidéo muet au survol, sans aucun téléchargement avant le survol.
- Constellation en spirale de Fibonacci, bulles proportionnelles au nombre de projets, dérive lente arrêtée au survol.

## 4. Architecture des pages

```
/                      Profil : en-tête, actions, bulles, grille filtrable, La Var, prestations
/flux                  Flux vertical (?p=slug pour partager une vidéo précise) + "Fin de bobine"
/artistes              Constellation (ou vue liste), filtres par discipline
/artistes/[slug]       Lentille, relation réelle, projets, appel au devis, artiste suivant
/projets               Index filtrable
/projets/[slug]        Vidéo d'en-tête, texte, galerie + visionneuse, rôles, crédits, devis contextualisé
/photo                 Planche-contact (maçonnerie) + visionneuse
/a-propos              Bio, parcours, disciplines, outils
/prestations           4 offres sur devis, projets associés, processus en 5 étapes
/devis                 Formulaire en 3 étapes (?ref= et ?service= le pré-remplissent)
/contact               Devis, e-mail, téléphone
/paiement/[jeton]      Récapitulatif, CGV, renonciation (particuliers), paiement Stripe
/retractation          Rétractation en ligne (particuliers)
/mentions-legales /confidentialite /cookies /cgv
/admin                 Tableau de bord KPI · /admin/demandes · /admin/commandes · /admin/contenus
```

## 5. Parcours utilisateurs

1. **Manager qui découvre** : lien partagé `/flux?p=brk-developpement`, puis swipe sur 3 clips, bulle BRK, page artiste, projet, "Demander un devis" pré-rempli avec la référence du projet.
2. **Label qui vérifie la crédibilité** : Profil, grille filtrée "Direction artistique", page projet (crédits, rôles), À propos, Contact.
3. **Artiste qui veut un clip** : Prestations, "Réalisation de clip", devis en 3 étapes, confirmation avec référence.
4. **Client qui paie** : lien reçu par e-mail `/paiement/…`, récapitulatif, acceptation des CGV (et demande d'exécution immédiate pour un particulier), Stripe Checkout, retour, statut mis à jour par le webhook.
5. **Sébastien qui pilote** : `/admin`, KPI sur 7, 30 ou 90 jours, demande, création de la commande et du lien de paiement, suivi, remboursement.

## 6. Design system (implémenté dans `src/app/globals.css`)

**Couleurs** : `ink #0B0B0F` · `panel #16151A` · `line #232228` · `fg #F6F3EC` · `muted #A39EAC` (éclairci depuis `#9C97A6` pour un contraste de 7,4:1) · `accent #FF5B3C` · `ok #3FCF8E` · `warn #FFB547`.

**Typographie** : Bricolage Grotesque 700 (titres, `.t-display`, interlettrage −3 %), Inter (texte, 16 px de base), Space Mono (libellés `.t-eyebrow`, timecodes `.t-mono`). Les fichiers sont auto-hébergés au build par `next/font` : aucun appel à Google depuis le navigateur des visiteurs.

**Composants** : `.glass`, `.glass-strong`, `.btn` (primary et ghost, 44 px), `.chip` (états pressed, checked et current), `.lens` + `.lens-ring`, `.input`, `ProjectCard`, `ArtistBubble`, `BubbleRow`, `Gallery` (avec `<dialog>`), `HeroVideo`, `VideoSources` (MP4 et WebM), `CtaLink` (mesuré), `QuoteForm`, `LegalShell`.

**Mouvement** : une courbe "ressort" sur les boutons et les chips (retour tactile), l'entrée `rise` en cascade (60 ms par élément) et des transitions d'éléments partagés natives : React 19.3 `<ViewTransition>` fait passer la bulle d'un artiste à sa page et la vignette d'un projet à son en-tête. Aucune bibliothèque d'animation n'a été ajoutée : Motion ou GSAP n'auraient rien apporté que CSS et l'API View Transitions ne fassent déjà. Avec `prefers-reduced-motion`, toutes les animations s'arrêtent et rien ne démarre seul dans le flux (un bouton lecture s'affiche).

**Rejeté volontairement** : WebGL et Three.js (la recherche a montré que Lusion ne s'affiche pas sans GPU, signe du coût sur les téléphones modestes), le défilement "smooth" détourné, le curseur personnalisé (l'existant "viseur" n'apporte rien à l'action) et le son automatique.

## 7. Maquettes filaires (mobile)

```
PROFIL                        FLUX                          PAGE PROJET
┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│ S.F-P.       [Devis] │      │ S.F-P.  ▬▬▬▬───  [D] │      │ [  vidéo d'en-tête  ]│
│ RÉALISATION · PHOTO  │      │          ● 03/08 0:07│      │ [                   ]│
│ Sébastien            │      │                      │      │ DA · 2024            │
│ Fula-Pitu.           │      │     [ vidéo 9:16 ]   │  (◉) │ "Enlève tes Pessas"  │
│ 14 projets 26 art. 8 │      │                      │  (◉) │ Leto                 │
│ [Devis][Flux][Contact]│     │ RÔLE                 │  (↑) │ Résumé…              │
│ (◉)(◉)(◉)(◉)(◉) →    │      │ "91022"              │  (+) │ ROLE  [Photo][DA]    │
│ [Tout][Clips][Photo] │      │ Dexter HMC           │ Devis│ CRÉDITS ──────────── │
│ ┌────┐┌────┐         │      │ Voir le projet →     │      │ [img][img][img]      │
│ │ ▶  ││    │         │      │                      │      │ ┌ Un projet dans  ┐  │
│ └────┘└────┘         │      │                      │      │ └ cet esprit ? [D]┘  │
│ ╭─ Profil Flux Art. ─╮│     │ ╭─ Profil Flux Art. ─╮│     │ Suivant : "Noir" →   │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘
```

Les captures réelles sont produites par `scripts/shots.mjs` (390 px et 1440 px).
