import hashlib
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


@pytest.fixture
def settings(tmp_path):
    return Settings(
        database_url=f"sqlite:///{tmp_path}/scf.db",
        secret_key="test-secret-key-0123456789-abcdefghijklmnop",
        relay_dir=tmp_path / "relay",
        min_chunk_size=4,
        default_chunk_size=1024,
    )


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c


class Env:
    def __init__(self, client):
        self.c = client
        client.post("/v1/auth/register", json={"email": "seb@example.com", "password": "motdepasse-solide"})
        r = client.post("/v1/auth/login", json={"email": "seb@example.com", "password": "motdepasse-solide"})
        self.user = {"Authorization": "Bearer " + r.json()["access_token"]}
        self.ios_tokens = self.pair("ios", "iPhone de Seb")
        self.desk_tokens = self.pair("desktop", "MacBook")
        self.ios = {"Authorization": "Bearer " + self.ios_tokens["access_token"]}
        self.desk = {"Authorization": "Bearer " + self.desk_tokens["access_token"]}

    def pair(self, kind, name):
        code = self.c.post("/v1/pairing-codes", headers=self.user).json()["code"]
        r = self.c.post("/v1/devices/pair", json={"code": code, "name": name, "kind": kind, "platform": "test"})
        assert r.status_code == 201, r.text
        return r.json()

    def register(self, asset_id, data: bytes | None, **extra):
        item = {"asset_local_id": asset_id, "filename": f"{asset_id}.mov", **extra}
        if data is not None:
            item.update(sha256=sha(data), size_bytes=len(data))
        r = self.c.post("/v1/videos/batch", headers=self.ios, json={"videos": [item]})
        assert r.status_code == 200, r.text
        return r.json()["results"][0]

    def upload(self, video_id, data: bytes, chunk_size=4, skip=()):
        s = self.c.post(f"/v1/videos/{video_id}/uploads", headers=self.ios, json={"chunk_size": chunk_size})
        assert s.status_code == 201, s.text
        s = s.json()
        for i in range(s["total_chunks"]):
            if i in skip or i in s["received"]:
                continue
            part = data[i * s["chunk_size"]:(i + 1) * s["chunk_size"]]
            r = self.c.put(f"/v1/uploads/{s['upload_id']}/chunks/{i}", headers={**self.ios, "X-Chunk-SHA256": sha(part)},
                           content=part)
            assert r.status_code == 200, r.text
        return s


@pytest.fixture
def env(client):
    return Env(client)
