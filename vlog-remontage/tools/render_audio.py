#!/usr/bin/env python3
"""Rend la bande-son seule du remontage (« radio edit »), avec niveaux égalisés.

  python3 tools/render_audio.py SEBV2.mp3 --out remontage_audio.mp3

Sert à écouter le nouveau récit et son rythme avant de toucher à l'image.
Chaque plan est normalisé séparément (loudnorm, -16 LUFS) pour gommer les
écarts de l'export (jusqu'à 17 dB entre le concert et le dimanche matin),
puis l'ensemble est calé à -14 LUFS / -1 dBTP (cible YouTube).
Les cartons titre deviennent des silences.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from cutlist import CUTS, GAP  # noqa: E402

FMT = ["-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le"]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("source", help="export vidéo ou piste audio")
    p.add_argument("--out", default="remontage_audio.mp3")
    args = p.parse_args()

    tmp = tempfile.mkdtemp(prefix="remontage_audio_")
    try:
        parts = []
        for i, c in enumerate(CUTS, 1):
            seg = os.path.join(tmp, f"{i:03d}.wav")
            if c["src"] == GAP:
                cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo:d={c['dur']}", *FMT, seg]
            else:
                a, b = c["src"]
                # fondu de 15 ms aux bords : évite les clics aux coupes
                fade = f"afade=t=in:d=0.015,afade=t=out:st={b - a - 0.015:.3f}:d=0.015"
                cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", args.source,
                       "-vn", "-af", f"loudnorm=I=-16:TP=-2:LRA=11,{fade}", *FMT, seg]
            subprocess.run(cmd, check=True)
            parts.append(seg)
        lst = os.path.join(tmp, "list.txt")
        with open(lst, "w") as f:
            f.writelines(f"file '{x}'\n" for x in parts)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
                        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.79:level=false", "-ar", "48000", "-b:a", "192k", args.out], check=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(args.out)


if __name__ == "__main__":
    main()
