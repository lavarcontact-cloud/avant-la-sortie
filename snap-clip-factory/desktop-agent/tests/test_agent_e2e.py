"""Chaîne réelle Cloud <-> agent (le Cloud tourne en processus via TestClient,
la vidéo est un vrai fichier H.264 généré par ffmpeg)."""
import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "cloud"))
sys.path.insert(0, str(ROOT / "desktop-agent"))

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from scf_agent.agent import Agent  # noqa: E402
from scf_agent.client import CloudClient  # noqa: E402
from scf_agent.config import AgentConfig, SecretStore  # noqa: E402

pytestmark = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg requis")


def sha(b):
    return hashlib.sha256(b).hexdigest()


@pytest.fixture(scope="module")
def video_bytes(tmp_path_factory):
    out = tmp_path_factory.mktemp("src") / "IMG_0001.MOV"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x568:rate=30",
                    "-f", "lavfi", "-i", "sine=duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
                    "-shortest", str(out)], check=True)
    return out.read_bytes()


class World:
    def __init__(self, tmp_path):
        os.environ["SCF_AGENT_NO_KEYRING"] = "1"
        self.settings = Settings(database_url=f"sqlite:///{tmp_path}/cloud.db", secret_key="x" * 40,
                                 relay_dir=tmp_path / "relay", min_chunk_size=1024, default_chunk_size=16 * 1024)
        self.http = TestClient(create_app(self.settings)).__enter__()
        h = self.http
        h.post("/v1/auth/register", json={"email": "s@e.com", "password": "motdepasse-solide"})
        tok = h.post("/v1/auth/login", json={"email": "s@e.com", "password": "motdepasse-solide"}).json()["access_token"]
        self.user = {"Authorization": f"Bearer {tok}"}
        code = h.post("/v1/pairing-codes", headers=self.user).json()["code"]
        ios = h.post("/v1/devices/pair", json={"code": code, "name": "iPhone", "kind": "ios"}).json()
        self.ios = {"Authorization": f"Bearer {ios['access_token']}"}
        self.home = tmp_path / "agent-home"
        self.library = tmp_path / "library"
        code = h.post("/v1/pairing-codes", headers=self.user).json()["code"]
        self.client = CloudClient("http://testserver", SecretStore(self.home), http=h)
        self.client.pair(code, "Mac", "test")
        self.cfg = AgentConfig(server="http://testserver", library_dir=str(self.library), min_free_disk_bytes=0)

    def agent(self):
        return Agent(self.cfg, self.client, home=self.home)

    def iphone_upload(self, asset, data, created="2026-10-02T18:30:00Z"):
        h = self.http
        r = h.post("/v1/videos/batch", headers=self.ios, json={"videos": [{
            "asset_local_id": asset, "filename": "IMG 0001.MOV", "source_created_at": created,
            "sha256": sha(data), "size_bytes": len(data)}]}).json()
        vid = r["results"][0]["video"]["id"]
        s = h.post(f"/v1/videos/{vid}/uploads", headers=self.ios, json={}).json()
        for i in range(s["total_chunks"]):
            part = data[i * s["chunk_size"]:(i + 1) * s["chunk_size"]]
            h.put(f"/v1/uploads/{s['upload_id']}/chunks/{i}", headers={**self.ios, "X-Chunk-SHA256": sha(part)}, content=part)
        assert h.post(f"/v1/uploads/{s['upload_id']}/complete", headers=self.ios).json()["state"] == "VERIFIED"
        return vid


@pytest.fixture
def world(tmp_path):
    return World(tmp_path)


def test_end_to_end_download_verify_process(world, video_bytes):
    vid = world.iphone_upload("PH-A", video_bytes)
    world.agent().tick()
    files = [p for p in world.library.rglob("*.MOV")]
    assert len(files) == 1 and files[0].read_bytes() == video_bytes
    assert files[0].parts[-3:-1] == ("2026", "10") and "IMG_0001" in files[0].name
    v = world.http.get(f"/v1/videos/{vid}", headers=world.user).json()
    assert v["state"] == "COMPLETED" and v["relay_present"] is False
    assert not any((world.settings.relay_dir / "videos").iterdir())        # plus rien dans le Cloud
    probe = world.http.app.state.ctx.db.SessionLocal().get(__import__("app.models", fromlist=["Video"]).Video, vid).probe
    assert probe["video_codec"] == "h264" and probe["width"] == 320 and probe["has_audio"]
    assert list((world.home / "work" / "thumbnails").glob("*.jpg"))
    devs = world.http.get("/v1/devices", headers=world.user).json()
    mac = next(d for d in devs if d["kind"] == "desktop")
    assert mac["status"]["queue"]["done"] == 1 and mac["status"]["disk_free_bytes"] > 0


def test_resume_partial_download(world, video_bytes):
    vid = world.iphone_upload("PH-B", video_bytes)
    agent = world.agent()
    item = agent.fetch_inbox()[0]
    from scf_agent.transfer import library_path
    dest = library_path(world.library, item["video"])
    dest.parent.mkdir(parents=True)
    Path(str(dest) + ".part").write_bytes(video_bytes[: len(video_bytes) // 3])   # coupure à 33 %
    agent.tick()
    assert dest.read_bytes() == video_bytes
    assert world.http.get(f"/v1/videos/{vid}", headers=world.user).json()["state"] == "COMPLETED"


def test_corrupted_partial_is_discarded_then_retried(world, video_bytes):
    world.iphone_upload("PH-C", video_bytes)
    agent = world.agent()
    item = agent.fetch_inbox()[0]
    from scf_agent.transfer import library_path
    dest = library_path(world.library, item["video"])
    dest.parent.mkdir(parents=True)
    Path(str(dest) + ".part").write_bytes(b"\x00" * 1000)                         # .part corrompu
    agent.tick()
    row = agent.queue.get(item["video"]["id"])
    assert row["stage"] == "pending" and "SHA-256" in row["last_error"] and not dest.exists()
    agent.queue.conn.execute("UPDATE videos SET next_attempt_at=0")
    agent.tick()                                                                  # nouvel essai, depuis zéro
    assert dest.read_bytes() == video_bytes


def test_restart_resumes_processing(world, video_bytes, monkeypatch):
    vid = world.iphone_upload("PH-D", video_bytes)
    a1 = world.agent()
    a1.cfg.process_after_download = False
    a1.tick()                                                   # téléchargé + livré, pas traité, puis « crash »
    assert world.http.get(f"/v1/videos/{vid}", headers=world.user).json()["state"] == "VERIFIED"
    world.cfg.process_after_download = True
    a2 = world.agent()                                          # redémarrage de l'ordinateur
    a2.reconcile()
    a2.tick()
    assert world.http.get(f"/v1/videos/{vid}", headers=world.user).json()["state"] == "COMPLETED"


def test_pause_command_from_dashboard(world, video_bytes):
    world.iphone_upload("PH-E", video_bytes)
    world.http.post("/v1/sync/pause", headers=world.user)
    agent = world.agent()
    agent.tick()
    assert agent.paused and not list(world.library.rglob("*.MOV"))
    world.http.post("/v1/sync/resume", headers=world.user)
    agent.tick()
    assert len(list(world.library.rglob("*.MOV"))) == 1


def test_revoked_agent_stops(world):
    did = next(d for d in world.http.get("/v1/devices", headers=world.user).json() if d["kind"] == "desktop")["id"]
    world.http.delete(f"/v1/devices/{did}", headers=world.user)
    world.client._access = None
    from scf_agent.client import AuthError
    with pytest.raises(AuthError):
        world.agent().tick()
