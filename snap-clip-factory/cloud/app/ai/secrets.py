"""Lecture des secrets côté serveur UNIQUEMENT.

Ordre : variable `SCF_<NOM>`, puis fichier désigné par `SCF_<NOM>_FILE`
(secrets Docker / gestionnaire de secrets). Les valeurs ne sont jamais
renvoyées par l'API ni écrites dans la base ou les journaux.
"""
from __future__ import annotations

import os
from pathlib import Path


def read_secret(name: str) -> str | None:
    if value := os.environ.get(f"SCF_{name}"):
        return value.strip()
    if path := os.environ.get(f"SCF_{name}_FILE"):
        p = Path(path)
        if p.is_file():
            return p.read_text().strip() or None
    return None


def setting(name: str, default: str = "") -> str:
    return os.environ.get(f"SCF_{name}", default).strip()
