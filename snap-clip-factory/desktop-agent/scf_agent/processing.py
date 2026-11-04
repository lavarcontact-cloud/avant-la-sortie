"""Traitement local, étape 1 : inventaire technique de la vidéo (ffprobe) et
vignette (ffmpeg). L'analyse IA, le découpage et le montage (phases 6-7)
viendront se brancher ici comme étapes supplémentaires du pipeline."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path


class ToolMissing(RuntimeError):
    pass


def _tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise ToolMissing(f"{name} introuvable : installer FFmpeg (https://ffmpeg.org/download.html)")
    return path


def probe(path: Path) -> dict:
    out = subprocess.run(
        [_tool("ffprobe"), "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, timeout=120, check=True,
    ).stdout
    data = json.loads(out)
    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
    audio = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {})
    rotation = 0
    for sd in video.get("side_data_list", []) or []:
        if "rotation" in sd:
            rotation = int(sd["rotation"])
    fps = None
    if rate := video.get("avg_frame_rate"):
        num, _, den = rate.partition("/")
        fps = round(float(num) / float(den), 3) if den and float(den) else None
    return {
        "container": data.get("format", {}).get("format_name"),
        "duration_s": float(data.get("format", {}).get("duration", 0) or 0),
        "bit_rate": int(data.get("format", {}).get("bit_rate", 0) or 0),
        "video_codec": video.get("codec_name"),
        "width": video.get("width"),
        "height": video.get("height"),
        "rotation": rotation,
        "fps": fps,
        "has_audio": bool(audio),
        "audio_codec": audio.get("codec_name"),
    }


def thumbnail(path: Path, out_dir: Path, at_s: float = 1.0) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / (path.stem + ".jpg")
    subprocess.run(
        [_tool("ffmpeg"), "-y", "-v", "error", "-ss", str(at_s), "-i", str(path), "-frames:v", "1",
         "-vf", "scale=480:-2", str(out)],
        capture_output=True, timeout=120, check=True,
    )
    return out


def run_pipeline(path: Path, work_dir: Path) -> dict:
    info = probe(path)
    thumb = thumbnail(path, work_dir / "thumbnails", at_s=min(1.0, info["duration_s"] / 2 or 0))
    return {"probe": info, "thumbnail": thumb.name}
