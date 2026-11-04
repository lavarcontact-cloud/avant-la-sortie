from conftest import Env, sha


def test_signup_closed_after_first_account(env):
    r = env.c.post("/v1/auth/register", json={"email": "intrus@example.com", "password": "motdepasse-solide"})
    assert r.status_code == 403


def test_pairing_code_single_use(env):
    code = env.c.post("/v1/pairing-codes", headers=env.user).json()["code"]
    body = {"code": code, "name": "x", "kind": "ios"}
    assert env.c.post("/v1/devices/pair", json=body).status_code == 201
    assert env.c.post("/v1/devices/pair", json=body).status_code == 400


def test_refresh_rotation_and_reuse_detection(env):
    old = env.ios_tokens["refresh_token"]
    r = env.c.post("/v1/auth/refresh", json={"refresh_token": old})
    assert r.status_code == 200
    new = r.json()["refresh_token"]
    # rejouer l'ancien jeton = vol suspecté -> toute la famille est révoquée
    assert env.c.post("/v1/auth/refresh", json={"refresh_token": old}).status_code == 401
    assert env.c.post("/v1/auth/refresh", json={"refresh_token": new}).status_code == 401


def test_revoked_device_is_locked_out(env):
    did = env.ios_tokens["device_id"]
    assert env.c.delete(f"/v1/devices/{did}", headers=env.user).status_code == 200
    assert env.c.get("/v1/devices/me", headers=env.ios).status_code == 401
    assert env.c.post("/v1/auth/refresh", json={"refresh_token": env.ios_tokens["refresh_token"]}).status_code == 401


def test_roles_are_enforced(env):
    # l'agent desktop ne peut pas uploader, l'iPhone ne peut pas lire la boîte de réception
    assert env.c.post("/v1/videos/batch", headers=env.desk, json={"videos": []}).status_code == 403
    assert env.c.get("/v1/agent/inbox", headers=env.ios).status_code == 403
    assert env.c.get("/v1/devices", headers=env.ios).status_code == 403
    assert env.c.get("/v1/videos").status_code == 401


def test_videos_isolated_between_accounts(client, settings):
    settings.allow_signup = True
    a = Env(client)
    vid = a.register("PH-1", b"secret-video")["video"]["id"]
    client.post("/v1/auth/register", json={"email": "autre@example.com", "password": "motdepasse-solide"})
    tok = client.post("/v1/auth/login", json={"email": "autre@example.com", "password": "motdepasse-solide"}).json()
    other = {"Authorization": "Bearer " + tok["access_token"]}
    assert client.get(f"/v1/videos/{vid}", headers=other).status_code == 404
    assert client.get("/v1/videos", headers=other).json() == []


def test_commands_delivered_once(env):
    assert env.c.post("/v1/sync/sync_now", headers=env.user).json()["queued_for"] == 2
    first = env.c.get("/v1/devices/me/commands", headers=env.ios).json()
    assert [x["kind"] for x in first] == ["sync_now"]
    assert env.c.get("/v1/devices/me/commands", headers=env.ios).json() == []


def test_heartbeat_filters_unknown_keys(env):
    env.c.post("/v1/devices/me/heartbeat", headers=env.desk,
               json={"status": {"disk_free_bytes": 123, "evil": "<script>"}})
    devs = env.c.get("/v1/devices", headers=env.user).json()
    desk = next(d for d in devs if d["kind"] == "desktop")
    assert desk["status"] == {"disk_free_bytes": 123}


def test_websocket_auth_and_events(env):
    with env.c.websocket_connect("/v1/ws") as ws:
        ws.send_json({"token": env.user["Authorization"].split()[1]})
        assert ws.receive_json()["type"] == "ready"
        env.c.post("/v1/devices/me/heartbeat", headers=env.desk, json={"status": {"disk_free_bytes": 1}})
        assert ws.receive_json()["type"] == "device"


def test_websocket_rejects_device_token(env):
    import pytest
    from starlette.websockets import WebSocketDisconnect
    with env.c.websocket_connect("/v1/ws") as ws:
        ws.send_json({"token": env.ios["Authorization"].split()[1]})
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()
