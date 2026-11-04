"""Générateur de vidéos de test synthétiques et REPRODUCTIBLES (ffmpeg seul).

Chaque segment a un type connu (parole voix A / voix B, silence, musique,
bruit) et un plan de couleur distinct : la chronologie exacte est renvoyée,
ce qui permet de vérifier silences, plans et timecodes.

La parole est synthétisée par flite (voix anglaises) : elle sert à tester les
signaux et la chaîne complète. Elle ne remplace pas un test de transcription
sur de vraies voix.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

FFMPEG = shutil.which("ffmpeg")
HAS_FLITE = bool(FFMPEG) and " flite " in subprocess.run([FFMPEG, "-hide_banner", "-filters"],
                                                        capture_output=True, text=True).stdout

COLORS = ["0x203040", "0xc04020", "0x20a060", "0xd0c020", "0x6040c0", "0x30b0d0", "0xe070a0", "0x808080"]


@dataclass
class Segment:
    kind: str                 # speech | silence | music | noise
    text: str = ""
    voice: str = "kal"
    duration: float = 0.0     # imposé pour silence/musique/bruit, mesuré pour la parole
    start: float = 0.0
    end: float = 0.0


@dataclass
class Media:
    path: Path
    segments: list[Segment] = field(default_factory=list)

    @property
    def cuts(self) -> list[float]:
        return [s.start for s in self.segments[1:]]

    @property
    def duration(self) -> float:
        return self.segments[-1].end


def _run(args):
    subprocess.run([FFMPEG, "-hide_banner", "-v", "error", "-y", *args], check=True)


def _duration(p: Path) -> float:
    out = subprocess.run([shutil.which("ffprobe"), "-v", "error", "-show_entries", "format=duration",
                          "-of", "json", str(p)], capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)["format"]["duration"])


DEFAULT_SCRIPT = [
    Segment("speech", "I never expected the studio to call me back that night.", "kal"),
    Segment("silence", duration=1.5),
    Segment("speech", "Wait, what? You recorded the whole album in one take?", "slt"),
    Segment("silence", duration=1.0),
    Segment("music", duration=4.0),
    Segment("noise", duration=3.0),
    Segment("speech", "Yes. And honestly, that mistake became the best part of the song, "
                      "because everybody in the room started laughing.", "kal"),
]


def build(out: Path, script: list[Segment] | None = None, size: str = "320x568", with_audio: bool = True) -> Media:
    """Construit la vidéo et renvoie sa chronologie exacte."""
    script = [Segment(**vars(s)) for s in (script or DEFAULT_SCRIPT)]
    work = out.parent / (out.stem + "_parts")
    work.mkdir(parents=True, exist_ok=True)
    parts, t = [], 0.0
    for i, seg in enumerate(script):
        wav = work / f"{i:02d}.wav"
        if seg.kind == "speech":
            text = seg.text.replace("'", "").replace(":", " ").replace(",", " ")
            _run(["-f", "lavfi", "-i", f"flite=text='{text}':voice={seg.voice}", "-ar", "16000", "-ac", "1", str(wav)])
            seg.duration = _duration(wav)
        elif seg.kind == "silence":
            _run(["-f", "lavfi", "-i", f"anullsrc=r=16000:cl=mono", "-t", str(seg.duration), str(wav)])
        elif seg.kind == "music":   # accord majeur + rythme : signal tonal soutenu
            _run(["-f", "lavfi", "-i",
                  "aevalsrc=0.25*sin(2*PI*440*t)*(0.6+0.4*sin(2*PI*2*t))+0.2*sin(2*PI*554.37*t)+0.2*sin(2*PI*659.25*t):s=16000",
                  "-t", str(seg.duration), "-ac", "1", str(wav)])
        elif seg.kind == "noise":   # bruit ambiant rose, niveau modéré
            _run(["-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.08:r=16000", "-t", str(seg.duration),
                  "-ac", "1", str(wav)])
        seg.start, seg.end = round(t, 3), round(t + seg.duration, 3)
        t += seg.duration
        parts.append(wav)

    lst = work / "audio.txt"
    lst.write_text("".join(f"file '{p.name}'\n" for p in parts))
    audio = work / "audio.wav"
    _run(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(audio)])

    vlist = work / "video.txt"
    vparts = []
    for i, seg in enumerate(script):
        mp4 = work / f"{i:02d}.mp4"
        _run(["-f", "lavfi", "-i", f"color=c={COLORS[i % len(COLORS)]}:s={size}:r=25:d={seg.duration:.3f}",
              "-vf", "drawbox=x=20:y=20:w=60:h=60:color=white@0.8:t=fill",
              "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", str(mp4)])
        vparts.append(mp4)
    vlist.write_text("".join(f"file '{p.name}'\n" for p in vparts))
    video = work / "video.mp4"
    _run(["-f", "concat", "-safe", "0", "-i", str(vlist), "-c", "copy", str(video)])

    if with_audio:
        _run(["-i", str(video), "-i", str(audio), "-c:v", "copy", "-c:a", "aac", "-shortest", str(out)])
    else:
        _run(["-i", str(video), "-c:v", "copy", "-an", str(out)])
    shutil.rmtree(work, ignore_errors=True)
    return Media(out, script)
