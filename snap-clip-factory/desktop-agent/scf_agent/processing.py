"""Traitement local de chaque vidéo reçue.

1. inventaire technique (ffprobe) et vignette — phase 4
2. analyse locale — phase 6 : extraction audio, silences, niveau sonore,
   changements de plan, transcription horodatée

Tout est calculé sur l'ordinateur et sauvegardé dans `work/analysis/<sha256>/`.
Seul un résumé TEXTUEL (`analysis_input`) est destiné au Cloud : jamais la
vidéo, jamais l'audio. Le montage (phase 7) viendra s'ajouter ici.
"""
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

from . import signals
from .processing_tools import ToolMissing, tool as _tool  # noqa: F401  (ToolMissing réexporté)
from .transcription import Transcriber, Transcript, make_transcriber, render_text

ANALYSIS_SCHEMA = 1


def probe(path: Path) -> dict:
    out = subprocess.run(
        [_tool("ffprobe"), "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120, check=True,
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


def extract_audio(video: Path, out: Path) -> Path:
    """Piste audio mono 16 kHz, uniquement pour l'analyse locale."""
    subprocess.run([_tool("ffmpeg"), "-v", "error", "-y", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000",
                    str(out)], capture_output=True, timeout=1800, check=True)
    return out


def analyze(video: Path, info: dict, cache: Path, options: dict, transcriber: Transcriber | None = None) -> dict:
    duration = info["duration_s"]
    timings: dict[str, float] = {}
    t0 = time.perf_counter()
    scenes = signals.detect_scenes(video, options.get("scene_threshold", 10.0))
    timings["scenes"] = time.perf_counter() - t0
    silences, rms = [], []
    if not info["has_audio"]:
        transcript = Transcript(status="no_audio", engine="none", note="vidéo sans piste audio")
    else:
        t0 = time.perf_counter()
        audio = extract_audio(video, cache / "audio.wav")
        timings["audio_extract"] = time.perf_counter() - t0
        try:
            t0 = time.perf_counter()
            rms = signals.loudness_per_second(audio)
            noise_floor = signals.adaptive_noise_floor(rms)
            silences = signals.detect_silences(audio, noise_db=noise_floor, duration=duration)
            timings["audio_signals"] = time.perf_counter() - t0
            silent = sum(x["end"] - x["start"] for x in silences)
            if duration and silent / duration >= 0.98:
                transcript = Transcript(status="no_speech", engine="none", note="audio silencieux")
            else:
                engine, load_error = transcriber, None
                if engine is None:
                    try:
                        engine = make_transcriber(options)
                    except Exception as e:   # modèle non téléchargeable (hors ligne), GPU absent…
                        load_error = f"moteur de transcription indisponible : {type(e).__name__} {e}"[:300]
                if load_error:
                    transcript = Transcript(status="error", engine=options.get("transcriber", "auto"), note=load_error)
                elif engine is None:
                    transcript = Transcript(status="unavailable", engine="none",
                                            note="aucun moteur de transcription installé (faster-whisper)")
                else:
                    lang = None if options.get("language", "auto") == "auto" else options["language"]
                    try:
                        t0 = time.perf_counter()
                        transcript = engine.transcribe(audio, lang)
                        timings["transcription"] = time.perf_counter() - t0
                    except Exception as e:  # le reste de l'analyse reste utile
                        transcript = Transcript(status="error", engine=getattr(engine, "name", "?"), note=str(e)[:300])
        finally:
            audio.unlink(missing_ok=True)   # l'audio extrait ne sert qu'au calcul local

    (cache / "transcript.json").write_text(json.dumps(transcript.to_dict(), ensure_ascii=False, indent=1))
    summary = signals.summarize(scenes, silences, rms, duration)
    summary["silence_threshold_db"] = locals().get("noise_floor")
    summary["timings_s"] = {k: round(v, 3) for k, v in timings.items()}
    summary["timings_s"]["total"] = round(sum(timings.values()), 3)
    summary["engine"] = transcript.engine
    sig = {"scenes": scenes, "silences": silences, "loudness_per_second": rms, "summary": summary}
    (cache / "signals.json").write_text(json.dumps(sig, ensure_ascii=False))

    return {
        "schema": ANALYSIS_SCHEMA,
        "duration_s": duration,
        "width": info.get("width"), "height": info.get("height"), "rotation": info.get("rotation", 0),
        "has_audio": info["has_audio"],
        "transcript": {
            "status": transcript.status, "engine": transcript.engine, "language": transcript.language,
            "language_probability": transcript.language_probability, "note": transcript.note,
            # texte + timecodes seulement ; les mots détaillés restent sur l'ordinateur
            "segments": [{"start": s.start, "end": s.end, "text": render_text(s), "speaker": s.speaker,
                          "confidence": s.confidence} for s in transcript.segments],
        },
        "scenes": scenes,
        "silences": silences,
        "loudness_per_second": rms,
        "summary": sig["summary"],
    }


def run_pipeline(path: Path, work_dir: Path, *, video_id: str | None = None, sha256: str | None = None,
                 options: dict | None = None, transcriber: Transcriber | None = None) -> dict:
    info = probe(path)
    thumb = thumbnail(path, work_dir / "thumbnails", at_s=min(1.0, info["duration_s"] / 2 or 0))
    result = {"probe": info, "thumbnail": thumb.name}
    options = options or {}
    if options.get("enabled") and (sha256 or video_id):
        cache = work_dir / "analysis" / (sha256 or video_id)
        cached = cache / "analysis_input.json"
        if cached.exists():   # reprise : l'analyse déjà faite n'est pas recalculée
            result["analysis_input"] = json.loads(cached.read_text())
            return result
        cache.mkdir(parents=True, exist_ok=True)
        payload = analyze(path, info, cache, options, transcriber)
        tmp = cached.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False))
        tmp.replace(cached)
        result["analysis_input"] = payload
    return result
