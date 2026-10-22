# Remontage du vlog « Seb V2 »

Source : vidéo YouTube non répertoriée `6YR1KuJPEqc` (47:33).
Dossier exclu du déploiement du site (`.vercelignore`). Les médias tirés de la vidéo (MP3, planches) restent en local, hors git (`.gitignore`).

| Livrable | Fichier |
|---|---|
| A — Diagnostic | `A-diagnostic.md` |
| B — Nouvelle structure | `out/structure.md` (+ `out/structure.csv` pour un tableur) |
| C — Plan détaillé | `C-plan-detaille.md` (+ colonne « Traitement » de B, plan par plan) |
| D — Exécution | ce fichier + `out/remontage.edl`, `out/titres.srt`, `tools/`, `remontage_audio_v1.mp3` (local) |
| E — Direction artistique | `E-direction-artistique.md` |
| Analyse | `analyse/planche_*.jpg` (40 images de la vidéo, local), `analyse/loudness_30s.txt` |

## État réel

**Sources réellement exploitées**
- Sous-titres automatiques horodatés (toute la parole).
- **Piste audio complète** (MP3 320 kb/s, 47:32) récupérée via le connecteur Firecrawl.
- **40 images** capturées dans le lecteur YouTube, ciblées sur les zones sans dialogue et les moments clés. Le timecode d'une image est à +0-6 s près.
- La vidéo elle-même n'est pas téléchargeable depuis cet environnement (YouTube bloqué par le réseau, et aucun connecteur ne rend le fichier vidéo).

**Fait**
- Diagnostic image + son + récit (A). Principaux constats : 1:50 de silence total, 17 dB d'écart de volume entre scènes, la moitié des scènes de rue en vertical avec bandes noires, fil rouge de l'accréditation enterré.
- Nouvelle structure en 9 parties, 63 plans, **22:05** au lieu de 47:33. Elle tient dans `cutlist.py`, la source unique dont tout le reste est généré.
- EDL CMX3600, piste guide `.srt` des textes, tableau CSV.
- **`remontage_audio_v1.mp3`** : la bande-son complète du remontage (22:05), niveaux égalisés (-14,4 LUFS intégré, crête -0,7 dBFS, plage dynamique ramenée de 10,5 à 5,4 LU). **À écouter en premier** : c'est le nouveau récit, sans l'image.

**Testé**
- EDL : vérifiée par script (durée source = durée record pour chaque événement, timeline continue).
- `render_rough.py` : testé sur une fausse source de 47:33 avec timecode incrusté (plans au bon timecode, durée exacte, seul noir = carton titre).
- `render_audio.py` : exécuté sur la vraie piste audio ; intensité mesurée après rendu (chiffres ci-dessus).
- `analyse_source.sh` : testé sur la fausse source.

**Pas fait**
- Montage image final, motion design, sound design, étalonnage, export : spécifiés (C, E), à exécuter dans Premiere / After Effects avec le fichier vidéo.
- Les points de coupe sont calés sur la parole et sur 40 images : à affiner image par image.

## Utilisation

Prérequis : Python 3 et ffmpeg (`brew install ffmpeg` sur Mac).

```bash
# 0. Placer l'export (ou mieux, le master d'origine) ici sous le nom SEBV2.mp4
#    (sur ta machine : yt-dlp -f "bv*+ba/b" -o SEBV2.mp4 "https://youtu.be/6YR1KuJPEqc")

# 1. Vérifier la cadence, puis générer EDL / SRT / tableaux
ffprobe -v error -select_streams v -show_entries stream=r_frame_rate SEBV2.mp4
python3 build.py --fps 25          # remplacer 25 par la cadence réelle

# 2. Regarder la structure en vidéo (assembly, sans finition)
python3 tools/render_rough.py SEBV2.mp4 --out assembly.mp4 --titles

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
