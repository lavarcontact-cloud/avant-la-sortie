# 02 : Recherche de références et direction artistique

> **Rôle :** directeur artistique digital + UX researcher.
> **Date de consultation de toutes les sources : 9 octobre 2026** (quelques accès techniques se sont terminés après minuit UTC, le 10/10).
> **Méthode :** chaque URL retenue a été chargée réellement. Outils utilisés : Firecrawl `scrape` (rendu statique ou résumé), Firecrawl `search` et WebSearch (découverte), et un navigateur Chromium headless piloté par Playwright (Kernel) pour lire le DOM des sites très JavaScript (TikTok, Instagram, Lusion). WebFetch a échoué (erreur DNS `ENOTFOUND`) sur apple.com, nike.com et design.duolingo.com : ces pages ont donc été lues via Firecrawl.
> **Règle d'honnêteté :** quand une interaction n'a pas pu être observée (scroll animé, transitions, viewer de stories), c'est écrit explicitement. Rien n'est décrit "de mémoire" comme s'il avait été vu.
> **Rappel typographique pour le site :** guillemets droits " " et pas de tirets cadratins comme séparateurs dans les textes visibles. Ce document suit la même règle.

---

## 0. Ce qui a été vérifié, ce qui ne l'a pas été

| Élément | Statut |
|---|---|
| Contenu, structure, libellés de navigation des 16 références retenues | Vérifié (chargé) |
| Attributs `<video>` du feed TikTok (page Explore) | Vérifié dans le DOM (Playwright) |
| Navigation clavier et snapping du feed TikTok "For You" | **Non observé** : la page a figé le navigateur headless à deux reprises (timeouts à 60 s, onglet impossible à rouvrir) |
| Bulles "highlights" Instagram (taille, rendu de l'anneau) | Vérifié dans le DOM ; **viewer de stories non observé** (clic sans effet hors connexion) |
| Animations au scroll d'Apple (iPhone 18 Pro, Vision Pro) | **Non observées** : lecture statique uniquement (titres, ordre des sections, CTA) |
| Expérience WebGL de Lusion | **Non observée** : le thread principal est resté saturé dans un Chromium sans GPU (évaluations JS en timeout à 25 s). C'est un indice de coût sur appareil faible, pas une mesure |
| Active Theory | **Non chargeable** : le scraper reçoit une page "Your browser is not supported" (`/unsupported`) |
| Division (division.paris) | **Non retenu** : redirige vers une page de connexion (`/Login`) |
| Pulse Films | **Non retenu** : application JS dont le contenu n'est pas lisible par le scraper |
| design.duolingo.com | Redirige désormais vers `blog.duolingo.com/hub/design/` (le "brand site" historique n'est plus en ligne sous cette forme) |
| Site officiel de Fifou (photographe des pochettes du rap français) | **Introuvable** dans les recherches menées ; non retenu |

---

## 1. Fiches des références retenues (16)

Format de chaque fiche : URL exacte · chargement (outil) · mécanismes observés · à adapter · à ne pas copier · conséquences perf / accessibilité / conversion · application concrète au portfolio de Sébastien.

### A. Grandes marques

#### R1. Nike : narration visuelle et rythme éditorial
- **URL :** https://www.nike.com/
- **Chargement :** oui, Firecrawl (mode query). WebFetch : échec DNS.
- **Mécanismes observés :** hero **photo** plein cadre avec un titre très court en capitales grasses ("FULLY INVESTED"), une phrase d'accroche, puis 2 à 4 CTA ("Shop NFL", "Shop Men's"...). La page enchaîne des **blocs-campagnes autonomes**, chacun avec un titre-slogan de 1 à 3 mots ("Train Everything", "CROWN THE SEASON", "Last Word", "BODY OBSESSED", "EVERY. DAY. SPEED."), une image d'athlète en action, puis un CTA. Ponctuation utilisée comme rythme ("EVERY. DAY. SPEED."). La page se termine par une grille produit "TRENDING".
- **À adapter :** la **cadence** titre court / image forte / un seul geste. Pour Sébastien, chaque projet devient un bloc-campagne : nom de l'artiste en Bricolage Grotesque très gros, un verbe ou un mot du clip, une image, un CTA ("Voir le clip").
- **À ne pas copier :** la densité commerciale (plusieurs CTA par bloc, répétition des mêmes blocs dans le carrousel, grille produit). Les slogans en anglais façon sportswear sonneraient faux dans le rap FR.
- **Perf / a11y / conversion :** images très lourdes sur un hero ; le contraste texte/photo dépend de chaque image (prévoir un voile). Le "un bloc = une intention" aide la conversion en réduisant l'hésitation.
- **Application :** section d'accueil "À l'affiche" : 3 à 5 blocs plein écran (Gazo, Landy, L2B...), un mot-titre par bloc, CTA unique coral.

#### R2. Apple iPhone (page gamme + iPhone 18 Pro) : hiérarchie et typographie
- **URL :** https://www.apple.com/iphone/ et https://www.apple.com/iphone-18-pro/
- **Chargement :** oui, Firecrawl (markdown + résumé). **Animations scroll non observées.**
- **Mécanismes observés :** sur la page gamme, deux "cartes" hero (iPhone Duo "Hello, hello.", iPhone 18 Pro "Pro further.") : **nom produit + phrase de 2 mots + 2 CTA** ("Learn more" / "Buy"). Puis une série de tuiles thématiques avec titres courts coupés volontairement sur deux lignes ("Picture your best / photos and videos."). Alternative textuelle très descriptive sur chaque image (couleur, angle, éléments visibles). Comparateur de modèles avec pastilles de couleurs et prix.
- **À adapter :** le **couple titre + sous-titre de 2 à 4 mots**, les retours à la ligne maîtrisés, la paire de CTA primaire/secondaire, et la qualité des `alt` (décrire le plan, la lumière, l'artiste).
- **À ne pas copier :** les séquences d'images pilotées au scroll (non observées ici, mais connues pour être coûteuses) : sur un portfolio vidéo, la vidéo elle-même doit porter l'émotion.
- **Perf / a11y / conversion :** alt textes exemplaires ; paire de CTA lisible ; structure en tuiles facile à scanner.
- **Application :** page "Services" construite en tuiles Apple-like : "Clip.", "Photo.", "Captation live.", "Montage." avec une phrase et 2 CTA ("Voir des exemples" / "Demander un devis").

#### R3. Apple Vision Pro : présentation d'un produit "spatial"
- **URL :** https://www.apple.com/apple-vision-pro/
- **Chargement :** oui, Firecrawl (mode query). **Vidéos et interactions non observées.**
- **Mécanismes observés :** découpage en **chapitres nommés** ("Entertainment", "Productivity", "Photos and Videos", "Connection", "Apps", "visionOS", "Technology", "Values") puis des affirmations techniques chiffrées ("More pixels than a 4K TV. For each eye."). Une commande "Replay" accompagne une vidéo de section. CTA répartis : "Book a demo", "Buy", "View in your space".
- **À adapter :** la **structure en chapitres** pour les pages projet, et le principe d'une commande visible pour rejouer/arrêter une vidéo décorative.
- **À ne pas copier :** la longueur (page interminable) ; un portfolio doit permettre d'atteindre le clip en un geste.
- **Perf / a11y / conversion :** une commande de lecture explicite répond au critère WCAG 2.2.2 (mettre en pause ce qui bouge plus de 5 s). "Book a demo" = analogue direct du "Réserver un appel".
- **Application :** page projet chapitrée (voir §4), bouton "Rejouer / Pause" sur toute vidéo d'ambiance.

#### R4. Apple Human Interface Guidelines, Materials (Liquid Glass) : la référence sur le verre
- **URL :** https://developer.apple.com/design/human-interface-guidelines/materials
- **Chargement :** oui, Firecrawl markdown, texte intégral (WebFetch n'a renvoyé que le titre). Changelog : mise à jour Liquid Glass du 9 septembre 2025.
- **Règles relevées (citations) :**
  - Liquid Glass "forms a distinct functional layer for controls and navigation elements [...] that floats above the content layer".
  - "**Don't use Liquid Glass in the content layer.**"
  - "**Use Liquid Glass effects sparingly.** [...] Limit these effects to the most important functional elements in your app."
  - "**Only use clear Liquid Glass for components that appear over visually rich backgrounds.**" Variante *clear* pour les composants "that float above media backgrounds, such as photos and videos".
  - "If the underlying content is bright, consider adding a dark dimming layer of 35% opacity."
  - Variante *regular* pour les composants avec beaucoup de texte (alertes, sidebars, popovers).
  - Les réglages système "reduce transparency or increase contrast" modifient l'apparence : il faut les respecter.
  - visionOS : "Prefer translucency to opaque colors in windows" ; trois niveaux de vibrance (label, secondaryLabel, tertiaryLabel, ce dernier seulement quand la lisibilité n'est pas critique).
- **À adapter :** tout. C'est la grille de décision du verre sur le site : **verre = couche de contrôle, jamais couche de contenu**.
- **À ne pas copier :** l'effet de réfraction/lentille de Liquid Glass natif, impossible à reproduire proprement en CSS sans shaders coûteux. On garde l'esprit (flou + voile + bord lumineux fin), pas la physique.
- **Perf / a11y / conversion :** moins de surfaces vitrées = moins de couches GPU ; voile à 35 % sur vidéo claire = lisibilité garantie.
- **Application :** verre limité à 3 composants : barre d'onglets mobile, pastille son/CTA posée sur la vidéo, étiquette nominative des bulles artistes au survol/focus. Variante "clear" + voile 35 % sur les plans lumineux.

#### R5. Duolingo Design (blog design + cas Rive) : personnalité et feedback
- **URL :** https://design.duolingo.com/ (redirige vers https://blog.duolingo.com/hub/design/), article https://blog.duolingo.com/core-tabs-redesign/ (4 février 2026), cas Rive https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life
- **Chargement :** oui, Firecrawl (markdown + résumés). Le "brand site" historique n'est plus servi à cette adresse : constat à noter.
- **Mécanismes observés :**
  - Refonte des onglets : quatre pistes explorées ("Punchy", "Soft", "Modular", "Flat"), arbitrage entre "consistency with purpose" et "simplicity with clarity", tests utilisateurs avant mise en ligne iOS.
  - Cas Rive : le personnage Lily réagit en temps réel via une **state machine** ; l'équipe a choisi une approche **modulaire** (réactions combinées dynamiquement plutôt que précalculées) pour garder des fichiers légers et performants.
- **À adapter :** l'idée que **chaque action reçoit une réponse émotionnelle courte**, et la technique : une petite animation à états (Rive ou CSS) plutôt que des vidéos de feedback.
- **À ne pas copier :** la mascotte, les couleurs saturées, le ton enfantin, la gamification (séries, badges). Le public de Sébastien (labels, artistes, managers) attend du sérieux et du style.
- **Perf / a11y / conversion :** micro-feedback = réassurance dans les formulaires longs (devis, réservation), donc moins d'abandons. Fichiers Rive légers ; prévoir une version statique en `prefers-reduced-motion`.
- **Application :** feedback "clap" (claquette qui se ferme en 3 images) à chaque étape validée du devis ; perforations de pellicule qui se remplissent comme barre de progression.

### B. Plateformes sociales

#### R6. TikTok web : navigation verticale et continuité de lecture
- **URL :** https://www.tiktok.com/explore et https://www.tiktok.com/foryou
- **Chargement :** Explore oui (Playwright/Kernel, viewport 390×844). For You : **non**, la page a figé le navigateur headless (deux sessions perdues). **Swipe, snapping et passage d'une vidéo à l'autre non observés.**
- **Mécanismes observés (DOM Explore) :** une seule `<video>` active dans la page, `muted: true`, `paused: false`, `preload: "auto"`, `autoplay: false` (lecture déclenchée en JS, pas par l'attribut), `playsinline: false` dans ce contexte desktop. Navigation latérale libellée "For You", "Shop", "Explore", "Following", "Short dramas", "LIVE", "Upload", "Profile", "More" ; filtres par catégories ; compteurs de vues sur chaque vignette ; invitation "Log in" récurrente.
- **À adapter :** **une seule vidéo jouée à la fois**, lancée par script quand elle est visible, son coupé par défaut avec un réglage de son **persistant** d'une vidéo à l'autre ; plein écran vertical sur mobile.
- **À ne pas copier :** le mur de connexion, les compteurs de vues (inutiles et parfois défavorables pour un réalisateur), le défilement infini sans fin (il faut une fin de bobine qui mène au contact), la lourdeur de la page (le blocage observé est un avertissement).
- **Perf / a11y / conversion :** sur iOS, sans `playsinline` la vidéo passe en plein écran (source WebKit, §3) : à ajouter impérativement. Une vidéo à la fois limite décodage et data. Fournir commandes clavier (flèches haut/bas) et boutons visibles, pas seulement le swipe.
- **Application :** feed "Rushes" (voir §4, mécanisme 1).

#### R7. Instagram profil + highlights : bulles et navigation
- **URL :** https://www.instagram.com/nike/
- **Chargement :** oui (Playwright/Kernel, viewport mobile). **Viewer de stories non observé** : le clic sur le highlight n'ouvre rien sans connexion.
- **Mécanismes observés (DOM) :** en-tête (nom, badge "Verified", abonnés, bio, lien), puis le highlight "Just Do It" exposé comme bouton accessible ("View Just Do It highlight"), **zone cliquable d'environ 85×108 px** (portrait + libellé dessous), anneau dessiné dans un `<canvas>` de 92×92 px. Onglets "Posts", "Reels", "Tagged" ; grille où chaque vignette annonce son type ("Clip", "Carousel").
- **À adapter :** la **bulle ronde + libellé dessous** comme raccourci vers une collection (un artiste = une bulle = ses projets), l'annonce du type de média sur chaque vignette, la grande zone tactile.
- **À ne pas copier :** l'anneau en dégradé multicolore Instagram (signature de la marque) ; le mur de connexion ; un `<canvas>` purement décoratif sans alternative.
- **Perf / a11y / conversion :** le libellé accessible "View ... highlight" est un bon modèle (`aria-label="Voir les projets avec Gazo"`). Zone tactile largement au-dessus du minimum 44×44 px.
- **Application :** rangée de bulles artistes en haut de l'accueil mobile, anneau coral fin = "nouveau projet", tap = viewer plein écran façon story.

### C. Portfolios de réalisateurs et maisons de production

#### R8. Iconoclast (France) : roster et sous-labels
- **URL :** https://iconoclast.tv/fr/directors (+ fiche https://iconoclast.tv/fr/directors/remi-besse)
- **Chargement :** oui, Firecrawl markdown. Le lecteur et les visuels des fiches projet ne sont pas lisibles en statique (seul le titre "IDK x Kaytranada" ressort).
- **Mécanismes observés :** navigation minimale "Directors", "film+tv", "Photographers", "Music", "Contact" ; sélecteur de pays ("Our network" : France, U.S., U.K....) ; roster **typographique** (noms collés en liste) segmenté en "Iconoclast", "New Talents", "Special Guests", "New Land", "Somesuch". Fiche réalisateur = 5 projets "Marque / Titre" puis "View More". Remi Besse (clips pour Oboy et SDM selon la presse) y côtoie Romain Gavras, Mourad Winter, Ernest Desumbila.
- **À adapter :** la **liste de noms comme interface** (les noms sont l'image), la fiche courte (5 projets max avant "Voir plus"), la catégorisation simple.
- **À ne pas copier :** la froideur et l'absence de contexte (aucun crédit, aucun rôle visible en statique) : Sébastien cumule réalisation, image, montage, photo, il doit afficher **son rôle** sur chaque projet.
- **Perf / a11y / conversion :** pages très légères ; mais pas de CTA, contact relégué au menu : modèle de maison de prod, pas d'indépendant qui vend.
- **Application :** page "Artistes" desktop : liste typographique géante des noms, survol = portrait vidéo en boucle dans le viseur.

#### R9. Partizan : grille de travaux et lecteur en overlay
- **URL :** https://partizan.com/
- **Chargement :** oui, Firecrawl (markdown complet).
- **Mécanismes observés :** menu "Work", "Directors", "About", "Contact" ; grille de vignettes 16:9 (480×270) légendées **Réalisateur / Artiste ou marque / Titre** ; collection "Partizan Classics" (Gondry : Daft Punk "Around the World", White Stripes...) ouverte dans un **lecteur overlay** avec "Play", "Pause", "Fullscreen", "Sound On/Off", "Prev", "Next", "Close", et un lien vers la catégorie ("Music content", "Branded content").
- **À adapter :** la **légende en trois lignes** (qui / pour qui / quoi), le lecteur overlay avec précédent/suivant pour enchaîner sans quitter la grille, la mise en avant d'un "best of".
- **À ne pas copier :** la duplication du carrousel dans le DOM (tout le contenu est répété deux fois), le bandeau cookies envahissant.
- **Perf / a11y / conversion :** commandes texte explicites (bon pour lecteurs d'écran) ; overlay = continuité de visionnage.
- **Application :** "Bobines" : collections thématiques ("Drill nocturne", "Performances live") ouvertes en overlay avec Prev/Next.

#### R10. Nabil : le portfolio d'auteur minimal (rap US)
- **URL :** https://nabil.com/ et https://nabil.com/film
- **Chargement :** oui, Firecrawl markdown. Lecture de la page projet Kendrick Lamar "DNA" interrompue par la limite de requêtes : **page projet non vérifiée**.
- **Mécanismes observés :** accueil réduit à trois mots, "Film", "Photo", "Info". Page Film : liste chronologiquement mélangée **Artiste / Titre** (Kendrick Lamar "DNA", Frank Ocean "Pyramids", Travis Scott, SZA, Tyla, Beats By Dre...). Clips et pubs dans la même liste.
- **À adapter :** la **séparation nette Film / Photo** (exactement la double casquette de Sébastien) et la confiance dans le travail : pas de texte marketing.
- **À ne pas copier :** l'absence totale de services, de prix, de prise de contact visible : Nabil n'a pas besoin de convertir, Sébastien oui.
- **Perf / a11y / conversion :** ultra léger ; conversion quasi nulle par design.
- **Application :** navigation principale à 4 entrées maximum : "Clips", "Photo", "Artistes", "Travailler ensemble".

#### R11. Lyrical Lemonade : un média rap qui assume l'univers
- **URL :** https://www.lyricallemonade.com/
- **Chargement :** oui, Firecrawl (mode query).
- **Mécanismes observés :** navigation "VIDEOS", "LLTV", "FESTIVAL", "DRINK", "SHOP", "BLOG", "ABOUT", chaque entrée accompagnée d'un sticker illustré ; liste de vidéos avec vignette, titre, chaîne, ancienneté, vues, et lien vers la playlist YouTube.
- **À adapter :** l'idée d'un **univers propre** et reconnaissable (stickers, signature graphique) qui dépasse le simple portfolio ; le lien vers la source YouTube (preuve sociale vérifiable).
- **À ne pas copier :** l'esthétique cartoon/jaune de Cole Bennett, et l'affichage des vues pour chaque vidéo.
- **Perf / a11y / conversion :** embarquer YouTube a un coût (iframes lourdes) : utiliser des façades (vignette + lancement au clic).
- **Application :** la "signature" de Sébastien = le timecode et les perforations (son équivalent des stickers). Lien "Voir sur YouTube" discret sous chaque clip.

#### R12. Colonel Blimp (archive) : la mémoire d'une maison de prod
- **URL :** https://colonelblimp.com/
- **Chargement :** oui, Firecrawl markdown.
- **Mécanismes observés :** page-mémorial ("R.I.P. 2003 - 2017", la maison a été intégrée à Blink) qui garde un mur d'images "Réalisateur / Artiste - Titre" (Dougal Wilson, David Wilson pour Tame Impala, Tim Brown pour Tinie Tempah...). Détail parlant : les fichiers d'images sont nommés par **timecode d'export** ("...00_01_19_23.Still001.png").
- **À adapter :** le still choisi comme photogramme précis, **affiché avec son timecode** : c'est exactement la culture du monteur, et une idée de légende forte pour Sébastien.
- **À ne pas copier :** la liste exhaustive non hiérarchisée (personnel, commissaires, réalisateurs).
- **Perf / a11y / conversion :** page statique légère ; aucune conversion (normal pour une archive).
- **Application :** chaque vignette de projet porte le timecode réel du photogramme ("TC 00:01:19:23"), en Space Mono.

### D. Sites expérimentaux / WebGL

#### R13. Lusion : narration 3D et curseur de lecture
- **URL :** https://lusion.co/
- **Chargement :** Firecrawl oui (texte) ; Playwright : **expérience non observable**, thread principal saturé sans GPU (deux évaluations en timeout).
- **Mécanismes observés (texte) :** promesse en une phrase ("We create 3D visual storytelling..."), invitation "scroll to explore", "Play Reel" avec "PLAY" / "MUTE", liste de projets légendée par disciplines ("concept • web • design • development • 3d • animation"), fin de page "CONTINUE TO SCROLL" qui mène à la page suivante ("Next Page"). Le viewport désactive le zoom (`maximum-scale=1.0, user-scalable=no`).
- **À adapter :** **la page qui se prolonge vers la suivante** (scroll de fin = transition vers "À propos"), le reel avec commandes explicites, les tags de discipline par projet (pour Sébastien : réal • image • montage • photo).
- **À ne pas copier :** la 3D temps réel en fond permanent, et surtout le blocage du zoom (`user-scalable=no` = échec WCAG 1.4.4).
- **Perf / a11y / conversion :** risque fort sur mobile milieu de gamme (cf. saturation observée). Reel = bon outil de conversion s'il démarre vite.
- **Application :** fin de chaque page projet = "projet suivant" qui se charge au scroll, comme un raccord de montage.

#### R14. Locomotive : éditorial, ton et smooth scroll
- **URL :** https://locomotive.ca/en
- **Chargement :** oui, Firecrawl markdown. **Scroll et animations non observés.**
- **Mécanismes observés :** titre-signature avec emojis et marque déposée ("Locomotive® Digital-first Design Agency"), ©2008-2026, "Featured work" avec noms coupés sur deux lignes autour de la vignette ("The / [image] / Drake Hotel"), section "Extras(13)" (articles, culture, boutique de merch). Le markdown révèle une animation de lettres découpées une par une (texte splitté caractère par caractère). Locomotive publie aussi "Should I use Locomotive Scroll on my project?", signe que l'agence elle-même questionne le smooth scroll.
- **À adapter :** **la vignette insérée dans le titre** (le nom de l'artiste s'ouvre pour laisser apparaître l'image), le ton personnel, les "extras" (making-of, matériel, coulisses).
- **À ne pas copier :** le découpage du texte en caractères isolés sans texte accessible (lu lettre par lettre par un lecteur d'écran), le smooth scroll détourné qui combat le scroll natif et le scroll-snap du feed.
- **Perf / a11y / conversion :** texte splitté = prévoir `aria-label` sur le conteneur et `aria-hidden` sur les lettres.
- **Application :** titres de projet "Gazo [vignette] La Rue" sur desktop ; rubrique "Coulisses" pour les making-of.

#### R15. Awwwards Sites of the Day (et le portfolio de Jesper Landberg)
- **URL :** https://www.awwwards.com/websites/sites_of_the_day/ et https://www.awwwards.com/sites/jesper-landberg-4
- **Chargement :** oui, Firecrawl (query + résumé). Site de Jesper Landberg lui-même **non chargé**.
- **Mécanismes observés :** la sélection récente mêle portfolios individuels (Maria Vasilyeva, Jesper Landberg), studios (Active Theory pour "Santioni Spirits") et marques. La fiche Landberg indique : palette **noir et blanc**, GSAP + Three.js + Nuxt, note 7,73/10, notation par design, usability, creativity, content.
- **À adapter :** la preuve que les portfolios individuels primés reposent sur **une palette réduite + du mouvement** ; la grille d'évaluation (design / usabilité / créativité / contenu) comme checklist interne.
- **À ne pas copier :** la course au prix : l'usabilité est souvent le parent pauvre de ces sites.
- **Perf / a11y / conversion :** Three.js = poids JS important ; à réserver à un élément unique et optionnel.
- **Application :** palette déjà conforme (quasi noir + un accent). Si WebGL il y a, un seul usage : le grain/la déformation du viseur au survol desktop, désactivé en mouvement réduit.

### E. Verre et UI spatiale

#### R16. Nielsen Norman Group : Glassmorphism, définition et bonnes pratiques
- **URL :** https://www.nngroup.com/articles/glassmorphism/
- **Chargement :** oui, Firecrawl (résumé).
- **Mécanismes / règles :** effet d'éléments translucides imitant le verre dépoli, créé par opacité + flou d'arrière-plan pour donner profondeur et hiérarchie ; l'abus nuit à la lisibilité ; recommandations : garantir le contraste du texte, doser le flou, **laisser l'utilisateur réduire la transparence**, s'appuyer sur un design system établi.
- **À adapter :** le verre comme outil de hiérarchie, jamais comme décor.
- **À ne pas copier :** la mode "cartes de verre sur dégradés pastel".
- **Perf / a11y / conversion :** contraste texte sur verre à vérifier sur le pire plan de chaque vidéo, pas sur une maquette.
- **Application :** combinée à R4 : verre réservé à la couche de contrôle, fond opaque `#16151A` en repli.

---

## 2. Contraintes techniques vérifiées (performance et accessibilité)

| Sujet | Source chargée | Ce qu'elle dit | Conséquence pour le site |
|---|---|---|---|
| Lecture auto vidéo iOS | WebKit, "New video policies for iOS" (Firecrawl) | Lecture sans geste permise si la vidéo est **muette ou sans piste audio** ; une vidéo qui gagne du son se met en pause ; sans `playsinline`, plein écran forcé sur iPhone ; `play()` suit les mêmes règles | Toutes les vidéos du feed : `muted playsinline loop` + `poster`. Activer le son seulement après un geste. |
| Lecture auto Chrome | Chrome for Developers, "Autoplay policy in Chrome" (Firecrawl) | **Muted autoplay toujours autorisé** ; autoplay avec son selon interaction préalable, Media Engagement Index, ou PWA installée ; prévoir un repli quand `play()` est refusé | Gérer la promesse de `play()` (catch → afficher bouton lecture). Le choix "son activé" mémorisé ne garantit pas la lecture sonore à la visite suivante. |
| Coût de `backdrop-filter` | Bugzilla Mozilla 1732817 (Firecrawl) + recherche web | Scroll nettement moins fluide sur apple.com dans Firefox Android à cause de `backdrop-filter` (bug ouvert, WebRender) ; retours de terrain : chaque élément flouté dans un conteneur scrollable devient une couche GPU | 2 à 3 surfaces floutées maximum par écran, jamais une par item de liste ; rayon réduit sur mobile (8-12 px) ; pas de flou sur ce qui défile sous un autre flou. |
| Mouvement réduit | MDN `prefers-reduced-motion` (Firecrawl) | Supporté largement depuis 2020 ; valeurs `no-preference` / `reduce` ; remplacer les mouvements par des fondus | Feed : pas d'autoplay en `reduce` (poster + bouton) ; bulles fixes ; timecode qui change sans défilement animé ; grain statique. |
| Transparence réduite | MDN `prefers-reduced-transparency` (Firecrawl) | Fonction **expérimentale**, support partiel | L'utiliser quand dispo, mais prévoir aussi un réglage manuel (toggle "Contraste élevé") et un repli opaque par défaut sur appareils faibles. |
| Zoom | Observation Lusion (`user-scalable=no`) | Bloquer le zoom empêche l'agrandissement du texte | Ne jamais mettre `maximum-scale=1` / `user-scalable=no`. |

---

## 3. Synthèse comparative

| Réf. | Ce qu'on prend | Ce qu'on laisse | Risque perf | Risque a11y | Impact conversion |
|---|---|---|---|---|---|
| R1 Nike | Bloc = 1 titre court + 1 image + 1 CTA | Densité commerciale, anglais sportswear | Moyen (images hero) | Contraste texte/photo | Fort (intention unique) |
| R2 Apple iPhone | Titre + sous-titre de 2-4 mots, paire de CTA, alt descriptifs | Séquences d'images au scroll | Faible si statique | Exemplaire (alt) | Fort |
| R3 Apple Vision Pro | Chapitres nommés, bouton Replay | Longueur | Moyen (vidéos) | Bon (contrôle vidéo) | Moyen ("Book a demo") |
| R4 HIG Materials | Verre = couche de contrôle, clear + voile 35 %, parcimonie | Réfraction native | Faible si dosé | Respect réglages système | Indirect (lisibilité) |
| R5 Duolingo | Feedback émotionnel court, animation à états légère | Mascotte, gamification, couleurs | Faible (Rive/CSS) | Prévoir version statique | Fort sur formulaires |
| R6 TikTok | 1 vidéo active, muet par défaut, son persistant, plein écran vertical | Mur de connexion, compteurs, infini | **Élevé** (page qui a figé le headless) | Swipe seul insuffisant | Fort (temps passé) si fin de bobine → contact |
| R7 Instagram | Bulle + libellé, grande zone tactile, type de média annoncé | Anneau dégradé IG, mur de connexion | Faible | Bon libellé accessible | Moyen (exploration) |
| R8 Iconoclast | Liste de noms comme interface, fiche à 5 projets | Absence de rôle/crédits/CTA | Très faible | Bon | Faible (modèle maison de prod) |
| R9 Partizan | Légende 3 lignes, overlay Prev/Next | DOM dupliqué, cookies | Moyen | Bon (commandes texte) | Moyen |
| R10 Nabil | Film / Photo séparés, sobriété | Aucun contact visible | Très faible | Bon | Faible par choix |
| R11 Lyrical Lemonade | Univers signature, lien source YouTube | Esthétique cartoon, vues | Moyen (iframes) | Moyen | Moyen |
| R12 Colonel Blimp | Photogramme légendé par timecode | Liste non hiérarchisée | Très faible | Bon | Nul (archive) |
| R13 Lusion | Page qui enchaîne sur la suivante, reel avec commandes, tags | 3D permanente, zoom bloqué | **Élevé** | **Mauvais** (zoom) | Moyen |
| R14 Locomotive | Vignette insérée dans le titre, ton personnel, extras | Texte splitté inaccessible, smooth scroll | Moyen | Moyen | Faible |
| R15 Awwwards / Landberg | Palette réduite + mouvement ; grille d'évaluation | Course au prix | Élevé (Three.js) | Variable | Variable |
| R16 NN/g | Règles de contraste et de réduction de transparence | Mode verre décoratif | Faible | Positif | Indirect |

**Lecture transversale :**
1. Les maisons de prod (R8 à R12) montrent le travail mais **ne vendent pas** : c'est l'espace libre pour Sébastien, indépendant, qui doit convertir (devis, réservation).
2. Les plateformes (R6, R7) donnent les **gestes** que le public rap connaît déjà par cœur : vertical, bulles, tap. Les reprendre, c'est zéro apprentissage.
3. Les sites primés (R13 à R15) apportent le **cinéma**, mais leur coût perf/a11y est incompatible avec un feed vidéo mobile : on prend la mise en scène, pas la 3D.
4. Apple (R4) tranche la question du verre : **contrôles oui, contenu non**.

---

## 4. Direction artistique proposée : "Salle de montage"

### 4.1 Idée directrice
Le site n'est pas une galerie, c'est **une timeline de montage ouverte**. Le visiteur "scrubbe" le travail de Sébastien comme on parcourt un banc de montage : les clips sont des rushes, les projets des bobines, les artistes des contre-champs, la demande de devis une feuille de service. Tout ce qui est déjà dans son site actuel (timecode lié au scroll, perforations, curseur viseur, grain) devient **un système cohérent** plutôt qu'une somme d'effets. C'est spécifique à lui : un réalisateur qui est aussi cadreur, monteur et photographe, et le seul de la sélection à pouvoir signer son interface avec la grammaire du montage.

### 4.2 Système visuel (cohérent avec l'existant)
- **Couleurs :** fond `#0B0B0F`, panneaux `#16151A`, texte `#F6F3EC`, secondaire `#9C97A6`. Accent unique **coral `#FF5B3C` utilisé comme le voyant REC** : il signale exclusivement un état "vivant" (vidéo en lecture, élément courant, CTA principal, nouveau projet). Jamais décoratif. Vérifier le contraste du coral sur `#0B0B0F` pour les petits textes ; pour du texte coral de moins de 18 px, préférer le coral en fond avec texte `#0B0B0F`.
- **Typographie :** Bricolage Grotesque pour les noms d'artistes et titres de clips, très gros, coupés sur deux lignes à la manière Apple/Nike ("GAZO / La Rue") ; Inter pour la lecture ; **Space Mono pour tout ce qui est métadonnée de plateau** : timecode, rôle ("RÉAL • IMAGE • MONTAGE"), format, date, lieu.
- **Signature timecode :** un TC global `00:00:00:00` lié au scroll (existant) + un TC local par clip lié au `currentTime` réel de la vidéo. Les vignettes sont légendées par le TC du photogramme (idée tirée de R12).
- **Rythme du mouvement en images, pas en millisecondes :** toutes les durées sont des multiples d'une image à 24 i/s (≈ 41,7 ms) : 3 images (125 ms) pour les micro-états, 6 images (250 ms) pour les transitions d'interface, 12 images (500 ms) pour les entrées de section. Transitions privilégiées : **cut** (changement sec) et **fondu au noir**, plutôt que des glissements élastiques. Le "J-cut" (le son précède l'image) sert de métaphore à l'activation du son : l'icône son s'allume une image avant que la vidéo change.
- **Grain :** overlay statique à ~6 % d'opacité ; animé (en `steps()`, 8 i/s) seulement sur desktop et hors mouvement réduit.
- **Verre "viseur" :** strictement 3 composants (barre d'onglets mobile, pastille son/CTA sur vidéo, étiquette des bulles). Recette : flou 12 px (8 px mobile), fond `rgba(22,21,26,.55)`, liseré intérieur 1 px `rgba(246,243,236,.12)`, voile sombre 35 % ajouté sur plans clairs (R4). Repli : `#16151A` opaque à 92 % si `prefers-reduced-transparency: reduce`, si `navigator.connection.saveData`, ou sur appareils à ≤ 4 cœurs.
- **Perforations :** placeholders de chargement (existant) et barre de progression (formulaires, lecture).
- **Curseur viseur :** desktop uniquement (pointeur fin) ; sur vidéo il affiche le TC et "Clic : son" ; masqué au clavier (le focus visible prend le relais : contour coral 2 px).

### 4.3 Architecture par écran
| Écran | Mobile (sensation app native) | Desktop (cinématographique) |
|---|---|---|
| Accueil | Rangée de bulles artistes en haut (façon highlights) puis feed "Rushes" plein écran | Reel muet en 2.39:1 letterbox, liste typographique des artistes à droite, TC global en bas |
| Feed "Rushes" | Swipe vertical, 1 vidéo active, pastille verre son + "Voir le projet" | Colonne verticale centrée + crédits en marge, navigation flèches ↑ ↓ et molette |
| Artistes "Contre-champs" | Bulles en grille fixe, tap = viewer story des projets | Bulles flottantes (légère parallaxe pointeur), survol = boucle vidéo dans le viseur |
| Projet "Bobine" | Clip → planche contact → générique → making-of, navigation par chapitres collante | Idem avec chapitres horodatés en marge ("00:00 Clip · 03:12 Photos · 04:40 Générique · 05:10 Coulisses") |
| Photo | Planche contact, tap = plein écran avec TC/EXIF en Space Mono | Grille éditoriale, alternance pleine largeur / diptyques |
| Services / devis "Feuille de service" | Stepper 4 étapes, perforations de progression, clap à chaque étape | Même stepper, résumé live en colonne |
| Réservation / paiement | **Aucun effet** : fond opaque, contraste maximal, mouvement minimal | Idem |

---

## 5. Les 5 mécanismes les plus actionnables

1. **Feed "Rushes" à vidéo unique active** (R6, WebKit, Chrome) : conteneur `scroll-snap-type: y mandatory`, chaque slide en `100dvh` ; `IntersectionObserver` (seuil 0,6) qui lance `play()` sur la slide visible et met en pause les autres ; vidéos `muted playsinline loop preload="metadata"` + `poster`, préchargement de la suivante uniquement ; choix "son activé" persistant dans la session ; TC local branché sur `currentTime` ; navigation clavier ↑ ↓ et boutons visibles ; **dernière slide = "Fin de bobine" avec CTA devis**. En `prefers-reduced-motion` : pas d'autoplay, poster + bouton lecture.
2. **Verre réservé à la couche de contrôle** (R4, R16, Bugzilla) : 3 composants maximum, variante "clear" + voile 35 % sur plans lumineux, flou 8-12 px, jamais de `backdrop-filter` sur les items d'une liste qui défile, repli opaque `#16151A` (réduction de transparence, Save-Data, appareils faibles).
3. **Bulles artistes façon highlights** (R7, R8) : portraits ronds 72-92 px avec libellé dessous et zone tactile ≥ 85 px, **anneau coral fin = nouveau projet** (pas de dégradé), `aria-label="Voir les projets avec [artiste]"` ; tap = viewer plein écran des projets de l'artiste avec segments de progression façon timeline et zones tap gauche/droite + boutons ; flottement et parallaxe uniquement desktop et hors mouvement réduit.
4. **Page projet chapitrée et horodatée** (R3, R9, R12, R13) : chapitres "Clip / Photos / Générique / Coulisses" avec navigation collante en timecodes ; légende en trois lignes "Rôle / Artiste / Titre" ; générique de fin déroulant en Space Mono (crédits réels, liens vers l'équipe) ; lecteur avec Prev/Next ; fin de page qui enchaîne sur le projet suivant comme un raccord, avec CTA "Travailler ensemble" juste avant.
5. **Micro-feedback en langage de plateau** (R5) : devis sous forme de "feuille de service" en 4 étapes (type de projet, date/lieu, budget, contact) ; chaque étape validée déclenche un clap de 3 images et remplit une perforation ; messages d'erreur courts et humains ; durées calées sur 3/6/12 images ; version statique en mouvement réduit. Paiement et réservation restent volontairement sobres.

---

## 6. Points de vigilance pour la suite
- Tester le feed sur un Android milieu de gamme et un iPhone ancien : la saturation observée sur TikTok et Lusion en headless montre que la vidéo + effets peut vite bloquer le thread principal.
- Encoder les clips en plusieurs débits (HLS ou au moins 2 MP4 : 540p mobile / 1080p desktop), poster en AVIF/WebP.
- Mesurer le contraste du texte sur verre sur le **plan le plus clair** de chaque clip, pas sur une maquette.
- Ne pas afficher de compteurs de vues ; préférer "Voir sur YouTube" comme preuve vérifiable.
- Vérifier les droits d'usage de chaque clip et portrait d'artiste avant mise en ligne (voir `06-conformite-juridique.md`).

---

## Sources consultées (accès le 9 octobre 2026)

Références retenues :
1. Nike, https://www.nike.com/ (Firecrawl)
2. Apple, iPhone, https://www.apple.com/iphone/ (Firecrawl)
3. Apple, iPhone 18 Pro, https://www.apple.com/iphone-18-pro/ (Firecrawl)
4. Apple, Apple Vision Pro, https://www.apple.com/apple-vision-pro/ (Firecrawl)
5. Apple Developer, Human Interface Guidelines, Materials, https://developer.apple.com/design/human-interface-guidelines/materials (Firecrawl)
6. Duolingo Design, https://design.duolingo.com/ → https://blog.duolingo.com/hub/design/ (Firecrawl)
7. Duolingo Blog, "Elevating craft: How we refreshed our core tabs", https://blog.duolingo.com/core-tabs-redesign/ (Firecrawl)
8. Rive Blog, "Duolingo's AI-powered Video Call brings Lily to life with Rive", https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life (Firecrawl)
9. TikTok, Explore, https://www.tiktok.com/explore (Playwright/Kernel)
10. TikTok, For You, https://www.tiktok.com/foryou (Playwright/Kernel : non chargée, blocage du navigateur)
11. Instagram, profil Nike, https://www.instagram.com/nike/ (Playwright/Kernel)
12. Iconoclast France, Directors, https://iconoclast.tv/fr/directors (Firecrawl)
13. Iconoclast France, Remi Besse, https://iconoclast.tv/fr/directors/remi-besse (Firecrawl)
14. Iconoclast U.S., https://iconoclast.tv/us/ et https://iconoclast.tv/us/music (Firecrawl)
15. Partizan, https://partizan.com/ (Firecrawl)
16. Nabil, https://nabil.com/ et https://nabil.com/film (Firecrawl)
17. Lyrical Lemonade, https://www.lyricallemonade.com/ (Firecrawl)
18. Colonel Blimp (archive), https://colonelblimp.com/ (Firecrawl)
19. Lusion, https://lusion.co/ (Firecrawl ; Playwright en échec)
20. Locomotive, https://locomotive.ca/en (Firecrawl)
21. Awwwards, Sites of the Day, https://www.awwwards.com/websites/sites_of_the_day/ (Firecrawl)
22. Awwwards, Jesper Landberg SOTD, https://www.awwwards.com/sites/jesper-landberg-4 (Firecrawl)
23. Nielsen Norman Group, "Glassmorphism: Definition and Best Practices", https://www.nngroup.com/articles/glassmorphism/ (Firecrawl)

Sources techniques :

24. WebKit, "New video policies for iOS", https://webkit.org/blog/6784/new-video-policies-for-ios/ (Firecrawl)
25. Chrome for Developers, "Autoplay policy in Chrome", https://developer.chrome.com/blog/autoplay (Firecrawl)
26. MDN, `prefers-reduced-motion`, https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion (Firecrawl)
27. MDN, `prefers-reduced-transparency`, https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency (Firecrawl)
28. Mozilla Bugzilla 1732817, "Scrolling on apple.com is much less smooth on fenix than in chrome with backdrop-filter", https://bugzilla.mozilla.org/show_bug.cgi?id=1732817 (Firecrawl)

Consultées mais non retenues :

29. Active Theory, https://activetheory.net/ (renvoie vers `/unsupported`)
30. Division, https://www.division.paris/ (page de connexion)
31. Pulse Films, https://www.pulsefilms.com/ (contenu non lisible en statique)
32. Recherches WebSearch sur les réalisateurs de clips de Gazo/BSB et sur Fifou : aucun site officiel exploitable identifié (presse uniquement : Billboard France, Numéro, Time Out, CNC).
