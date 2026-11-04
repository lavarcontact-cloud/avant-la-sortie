"""Parcours phase 6 : données d'analyse -> worker -> clips -> validation humaine."""
import pytest

from app import worker
from app.clips import ClipState, PublicationRefused, assert_publishable
from app.models import AnalysisJob, Clip
from phase6_helpers import GOOD_CLIP, FakeLLM, anthropic_reply, delivered_video, payload, set_config, settings  # noqa: F401


def ctx(env):
    return env.c.app.state.ctx


def send(env, vid, p=None):
    return env.c.post(f"/v1/videos/{vid}/analysis-input", headers=env.desk, json=p or payload())


def clips(env, vid, **q):
    return env.c.get("/v1/clips", headers=env.user, params={"video_id": vid, **q}).json()


def test_demo_end_to_end_marks_everything_simulated(env):
    set_config(env, provider="demo")
    vid = delivered_video(env)
    r = send(env, vid)
    assert r.status_code == 202 and r.json()["job_id"]
    assert worker.run_once(ctx(env)) == 1
    cl = clips(env, vid)
    assert cl and all(c["simulated"] and c["state"] == "READY_FOR_REVIEW" for c in cl)
    assert all(c["title"].startswith("[DÉMO]") for c in cl)
    assert [h["to"] for h in cl[0]["history"]] == ["DETECTED", "ANALYZED", "READY_FOR_REVIEW"]
    # un résultat simulé ne peut jamais être validé
    assert env.c.post(f"/v1/clips/{cl[0]['id']}/approve", headers=env.user).status_code == 409
    detail = env.c.get(f"/v1/studio/videos/{vid}", headers=env.user).json()
    assert detail["transcript"]["segments"][1]["text"].startswith("Wait") and detail["jobs"][0]["simulated"]


def test_real_provider_flow_with_cost(env, monkeypatch):
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY", "sk-test")
    set_config(env, provider="anthropic", price_input_per_mtok=3.0, price_output_per_mtok=15.0)
    vid = delivered_video(env)
    send(env, vid)
    fake = FakeLLM([anthropic_reply([GOOD_CLIP], 2000, 400)])
    worker.run_once(ctx(env), http=fake.client)
    cl = clips(env, vid)
    assert len(cl) == 1 and not cl[0]["simulated"] and cl[0]["quote_verified"]
    job = env.c.get(f"/v1/studio/videos/{vid}", headers=env.user).json()["jobs"][0]
    assert job["status"] == "done" and job["cost_usd"] == pytest.approx(2000 / 1e6 * 3 + 400 / 1e6 * 15)
    assert job["estimated_cost_usd"] > 0
    # le contenu envoyé au fournisseur : du texte, aucune donnée vidéo
    sent = fake.requests[0].content.decode()
    assert "You recorded the whole album" in sent and len(fake.requests[0].content) < 20_000


def test_human_review_cycle_and_publication_guard(env, monkeypatch):
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY", "sk-test")
    set_config(env, provider="anthropic")
    vid = delivered_video(env)
    send(env, vid)
    worker.run_once(ctx(env), http=FakeLLM([anthropic_reply([GOOD_CLIP])]).client)
    cid = clips(env, vid)[0]["id"]
    db = ctx(env).db.SessionLocal()
    get = lambda: db.get(Clip, cid)  # noqa: E731

    with pytest.raises(PublicationRefused):          # pas encore validé
        assert_publishable(get())
    # un appareil ne peut pas valider
    assert env.c.post(f"/v1/clips/{cid}/approve", headers=env.desk).status_code == 403
    assert env.c.post(f"/v1/clips/{cid}/approve", headers=env.ios).status_code == 403
    assert env.c.post(f"/v1/clips/{cid}/approve", headers=env.user, json={"note": "ok"}).json()["state"] == "APPROVED"
    db.expire_all()
    assert_publishable(get())                        # validé tel quel : autorisé

    # modifier les timecodes après validation révoque la validation
    r = env.c.patch(f"/v1/clips/{cid}", headers=env.user, json={"start_s": 4.5, "end_s": 9.0}).json()
    assert r["state"] == "READY_FOR_REVIEW" and r["start_s"] == 4.5 and r["approved_at"] is None
    db.expire_all()
    with pytest.raises(PublicationRefused):
        assert_publishable(get())

    # validation contournée en écrivant l'état en base : refusée quand même
    c = get()
    c.state = ClipState.APPROVED.value
    db.commit()
    with pytest.raises(PublicationRefused, match="aucune validation humaine"):
        assert_publishable(get())
    c.approved_at, c.approved_by, c.approval_fingerprint = c.created_at, "user:x", "faux"
    db.commit()
    with pytest.raises(PublicationRefused, match="a changé"):
        assert_publishable(get())
    db.close()


def test_reject_and_reopen(env):
    set_config(env, provider="demo")
    vid = delivered_video(env)
    send(env, vid)
    worker.run_once(ctx(env))
    cid = clips(env, vid)[0]["id"]
    assert env.c.post(f"/v1/clips/{cid}/reject", headers=env.user, json={"note": "bof"}).json()["state"] == "REJECTED"
    assert env.c.patch(f"/v1/clips/{cid}", headers=env.user, json={"title": "x"}).status_code == 409
    assert env.c.post(f"/v1/clips/{cid}/reopen", headers=env.user).json()["state"] == "READY_FOR_REVIEW"


def test_timecode_edit_validated(env):
    set_config(env, provider="demo")
    vid = delivered_video(env)
    send(env, vid)
    worker.run_once(ctx(env))
    cid = clips(env, vid)[0]["id"]
    for bad in ({"start_s": 9, "end_s": 4}, {"end_s": 999}):
        assert env.c.patch(f"/v1/clips/{cid}", headers=env.user, json=bad).status_code == 422


def test_filters(env, monkeypatch):
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY", "sk-test")
    set_config(env, provider="anthropic", min_clip_s=3)
    vid = delivered_video(env)
    send(env, vid)
    other = {**GOOD_CLIP, "start_s": 16.0, "end_s": 22.6, "category": "anecdote", "score": 40, "quote": ""}
    worker.run_once(ctx(env), http=FakeLLM([anthropic_reply([GOOD_CLIP, other])]).client)
    assert {c["category"] for c in clips(env, vid)} == {"reaction", "anecdote"}
    assert [c["category"] for c in clips(env, vid, category="anecdote")] == ["anecdote"]
    assert [c["score"] for c in clips(env, vid, min_score=50)] == [74]


def test_transient_errors_retry_and_resume_windows(env, monkeypatch):
    """Fenêtre 1 réussie, puis 429 : au nouvel essai, seule la fenêtre 2 est redemandée."""
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY", "sk-test")
    set_config(env, provider="anthropic", level="rapide", max_input_chars=1_000_000)
    segs = [{"start": i * 4.0, "end": i * 4.0 + 3.5, "text": f"phrase {i} " + "mot " * 60, "speaker": None,
             "confidence": 0.9} for i in range(60)]
    vid = delivered_video(env, duration=240.0)
    send(env, vid, payload(segments=segs, duration=240.0))
    fake = FakeLLM([anthropic_reply([]), (429, {"error": "rate"})])
    worker.run_once(ctx(env), http=fake.client)
    db = ctx(env).db.SessionLocal()
    job = db.scalar(__import__("sqlalchemy").select(AnalysisJob))
    windows = job.progress["windows"]
    assert windows >= 2 and job.status == "queued" and job.attempts == 1 and job.progress["done"] == [0]
    job.next_attempt_at = job.created_at   # on n'attend pas le délai
    db.commit()
    fake2 = FakeLLM([anthropic_reply([])])
    worker.run_once(ctx(env), http=fake2.client)
    db.expire_all()
    assert db.get(AnalysisJob, job.id).status == "done"
    assert len(fake2.requests) == windows - 1            # la fenêtre 0 n'a pas été redemandée
    db.close()


def test_permanent_error_fails_without_retry(env, monkeypatch):
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY", "sk-bad")
    set_config(env, provider="anthropic")
    vid = delivered_video(env)
    send(env, vid)
    fake = FakeLLM([(401, {"error": "invalid x-api-key"})])
    worker.run_once(ctx(env), http=fake.client)
    job = env.c.get(f"/v1/studio/videos/{vid}", headers=env.user).json()["jobs"][0]
    assert job["status"] == "failed" and "401" in job["error"] and len(fake.requests) == 1
    assert worker.run_once(ctx(env), http=fake.client) == 0


def test_missing_key_fails_cleanly(env, monkeypatch):
    monkeypatch.delenv("SCF_OPENAI_API_KEY", raising=False)
    set_config(env, provider="openai", model="un-modele")
    vid = delivered_video(env)
    send(env, vid)
    worker.run_once(ctx(env))
    job = env.c.get(f"/v1/studio/videos/{vid}", headers=env.user).json()["jobs"][0]
    assert job["status"] == "failed" and "SCF_OPENAI_API_KEY" in job["error"]


def test_cost_limits_block_before_any_call(env, monkeypatch):
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY", "sk-test")
    set_config(env, provider="anthropic", price_input_per_mtok=3.0, price_output_per_mtok=15.0,
               max_cost_per_video_usd=0.0001)
    vid = delivered_video(env)
    send(env, vid)
    fake = FakeLLM([anthropic_reply([GOOD_CLIP])])
    worker.run_once(ctx(env), http=fake.client)
    job = env.c.get(f"/v1/studio/videos/{vid}", headers=env.user).json()["jobs"][0]
    assert job["status"] == "blocked" and "coût estimé" in job["error"] and fake.requests == []
    # limite de taille
    set_config(env, provider="anthropic", max_input_chars=1000)
    big = [{"start": 0, "end": 5, "text": "x" * 3000, "speaker": None, "confidence": 1}]
    vid2 = delivered_video(env, asset="PH-2", data=b"y" * 40)
    send(env, vid2, payload(segments=big))
    worker.run_once(ctx(env), http=fake.client)
    job = env.c.get(f"/v1/studio/videos/{vid2}", headers=env.user).json()["jobs"][0]
    assert job["status"] == "blocked" and "caractères" in job["error"] and fake.requests == []


def test_interrupted_job_is_requeued(env):
    set_config(env, provider="demo")
    vid = delivered_video(env)
    send(env, vid)
    db = ctx(env).db.SessionLocal()
    job = db.scalar(__import__("sqlalchemy").select(AnalysisJob))
    job.status = "running"                      # le serveur s'est arrêté pendant l'analyse
    db.commit()
    assert worker.run_once(ctx(env)) == 0
    assert worker.requeue_interrupted(ctx(env)) == 1
    assert worker.run_once(ctx(env)) == 1
    db.expire_all()
    assert db.get(AnalysisJob, job.id).status == "done"
    db.close()


def test_analysis_input_rules(env):
    set_config(env, provider="demo")
    vid = delivered_video(env)
    first = send(env, vid).json()
    again = send(env, vid).json()                   # renvoi identique (reprise de l'agent)
    assert again["duplicate"] and again["job_id"] == first["job_id"]
    # schéma strict : pas de champ supplémentaire (ex. données vidéo)
    assert env.c.post(f"/v1/videos/{vid}/analysis-input", headers=env.desk,
                      json={**payload(), "video_base64": "AAAA"}).status_code == 422
    big = payload(segments=[{"start": 0, "end": 1, "text": "x" * 4999}] * 600)
    assert env.c.post(f"/v1/videos/{vid}/analysis-input", headers=env.desk, json=big).status_code == 413
    # seul l'ordinateur qui a reçu la vidéo peut envoyer son analyse
    assert env.c.post(f"/v1/videos/{vid}/analysis-input", headers=env.ios, json=payload()).status_code == 403
    other_desk = env.pair("desktop", "Autre PC")
    h = {"Authorization": "Bearer " + other_desk["access_token"]}
    assert env.c.post(f"/v1/videos/{vid}/analysis-input", headers=h, json=payload()).status_code == 403


def test_reanalysis_keeps_reviewed_clips(env, monkeypatch):
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY", "sk-test")
    set_config(env, provider="anthropic", min_clip_s=3)
    vid = delivered_video(env)
    send(env, vid)
    other = {**GOOD_CLIP, "start_s": 16.0, "end_s": 22.6, "category": "anecdote", "score": 40, "quote": ""}
    worker.run_once(ctx(env), http=FakeLLM([anthropic_reply([GOOD_CLIP, other])]).client)
    first = {c["category"]: c["id"] for c in clips(env, vid)}
    env.c.post(f"/v1/clips/{first['reaction']}/approve", headers=env.user)
    assert env.c.post(f"/v1/studio/videos/{vid}/analyze", headers=env.user).status_code == 202
    worker.run_once(ctx(env), http=FakeLLM([anthropic_reply([])]).client)
    ids = {c["id"]: c["state"] for c in clips(env, vid)}
    assert ids == {first["reaction"]: "APPROVED"}   # la validée reste, l'non-examinée est remplacée


def test_no_publish_route_exists(env):
    paths = set(env.c.get("/openapi.json").json()["paths"])
    assert "/v1/clips/{clip_id}/{action}" in paths   # inventaire bien lu
    assert not any("publish" in p or "publication" in p for p in paths)


def test_edit_recomputes_excerpt_and_quote_check(env, monkeypatch):
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY", "sk-test")
    set_config(env, provider="anthropic", min_clip_s=3)
    vid = delivered_video(env)
    send(env, vid)
    worker.run_once(ctx(env), http=FakeLLM([anthropic_reply([GOOD_CLIP])]).client)
    cid = clips(env, vid)[0]["id"]
    r = env.c.patch(f"/v1/clips/{cid}", headers=env.user, json={"start_s": 16.0, "end_s": 22.6}).json()
    assert r["transcript_excerpt"].startswith("Yes. And honestly") and r["quote_verified"] is False
