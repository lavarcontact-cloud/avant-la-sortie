#!/usr/bin/env bash
# Génère une affiche (poster) JPEG pour chaque vidéo de public/media/videos,
# à partir d'une vraie image de la vidéo (1 s), et vérifie le "faststart"
# (atome moov en tête) pour une lecture progressive immédiate.
set -euo pipefail
cd "$(dirname "$0")/../public/media"
for v in videos/*.mp4; do
  n=$(basename "$v" .mp4)
  [ -f "posters/$n.jpg" ] || ffmpeg -v error -y -ss 1 -i "$v" -frames:v 1 -q:v 4 "posters/$n.jpg"
  # Ordre des atomes MP4 : faststart = "moov" avant "mdat".
  order=$(python3 -c "import struct,sys
d=open(sys.argv[1],'rb').read();i=0;o=[]
while i<len(d)-8:
  s=struct.unpack('>I',d[i:i+4])[0];o.append(d[i+4:i+8].decode('latin1'))
  s=struct.unpack('>Q',d[i+8:i+16])[0] if s==1 else s
  if s<8: break
  i+=s
print(' '.join(o))" "$v")
  if [[ "$order" == *mdat*moov* ]]; then
    ffmpeg -v error -y -i "$v" -c copy -movflags +faststart "$v.tmp.mp4" && mv "$v.tmp.mp4" "$v"
    echo "faststart: $n"
  fi
done
ls posters | wc -l
