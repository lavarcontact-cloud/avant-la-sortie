#!/usr/bin/env bash
# Analyse technique de l'export (ou d'un rush) avec ffmpeg.
#   bash tools/analyse_source.sh SEBV2.mp4 [dossier_sortie]
#
# Produit :
#   infos.txt        format, cadence, résolution, pistes audio
#   coupes.txt       changements de plan détectés (seuil 10 %) → rythme réel du montage actuel
#   noirs.txt        images noires ≥ 0,1 s (frames noires involontaires)
#   silences.txt     silences ≥ 1,5 s sous -40 dB
#   loudness.txt     intensité intégrée (LUFS), plage, crête — cible YouTube ≈ -14 LUFS
#   planches/        une planche contact par minute (6 vignettes, une toutes les 10 s)
#
# Envoie-moi coupes.txt et le dossier planches/ : je pourrai voir l'image
# et remplacer les « À VISIONNER » de cutlist.py par de vrais choix de plans.
set -euo pipefail
src="$1"; out="${2:-analyse}"
mkdir -p "$out/planches"

ffprobe -v error -show_entries format=duration,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,channels,sample_rate \
  -of default=noprint_wrappers=1 "$src" > "$out/infos.txt"

ffmpeg -hide_banner -nostats -i "$src" -an -vf "scale=320:-2,select='gt(scene,0.10)',metadata=print:file=-" -f null - 2>/dev/null \
  | awk -F'pts_time:' '/pts_time/{split($2,a," "); t=a[1]; printf "%02d:%05.2f\n", int(t/60), t-60*int(t/60)}' > "$out/coupes.txt"

ffmpeg -hide_banner -nostats -i "$src" -an -vf "blackdetect=d=0.1:pix_th=0.10" -f null - 2>&1 | grep blackdetect > "$out/noirs.txt" || true
ffmpeg -hide_banner -nostats -i "$src" -vn -af "silencedetect=n=-40dB:d=1.5" -f null - 2>&1 | grep silence_ > "$out/silences.txt" || true
ffmpeg -hide_banner -nostats -i "$src" -vn -af "ebur128=peak=true" -f null - 2>&1 | sed -n '/Summary:/,$p' > "$out/loudness.txt"

ffmpeg -hide_banner -v error -i "$src" -vf "fps=1/10,scale=320:-2,drawtext=text='%{pts\:hms}':x=6:y=6:fontcolor=white:box=1:boxcolor=black@0.6,tile=3x2" \
  -vsync vfr "$out/planches/minute_%03d.jpg"

n=$(wc -l < "$out/coupes.txt")
dur=$(awk -F= '/^duration=/{print $2; exit}' "$out/infos.txt")
echo "Coupes détectées : $n  →  plan moyen ≈ $(awk -v d="$dur" -v n="$n" 'BEGIN{printf "%.1f", d/(n+1)}') s"
echo "Résultats dans $out/"
