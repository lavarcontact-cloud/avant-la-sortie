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

**Note Claude Code (2026-08-23) : cette table listait plusieurs fichiers comme "câblés"/"réels" alors qu'ils n'étaient pas présents dans le dossier livré. Le statut ci-dessous reflète ce qui existe réellement sur disque après vérification.**

| Chapitre | Contenu texte | Fond vidéo | Statut |
|---|---|---|---|
| Hero | fait | **canvas génératif** (lueur chaude + poussière en suspension, `#heroCanvas`) | Fait, en code pur. Alternative si Sébastien a une vraie photo du studio : la proposer à la place |
| Origins | fait | `origins-drone-quartier.mp4` (réel, cadré par Sébastien) + photo `origins-millau.jpg` | Fait |
| Image | fait | pas de fond séparé — 3 bandes de preuves réelles (vidéos, photos plateau, covers) | Fait avec les fichiers réellement reçus : `l2b-noir-cuts.mp4`, `landy-gazo-maybach-cuts.mp4`, `mhd-afrotrap11-cuts.mp4`, `festival-fcny-lamano.mp4`, 4 photos plateau, 4 covers |
| Générations | fait | image fixe optionnelle | Non bloquant |
| BRK | fait | `brk-background-loop.mp4` — **annoncé mais fichier non reçu** ; placeholder pellicule affiché en attendant | Partiel — en attente du fichier vidéo |
| La Var | fait | `lavar-background-loop.mp4` — **annoncé mais fichier non reçu** ; placeholder pellicule affiché en attendant. Bande de preuves réelles (logo, 2 posts, 2 extraits) déjà intégrée et fonctionnelle | Partiel — en attente du fichier vidéo de fond (la bande de preuves, elle, est complète) |
| Vision | fait | aucune (contraste voulu) | Fait |
| Final | fait | **canvas génératif** (variante calme du même système que Hero, `#finalCanvas`) | Fait, en attendant une vraie photo du studio — à remplacer si Sébastien en envoie une |

Les prompts Higgsfield restent dans l'historique de la conversation si l'accès revient un jour et que Sébastien veut upgrader Hero ou Final avec une vraie séquence cinématique IA — mais ce n'est plus le chemin critique.

## Assets réellement présents dans ce dossier (vérifié 2026-08-23)
- `lavar-post-klm.jpg`, `lavar-post-creamy.jpg` — posts réels La Var, compressés. **Câblés** dans La Var
- `lavar-logo.png` — logo La Var, recadré. **Câblé** dans La Var
- `lavar-rnboi-preview.mp4`, `lavar-rvfleuze-preview.mp4` — extraits de 7s, sans audio, 480px large. **Câblés** dans La Var
- `l2b-noir-cuts.mp4` (76s), `landy-gazo-maybach-cuts.mp4` (14s), `mhd-afrotrap11-cuts.mp4` (5s) — compilations de passages précis où il apparaît comme acteur dans ces 3 clips officiels. **Câblés** dans la bande de preuves de la section Image
- `festival-fcny-lamano.mp4` — Sébastien photographe, festival Fcny, aux côtés de l'artiste La Mano. **Câblé** dans la section Image
- `origins-millau.jpg` — photo de Millau (Aveyron), ville natale. **Câblée** dans Origins
- `image-photo-batbat.jpg`, `image-photo-rvfleuze.jpg`, `image-photo-bilouki.jpg`, `image-photo-dexterhmc.jpg` — photos plateau. **Câblées** dans Image
- `image-cover-leto-pessas.jpg`, `image-cover-negrito-stavo.jpg`, `image-cover-fave-five.jpg`, `image-cover-blackd-leto.jpg` — covers DA. **Câblées** dans Image

## Fichiers annoncés dans une passation précédente mais jamais reçus dans ce dossier
Ces noms de fichiers apparaissaient comme "déjà câblés" dans une version antérieure de ce document, mais ils n'ont jamais été livrés dans `/videos` ou `/images`. Le HTML ne les référence plus (pour éviter des tuiles cassées) sauf comme fond de section avec repli sur le placeholder pellicule :
- `scene-rue-groupe.mp4` (V2V « Crapuleux »), `scene-pont-nuit.mp4` (Fascoflex) — retirés de la bande de preuves Image
- `brk-studio-couch.mp4`, `brk-studio-solo.mp4`, `brk-studio-session.mp4` — bande de preuves BRK retirée en attendant
- `brk-motion-abstract.mp4` — jamais placé, chapitre à confirmer
- `brk-background-loop.mp4`, `lavar-background-loop.mp4` — fonds de section, référencés en commentaire dans le HTML mais `src` laissé à `null` (placeholder actif) tant qu'ils ne sont pas livrés

`origins-drone-quartier.mp4` a depuis été reçu (déposé dans `videos/`, 2026-08-23) et est maintenant câblé en fond de la section Origins — retiré de cette liste.

**À faire côté Sébastien : renvoyer les fichiers restants ci-dessus s'ils existent, pour qu'ils soient câblés à leur tour.**

## Bug corrigé (2026-08-23)
Les vidéos de fond ont `preload="none"` ; assigner `.src` en JS seul ne déclenchait pas toujours le chargement des métadonnées dans certains navigateurs (le slot restait bloqué sur le placeholder même une fois le fichier livré). Le script appelle désormais `video.load()` juste après avoir posé le `src`, ce qui corrige le chargement pour tous les fonds de section à venir (BRK, La Var).

## Chemins d'assets
Tous les chemins sont désormais relatifs et uniformes (`images/...`, `videos/...`, `posters/...`, sans slash initial) — le point corrigé lors du passage sur Claude Code le 2026-08-23.

## Ce qui n'est PAS encore fait
- Origins, BRK, La Var : câbler les vraies vidéos de fond dès réception (`origins-drone-quartier.mp4`, `brk-background-loop.mp4`, `lavar-background-loop.mp4`)
- Récupérer (si besoin) `scene-rue-groupe.mp4`, `scene-pont-nuit.mp4`, `brk-studio-couch.mp4`, `brk-studio-solo.mp4`, `brk-studio-session.mp4`, `brk-motion-abstract.mp4`
- Final : remplacer le canvas génératif par une vraie photo/vidéo du studio dès que Sébastien l'envoie
- Email de contact dans la section Final (placeholder actuel)
- Version mobile 9:16 des vidéos scroll-controlled
- Décider si Origins garde son idée de crossfade vers un plan intérieur studio, ou reste tel quel une fois le plan drone reçu
