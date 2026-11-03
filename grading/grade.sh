#!/usr/bin/env bash
# Étalonnage "FP9 nuit froide" sur un ou plusieurs rushs.
# Usage : ./grade.sh rush1.mp4 [rush2.mov ...]   -> sortie dans ./graded/
# Options (variables d'env) :
#   GHOST=1   ajoute la traînée/ghosting de mouvement des réfs
#   CA=4      intensité de l'aberration chromatique en px (0 = off)
#   GRAIN=10  intensité du grain (0 = off)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
LUT="$DIR/fp9_nuit_froide.cube"
CA="${CA:-4}"; GRAIN="${GRAIN:-10}"; GHOST="${GHOST:-0}"
mkdir -p graded
for IN in "$@"; do
  OUT="graded/$(basename "${IN%.*}")_fp9.mp4"
  VF="format=gbrp,lut3d=file='$LUT':interp=tetrahedral"
  [ "$CA" != 0 ] && VF="$VF,rgbashift=rh=-$CA:bh=$CA"
  [ "$GHOST" = 1 ] && VF="$VF,tmix=frames=3:weights='1 0.5 0.25'"
  VF="$VF,vignette=angle=PI/4.5"
  [ "$GRAIN" != 0 ] && VF="$VF,noise=alls=$GRAIN:allf=t"
  VF="$VF,format=yuv420p"
  ffmpeg -hide_banner -y -i "$IN" -vf "$VF" -c:v libx264 -crf 16 -preset slow -c:a copy "$OUT"
  echo "OK -> $OUT"
done
