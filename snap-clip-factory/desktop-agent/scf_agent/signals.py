"""Signaux audio/vidéo calculés localement avec FFmpeg (aucun envoi de média).

- plans : filtre `scdet` sur une version réduite (320 px, 5 i/s) -> compatible 4K
- silences : `silencedetect`
- niveau sonore : RMS par seconde (`astats`), pour repérer pics et passages forts

Ces signaux décrivent le son et le montage, PAS le contenu visuel : ils ne
permettent pas de savoir ce que l'on voit à l'image.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

from .processing_tools import tool

_PTS = re.compile(r"lavfi\.scd\.time:\s*([\d.]+)")
_SCORE = re.compile(r"lavfi\.scd\.score:\s*([\d.]+)")
_SIL_START = re.compile(r"silence_start:\s*(-?[\d.]+)")
_SIL_END = re.compile(r"silence_end:\s*([\d.]+)")
_FRAME = re.compile(r"pts_time:([\d.]+)")
_STAT = re.compile(r"lavfi\.signalstats\.(YAVG|UAVG|VAVG)=([\d.]+)")


def _ffmpeg(args: list[str], timeout: int = 1800) -> str:
    out = subprocess.run([tool("ffmpeg"), "-hide_banner", "-nostats", *args], capture_output=True, text=True, encoding="utf-8", errors="replace",
                         timeout=timeout)
    if out.returncode != 0:
        raise RuntimeError(f"ffmpeg : {out.stderr.strip()[-400:]}")
    return out.stderr + out.stdout


def detect_scenes(video: Path, threshold: float = 10.0, chroma_jump: float = 12.0) -> list[dict]:
    """Changements de plan : [{"t": secondes, "score": 0-100}].

    Deux détecteurs fusionnés, sur une image réduite (320 px, 5 i/s, donc
    supportable en 4K) : `scdet` (différence d'image, sensible à la luminosité)
    et un saut de chrominance moyenne (`signalstats`), qui rattrape les coupes
    entre plans de même luminosité mais de couleurs différentes."""
    log = _ffmpeg(["-i", str(video), "-an", "-vf",
                   f"fps=5,scale=320:-2,scdet=threshold={threshold},signalstats,metadata=mode=print",
                   "-f", "null", "-"])
    cuts: dict[float, float] = {}
    for t, sc in zip(_PTS.findall(log), _SCORE.findall(log)):
        cuts[round(float(t), 2)] = round(float(sc), 1)
    # signalstats : une ligne pts_time par image, puis ses valeurs moyennes
    frames, cur = [], None
    for line in log.splitlines():
        if m := _FRAME.search(line):
            cur = {"t": float(m.group(1))}
            frames.append(cur)
        elif cur is not None and (m := _STAT.search(line)):
            cur[m.group(1)] = float(m.group(2))
    for prev, f in zip(frames, frames[1:]):
        if not all(k in f and k in prev for k in ("YAVG", "UAVG", "VAVG")):
            continue
        jump = max(abs(f[k] - prev[k]) for k in ("YAVG", "UAVG", "VAVG"))
        if jump >= chroma_jump and not any(abs(f["t"] - t) < 0.5 for t in cuts):
            cuts[round(f["t"], 2)] = round(min(100.0, jump / 2.55), 1)  # 0-255 -> 0-100
    return [{"t": t, "score": sc} for t, sc in sorted(cuts.items())]


def detect_silences(audio: Path, noise_db: float = -35, min_s: float = 0.6, duration: float | None = None) -> list[dict]:
    log = _ffmpeg(["-i", str(audio), "-af", f"silencedetect=noise={noise_db}dB:d={min_s}", "-f", "null", "-"])
    starts = [max(0.0, float(x)) for x in _SIL_START.findall(log)]
    ends = [float(x) for x in _SIL_END.findall(log)]
    if len(ends) < len(starts) and duration is not None:
        ends.append(duration)  # silence jusqu'à la fin
    return [{"start": round(a, 2), "end": round(b, 2)} for a, b in zip(starts, ends)]


def loudness_per_second(audio: Path) -> list[float]:
    """RMS (dBFS) par seconde ; -91 = silence numérique."""
    log = _ffmpeg(["-i", str(audio), "-af",
                   "asetnsamples=n=16000:p=0,astats=metadata=1:reset=1,"
                   "ametadata=mode=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"])
    vals = []
    for m in re.finditer(r"lavfi\.astats\.Overall\.RMS_level=(-?[\d.]+|-inf)", log):
        v = m.group(1)
        vals.append(-91.0 if v == "-inf" else max(-91.0, round(float(v), 1)))
    return vals


def adaptive_noise_floor(rms: list[float], default: float = -35.0) -> float:
    """Seuil de silence relatif au niveau de la vidéo (phase 6.1).

    Mesuré : avec un seuil fixe de -35 dB, une voix enregistrée faiblement était
    en partie classée « silence ». On prend le 75e centile du niveau des secondes
    non muettes, moins 22 dB, borné entre -60 et -30 dB."""
    voiced = sorted(v for v in rms if v > -85)
    if len(voiced) < 3:
        return default
    ref = voiced[int(0.75 * (len(voiced) - 1))]
    return round(max(-60.0, min(-30.0, ref - 22.0)), 1)


def summarize(scenes: list[dict], silences: list[dict], rms: list[float], duration: float) -> dict:
    silent = sum(s["end"] - s["start"] for s in silences)
    loud = [i for i, v in enumerate(rms) if v > -91]
    peaks = []
    if loud:
        ordered = sorted(v for v in rms if v > -91)
        p90 = ordered[int(0.9 * (len(ordered) - 1))]
        peaks = [i for i, v in enumerate(rms) if v >= p90 and v > -30]
    return {
        "duration_s": round(duration, 2),
        "scene_changes": len(scenes),
        "silence_ratio": min(1.0, round(silent / duration, 3)) if duration else 0,
        "loudness_peaks_s": peaks[:50],
    }
