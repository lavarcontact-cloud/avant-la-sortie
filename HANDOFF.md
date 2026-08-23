# AVANT LA SORTIE — passation vers Claude Code

Candidature de Sébastien pour Responsable Pôle Stratégie Créative (A&R Studios), CDD de remplacement, Universal Music France.

## Concept
Ligne directrice : « Je n'ai pas commencé par un poste. J'ai commencé par un studio. »
Le site raconte une trajectoire (studio → image → développement d'artiste → média) plutôt qu'un CV. Vision assumée mais non promotionnelle : une pensée en construction, née du terrain, sans promesses exagérées.

## Système visuel
- Fond quasi noir `#0A0908`, panneau `#14110D`, texte `#ECE7DD`, accent unique chaud `#C9A15C`, lignes `#2B241C`
- Typo système (pas de police externe chargée) : display en 800, mono pour les eyebrows/labels/stats
- Élément signature : timecode qui tourne en continu en haut à droite, calé sur la progression du scroll (métaphore du montage continu)
- Emplacements vidéo traités comme de la pellicule en attente (perforations, coins de viseur, scanline) — disparaît automatiquement dès qu'un vrai fichier est chargé
- Curseur en forme de viseur (desktop)
- Grain de pellicule permanent, léger, sur tout le site
- Rythme cassé volontairement entre chapitres (alignement, point de départ du texte) pour éviter la répétition mécanique

## Chapitres et statut des assets — mise à jour : plus d'Higgsfield

Sébastien n'a plus accès à Higgsfield. Plutôt que de chercher un autre outil de génération vidéo IA, la stratégie a changé : s'appuyer sur les rushs réels déjà envoyés (qui étaient de toute façon plus cohérents avec le discours "sans promesses exagérées, issu du terrain") et traiter en génératif pur (canvas/CSS, aucun outil externe) les deux seuls endroits sans matière réelle.

**Note Claude Code (2026-08-23, corrigée pour la 2e fois) : ce fichier est régénéré de temps en temps par ailleurs et revient systématiquement avec des fichiers marqués "câblés"/"réels" qui n'ont jamais été livrés dans ce dossier. Le tableau et la liste ci-dessous ont été recorrigés pour matcher ce qui existe réellement sur disque. Si ce fichier est régénéré à nouveau, considérer `index.html` (pas ce document) comme la source de vérité sur ce qui est effectivement câblé — et redemander à Claude Code de revérifier avant de faire confiance à un nouveau statut "fait".**

| Chapitre | Contenu texte | Fond vidéo | Statut |
|---|---|---|---|
| Hero | fait | **canvas génératif** (lueur chaude + poussière en suspension, `#heroCanvas`) | Fait, en code pur. Alternative si Sébastien a une vraie photo du studio : la proposer à la place |
| Origins | fait | `origins-drone-quartier.mp4` (réel, cadré par Sébastien) + photo `origins-millau.jpg` en grande image d'ambiance | Fait |
| Image | fait | pas de fond séparé — 3 bandes de preuves réelles (vidéos, photos plateau, covers) | Fait, avec les fichiers réellement reçus uniquement |
| Générations | fait | emplacement photo sobre en attente (pour une photo de Sébastien au montage/cadrage/studio) | Non bloquant |
| BRK | fait | `brk-background-loop.mp4` — **annoncé mais fichier non reçu**, placeholder pellicule actif. En plus des photos studio : 3 compilations highlights réelles (Katimini, Everyday, Flex), sélectionnées par Sébastien pour leur direction artistique/étalonnage | Partiel — fond vidéo en attente, contenu réel très riche par ailleurs |
| La Var | fait | `lavar-background-loop.mp4` — **annoncé mais fichier non reçu**, placeholder pellicule actif. Bande de preuves réelles (logo, 2 posts, 2 extraits) complète | Partiel — fond vidéo en attente |
| Vision | fait | aucune (contraste voulu) | Fait |
| Final | fait | **canvas génératif** (variante calme du même système que Hero, `#finalCanvas`) + carte contact (nom, email, téléphone) | Fait |

Les prompts Higgsfield restent dans l'historique de la conversation si l'accès revient un jour et que Sébastien veut upgrader Hero ou Final avec une vraie séquence cinématique IA — mais ce n'est plus le chemin critique.

## Assets réellement présents dans ce dossier (vérifié 2026-08-23)
- `lavar-post-klm.jpg`, `lavar-post-creamy.jpg` — posts réels La Var, compressés. **Câblés** dans La Var
- `lavar-logo.png` — logo La Var, recadré. **Câblé** dans La Var
- `lavar-rnboi-preview.mp4`, `lavar-rvfleuze-preview.mp4` — extraits de 7s, sans audio, 480px large. **Câblés** dans La Var
- `l2b-noir-cuts.mp4` (76s), `landy-gazo-maybach-cuts.mp4` (14s), `mhd-afrotrap11-cuts.mp4` (5s) — compilations de passages précis où il apparaît comme acteur dans ces 3 clips officiels. **Câblés** dans la bande de preuves de la section Image
- `festival-fcny-lamano.mp4` — Sébastien photographe accrédité pour Générations, festival FCNY, sur l'apparition de La Mano. Présent dans le dossier mais **plus référencé dans le HTML** depuis le 2026-08-23 (23h) : le crédit FCNY/La Mano a été déplacé en texte dans la section Générations, la vidéo n'y est pas (encore) montée
- `origins-millau.jpg` — photo de Millau (Aveyron), ville natale. **Câblée** dans Origins, en grande image d'ambiance assombrie
- `origins-drone-quartier.mp4` — 2 plans drone réels (Bois-l'Abbé, Les Mordacs), cadrés par Sébastien. **Câblé** en fond de la section Origins
- `image-photo-batbat.jpg`, `image-photo-rvfleuze.jpg`, `image-photo-bilouki.jpg`, `image-photo-dexterhmc.jpg` — photos plateau. **Câblées** dans Image (`dexterhmc` reste hors bande visuelle, cité en texte seul — voir note plus bas)
- `image-cover-leto-pessas.jpg`, `image-cover-negrito-stavo.jpg`, `image-cover-fave-five.jpg`, `image-cover-blackd-leto.jpg` — covers DA. **Câblées** dans Image
- `brk-photo-1.jpg`, `brk-photo-2.jpg`, `brk-photo-3.jpg` — photos réelles de BRK en studio. **Câblées** dans la section BRK (bande "Photos studio")
- `brk-katimini-highlights.mp4`, `brk-everyday-highlights.mp4`, `brk-flex-highlights.mp4` — compilations montées par Sébastien à partir de rushs de 3 clips BRK (Katimini, Everyday, Flex), centrées sur la direction artistique et l'étalonnage propres à chaque clip (chaud nuit / froid contre-jour / vert néon). **Câblées** dans une bande dédiée dans BRK, avant les photos studio
- `dexter-lahasba-bts.mp4` — rushs filmés par Sébastien sur le tournage de Dexter HMC ft. La Hasba, « 91022 ». **Câblé** dans la bande Photographe de plateau
- `scene-rue-groupe.mp4` — BTS du tournage V2V « Crapuleux », Sébastien à la caméra. **Câblé** dans la bande Direction artistique (2026-08-23, 23h) — ce fichier était listé plus bas comme jamais reçu ; il l'est maintenant
- `hld-photo-presse.jpg` — photo de presse pour l'artiste HLD. **Câblée** dans la bande Photographe de plateau
- `klm-100k-photo.jpg` — photo prise sur le tournage du clip « 100K » de KLM. **Câblée** dans la bande Photographe de plateau
- `image-photo-bilouki-2.jpg` — deuxième photo du shoot Bilouki « Paire Assortie ». **Câblée** à côté de la première (qui n'était affichée qu'en texte jusqu'ici, remise en image à cette occasion)

## Fichiers annoncés dans une passation précédente mais jamais reçus dans ce dossier
Ces noms de fichiers apparaissent régulièrement comme "déjà câblés" dans les versions régénérées de ce document, mais ils n'ont jamais été livrés dans `/videos` ou `/images`. Le HTML ne les référence pas (pour éviter des tuiles cassées), sauf comme fond de section avec repli sur le placeholder pellicule :
- `scene-pont-nuit.mp4` (Fascoflex) — pas dans la bande de preuves Image
- `brk-studio-couch.mp4`, `brk-studio-solo.mp4`, `brk-studio-session.mp4` — pas dans la bande de preuves BRK (les 3 vraies photos studio les remplacent avantageusement pour l'instant)
- `brk-motion-abstract.mp4` — jamais placé, chapitre à confirmer
- `brk-background-loop.mp4`, `lavar-background-loop.mp4` — fonds de section, `src` laissé à `null` dans le HTML (placeholder actif) tant qu'ils ne sont pas livrés

**À faire côté Sébastien : renvoyer ces fichiers s'ils existent, pour qu'ils soient câblés à leur tour.**

## Chemins d'assets
Tous les chemins sont relatifs et uniformes (`images/...`, `videos/...`, `posters/...`, sans slash initial).

## Bug corrigé (2026-08-23)
Les vidéos de fond ont `preload="none"` ; assigner `.src` en JS seul ne déclenchait pas toujours le chargement des métadonnées dans certains navigateurs (le slot restait bloqué sur le placeholder même une fois le fichier livré). Le script appelle désormais `video.load()` juste après avoir posé le `src`.

## Refonte visuelle (2026-08-23)
Une passe de direction artistique a été appliquée sur `index.html` à la demande de Sébastien : fond sombre resté dominant (pas d'image de fond systématique par section), photo de Millau mise en avant comme grande image d'ambiance assombrie avec léger zoom continu, tuiles de preuve légèrement agrandies avec effet de survol doux, emplacement photo dédié pour Générations (photo de Sébastien au montage à venir), et carte de contact réelle et cliquable (mailto:/tel:) dans la section Final. **Cette refonte vit uniquement dans `index.html` — si `avant-la-sortie.html` est régénéré ailleurs, il repart de l'ancienne version sans ces changements ; ne pas l'utiliser pour écraser `index.html` sans vérifier d'abord ce qui serait perdu.**

## Passe mobile-first et lisibilité (2026-08-23, suite)
Overlay d'Origins largement renforcé (le fond drone lavait le titre) + filtre d'assombrissement sur les vidéos de fond. Image restructurée en 3 blocs nommés (Acteur / Photographe de plateau / Direction artistique) avec 2-3 visuels et une ligne de crédit chacun, au lieu d'un paragraphe et d'une grille dense — sélection éditoriale faite sur les visuels les plus forts (une photo écartée pour son ton peu adapté à un recruteur, quelques autres gardées en texte seul faute de place). Plus aucun texte technique (« EMPLACEMENT VIDÉO », nom de fichier) visible à l'écran nulle part. Mobile testé à 390px : grille 1-2 colonnes, texte et légendes agrandis, capitales minuscules supprimées, blocs alignés à droite repassent en alignement gauche. Navigation et libellés en français partout.

## Fichier non intégré (2026-08-23, 23h)
`concert-photo-ashe22.jpg` est arrivé à la racine du dossier en même temps que les 6 autres fichiers de cette livraison, mais n'était mentionné dans aucune instruction. Laissé tel quel à la racine, non déplacé, non câblé. À traiter dès que Sébastien précise où (ou si) il doit être utilisé.

## Ce qui n'est PAS encore fait
- **`image-photo-batbat-v2.jpg` (2026-08-23, 23h)** : Sébastien a demandé de remplacer la photo Batbat actuelle par ce fichier recadré en 4:5, censé être dans un dossier `a-integrer/`. Ce dossier n'existe pas et le fichier n'est nulle part sur le disque — seule une image collée dans le message de chat, que Claude Code ne peut pas enregistrer lui-même. La photo Batbat actuelle (`image-photo-batbat.jpg`) est donc restée en place. À refaire dès que le fichier est réellement déposé dans `images/`
- Câbler `brk-background-loop.mp4`, `lavar-background-loop.mp4` dès réception
- Récupérer (si besoin) `scene-rue-groupe.mp4`, `scene-pont-nuit.mp4`, `brk-studio-couch.mp4`, `brk-studio-solo.mp4`, `brk-studio-session.mp4`, `brk-motion-abstract.mp4` — moins urgent maintenant que BRK a des highlights réels et récents
- Final : remplacer le canvas génératif par une vraie photo/vidéo du studio dès que Sébastien l'envoie
- Version mobile 9:16 des vidéos scroll-controlled
- La Var : éventuellement une photo de tournage ou un fond de feed Instagram discret — non fait pour l'instant pour éviter de surcharger une bande déjà riche
