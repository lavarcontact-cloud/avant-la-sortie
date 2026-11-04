"""Configuration du Cloud Control Plane, lue depuis l'environnement (préfixe SCF_)."""
from __future__ import annotations

import os
import secrets
import warnings
from dataclasses import dataclass, field
from pathlib import Path


def _env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(f"SCF_{name}", default)


@dataclass
class Settings:
    database_url: str = "sqlite:///./scf.db"
    secret_key: str = ""
    relay_dir: Path = Path("./relay")
    access_token_ttl_s: int = 15 * 60
    refresh_token_ttl_s: int = 30 * 24 * 3600
    user_token_ttl_s: int = 12 * 3600
    pairing_code_ttl_s: int = 10 * 60
    download_url_ttl_s: int = 10 * 60
    upload_session_ttl_s: int = 7 * 24 * 3600
    default_chunk_size: int = 8 * 1024 * 1024
    max_chunk_size: int = 32 * 1024 * 1024
    min_chunk_size: int = 256 * 1024
    # Le Cloud n'est qu'un relais : une fois la vidéo livrée et vérifiée sur
    # l'ordinateur, la copie relais est supprimée.
    purge_relay_after_delivery: bool = True
    allow_signup: bool = False
    public_base_url: str = ""
    cors_origins: list[str] = field(default_factory=list)
    # Phase 6 : worker d'analyse IA dans le processus de l'API (False = lancer `python -m app.worker`)
    ai_worker: bool = True

    @classmethod
    def from_env(cls) -> "Settings":
        s = cls(
            database_url=_env("DATABASE_URL", cls.database_url),
            secret_key=_env("SECRET_KEY", "") or "",
            relay_dir=Path(_env("RELAY_DIR", "./relay")),
            allow_signup=_env("ALLOW_SIGNUP", "0") == "1",
            purge_relay_after_delivery=_env("PURGE_RELAY", "1") == "1",
            public_base_url=_env("PUBLIC_BASE_URL", "") or "",
            cors_origins=[o for o in (_env("CORS_ORIGINS", "") or "").split(",") if o],
            ai_worker=_env("AI_WORKER", "1") == "1",
        )
        if _env("DEFAULT_CHUNK_SIZE"):
            s.default_chunk_size = int(_env("DEFAULT_CHUNK_SIZE"))
        return s

    def __post_init__(self) -> None:
        if not self.secret_key:
            warnings.warn(
                "SCF_SECRET_KEY absent : clé éphémère générée. Tous les jetons "
                "seront invalidés au redémarrage. Définir SCF_SECRET_KEY en production.",
                stacklevel=2,
            )
            self.secret_key = secrets.token_urlsafe(48)
        if len(self.secret_key) < 32:
            raise ValueError("SCF_SECRET_KEY doit faire au moins 32 caractères")
        self.relay_dir = Path(self.relay_dir)
