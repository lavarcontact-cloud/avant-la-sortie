"""Mesures de qualité de transcription (phase 6.1), vérifiées sur des cas calculés à la main."""
import json
from pathlib import Path

import pytest

import media
from scf_agent import bench
from scf_agent.quality import align, cer, evaluate, normalize_words, parse_srt, wer
from scf_agent.transcription import Transcript, TranscriptSegment, Word


def test_french_normalization_keeps_accents_and_splits_elisions():
    assert normalize_words("J'ai vu ça, à Paris !") == ["j'", "ai", "vu", "ça", "à", "paris"]
    assert normalize_words("L’album… [incroyable?]") == ["l'", "album", "incroyable"]
    assert normalize_words("a") != normalize_words("à")


def test_wer_by_hand():
    ref = normalize_words("je suis allé au studio hier soir")          # 7 mots
    hyp = normalize_words("je suis allée au studio soir")               # 1 substitution + 1 suppression
    assert wer(ref, hyp) == round(2 / 7, 4)
    assert wer(ref, ref) == 0.0 and wer([], hyp) is None
    ops = [op for op, _, _ in align(["a", "b", "c"], ["a", "x", "c", "d"])]
    assert ops == ["ok", "sub", "ok", "ins"]
    assert cer("abc", "abd") == round(1 / 3, 4)


def test_uncertainty_calibration():
    """2 mots faux dont 1 signalé incertain ; 1 mot juste signalé à tort."""
    words = [Word(0.0, 0.3, "je", 0.9), Word(0.3, 0.6, "suis", 0.3, uncertain=True),
             Word(0.6, 1.0, "allée", 0.2, uncertain=True), Word(1.0, 1.4, "o", 0.9), Word(1.4, 2.0, "studio", 0.95)]
    t = Transcript("ok", "test", segments=[TranscriptSegment(0, 2, "je suis allée o studio", words=words)]).to_dict()
    q = evaluate("je suis allé au studio", t)
    assert (q.substitutions, q.deletions, q.insertions, q.wer) == (2, 0, 0, 0.4)
    assert q.wrong_marked_uncertain == 0.5          # « allée » signalé, « o » non
    assert q.correct_marked_uncertain == round(1 / 3, 3)   # « suis » était juste


SRT = """1
00:00:01,000 --> 00:00:03,000
[Seb] Le studio m'a rappelé le soir même.

2
00:00:05,500 --> 00:00:07,000
Karim: Quoi ? Tout l'album en une prise ?

3
00:00:08,000 --> 00:00:09,000
[Seb] Ouais.
"""


def test_srt_speakers_and_cue_timecodes():
    cues = parse_srt(SRT)
    assert [(c.start, c.speaker) for c in cues] == [(1.0, "Seb"), (5.5, "Karim"), (8.0, "Seb")]
    assert cues[1].text.startswith("Quoi")
    segs = [TranscriptSegment(1.2, 3.0, "le studio m'a rappelé le soir même"),
            TranscriptSegment(6.4, 7.0, "quoi tout l'album en une prise"),
            TranscriptSegment(8.1, 8.6, "ouais")]
    q = evaluate(" ".join(c.text for c in cues), Transcript("ok", "t", segments=segs).to_dict(), cues)
    assert q.wer == 0.0 and q.ref_speaker_changes == 2 and q.speakers_detected is False
    assert q.cue_start_error_s["n"] == 3 and q.cue_start_error_s["median"] == pytest.approx(0.2)
    assert q.cue_start_error_s["within_0_5s"] == pytest.approx(2 / 3, abs=1e-3)


@pytest.mark.skipif(not (media.FFMPEG and media.HAS_FLITE), reason="ffmpeg avec flite requis")
def test_bench_end_to_end_with_reference(tmp_path):
    """Banc complet sur vidéo synthétique. Transcription = DOUBLE DE TEST avec une erreur volontaire."""
    m = media.build(tmp_path / "v" / "dialogue.mp4")
    speech = [s for s in m.segments if s.kind == "speech"]

    class OneMistake:
        name = "double-de-test"

        def transcribe(self, audio, language):
            segs = [TranscriptSegment(s.start, s.end, s.text) for s in speech]
            segs[0].text = segs[0].text.replace("studio", "radio")       # 1 substitution connue
            return Transcript("ok", self.name, language="en", segments=segs)

    def ts(t):
        return f"00:00:{int(t):02d},{int((t % 1) * 1000):03d}"
    srt = "\n".join(f"{i + 1}\n{ts(s.start)} --> {ts(s.end)}\n{s.text}\n" for i, s in enumerate(speech))
    (tmp_path / "v" / "dialogue.srt").write_text(srt)
    media.build(tmp_path / "v" / "muet.mp4", with_audio=False)
    rep = bench.run(tmp_path / "v", tmp_path / "out", {"enabled": True, "transcriber": "auto", "whisper_model": "small",
                                                        "language": "auto"}, transcriber=OneMistake())
    by = {r["file"]: r for r in rep["videos"]}
    q = by["dialogue.mp4"]["quality"]
    n_ref = len(normalize_words(" ".join(s.text for s in speech)))
    assert q["substitutions"] == 1 and q["wer"] == round(1 / n_ref, 4)
    assert q["cue_start_error_s"]["median"] == 0.0
    assert by["muet.mp4"]["transcript_status"] == "no_audio" and by["muet.mp4"]["quality"] is None
    assert by["dialogue.mp4"]["timings_s"]["wall_total"] > 0 and by["dialogue.mp4"]["realtime_factor"] > 0
    md = (tmp_path / "out" / "bench.md").read_text()
    assert "dialogue.mp4" in md and "muet.mp4" in md
    assert json.loads((tmp_path / "out" / "bench.json").read_text())["videos"]
