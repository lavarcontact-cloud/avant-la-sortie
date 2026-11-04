"""Validation des propositions : le modèle propose, le serveur vérifie."""
import pytest

from app.ai.base import TransientAIError
from app.ai.config import AIConfig
from app.ai.moments import build_request, build_windows, parse_response, validate
from phase6_helpers import GOOD_CLIP, SEGMENTS, payload, settings  # noqa: F401

CFG = AIConfig(min_clip_s=3, max_clip_s=20)


def test_parse_variants():
    assert parse_response('{"clips": [{"a": 1}]}') == [{"a": 1}]
    assert parse_response('Voici :\n```json\n{"clips": []}\n```') == []
    assert parse_response('blabla {"clips": [{"b": 2}]} fin') == [{"b": 2}]
    for bad in ("", "pas de json", '{"autre": 1}', '{"clips": "x"}'):
        with pytest.raises(TransientAIError):   # jamais interprété comme « 0 clip »
            parse_response(bad)


def test_good_clip_is_kept_with_server_excerpt():
    kept, rejected = validate([GOOD_CLIP], payload(), CFG)
    assert rejected == [] and len(kept) == 1
    k = kept[0]
    assert (k.start_s, k.end_s) == (5.0, 8.03)               # recalé sur le segment
    assert (k.proposed_start_s, k.proposed_end_s) == (4.8, 8.2)
    assert k.quote_verified and k.transcript_excerpt == SEGMENTS[1]["text"]
    assert k.category == "reaction" and k.score == 74


def test_invented_quote_is_flagged_and_confidence_halved():
    kept, _ = validate([{**GOOD_CLIP, "quote": "We won the Grammy last year"}], payload(), CFG)
    assert not kept[0].quote_verified and kept[0].confidence == 0.4
    assert any("citation introuvable" in w for w in kept[0].warnings)


def test_uncertain_words_still_match_but_stay_marked():
    clip = {**GOOD_CLIP, "start_s": 16.0, "end_s": 22.6, "category": "anecdote",
            "quote": "that mistake became the best part of the song"}
    k = validate([clip], payload(), CFG)[0][0]
    assert k.quote_verified and "[mistake?]" in k.transcript_excerpt


@pytest.mark.parametrize("bad,reason", [
    ({"category": "viral"}, "catégorie inconnue"),
    ({"start_s": 9, "end_s": 4}, "fin"),
    ({"start_s": 50, "end_s": 60}, "hors de la vidéo"),
    ({"start_s": "début"}, "non numériques"),
])
def test_invalid_proposals_rejected(bad, reason):
    kept, rejected = validate([{**GOOD_CLIP, **bad}], payload(), CFG)
    assert kept == [] and reason in rejected[0]


def test_bounds_clamped_extended_and_trimmed():
    k = validate([{**GOOD_CLIP, "start_s": -2, "end_s": 1.0, "quote": ""}], payload(), CFG)[0][0]
    assert k.start_s == 0.0 and k.end_s - k.start_s >= 3 and k.warnings
    long = validate([{**GOOD_CLIP, "start_s": 0, "end_s": 22.6, "quote": ""}], payload(), AIConfig(min_clip_s=3, max_clip_s=10))[0][0]
    assert long.end_s - long.start_s == pytest.approx(10)


def test_scores_and_confidence_clamped():
    k = validate([{**GOOD_CLIP, "score": 250, "confidence": 3}], payload(), CFG)[0][0]
    assert k.score == 100 and k.confidence == 1.0


def test_overlapping_duplicates_merged_and_capped():
    dup = {**GOOD_CLIP, "start_s": 5.1, "end_s": 8.0, "score": 60}
    other = {**GOOD_CLIP, "start_s": 16.0, "end_s": 22.0, "category": "anecdote", "score": 50, "quote": ""}
    kept, _ = validate([GOOD_CLIP, dup, other], payload(), CFG)
    assert [k.score for k in kept] == [74, 50]
    kept, _ = validate([GOOD_CLIP, dup, other], payload(), AIConfig(min_clip_s=3, max_clip_s=20, max_clips_per_video=1))
    assert [k.score for k in kept] == [74]


def test_windows_split_long_transcripts_with_overlap():
    segs = [{"start": i * 4.0, "end": i * 4.0 + 3.5, "text": f"phrase numéro {i} " * 10, "speaker": None}
            for i in range(300)]
    wins = build_windows(segs, 1200.0, window_chars=12_000)
    assert len(wins) > 1 and wins[0].start == 0.0 and wins[-1].end == 1200.0
    assert wins[1].segments[0] in wins[0].segments            # chevauchement
    covered = {s["start"] for w in wins for s in w.segments}
    assert covered == {s["start"] for s in segs}               # rien de perdu


def test_prompt_contains_rules_and_only_text():
    p = payload()
    req = build_request(build_windows(p["transcript"]["segments"], 22.6, 24_000)[0], p, CFG, 1)
    assert "N'invente aucun contexte" in req.system and "PAS une" in req.system
    assert "[16.03–22.60]" in req.user and "[mistake?]" in req.user
    assert "verticale" in req.user


def test_no_transcript_uses_signals_only():
    p = payload(segments=[], status="unavailable")
    req = build_request(build_windows([], 22.6, 24_000)[0], p, CFG, 1)
    assert "aucune parole transcrite" in req.user
    k = validate([{**GOOD_CLIP, "quote": "", "category": "moment_inattendu"}], p, CFG)[0][0]
    assert any("aucune transcription" in w for w in k.warnings)


def test_new_categories_legacy_mapping_and_required_explanation():
    cats = ["punchline", "moment_drole", "anecdote", "reaction", "debat", "moment_inattendu", "coulisses",
            "performance", "moment_emotionnel", "phrase_polemique"]
    for i, cat in enumerate(cats):
        kept, rej = validate([{**GOOD_CLIP, "category": cat}], payload(), CFG)
        assert kept and kept[0].category == cat, (cat, rej)
    # anciennes catégories et variantes d'écriture converties
    assert validate([{**GOOD_CLIP, "category": "humour"}], payload(), CFG)[0][0].category == "moment_drole"
    assert validate([{**GOOD_CLIP, "category": "Moment émotionnel"}], payload(), CFG)[0][0].category == "moment_emotionnel"
    # pas d'explication -> rejet motivé
    kept, rej = validate([{**GOOD_CLIP, "explanation": "  "}], payload(), CFG)
    assert kept == [] and "explication" in rej[0]
    # polémique -> avertissement systématique
    k = validate([{**GOOD_CLIP, "category": "phrase_polemique"}], payload(), CFG)[0][0]
    assert any("polémique" in w for w in k.warnings)


def test_orientation_uses_rotation_like_iphone_files():
    """Fichier iPhone réel : stocké 1920x1080, rotation -90 -> vertical à l'affichage."""
    p = payload(width=1920, height=1080, rotation=-90)
    req = build_request(build_windows(p["transcript"]["segments"], 22.6, 24_000)[0], p, CFG, 1)
    assert "verticale" in req.user
    p2 = payload(width=1920, height=1080, rotation=0)
    assert "horizontale" in build_request(build_windows(p2["transcript"]["segments"], 22.6, 24_000)[0], p2, CFG, 1).user
