"""PHASE 1 — AUDIT : matériel, système et ressources disponibles."""
from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


def _run(cmd: list[str]) -> str:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10).stdout.strip()
    except Exception:
        return ""


def _ram_bytes() -> int | None:
    try:
        if sys.platform == "darwin":
            return int(_run(["sysctl", "-n", "hw.memsize"]))
        if os.name == "nt":
            import ctypes

            class MEM(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("a", ctypes.c_ulonglong * 6)]
            m = MEM()
            m.dwLength = ctypes.sizeof(MEM)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
            return int(m.ullTotalPhys)
        return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
    except Exception:
        return None


def _cpu_name() -> str:
    """Nom commercial du processeur (platform.processor() donne seulement la famille sous Windows)."""
    if os.name == "nt":
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0") as k:
                return str(winreg.QueryValueEx(k, "ProcessorNameString")[0]).strip()
        except Exception:
            pass
    if sys.platform == "darwin":
        return _run(["sysctl", "-n", "machdep.cpu.brand_string"]) or platform.processor()
    try:
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            if line.startswith("model name"):
                return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return platform.processor()


def _gpu() -> list[str]:
    if sys.platform == "darwin":
        out = _run(["system_profiler", "SPDisplaysDataType", "-json"])
        try:
            return [g.get("sppci_model", "?") for g in json.loads(out)["SPDisplaysDataType"]]
        except Exception:
            return []
    if shutil.which("nvidia-smi"):
        return [l for l in _run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"]).splitlines() if l]
    if os.name == "nt":
        out = _run(["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_VideoController).Name"])
        return [l for l in out.splitlines() if l]
    return []


def _ffmpeg() -> dict:
    path = shutil.which("ffmpeg")
    if not path:
        return {"installed": False}
    first = _run([path, "-hide_banner", "-version"]).splitlines()[:1]
    encoders = _run([path, "-hide_banner", "-encoders"])
    hw = [e for e in ("h264_videotoolbox", "hevc_videotoolbox", "h264_nvenc", "hevc_nvenc", "h264_qsv", "h264_amf")
          if e in encoders]
    return {"installed": True, "version": first[0] if first else "", "hw_encoders_compiled": hw,
            "note": "encodeurs présents dans le binaire ; leur disponibilité dépend du GPU réel"}


def audit(library: Path) -> dict:
    library.mkdir(parents=True, exist_ok=True)
    du = shutil.disk_usage(library)
    ram = _ram_bytes()
    gpus = _gpu()
    ff = _ffmpeg()
    apple_silicon = sys.platform == "darwin" and platform.machine() == "arm64"
    has_cuda = any("NVIDIA" in g.upper() for g in gpus)
    # Recommandation transcription locale (phase 6) — indicative.
    if apple_silicon or has_cuda:
        whisper = "local : modèle medium/large-v3 envisageable"
    elif ram and ram >= 16 * 1024**3:
        whisper = "local CPU : modèle small, lent ; Cloud conseillé pour les longs rushs"
    else:
        whisper = "Cloud conseillé"
    return {
        "os": f"{platform.system()} {platform.release()}",
        "machine": platform.machine(),
        "cpu": _cpu_name(),
        "cpu_cores": os.cpu_count(),
        "ram_gb": round(ram / 1024**3, 1) if ram else None,
        "gpus": gpus,
        "python": sys.version.split()[0],
        "ffmpeg": ff,
        "library": str(library),
        "disk_free_gb": round(du.free / 1024**3, 1),
        "disk_total_gb": round(du.total / 1024**3, 1),
        "transcription": whisper,
        "ready_for_phase_4": ff["installed"] and du.free > 20 * 1024**3,
    }
