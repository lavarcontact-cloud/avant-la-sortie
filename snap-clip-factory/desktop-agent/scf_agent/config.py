"""Emplacements et configuration de l'agent, par système d'exploitation."""
from __future__ import annotations

import json
import os
import platform
import stat
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

APP = "SnapClipFactory"


def app_dir() -> Path:
    if override := os.environ.get("SCF_AGENT_HOME"):
        return Path(override)
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP
    if os.name == "nt":
        return Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / APP
    return Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "snapclipfactory"


def default_library() -> Path:
    base = Path.home() / ("Movies" if sys.platform == "darwin" else "Videos")
    return base / APP


@dataclass
class AgentConfig:
    server: str = ""
    device_id: str = ""
    library_dir: str = field(default_factory=lambda: str(default_library()))
    poll_interval_s: int = 15
    max_download_bytes_per_s: int = 0          # 0 = pas de limite
    min_free_disk_bytes: int = 5 * 1024**3      # on s'arrête avant de remplir le disque
    process_after_download: bool = True
    # --- Phase 6 : analyse locale ---------------------------------------
    analysis_enabled: bool = True
    transcriber: str = "auto"            # auto | faster-whisper | none
    whisper_model: str = "small"         # tiny | base | small | medium | large-v3
    whisper_device: str = "auto"         # auto | cpu | cuda
    language: str = "auto"               # auto = détection, ou code ISO (fr, en…)
    uncertain_word_probability: float = 0.5
    scene_threshold: float = 10.0        # seuil ffmpeg scdet (0-100)
    whisper_compute_type: str = "auto"   # auto = choix du moteur ; "int8" plus rapide sur processeur (voir transcription.py)
    vocabulary: list = field(default_factory=list)   # noms propres et surnoms à bien orthographier

    def analysis_options(self) -> dict:
        return {
            "enabled": self.analysis_enabled, "transcriber": self.transcriber,
            "whisper_model": self.whisper_model, "whisper_device": self.whisper_device,
            "language": self.language, "uncertain_word_probability": self.uncertain_word_probability,
            "scene_threshold": self.scene_threshold, "whisper_compute_type": self.whisper_compute_type,
            "vocabulary": list(self.vocabulary),
        }

    @classmethod
    def load(cls, home: Path | None = None) -> "AgentConfig":
        p = (home or app_dir()) / "config.json"
        if p.exists():
            data = json.loads(p.read_text())
            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        return cls()

    def save(self, home: Path | None = None) -> None:
        d = home or app_dir()
        d.mkdir(parents=True, exist_ok=True)
        (d / "config.json").write_text(json.dumps(asdict(self), indent=2))


class SecretStore:
    """Jeton de rafraîchissement : trousseau du système (Keychain macOS,
    Gestionnaire d'identification Windows) via `keyring` si disponible,
    sinon fichier lisible par le seul utilisateur."""

    SERVICE = "snap-clip-factory-agent"

    def __init__(self, home: Path | None = None):
        self.home = home or app_dir()
        try:
            import keyring  # type: ignore

            self._kr = keyring if os.environ.get("SCF_AGENT_NO_KEYRING") != "1" else None
        except Exception:
            self._kr = None

    def get(self, key: str) -> str | None:
        if self._kr:
            try:
                return self._kr.get_password(self.SERVICE, key)
            except Exception:
                pass
        p = self.home / f".{key}"
        return p.read_text().strip() if p.exists() else None

    def set(self, key: str, value: str) -> None:
        if self._kr:
            try:
                self._kr.set_password(self.SERVICE, key, value)
                return
            except Exception:
                pass
        self.home.mkdir(parents=True, exist_ok=True)
        p = self.home / f".{key}"
        fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, stat.S_IRUSR | stat.S_IWUSR)
        with os.fdopen(fd, "w") as f:
            f.write(value)

    def delete(self, key: str) -> None:
        if self._kr:
            try:
                self._kr.delete_password(self.SERVICE, key)
            except Exception:
                pass
        (self.home / f".{key}").unlink(missing_ok=True)


def platform_label() -> str:
    return f"{platform.system()} {platform.release()} ({platform.machine()})"
