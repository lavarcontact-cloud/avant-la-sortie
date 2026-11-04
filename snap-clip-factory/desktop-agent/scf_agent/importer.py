"""`scf-agent import` : importer des vidéos du PC SANS l'iPhone.

Utilise exactement le protocole de l'app iPhone (inventaire, SHA-256, upload
par morceaux reprenable, vérification serveur). L'import apparaît comme un
appareil séparé, « Import PC », appairé une seule fois avec un code du
dashboard (le mot de passe du compte n'est pas conservé).

Le fichier d'origine est ouvert en LECTURE SEULE : il n'est jamais modifié,
déplacé ni supprimé. Relancer la commande reprend un envoi interrompu et
ignore les vidéos déjà importées.
"""
from __future__ import annotations

import hashlib
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

from . import processing
from .config import SecretStore, app_dir

VIDEO_EXT = {".mov", ".mp4", ".m4v", ".mkv", ".avi", ".webm", ".3gp"}
DONE = {"VERIFIED", "PROCESSING", "COMPLETED"}


class ImportError_(RuntimeError):
    pass


def _state_file(home: Path) -> Path:
    return home / "import_device.json"


def pair(http: httpx.Client, server: str, code: str, home: Path, secrets: SecretStore) -> None:
    r = http.post(f"{server}/v1/devices/pair", json={"code": code.strip().upper(), "name": "Import PC (sans iPhone)",
                                                      "kind": "ios", "platform": "scf-agent import"})
    if r.status_code != 201:
        raise ImportError_(f"appairage refusé : {r.text}")
    secrets.set("import_refresh_token", r.json()["refresh_token"])
    home.mkdir(parents=True, exist_ok=True)
    _state_file(home).write_text(json.dumps({"server": server, "device_id": r.json()["device_id"]}))


def _token(http: httpx.Client, server: str, secrets: SecretStore) -> str:
    rt = secrets.get("import_refresh_token")
    if not rt:
        raise ImportError_("import non appairé : relancer avec --code (code du dashboard)")
    r = http.post(f"{server}/v1/auth/refresh", json={"refresh_token": rt})
    if r.status_code == 401:
        secrets.delete("import_refresh_token")
        raise ImportError_("appareil d'import révoqué ou expiré : relancer avec un nouveau --code")
    r.raise_for_status()
    secrets.set("import_refresh_token", r.json()["refresh_token"])   # jeton rotatif
    return r.json()["access_token"]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while b := f.read(4 << 20):
            h.update(b)
    return h.hexdigest()


def _created_at(path: Path) -> str:
    """Date de tournage (métadonnée creation_time) sinon date du fichier."""
    try:
        import subprocess

        out = subprocess.run([processing._tool("ffprobe"), "-v", "error", "-show_entries", "format_tags=creation_time",
                              "-of", "json", str(path)], capture_output=True, text=True, encoding="utf-8",
                             errors="replace", timeout=60).stdout
        tag = json.loads(out).get("format", {}).get("tags", {}).get("creation_time")
        if tag:
            return tag
    except Exception:
        pass
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()


def import_file(http: httpx.Client, server: str, token: str, path: Path, chunk_size: int = 8 << 20,
                log=print) -> dict:
    h = {"Authorization": f"Bearer {token}"}
    size = path.stat().st_size
    log(f"{path.name} : empreinte SHA-256…")
    sha = _sha256(path)
    info = processing.probe(path)
    item = {"asset_local_id": f"pc:{sha[:40]}", "origin": "share", "filename": path.name,
            "source_created_at": _created_at(path), "duration_s": info["duration_s"] or None,
            "width": info.get("width"), "height": info.get("height"), "sha256": sha, "size_bytes": size}
    r = http.post(f"{server}/v1/videos/batch", headers=h, json={"videos": [item]})
    r.raise_for_status()
    v = r.json()["results"][0]["video"]
    if v["state"] in DONE:
        log(f"{path.name} : déjà importée ({v['state']})")
        return v
    r = http.post(f"{server}/v1/videos/{v['id']}/uploads", headers=h, json={"chunk_size": chunk_size})
    if r.status_code == 409 and isinstance(r.json().get("detail"), dict) \
            and r.json()["detail"].get("code") == "already_uploaded":
        log(f"{path.name} : déjà importée")
        return r.json()["detail"]["video"]
    r.raise_for_status()
    s = r.json()
    todo = [i for i in range(s["total_chunks"]) if i not in set(s["received"])]
    if s["received"]:
        log(f"{path.name} : reprise, {len(s['received'])}/{s['total_chunks']} morceaux déjà reçus")
    with open(path, "rb") as f:   # lecture seule
        for n, i in enumerate(todo, 1):
            f.seek(i * s["chunk_size"])
            data = f.read(s["chunk_size"])
            digest = hashlib.sha256(data).hexdigest()
            for attempt in range(4):
                try:
                    pr = http.put(f"{server}/v1/uploads/{s['upload_id']}/chunks/{i}", content=data,
                                  headers={**h, "X-Chunk-SHA256": digest, "Content-Type": "application/octet-stream"},
                                  timeout=120)
                    if pr.status_code < 500:
                        pr.raise_for_status()
                        break
                except (httpx.TransportError,) as e:
                    if attempt == 3:
                        raise ImportError_(f"coupure réseau persistante ({e}) : relancer pour reprendre") from e
                time.sleep(2 ** attempt)
            if n % 10 == 0 or n == len(todo):
                log(f"{path.name} : {s['total_chunks'] - len(todo) + n}/{s['total_chunks']} morceaux")
    r = http.post(f"{server}/v1/uploads/{s['upload_id']}/complete", headers=h, timeout=600)
    if r.status_code == 422:
        raise ImportError_(f"{path.name} : intégrité refusée par le serveur ({r.text[:200]})")
    r.raise_for_status()
    v = r.json()
    log(f"{path.name} : {v['state']} ({math.ceil(size / 2**20)} Mo, intégrité vérifiée)")
    return v


def run(paths: list[str], server: str | None, code: str | None, http: httpx.Client | None = None,
        home: Path | None = None) -> list[dict]:
    home = home or app_dir()
    secrets = SecretStore(home)
    http = http or httpx.Client(timeout=httpx.Timeout(60, read=600))
    saved = json.loads(_state_file(home).read_text()) if _state_file(home).exists() else {}
    server = (server or saved.get("server") or "").rstrip("/")
    if not server:
        raise ImportError_("indiquer --server la première fois")
    if code:
        pair(http, server, code, home, secrets)
    token = _token(http, server, secrets)
    files: list[Path] = []
    for p in map(Path, paths):
        p = p.expanduser()
        if p.is_dir():
            files += sorted(x for x in p.iterdir() if x.suffix.lower() in VIDEO_EXT)
        elif p.is_file():
            files.append(p)
        else:
            raise ImportError_(f"introuvable : {p}")
    return [import_file(http, server, token, f) for f in files]
