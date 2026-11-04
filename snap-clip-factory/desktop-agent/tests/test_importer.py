"""`scf-agent import` : vidéo du PC -> Cloud par le protocole de l'iPhone, puis chaîne complète."""
import hashlib
import subprocess

import httpx
import pytest

import media
from scf_agent import importer, processing
from test_analysis import ScriptedTranscriber, World6

pytestmark = pytest.mark.skipif(not (media.FFMPEG and media.HAS_FLITE), reason="ffmpeg avec flite requis")


@pytest.fixture
def world(tmp_path):
    return World6(tmp_path)


def code(world):
    return world.http.post("/v1/pairing-codes", headers=world.user).json()["code"]


def test_import_then_agent_processes(world, tmp_path, monkeypatch):
    m = media.build(tmp_path / "src" / "Vidéo été.mp4")      # nom accentué
    before = hashlib.sha256(m.path.read_bytes()).hexdigest()
    home = tmp_path / "imp"
    v = importer.run([str(m.path)], "http://testserver", code(world), http=world.http, home=home)[0]
    assert v["state"] == "VERIFIED"
    assert hashlib.sha256(m.path.read_bytes()).hexdigest() == before           # original intact
    devs = {d["name"]: d for d in world.http.get("/v1/devices", headers=world.user).json()}
    assert "Import PC (sans iPhone)" in devs
    # 2e lancement, sans code : pas de doublon
    again = importer.run([str(m.path.parent)], None, None, http=world.http, home=home)
    assert again[0]["id"] == v["id"]
    assert len(world.http.get("/v1/videos", headers=world.user).json()) == 1
    # l'agent la récupère et l'analyse comme une vidéo d'iPhone
    monkeypatch.setattr(processing, "make_transcriber", lambda opts: ScriptedTranscriber(m))
    world.agent().tick()
    got = world.http.get(f"/v1/videos/{v['id']}", headers=world.user).json()
    assert got["state"] == "COMPLETED" and got["filename"] == "Vidéo été.mp4"
    from app import worker
    assert worker.run_once(world.ctx) == 1
    assert world.http.get("/v1/clips", headers=world.user, params={"video_id": v["id"]}).json()


def test_import_resumes_after_network_cut(world, tmp_path):
    src = tmp_path / "gros.mp4"
    subprocess.run([media.FFMPEG, "-v", "error", "-f", "lavfi", "-i", "testsrc2=duration=8:size=640x360:rate=25",
                    "-c:v", "libx264", "-b:v", "3M", str(src)], check=True)
    home = tmp_path / "imp"
    importer.pair(world.http, "http://testserver", code(world), home, importer.SecretStore(home))
    token = importer._token(world.http, "http://testserver", importer.SecretStore(home))
    state = {"ok_puts": 0, "cut": True}
    real_put = world.http.put

    def flaky(url, **kw):
        if state["cut"] and state["ok_puts"] >= 2:
            raise httpx.ConnectError("coupure persistante")
        state["ok_puts"] += 1
        return real_put(url, **kw)

    world.http.put = flaky
    real_sleep, importer.time.sleep = importer.time.sleep, lambda s: None
    try:
        with pytest.raises(importer.ImportError_, match="relancer pour reprendre"):
            importer.import_file(world.http, "http://testserver", token, src, chunk_size=262144, log=lambda *_: None)
        state.update(cut=False, ok_puts=0)
        v = importer.import_file(world.http, "http://testserver", token, src, chunk_size=262144, log=lambda *_: None)
    finally:
        world.http.put = real_put
        importer.time.sleep = real_sleep
    total = -(-src.stat().st_size // 262144)
    assert v["state"] == "VERIFIED" and v["sha256"] == hashlib.sha256(src.read_bytes()).hexdigest()
    assert state["ok_puts"] == total - 2            # reprise : seuls les morceaux manquants sont renvoyés


def test_import_requires_pairing(tmp_path):
    with pytest.raises(importer.ImportError_, match="non appairé"):
        importer.run([str(tmp_path)], "http://x", None, http=httpx.Client(), home=tmp_path / "h")
