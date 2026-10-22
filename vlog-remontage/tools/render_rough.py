#!/usr/bin/env python3
"""Rend une version « assembly » du remontage à partir de l'export, avec ffmpeg.

  python3 tools/render_rough.py SEBV2.mp4 --out assembly.mp4 [--titles] [--height 720]

Ce n'est PAS le montage final : pas de motion design, pas de sound design.
C'est l'ordre et la durée des plans, pour juger la structure en la regardant.
--titles incruste les textes de cutlist.py en simple texte blanc (repères, pas du design).
Chaque plan est réencodé en H.264/AAC à cadence fixe, puis tout est concaténé.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from cutlist import CUTS, GAP  # noqa: E402


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,r_frame_rate",
                          "-of", "json", path], check=True, capture_output=True, text=True).stdout
    info = json.loads(out)
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    num, den = map(int, video["r_frame_rate"].split("/"))
    return float(info["format"]["duration"]), num / den


def font():
    try:
        return subprocess.run(["fc-match", "-f", "%{file}", "sans:bold"], capture_output=True, text=True).stdout or None
    except FileNotFoundError:
        return None


def drawtext(text, fontfile):
    esc = text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’")
    ff = f"fontfile='{fontfile}':" if fontfile else ""
    return (f"drawtext={ff}text='{esc}':fontcolor=white:fontsize=h/12:borderw=3:bordercolor=black"
            f":x=(w-text_w)/2:y=h*0.78:enable='lt(t,2.5)'")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("source")
    p.add_argument("--out", default="assembly.mp4")
    p.add_argument("--height", type=int, default=720)
    p.add_argument("--titles", action="store_true")
    args = p.parse_args()

    duration, fps = probe(args.source)
    for i, c in enumerate(CUTS, 1):
        if c["src"] != GAP and c["src"][1] > duration + 0.5:
            sys.exit(f"plan {i} : sortie {c['src'][1]} s au-delà de la durée de la source ({duration:.1f} s)")

    fontfile = font() if args.titles else None
    scale = f"scale=-2:{args.height},fps={fps:.3f},format=yuv420p"
    enc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]
    tmp = tempfile.mkdtemp(prefix="remontage_")
    parts = []
    try:
        for i, c in enumerate(CUTS, 1):
            seg = os.path.join(tmp, f"{i:03d}.mp4")
            vf = scale + ("," + drawtext(c["title"], fontfile) if args.titles and c.get("title") else "")
            if c["src"] == GAP:
                width = round(args.height * 16 / 9 / 2) * 2
                cmd = ["ffmpeg", "-y", "-v", "error",
                       "-f", "lavfi", "-i", f"color=black:s={width}x{args.height}:r={fps:.3f}:d={c['dur']}",
                       "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo:d={c['dur']}",
                       "-vf", vf, "-shortest", *enc, seg]
            else:
                a, b = c["src"]
                cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.3f}", "-i", args.source, "-t", f"{b - a:.3f}",
                       "-vf", vf, *enc, seg]
            subprocess.run(cmd, check=True)
            parts.append(seg)
            print(f"\r{i}/{len(CUTS)}", end="", flush=True)
        lst = os.path.join(tmp, "list.txt")
        with open(lst, "w") as f:
            f.writelines(f"file '{x}'\n" for x in parts)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
                        "-c", "copy", "-movflags", "+faststart", args.out], check=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    out_dur, _ = probe(args.out)
    print(f"\n{args.out} : {out_dur / 60:.0f} min {out_dur % 60:04.1f} s")


if __name__ == "__main__":
    main()
