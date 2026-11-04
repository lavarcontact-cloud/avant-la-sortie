from conftest import sha

DATA = b"0123456789abcdefghijklmnopqrstuvwxyz-video-bytes!"  # 49 octets -> 13 morceaux de 4


def test_full_chain_iphone_to_desktop(env, settings):
    c = env.c
    res = env.register("PH-1", None, source_created_at="2026-10-01T10:00:00Z", duration_s=12.5, width=1080, height=1920)
    vid = res["video"]["id"]
    assert res["video"]["state"] == "DISCOVERED"

    r = c.post(f"/v1/videos/{vid}/fingerprint", headers=env.ios, json={"sha256": sha(DATA), "size_bytes": len(DATA)})
    assert r.json()["video"]["state"] == "QUEUED"

    s = env.upload(vid, DATA)
    assert s["total_chunks"] == 13
    r = c.post(f"/v1/uploads/{s['upload_id']}/complete", headers=env.ios)
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "VERIFIED" and r.json()["relay_present"]

    inbox = c.get("/v1/agent/inbox", headers=env.desk).json()["items"]
    assert [i["video"]["id"] for i in inbox] == [vid]
    url = inbox[0]["download_url"]
    body = c.get(url).content
    assert body == DATA

    r = c.post(f"/v1/videos/{vid}/delivered", headers=env.desk, json={"sha256": sha(DATA)})
    assert r.json()["relay_present"] is False                     # relais purgé
    assert not (settings.relay_dir / "videos" / vid).exists()
    assert c.get(url).status_code == 404
    assert c.get("/v1/agent/inbox", headers=env.desk).json()["items"] == []

    for st in ("PROCESSING", "COMPLETED"):
        r = c.post(f"/v1/videos/{vid}/state", headers=env.desk, json={"state": st, "probe": {"codec": "hevc"}})
        assert r.json()["state"] == st
    summary = c.get("/v1/dashboard/summary", headers=env.user).json()
    assert summary["sync"]["by_state"]["COMPLETED"] == 1
    assert summary["sync"]["delivered_to_desktop"] == 1
    actions = [a["action"] for a in c.get("/v1/activity", headers=env.user).json()]
    assert "video.delivered" in actions and "device.paired" in actions


def test_resume_after_interruption(env):
    vid = env.register("PH-2", DATA)["video"]["id"]
    s1 = env.upload(vid, DATA, skip={3, 7, 12})              # coupure réseau : 3 morceaux perdus
    r = env.c.post(f"/v1/uploads/{s1['upload_id']}/complete", headers=env.ios)
    assert r.status_code == 409 and r.json()["detail"]["missing"] == [3, 7, 12]

    # L'app redémarre : rouvrir renvoie la MÊME session avec la liste des reçus
    s2 = env.c.post(f"/v1/videos/{vid}/uploads", headers=env.ios, json={"chunk_size": 4}).json()
    assert s2["upload_id"] == s1["upload_id"]
    assert set(range(13)) - set(s2["received"]) == {3, 7, 12}
    env.upload(vid, DATA)                                       # n'envoie que les manquants
    r = env.c.post(f"/v1/uploads/{s1['upload_id']}/complete", headers=env.ios)
    assert r.json()["state"] == "VERIFIED"


def test_corrupted_chunk_rejected(env):
    vid = env.register("PH-3", DATA)["video"]["id"]
    s = env.c.post(f"/v1/videos/{vid}/uploads", headers=env.ios, json={"chunk_size": 4}).json()
    r = env.c.put(f"/v1/uploads/{s['upload_id']}/chunks/0", headers={**env.ios, "X-Chunk-SHA256": sha(b"XXXX")},
                  content=DATA[:4])
    assert r.status_code == 422
    r = env.c.put(f"/v1/uploads/{s['upload_id']}/chunks/0", headers={**env.ios, "X-Chunk-SHA256": sha(b"abc")},
                  content=b"abc")
    assert r.status_code == 400  # mauvaise taille


def test_global_integrity_failure_marks_failed(env):
    announced = DATA[:-1] + b"?"                       # le fichier annoncé n'est pas celui envoyé
    vid = env.register("PH-4", announced)["video"]["id"]
    s = env.upload(vid, DATA)
    r = env.c.post(f"/v1/uploads/{s['upload_id']}/complete", headers=env.ios)
    assert r.status_code == 422
    v = env.c.get(f"/v1/videos/{vid}", headers=env.ios).json()
    assert v["state"] == "FAILED" and "intégrité" in v["error"] and not v["relay_present"]
    # reprise possible : nouvelle session
    assert env.c.post(f"/v1/videos/{vid}/uploads", headers=env.ios, json={}).status_code == 201


def test_duplicates_are_merged(env):
    first = env.register("PH-5", DATA)["video"]
    dup = env.register("SHARE-abc", DATA, origin="snapchat_memories")
    assert dup["deduplicated"] is True and dup["video"]["id"] == first["id"]
    vids = env.c.get("/v1/videos", headers=env.user).json()
    assert len(vids) == 1


def test_already_uploaded_returns_409(env):
    vid = env.register("PH-6", DATA)["video"]["id"]
    s = env.upload(vid, DATA)
    env.c.post(f"/v1/uploads/{s['upload_id']}/complete", headers=env.ios)
    r = env.c.post(f"/v1/videos/{vid}/uploads", headers=env.ios, json={})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "already_uploaded"


def test_range_download(env):
    vid = env.register("PH-7", DATA)["video"]["id"]
    s = env.upload(vid, DATA)
    env.c.post(f"/v1/uploads/{s['upload_id']}/complete", headers=env.ios)
    url = env.c.get("/v1/agent/inbox", headers=env.desk).json()["items"][0]["download_url"]
    r = env.c.get(url, headers={"Range": "bytes=10-"})
    assert r.status_code == 206 and r.content == DATA[10:]
    assert r.headers["content-range"] == f"bytes 10-{len(DATA) - 1}/{len(DATA)}"
    # signature falsifiée
    assert env.c.get(url.replace("sig=", "sig=00")).status_code == 403


def test_recent_videos_first(env):
    old = env.register("OLD", b"old-bytes", source_created_at="2020-01-01T00:00:00Z")["video"]["id"]
    new = env.register("NEW", b"new-bytes", source_created_at="2026-10-01T00:00:00Z")["video"]["id"]
    for vid, d in ((old, b"old-bytes"), (new, b"new-bytes")):
        s = env.upload(vid, d)
        env.c.post(f"/v1/uploads/{s['upload_id']}/complete", headers=env.ios)
    ids = [i["video"]["id"] for i in env.c.get("/v1/agent/inbox", headers=env.desk).json()["items"]]
    assert ids == [new, old]


def test_invalid_transition_refused(env):
    vid = env.register("PH-8", DATA)["video"]["id"]
    s = env.upload(vid, DATA)
    env.c.post(f"/v1/uploads/{s['upload_id']}/complete", headers=env.ios)
    env.c.post(f"/v1/videos/{vid}/delivered", headers=env.desk, json={"sha256": sha(DATA)})
    r = env.c.post(f"/v1/videos/{vid}/state", headers=env.desk, json={"state": "COMPLETED"})
    assert r.status_code == 409  # VERIFIED -> COMPLETED sans PROCESSING


def test_oversized_chunk_rejected(env, settings):
    vid = env.register("PH-9", DATA)["video"]["id"]
    s = env.c.post(f"/v1/videos/{vid}/uploads", headers=env.ios, json={"chunk_size": 4}).json()
    big = b"x" * (settings.max_chunk_size + 1)
    r = env.c.put(f"/v1/uploads/{s['upload_id']}/chunks/0", headers={**env.ios, "X-Chunk-SHA256": sha(big)}, content=big)
    assert r.status_code == 413
