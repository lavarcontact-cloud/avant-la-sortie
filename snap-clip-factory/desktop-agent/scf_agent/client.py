"""Client HTTP du Cloud Control Plane avec renouvellement automatique du jeton."""
from __future__ import annotations

import threading
import time
from urllib.parse import urljoin

import httpx

from .config import SecretStore


class AuthError(RuntimeError):
    """L'appareil a été révoqué ou sa session a expiré : ré-appairage nécessaire."""


class CloudClient:
    def __init__(self, server: str, secrets: SecretStore, http: httpx.Client | None = None):
        self.server = server.rstrip("/")
        self.secrets = secrets
        self.http = http or httpx.Client(timeout=httpx.Timeout(30, read=120), follow_redirects=False)
        self._access: str | None = None
        self._access_exp = 0.0
        self._lock = threading.Lock()

    def url(self, path: str) -> str:
        return urljoin(self.server + "/", path.lstrip("/")) if not path.startswith("http") else path

    # --- appairage / jetons ---------------------------------------------------------
    def pair(self, code: str, name: str, platform: str) -> str:
        r = self.http.post(self.url("/v1/devices/pair"),
                           json={"code": code.strip().upper(), "name": name, "kind": "desktop", "platform": platform})
        if r.status_code != 201:
            raise AuthError(f"appairage refusé : {r.text}")
        return self._store(r.json())

    def _store(self, pair: dict) -> str:
        self.secrets.set("refresh_token", pair["refresh_token"])
        self._access = pair["access_token"]
        self._access_exp = time.time() + pair["expires_in"] - 30
        return pair["device_id"]

    def _token(self) -> str:
        with self._lock:
            if self._access and time.time() < self._access_exp:
                return self._access
            rt = self.secrets.get("refresh_token")
            if not rt:
                raise AuthError("agent non appairé")
            r = self.http.post(self.url("/v1/auth/refresh"), json={"refresh_token": rt})
            if r.status_code == 401:
                self.secrets.delete("refresh_token")
                raise AuthError("session révoquée : relancer `scf-agent pair`")
            r.raise_for_status()
            self._store(r.json())
            return self._access

    def request(self, method: str, path: str, **kw) -> httpx.Response:
        for attempt in (0, 1):
            headers = {**kw.pop("headers", {}), "Authorization": f"Bearer {self._token()}"}
            r = self.http.request(method, self.url(path), headers=headers, **kw)
            if r.status_code == 401 and attempt == 0:
                self._access = None  # jeton d'accès expiré ou rejeté : un seul renouvellement
                continue
            if r.status_code == 401:
                raise AuthError(r.text)
            return r
        raise AssertionError("unreachable")

    def get(self, path, **kw):
        return self.request("GET", path, **kw)

    def post(self, path, **kw):
        return self.request("POST", path, **kw)
