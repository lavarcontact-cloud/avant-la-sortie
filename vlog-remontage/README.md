# Remontage du vlog « Seb V2 »

Source : vidéo YouTube non répertoriée `6YR1KuJPEqc` (47:33).
Dossier exclu du déploiement du site (`.vercelignore`). Les médias tirés de la vidéo (MP3, planches) restent en local, hors git (`.gitignore`).

| Livrable | Fichier |
|---|---|
| A — Diagnostic | `A-diagnostic.md` |
| B — Nouvelle structure | `out/structure.md` (+ `out/structure.csv` pour un tableur) |
| C — Plan détaillé | `C-plan-detaille.md` (+ colonne « Traitement » de B, plan par plan) |
| D — Exécution | ce fichier + `out/remontage.edl`, `out/titres.srt`, `tools/`, `remontage_v1_apercu.mp4` et `remontage_audio_v1.mp3` (locaux) |
| E — Direction artistique | `E-direction-artistique.md` |
| Analyse | `analyse/video/` (coupes, noirs, silences, planches toutes les 10 s), `analyse/loudness_30s.txt` |

## État réel

**Sources réellement exploitées**
- **Le fichier vidéo** de la version YouTube (`media/SEBV2.mp4`, 1280×720, 25 i/s, H.264 à 1,2 Mb/s, AAC 44,1 kHz, 47:32,8). C'est une copie compressée, pas le master : assez bonne pour la structure, trop faible pour l'export final.
- Analyse complète : coupes, noirs, silences, intensité sonore, une image toutes les 10 s sur 47 min (`analyse/video/`, local).
- Sous-titres automatiques horodatés (toute la parole).

**Fait**
- Diagnostic image + son + récit (A), complété par l'analyse du fichier.
- Nouvelle structure : 9 parties, 68 plans, **21:49** au lieu de 47:33 (`cutlist.py`, source unique).
- Points de coupe vérifiés à l'image pour le concert et le cold open. 5 images noires parasites retirées. 3 plans à l'image inutilisable (noire, sangle du sac) recouverts par des images de la même scène ou de la même nuit (b-roll), le son restant d'origine.
- EDL CMX3600 (événements image et son séparés pour les b-rolls), piste guide `.srt`, CSV.
- **`remontage_v1_apercu.mp4`** : **l'assembly regardable de la nouvelle structure** (21:50, 540p), son égalisé plan par plan (-14,2 LUFS, crête -1,3 dBTP), repères de texte en blanc. C'est un **ours** (ordre, durées, rythme de récit), pas le montage fini.

**Testé / vérifié**
- EDL : durée source = durée record pour chaque événement, timeline continue (script).
- Assembly : durée 21:49,8 pour 21:49,7 attendus ; seuls noirs = les 2 cartons voulus ; planches contact relues.
- Mesures d'intensité après rendu (chiffres ci-dessus).

**Pas fait**
- Motion design, sound design, triptyques verticaux, étalonnage, export final : spécifiés (C, E), à faire dans Premiere / After Effects, idéalement à partir du **master** et des rushs.
- Les coupes hors concert et cold open restent calées sur la parole (±1 s) : à affiner image par image.

## Utilisation

Prérequis : Python 3 et ffmpeg (`brew install ffmpeg` sur Mac).

```bash
# 0. Placer l'export (ou mieux, le master d'origine) ici sous le nom SEBV2.mp4
#    (sur ta machine : yt-dlp -f "bv*+ba/b" -o SEBV2.mp4 "https://youtu.be/6YR1KuJPEqc")

# 1. Vérifier la cadence, puis générer EDL / SRT / tableaux
ffprobe -v error -select_streams v -show_entries stream=r_frame_rate SEBV2.mp4
python3 build.py --fps 25          # remplacer 25 par la cadence réelle

# 2. Regarder la structure en vidéo (assembly, sans finition)
python3 tools/render_rough.py SEBV2.mp4 --out assembly.mp4 --titles --level

# 3. Bande-son seule, niveaux égalisés
python3 tools/render_audio.py SEBV2.mp4 --out remontage_audio.mp3

# 4. Analyse technique (coupes, noirs, silences, loudness, planches contact)
bash tools/analyse_source.sh SEBV2.mp4 analyse
```

### Dans Premiere Pro
1. Fichier > Importer > `out/remontage.edl` (réglages de séquence = ceux de l'export). Lier la bobine `SEBV2` à `SEBV2.mp4`.
2. Importer `out/titres.srt` sur la séquence : c'est une **piste guide**, pas l'habillage final.
3. Son d'abord : *Audio Essentiel > Dialogue > Unifier l'intensité* sur toutes les scènes parlées, puis comparer avec `remontage_audio_v1.mp3`.
4. Plans verticaux : appliquer la règle de `C-plan-detaille.md` (fond flouté / triptyque).
5. Garder le projet du premier monteur **intact**. Travailler dans une nouvelle séquence.

### Modifier la structure
Tout se change dans `cutlist.py`, puis relancer `python3 build.py`. Ne pas éditer `out/` à la main.

## Ce qu'il me faut pour aller plus loin
1. **Le projet Premiere + les rushs** (ou au moins le master) : pour retrouver le son manquant de 10:40 → 12:30 et séparer voix et musique.
2. **Les confirmations de la colonne ⚠** de `out/structure.md` : noms exacts, salle, ordre des derniers jours, comment tu es entré au concert, timecode de Leto.
