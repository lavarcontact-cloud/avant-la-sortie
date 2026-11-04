"""Téléchargement reprenable (HTTP Range), limitation de débit, vérification SHA-256."""
from __future__ import annotations

import hashlib
import os
import re
import time
from datetime import datetime
from pathlib import Path

import httpx


class IntegrityError(RuntimeError):
    pass


class RateLimiter:
    def __init__(self, bytes_per_s: int):
        self.rate = bytes_per_s
        self.t0 = time.monotonic()
        self.sent = 0

    def consume(self, n: int) -> None:
        if self.rate <= 0:
            return
        self.sent += n
        expected = self.sent / self.rate
        elapsed = time.monotonic() - self.t0
        if expected > elapsed:
            time.sleep(expected - elapsed)


_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def library_path(library: Path, video: dict) -> Path:
    """<bibliothèque>/AAAA/MM/AAAAMMJJ_HHMMSS_<sha8>_<nom>. Jamais de chemin
    fourni tel quel par le serveur : le nom est assaini."""
    created = video.get("source_created_at")
    try:
        dt = datetime.fromisoformat(created.replace("Z", "+00:00")) if created else None
    except ValueError:
        dt = None
    dt = dt or datetime.now()
    stem, ext = os.path.splitext(video["filename"])
    safe = (_UNSAFE.sub("_", stem).strip("._") or "video")[:80]
    ext = _UNSAFE.sub("", ext)[:8] or ".mov"
    return library / f"{dt:%Y}" / f"{dt:%m}" / f"{dt:%Y%m%d_%H%M%S}_{video['sha256'][:8]}_{safe}{ext}"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while block := f.read(1024 * 1024):
            h.update(block)
    return h.hexdigest()


def download(http: httpx.Client, url: str, dest: Path, expected_sha: str, expected_size: int | None,
             limiter: RateLimiter | None = None, should_stop=lambda: False) -> Path:
    """Télécharge dans `dest.part` en reprenant là où on s'était arrêté, puis
    vérifie l'empreinte avant de renommer atomiquement."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    offset = part.stat().st_size if part.exists() else 0
    if expected_size is not None and offset > expected_size:
        part.unlink()
        offset = 0
    if expected_size is None or offset < expected_size:
        headers = {"Range": f"bytes={offset}-"} if offset else {}
        with http.stream("GET", url, headers=headers) as r:
            if r.status_code == 416:
                part.unlink(missing_ok=True)
                raise IntegrityError("plage refusée, téléchargement recommencé")
            if r.status_code == 200 and offset:
                offset = 0  # le serveur ignore Range : on repart de zéro
            elif r.status_code not in (200, 206):
                raise httpx.HTTPStatusError(f"HTTP {r.status_code}", request=r.request, response=r)
            with open(part, "r+b" if offset else "wb") as f:
                f.seek(offset)
                f.truncate()
                for block in r.iter_bytes(256 * 1024):
                    f.write(block)
                    if limiter:
                        limiter.consume(len(block))
                    if should_stop():
                        raise InterruptedError("pause demandée")
                f.flush()
                os.fsync(f.fileno())
    actual = sha256_file(part)
    if actual != expected_sha:
        part.unlink(missing_ok=True)
        raise IntegrityError(f"SHA-256 local {actual[:12]}… != {expected_sha[:12]}…")
    os.replace(part, dest)
    return dest
