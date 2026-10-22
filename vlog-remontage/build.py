#!/usr/bin/env python3
"""Génère les fichiers de montage à partir de cutlist.py.

  python3 build.py --fps 25

Sorties (dans out/) :
  remontage.edl          EDL CMX3600, une seule bobine (l'export) + noirs pour les cartons
  titres.srt             textes à l'écran, calés sur la NOUVELLE timeline (piste guide)
  structure.csv          liste complète, ouvrable dans un tableur
  structure.md           tableau du Livrable B
"""
import argparse
import csv
import os

from cutlist import CUTS, GAP

REEL = "SEBV2"


def tc_f(frames, fps):
    f = frames % fps
    s = frames // fps
    return f"{s // 3600:02d}:{s // 60 % 60:02d}:{s % 60:02d}:{f:02d}"


def srt_tc(seconds):
    ms = round(seconds * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def mmss(seconds):
    s = int(seconds)
    return f"{s // 60}:{s % 60:02d}"


def timeline(cuts):
    """Ajoute la position de chaque plan sur la nouvelle timeline."""
    pos = 0.0
    rows = []
    for i, c in enumerate(cuts, 1):
        if c["src"] == GAP:
            dur = c["dur"]
        else:
            a, b = c["src"]
            if b <= a:
                raise ValueError(f"plan {i} : sortie avant entrée ({a}, {b})")
            dur = b - a
        rows.append(dict(c, n=i, rec_in=pos, rec_out=pos + dur, dur=dur))
        pos += dur
    return rows


def write_edl(rows, fps, path):
    """Tout en images entières : durée source == durée record, pas de trou ni de chevauchement."""
    rec = 0
    with open(path, "w", encoding="utf-8") as f:
        f.write("TITLE: SEB V2 REMONTAGE\nFCM: NON-DROP FRAME\n\n")
        for r in rows:
            if r["src"] == GAP:
                dur = round(r["dur"] * fps)
                rec_in, rec_out = tc_f(rec, fps), tc_f(rec + dur, fps)
                f.write(f"{r['n']:03d}  BL       V     C        00:00:00:00 {tc_f(dur, fps)} {rec_in} {rec_out}\n")
                f.write(f"* CARTON: {r['title'] or ''}\n\n")
                rec += dur
                continue
            src_in = round(r["src"][0] * fps)
            dur = round(r["src"][1] * fps) - src_in
            rec_in, rec_out = tc_f(rec, fps), tc_f(rec + dur, fps)
            rec += dur
            a, b = tc_f(src_in, fps), tc_f(src_in + dur, fps)
            # B = vidéo + audio 1/2 (AA/V)
            f.write(f"{r['n']:03d}  {REEL:<8} AA/V  C        {a} {b} {rec_in} {rec_out}\n")
            f.write(f"* FROM CLIP NAME: {REEL}.mp4\n")
            f.write(f"* {r['act']} | {r['goal']}\n\n")


def write_srt(rows, path):
    n = 0
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            if not r["title"]:
                continue
            n += 1
            end = min(r["rec_out"], r["rec_in"] + 2.5)
            f.write(f"{n}\n{srt_tc(r['rec_in'])} --> {srt_tc(end)}\n{r['title']}\n\n")


def write_csv(rows, path):
    cols = ["n", "act", "src_in", "src_out", "rec_in", "rec_out", "dur", "heard", "goal", "fx", "title", "check"]
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            src_in, src_out = ("CARTON", "") if r["src"] == GAP else (mmss(r["src"][0]), mmss(r["src"][1]))
            w.writerow([r["n"], r["act"], src_in, src_out, mmss(r["rec_in"]), mmss(r["rec_out"]),
                        round(r["dur"], 1), r["heard"], r["goal"], r["fx"], r["title"] or "", r["check"] or ""])


def write_md(rows, path):
    acts = {}
    for r in rows:
        acts.setdefault(r["act"], []).append(r)
    total = rows[-1]["rec_out"]
    with open(path, "w", encoding="utf-8") as f:
        f.write("# Livrable B — Nouvelle structure narrative\n\n")
        f.write("Généré par `build.py` depuis `cutlist.py`. Timecodes source = export YouTube « Seb V2 » (47:33), "
                "calés sur les sous-titres automatiques horodatés (±1 s). Aucun plan n'a encore été vu à l'image.\n\n")
        f.write(f"**Durée de l'assembly : {mmss(total)}** (source : 47:33).\n\n")
        f.write("## Vue par acte\n\n| Acte | Position | Durée |\n|---|---|---|\n")
        for act, rs in acts.items():
            f.write(f"| {act} | {mmss(rs[0]['rec_in'])} → {mmss(rs[-1]['rec_out'])} | {mmss(rs[-1]['rec_out'] - rs[0]['rec_in'])} |\n")
        f.write("\n## Plan par plan\n\n")
        f.write("| # | Séquence | Timecode source | Nouvelle position | Durée cible | Objectif narratif | Traitement |\n")
        f.write("|---|---|---|---|---|---|---|\n")
        for r in rows:
            src = "carton" if r["src"] == GAP else f"{mmss(r['src'][0])} → {mmss(r['src'][1])}"
            treat = r["fx"] + (f" **Texte : {r['title']}**" if r["title"] else "")
            if r["check"]:
                treat += f" ⚠ {r['check']}"
            f.write(f"| {r['n']} | {r['act']} — {r['heard']} | {src} | {mmss(r['rec_in'])} | {round(r['dur'])} s "
                    f"| {r['goal']} | {treat} |\n")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--fps", type=int, default=25, help="cadence de l'export (vérifier avec ffprobe)")
    p.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "out"))
    args = p.parse_args()
    os.makedirs(args.out, exist_ok=True)
    rows = timeline(CUTS)
    write_edl(rows, args.fps, os.path.join(args.out, "remontage.edl"))
    write_srt(rows, os.path.join(args.out, "titres.srt"))
    write_csv(rows, os.path.join(args.out, "structure.csv"))
    write_md(rows, os.path.join(args.out, "structure.md"))
    print(f"{len(rows)} plans, durée {mmss(rows[-1]['rec_out'])} -> {args.out}")


if __name__ == "__main__":
    main()
