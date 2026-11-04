"""`scf-agent bench` : banc d'essai LOCAL sur tes vraies vidéos (phase 6.1).

    scf-agent bench --videos ~/Bench --model small --language fr --out ~/Bench/rapport

Pour chaque vidéo du dossier : temps de chaque étape, facteur temps réel,
statut de transcription, langue détectée, nombre de mots incertains. Si un
fichier de référence existe à côté (`<nom>.srt` ou `<nom>.txt`, écrit par toi),
calcule WER, CER, calibration des incertitudes et précision des timecodes.

Rien n'est envoyé au Cloud ni à un fournisseur : tout reste sur l'ordinateur.
"""
from __future__ import annotations

import json
import time
from dataclasses import asdict
from pathlib import Path

from . import processing
from .quality import evaluate, parse_srt

VIDEO_EXT = {".mov", ".mp4", ".m4v", ".mkv", ".avi", ".webm"}


def run(videos: Path, out: Path, options: dict, transcriber=None) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in videos.iterdir() if p.suffix.lower() in VIDEO_EXT)
    results = []
    for f in files:
        cache = out / "cache" / f.stem
        cache.mkdir(parents=True, exist_ok=True)
        t0 = time.perf_counter()
        info = processing.probe(f)
        t_probe = time.perf_counter() - t0
        try:
            payload = processing.analyze(f, info, cache, options, transcriber)
            error = None
        except Exception as e:
            payload, error = None, f"{type(e).__name__}: {e}"[:300]
        total = time.perf_counter() - t0
        tr = json.loads((cache / "transcript.json").read_text()) if (cache / "transcript.json").exists() else {}
        words = [w for s in tr.get("segments", []) for w in (s.get("words") or [])]
        row = {
            "file": f.name, "duration_s": info["duration_s"], "resolution": f"{info.get('width')}x{info.get('height')}",
            "codec": info.get("video_codec"), "has_audio": info["has_audio"], "error": error,
            "timings_s": {"probe": round(t_probe, 3), **((payload or {}).get("summary", {}).get("timings_s", {})),
                          "wall_total": round(total, 3)},
            "realtime_factor": round(total / info["duration_s"], 3) if info["duration_s"] else None,
            "transcript_status": tr.get("status"), "engine": tr.get("engine"), "note": tr.get("note"),
            "language": tr.get("language"), "language_probability": tr.get("language_probability"),
            "segments": len(tr.get("segments", [])), "words": len(words),
            "uncertain_share": round(sum(w.get("uncertain", False) for w in words) / len(words), 3) if words else None,
            "scene_changes": len((payload or {}).get("scenes", [])),
            "silence_ratio": (payload or {}).get("summary", {}).get("silence_ratio"),
            "reference": None, "quality": None,
        }
        ref_srt, ref_txt = f.with_suffix(".srt"), f.with_suffix(".txt")
        if ref_srt.exists() or ref_txt.exists():
            cues = parse_srt(ref_srt.read_text(encoding="utf-8")) if ref_srt.exists() else None
            ref_text = " ".join(c.text for c in cues) if cues else ref_txt.read_text(encoding="utf-8")
            row["reference"] = (ref_srt if ref_srt.exists() else ref_txt).name
            row["quality"] = asdict(evaluate(ref_text, tr, cues))
        results.append(row)
        print(f"{f.name}: {row['transcript_status']} en {total:.1f} s (x{row['realtime_factor']})"
              + (f", WER {row['quality']['wer']}" if row["quality"] else ""))
    report = {"options": options, "videos": results}
    (out / "bench.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    (out / "bench.md").write_text(to_markdown(report))
    return report


def _p(v):
    return "—" if v is None else f"{v * 100:.1f} %"


def to_markdown(report: dict) -> str:
    o = report["options"]
    lines = [f"# Banc d'essai transcription — moteur `{o.get('transcriber')}` / modèle `{o.get('whisper_model')}`"
             f" / langue `{o.get('language')}`", "",
             "| Vidéo | Durée | Format | Statut | Langue | Temps | × temps réel | Mots incertains | WER | CER | Faux signalés incertains | Fausses alertes | Écart timecodes (méd.) |",
             "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in report["videos"]:
        q = r["quality"] or {}
        tc = q.get("cue_start_error_s") or {}
        lines.append(f"| {r['file']} | {r['duration_s']:.0f} s | {r['resolution']} | {r['transcript_status']} | "
                     f"{r['language'] or '—'} | {r['timings_s']['wall_total']:.1f} s | {r['realtime_factor']} | "
                     f"{_p(r['uncertain_share'])} | {_p(q.get('wer'))} | {_p(q.get('cer'))} | "
                     f"{_p(q.get('wrong_marked_uncertain'))} | {_p(q.get('correct_marked_uncertain'))} | "
                     f"{(str(tc['median']) + ' s') if tc else '—'} |")
    notes = [r for r in report["videos"] if r.get("note") or r.get("error")]
    if notes:
        lines += ["", "Remarques :"] + [f"- {r['file']} : {r.get('error') or r.get('note')}" for r in notes]
    spk = [r for r in report["videos"] if r["quality"] and r["quality"].get("ref_speaker_changes")]
    if spk:
        lines += ["", "Locuteurs : le moteur ne distingue pas les locuteurs ; changements présents dans les références : "
                  + ", ".join(f"{r['file']} ({r['quality']['ref_speaker_changes']})" for r in spk)]
    return "\n".join(lines) + "\n"
