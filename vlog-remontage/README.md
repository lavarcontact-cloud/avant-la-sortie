# Remontage du vlog « Seb V2 »

Source : vidéo YouTube non répertoriée `6YR1KuJPEqc` (47:33).
Dossier exclu du déploiement du site (`.vercelignore`).

| Livrable | Fichier |
|---|---|
| A — Diagnostic | `A-diagnostic.md` |
| B — Nouvelle structure | `out/structure.md` (+ `out/structure.csv` pour un tableur) |
| C — Plan détaillé | `C-plan-detaille.md` (+ colonne « Traitement » de B, plan par plan) |
| D — Exécution | ce fichier + `out/remontage.edl`, `out/titres.srt`, `tools/` |
| E — Direction artistique | `E-direction-artistique.md` |

## État réel

**Fait**
- Analyse de toute la parole de la vidéo à partir des sous-titres automatiques horodatés de YouTube.
- Nouvelle structure en 9 parties, 58 plans, **21:08** au lieu de 47:33. Elle tient dans `cutlist.py`, la source unique dont tout le reste est généré.
- EDL CMX3600 (Premiere / Resolve / Avid), piste de textes `.srt` calée sur la nouvelle timeline, tableau CSV.
- Script de rendu d'une **assembly** (version de travail) et script d'analyse technique de la source.

**Testé**
- `build.py` : EDL vérifiée par script. Chaque événement a une durée source égale à sa durée record, et la timeline est continue, sans trou ni chevauchement.
- `tools/render_rough.py` : testé sur une fausse source de 47:33 avec timecode incrusté. Les plans tombent au bon timecode source (35:16, 04:20, 39:51 contrôlés à l'image), le rendu dure exactement 21:08 à 25 i/s, et le seul noir est le carton titre voulu.
- `tools/analyse_source.sh` : détection des coupes, des noirs, des silences, de l'intensité sonore et planches contact, testée sur la même fausse source.

**Pas fait (et pourquoi)**
- **Je n'ai vu aucune image** : YouTube est bloqué en téléchargement dans mon environnement. Les points de coupe viennent de la parole (±1 s) et tous les blocs musicaux sont marqués « À VISIONNER ».
- Pas de motion design, de sound design ni d'étalonnage réalisés : ils sont spécifiés (C et E), à exécuter dans Premiere / After Effects.
- Pas d'export final.

## Utilisation

Prérequis : Python 3 et ffmpeg (`brew install ffmpeg` sur Mac).

```bash
# 0. Récupérer l'export (ou mieux, ton fichier master d'origine), le nommer SEBV2.mp4
yt-dlp -f "bv*+ba/b" -o SEBV2.mp4 "https://youtu.be/6YR1KuJPEqc"

# 1. Vérifier la cadence (r_frame_rate) puis générer EDL / SRT / tableaux
ffprobe -v error -select_streams v -show_entries stream=r_frame_rate SEBV2.mp4
python3 build.py --fps 25          # remplacer 25 par la cadence réelle

# 2. Regarder la structure avant tout travail de finition
python3 tools/render_rough.py SEBV2.mp4 --out assembly.mp4 --titles

# 3. Analyse technique de la source (et planches contact à m'envoyer)
bash tools/analyse_source.sh SEBV2.mp4 analyse
```

### Dans Premiere Pro
1. Fichier > Importer > `out/remontage.edl` (réglages de séquence = ceux de l'export). Quand Premiere demande les médias, lier la bobine `SEBV2` à `SEBV2.mp4`.
2. Importer `out/titres.srt` et le glisser sur la séquence : c'est une **piste guide**. Chaque texte indique où placer un titre animé (After Effects / Essential Graphics) selon `E-direction-artistique.md`.
3. Affiner chaque coupe à l'image (les points d'entrée et de sortie sont à ±1 s), puis appliquer la colonne « Traitement » de `out/structure.md`.
4. Garder le projet du premier monteur **intact**. Travailler dans une copie ou dans une nouvelle séquence.

### Modifier la structure
Tout se change dans `cutlist.py` (ordre, entrées et sorties, textes), puis relancer `python3 build.py`. Ne pas éditer les fichiers de `out/` à la main.

## Ce qu'il me faut pour aller plus loin
1. **Le projet Premiere du monteur + les rushs**, sinon au moins le master non compressé. Avec seulement l'export, impossible de séparer voix et musique ou de reprendre un plan plus long.
2. Ou, a minima, l'**accès à la vidéo** depuis cet environnement (autoriser `youtube.com` et `googlevideo.com` dans le réseau de l'environnement), ou les **planches contact** produites par `analyse_source.sh` : je pourrai alors choisir les plans des zones « À VISIONNER ».
3. Les vérifications listées dans la colonne ⚠ de `out/structure.md` : noms exacts, salle, jours, et comment tu es entré au concert.
