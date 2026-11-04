"""Phase 6.1 : évaluation humaine (motifs, comparaison manuelle, mesures, options désactivées par défaut)."""
import json

import pytest

from app import worker
from phase6_helpers import GOOD_CLIP, FakeLLM, anthropic_reply, delivered_video, payload, set_config, settings  # noqa: F401

OTHER = {**GOOD_CLIP, "start_s": 16.0, "end_s": 22.6, "category": "anecdote", "score": 40, "quote": "",
         "explanation": "Petite histoire avec une chute."}


def ctx(env):
    return env.c.app.state.ctx


def analyzed_video(env, monkeypatch, clips=(GOOD_CLIP, OTHER), asset="PH-1", data=b"x" * 40, timings=None, **cfg):
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY", "sk-test")
    set_config(env, provider="anthropic", min_clip_s=3, price_input_per_mtok=3.0, price_output_per_mtok=15.0, **cfg)
    vid = delivered_video(env, asset=asset, data=data)
    p = payload()
    if timings:
        p["summary"] = {**p["summary"], "timings_s": timings, "engine": "faster-whisper:small"}
    env.c.post(f"/v1/videos/{vid}/analysis-input", headers=env.desk, json=p)
    fake = FakeLLM([anthropic_reply(list(clips), 1000, 200)])
    worker.run_once(ctx(env), http=fake.client)
    cl = {c["category"]: c for c in env.c.get("/v1/clips", headers=env.user, params={"video_id": vid}).json()}
    return vid, cl, fake


def rep(env, **q):
    return env.c.get("/v1/evaluation/report", headers=env.user, params=q).json()


def test_reject_reasons_validated_and_counted(env, monkeypatch):
    _, cl, _ = analyzed_video(env, monkeypatch)
    rid = cl["anecdote"]["id"]
    assert env.c.post(f"/v1/clips/{rid}/reject", headers=env.user, json={"reasons": ["inventé"]}).status_code == 422
    assert env.c.post(f"/v1/clips/{cl['reaction']['id']}/approve", headers=env.user,
                      json={"reasons": ["doublon"]}).status_code == 422
    r = env.c.post(f"/v1/clips/{rid}/reject", headers=env.user,
                   json={"reasons": ["hors_contexte", "coupe_fin"], "note": "on ne comprend pas"})
    assert r.status_code == 200
    out = rep(env)
    assert out["rejection_reasons"]["hors_contexte"]["count"] == 1
    assert out["rejection_reasons"]["coupe_fin"]["label"].startswith("Mauvaise fin")
    assert out["rejected_without_reason"] == 0


def test_acceptance_rates_buckets_and_timecode_shifts(env, monkeypatch):
    _, cl, _ = analyzed_video(env, monkeypatch)
    a, b = cl["reaction"], cl["anecdote"]
    env.c.patch(f"/v1/clips/{a['id']}", headers=env.user, json={"start_s": a["start_s"] - 0.5, "end_s": a["end_s"] + 2.0})
    env.c.post(f"/v1/clips/{a['id']}/approve", headers=env.user)
    env.c.post(f"/v1/clips/{b['id']}/reject", headers=env.user, json={"reasons": ["pas_interessant"]})
    out = rep(env)
    assert out["totals"] | {} == {**out["totals"], "proposed": 2, "approved": 1, "rejected": 1, "acceptance_rate": 0.5}
    assert out["by_category"]["reaction"]["acceptance_rate"] == 1.0
    assert out["by_category"]["anecdote"]["acceptance_rate"] == 0.0
    assert out["by_score_bucket"]["60-79"]["approved"] == 1 and out["by_score_bucket"]["40-59"]["rejected"] == 1
    tc = out["timecodes"]
    # décalage mesuré par rapport à la PROPOSITION du modèle (fin proposée 8,2 s -> 10,03 s)
    assert tc["approved_clips"] == 1 and tc["end_shift_s"]["mean"] == pytest.approx(1.83) and tc["within_1s_share"] == 0.0
    assert tc["signed_end_shift_mean_s"] > 0
    assert out["by_model"]["anthropic:claude-sonnet-5-5"]["proposed"] == 2


def test_simulated_results_never_mixed_with_real(env, monkeypatch):
    set_config(env, provider="demo")
    vid = delivered_video(env, asset="DEMO", data=b"d" * 40)
    env.c.post(f"/v1/videos/{vid}/analysis-input", headers=env.desk, json=payload())
    worker.run_once(ctx(env))
    out = rep(env)
    assert out["totals"]["proposed"] == 0 and out["totals"]["simulated_excluded"] >= 1
    assert out["processing"]["videos"] == 0
    assert rep(env, include_simulated=True)["totals"]["proposed"] >= 1


def test_manual_selections_compared_with_ai(env, monkeypatch):
    vid, cl, _ = analyzed_video(env, monkeypatch)
    url = f"/v1/studio/videos/{vid}/selections"
    assert env.c.post(url, headers=env.user, json={"start_s": 9, "end_s": 4}).status_code == 422
    assert env.c.post(url, headers=env.user, json={"start_s": 1, "end_s": 2, "category": "viral"}).status_code == 422
    # retrouvé par l'IA (recouvre la « reaction »), même catégorie
    env.c.post(url, headers=env.user, json={"start_s": 4.9, "end_s": 8.5, "category": "reaction"})
    # manqué : passage sans proposition
    miss = env.c.post(url, headers=env.user, json={"start_s": 9.0, "end_s": 15.0, "category": "performance",
                                                    "note": "le passage musical"}).json()
    assert len(env.c.get(url, headers=env.user).json()) == 2
    m = rep(env)["manual_comparison"]
    assert (m["manual_selections"], m["found_by_ai"], m["recall"], m["category_agreement"]) == (2, 1, 0.5, 1.0)
    assert m["missed"][0]["note"] == "le passage musical"
    assert m["ai_proposals_on_these_videos"] == 2 and m["ai_proposals_matching_manual"] == 1
    assert env.c.delete(f"/v1/studio/selections/{miss['id']}", headers=env.user).json()["deleted"]
    assert rep(env)["manual_comparison"]["recall"] == 1.0


def test_processing_time_cost_and_clip_counts(env, monkeypatch):
    analyzed_video(env, monkeypatch, timings={"scenes": 1.2, "transcription": 8.8, "total": 11.3})
    pr = rep(env)["processing"]
    v = pr["per_video"][0]
    assert v["local_processing_s"] == 11.3 and v["realtime_factor"] == pytest.approx(11.3 / 22.6, abs=1e-3)
    assert v["engine"] == "faster-whisper:small" and v["clips"] == 2
    assert v["cost_usd"] == pytest.approx(1000 / 1e6 * 3 + 200 / 1e6 * 15)
    assert pr["cost_per_video_usd"]["n"] == 1 and pr["videos_with_unknown_cost"] == 0
    assert v["cloud_analysis_s"] is not None


def test_feedback_guidance_is_off_by_default_and_contains_no_transcript(env, monkeypatch):
    vid, cl, fake = analyzed_video(env, monkeypatch)
    assert "PRÉFÉRENCES" not in fake.requests[0].content.decode()
    for c in cl.values():                          # 2 refus "reaction" + 1 acceptation, pour dépasser le seuil
        env.c.post(f"/v1/clips/{c['id']}/reject", headers=env.user, json={"reasons": ["hors_contexte"]})
    _, cl2, _ = analyzed_video(env, monkeypatch, asset="PH-2", data=b"z" * 40)
    env.c.post(f"/v1/clips/{cl2['reaction']['id']}/reject", headers=env.user, json={"reasons": ["coupe_debut"]})
    # activation explicite
    vid3, _, fake3 = analyzed_video(env, monkeypatch, asset="PH-3", data=b"w" * 40, use_feedback_guidance=True)
    body = json.loads(fake3.requests[0].content)
    text = body["messages"][0]["content"]
    assert "PRÉFÉRENCES OBSERVÉES" in text
    assert "reaction :" not in text        # 2 décisions seulement : sous le seuil de 3, pas de conclusion
    assert "Incompréhensible sans le contexte" in text
    assert text.count("You recorded the whole album") == 1      # seulement la transcription de CETTE vidéo
    assert "on ne comprend pas" not in text
    # 3e refus « reaction » : la catégorie apparaît
    _, cl4, _ = analyzed_video(env, monkeypatch, asset="PH-4", data=b"v" * 40)
    env.c.post(f"/v1/clips/{cl4['reaction']['id']}/reject", headers=env.user, json={"reasons": ["coupe_debut"]})
    _, _, fake5 = analyzed_video(env, monkeypatch, asset="PH-5", data=b"u" * 40, use_feedback_guidance=True)
    assert "reaction : 0/3 acceptés" in json.loads(fake5.requests[0].content)["messages"][0]["content"]


def test_ranking_adjustment_opt_in_and_bounded(env, monkeypatch):
    _, cl, _ = analyzed_video(env, monkeypatch)
    for c in cl.values():
        assert "adjusted_score" not in c                      # désactivé par défaut
    env.c.post(f"/v1/clips/{cl['anecdote']['id']}/reject", headers=env.user, json={"reasons": ["pas_interessant"]})
    env.c.post(f"/v1/clips/{cl['reaction']['id']}/approve", headers=env.user)
    set_config(env, provider="anthropic", rank_with_feedback=True)
    out = env.c.get("/v1/clips", headers=env.user).json()
    for c in out:
        assert abs(c["adjusted_score"] - c["score"]) <= 10 and c["score"] in (74, 40)   # score d'origine intact
    by = {c["category"]: c for c in out}
    assert by["reaction"]["adjusted_score"] > 74 and by["anecdote"]["adjusted_score"] < 40


def test_export_and_permissions(env, monkeypatch):
    _, cl, _ = analyzed_video(env, monkeypatch)
    env.c.post(f"/v1/clips/{cl['reaction']['id']}/approve", headers=env.user)
    ex = env.c.get("/v1/evaluation/export", headers=env.user).json()
    assert [f["decision"] for f in ex["feedback"]] == ["approve"]
    for path in ("/v1/evaluation/report", "/v1/evaluation/export"):
        assert env.c.get(path, headers=env.desk).status_code == 403
        assert env.c.get(path, headers=env.ios).status_code == 403
