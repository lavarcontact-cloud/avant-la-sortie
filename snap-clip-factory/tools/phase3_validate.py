"""PHASE 3 — vérifie, depuis le compte utilisateur, qu'un lot de vidéos RÉELLES
envoyées par l'iPhone est arrivé intact sur l'ordinateur.

Usage :
  python tools/phase3_validate.py --server https://… --email … --library ~/Movies/SnapClipFactory [--count 10]

Ce script ne simule rien : il lit l'état réel du Cloud et re-hache les fichiers
présents dans la bibliothèque locale de l'agent.
"""
from __future__ import annotations

import argparse
import getpass
import hashlib
import sys
from pathlib import Path

import httpx


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        while b := f.read(1 << 20):
            h.update(b)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", required=True)
    ap.add_argument("--email", required=True)
    ap.add_argument("--library", required=True, type=Path)
    ap.add_argument("--count", type=int, default=10)
    a = ap.parse_args()
    http = httpx.Client(base_url=a.server, timeout=30)
    tok = http.post("/v1/auth/login", json={"email": a.email, "password": getpass.getpass("Mot de passe : ")})
    tok.raise_for_status()
    http.headers["Authorization"] = "Bearer " + tok.json()["access_token"]

    devices = http.get("/v1/devices").json()
    kinds = {d["kind"] for d in devices if not d["revoked"]}
    print(f"Appareils : {', '.join(d['kind'] + ':' + d['name'] for d in devices if not d['revoked'])}")
    videos = http.get("/v1/videos", params={"limit": 500}).json()
    delivered = [v for v in videos if v["delivered_at"]]
    by_sha = {}
    for f in a.library.expanduser().rglob("*"):
        if f.is_file() and not f.name.endswith(".part"):
            by_sha.setdefault(f.name.split("_")[2] if f.name.count("_") >= 3 else "", []).append(f)

    ok = 0
    for v in delivered:
        candidates = by_sha.get(v["sha256"][:8], [])
        match = next((f for f in candidates if sha256(f) == v["sha256"]), None)
        status = "OK " if match else "MANQUANTE"
        ok += bool(match)
        print(f"  [{status}] {v['filename']:<32} {v['state']:<11} {v['size_bytes'] or 0:>12} o  {v['sha256'][:12]}…")

    checks = {
        "iPhone appairé": "ios" in kinds,
        "Ordinateur appairé": "desktop" in kinds,
        f"≥ {a.count} vidéos détectées": len(videos) >= a.count,
        f"≥ {a.count} vidéos reçues sur l'ordinateur, SHA-256 identique": ok >= a.count,
        "Aucune copie restante dans le relais Cloud": not any(v["relay_present"] for v in delivered),
    }
    print()
    for label, passed in checks.items():
        print(f"{'✔' if passed else '✘'} {label}")
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
