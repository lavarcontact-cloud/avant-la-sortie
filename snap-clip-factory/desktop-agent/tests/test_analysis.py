"""Phase 6 côté agent, sur des vidéos synthétiques réelles (ffmpeg + voix flite).

La transcription réelle (faster-whisper) ne peut pas tourner ici : aucun modèle
n'est téléchargeable dans cet environnement. Elle est remplacée par
`ScriptedTranscriber`, un DOUBLE DE TEST qui renvoie le texte connu du script.
L'adaptateur faster-whisper est testé avec un module factice qui imite son API.
"""
import json
import shutil
import subprocess
import sys
import types
from pathlib import Path

import httpx
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "cloud"), str(ROOT / "cloud" / "tests")]

import media  # noqa: E402
from scf_agent import processing, signals  # noqa: E402
from scf_agent.transcription import (FasterWhisperTranscriber, Transcript, TranscriptSegment, Word,  # noqa: E402
                                     make_transcriber, mark_uncertain, render_text)
from test_agent_e2e import World  # noqa: E402

pytestmark = pytest.mark.skipif(not (media.FFMPEG and media.HAS_FLITE), reason="ffmpeg avec flite requis")
OPTS = {"enabled": True, "transcriber": "auto", "language": "auto", "scene_threshold": 10.0}


class ScriptedTranscriber:
    """Double de test : renvoie le script connu de la vidéo synthétique."""
    name = "scripted-test-double"

    def __init__(self, m: media.Media):
        self.m = m
        self.calls = 0

    def transcribe(self, audio: Path, language):
        self.calls += 1
        assert audio.exists() and audio.suffix == ".wav"       # reçoit bien l'audio extrait
        segs = [TranscriptSegment(s.start, s.end, s.text, speaker=f"voix_{s.voice}", confidence=0.9)
                for s in self.m.segments if s.kind == "speech"]
        return Transcript(status="ok", engine=self.name, language="en", language_probability=1.0, segments=segs)


@pytest.fixture(scope="module")
def dialogue(tmp_path_factory):
    return media.build(tmp_path_factory.mktemp("m") / "dialogue.mp4")


# --- signaux ----------------------------------------------------------------------
def test_scene_cuts_found_at_known_times(dialogue):
    found = [c["t"] for c in signals.detect_scenes(dialogue.path)]
    for cut in dialogue.cuts:
        assert any(abs(f - cut) <= 0.3 for f in found), (cut, found)
    assert len(found) == len(dialogue.cuts)                      # pas de faux plans


def test_silences_found_at_known_times(dialogue, tmp_path):
    wav = processing.extract_audio(dialogue.path, tmp_path / "a.wav")
    sil = signals.detect_silences(wav, duration=dialogue.duration)
    expected = [s for s in dialogue.segments if s.kind == "silence"]
    assert len(sil) == len(expected)
    for got, exp in zip(sil, expected):
        assert abs(got["start"] - exp.start) <= 0.35 and abs(got["end"] - exp.end) <= 0.35
    # la musique et le bruit ambiant ne sont PAS pris pour du silence
    music = next(s for s in dialogue.segments if s.kind == "music")
    noise = next(s for s in dialogue.segments if s.kind == "noise")
    assert not any(g["start"] < music.end and g["end"] > music.start for g in sil)
    assert not any(g["start"] < noise.end and g["end"] > noise.start for g in sil)


def test_loudness_profile(dialogue, tmp_path):
    wav = processing.extract_audio(dialogue.path, tmp_path / "a.wav")
    rms = signals.loudness_per_second(wav)
    assert abs(len(rms) - dialogue.duration) <= 1.5
    sil = next(s for s in dialogue.segments if s.kind == "silence")
    assert rms[int(sil.start) + 1] <= -60                        # silence
    music = next(s for s in dialogue.segments if s.kind == "music")
    assert rms[int(music.start) + 1] > -25                       # musique soutenue


# --- transcription ----------------------------------------------------------------
def test_uncertain_words_are_marked_not_invented():
    words = mark_uncertain([Word(0, 0.3, "the", 0.98), Word(0.3, 0.7, "mistake", 0.31), Word(0.7, 1, "became", 0.9)], 0.5)
    seg = TranscriptSegment(0, 1, "the mistake became", words=words)
    assert render_text(seg) == "the [mistake?] became"
    assert render_text(TranscriptSegment(0, 1, " texte brut ")) == "texte brut"


def test_faster_whisper_adapter_mapping(monkeypatch, tmp_path):
    """Adaptateur testé avec un module factice qui imite l'API faster-whisper (pas le vrai modèle)."""
    W = types.SimpleNamespace
    calls = {}

    class FakeModel:
        def __init__(self, name, device, compute_type):
            calls["init"] = (name, device)

        def transcribe(self, path, **kw):
            calls["kw"] = kw
            segs = [W(start=1.0, end=2.5, text=" Bonjour à tous ", avg_logprob=-0.1, no_speech_prob=0.02,
                      words=[W(start=1.0, end=1.5, word=" Bonjour", probability=np.float32(0.95)),
                             W(start=1.6, end=2.5, word=" àtous", probability=np.float32(0.2))])]   # numpy, comme le vrai
            return iter(segs), W(language="fr", language_probability=0.97)

    monkeypatch.setitem(sys.modules, "faster_whisper", types.SimpleNamespace(WhisperModel=FakeModel))
    FasterWhisperTranscriber._models.clear()
    t = make_transcriber({"transcriber": "auto", "whisper_model": "tiny", "uncertain_word_probability": 0.5})
    import wave
    with wave.open(str(tmp_path / "a.wav"), "wb") as w:   # 1 s de silence 16 kHz mono
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b"\x00\x00" * 16000)
    out = t.transcribe(tmp_path / "a.wav", None)
    assert calls["init"] == ("tiny", "auto") and calls["kw"]["word_timestamps"] and calls["kw"]["language"] is None
    assert out.status == "ok" and out.language == "fr" and out.segments[0].speaker is None
    assert render_text(out.segments[0]) == "Bonjour [àtous?]"
    assert 0.9 < out.segments[0].confidence < 0.91
    json.dumps(out.to_dict())   # constaté en réel : booléens numpy non sérialisables


def test_no_engine_installed_is_reported(monkeypatch):
    monkeypatch.setitem(sys.modules, "faster_whisper", None)   # import impossible
    assert make_transcriber({"transcriber": "auto"}) is None
    with pytest.raises(ImportError):
        make_transcriber({"transcriber": "faster-whisper"})


# --- pipeline -----------------------------------------------------------------------
def test_pipeline_produces_text_only_payload_and_local_files(dialogue, tmp_path):
    st = ScriptedTranscriber(dialogue)
    res = processing.run_pipeline(dialogue.path, tmp_path, sha256="abc", options=OPTS, transcriber=st)
    p = res["analysis_input"]
    assert p["transcript"]["status"] == "ok" and len(p["transcript"]["segments"]) == 3
    seg = p["transcript"]["segments"][1]
    assert seg["text"].startswith("Wait") and seg["speaker"] == "voix_slt"
    assert seg["start"] == pytest.approx(5.0, abs=0.05)          # timecodes conservés
    raw = json.dumps(p)
    assert len(raw) < 20_000 and set(p) == {"schema", "duration_s", "width", "height", "rotation", "has_audio",
                                            "transcript", "scenes", "silences", "loudness_per_second", "summary"}
    cache = tmp_path / "analysis" / "abc"
    assert (cache / "transcript.json").exists() and (cache / "signals.json").exists()
    assert not (cache / "audio.wav").exists()                     # l'audio extrait est effacé
    # reprise : le second passage relit le cache, sans retranscrire
    processing.run_pipeline(dialogue.path, tmp_path, sha256="abc", options=OPTS, transcriber=st)
    assert st.calls == 1


def test_video_without_audio(tmp_path):
    m = media.build(tmp_path / "muet.mp4", with_audio=False)
    p = processing.run_pipeline(m.path, tmp_path, sha256="muet", options=OPTS,
                                transcriber=ScriptedTranscriber(m))["analysis_input"]
    assert p["has_audio"] is False and p["transcript"]["status"] == "no_audio" and p["transcript"]["segments"] == []


def test_silent_video_is_not_transcribed(tmp_path):
    m = media.build(tmp_path / "calme.mp4", [media.Segment("silence", duration=4.0), media.Segment("silence", duration=3.0)])
    st = ScriptedTranscriber(m)
    p = processing.run_pipeline(m.path, tmp_path, sha256="calme", options=OPTS, transcriber=st)["analysis_input"]
    assert p["transcript"]["status"] == "no_speech" and st.calls == 0


def test_transcriber_crash_keeps_other_signals(dialogue, tmp_path):
    class Broken:
        name = "cassé"

        def transcribe(self, audio, language):
            raise RuntimeError("modèle introuvable")

    p = processing.run_pipeline(dialogue.path, tmp_path, sha256="x", options=OPTS, transcriber=Broken())["analysis_input"]
    assert p["transcript"]["status"] == "error" and "modèle introuvable" in p["transcript"]["note"]
    assert p["scenes"] and p["silences"]


def test_4k_video_supported(tmp_path):
    m = media.build(tmp_path / "uhd.mp4", media.DEFAULT_SCRIPT[:3], size="3840x2160")
    p = processing.run_pipeline(m.path, tmp_path, sha256="uhd", options=OPTS,
                                transcriber=ScriptedTranscriber(m))["analysis_input"]
    assert (p["width"], p["height"]) == (3840, 2160)
    assert [round(c["t"]) for c in p["scenes"]] == [round(c) for c in m.cuts]


# --- chaîne complète agent -> Cloud ---------------------------------------------------
class World6(World):
    def __init__(self, tmp_path):
        import app.config as cfgmod
        orig = cfgmod.Settings.__init__

        def init(self_, *a, **kw):
            kw.setdefault("ai_worker", False)
            orig(self_, *a, **kw)
        cfgmod.Settings.__init__ = init
        try:
            super().__init__(tmp_path)
        finally:
            cfgmod.Settings.__init__ = orig
        self.ctx = self.http.app.state.ctx


@pytest.fixture
def world(tmp_path):
    return World6(tmp_path)


def test_agent_to_cloud_demo_clips(world, dialogue, monkeypatch):
    from app import worker

    monkeypatch.setattr(processing, "make_transcriber", lambda opts: ScriptedTranscriber(dialogue))
    sent = []
    real_post = world.client.post

    def spy(path, **kw):
        sent.append((path, kw))
        return real_post(path, **kw)

    world.client.post = spy
    vid = world.iphone_upload("PH-D", dialogue.path.read_bytes())
    world.agent().tick()
    assert world.http.get(f"/v1/videos/{vid}", headers=world.user).json()["state"] == "COMPLETED"
    analysis = [kw["json"] for p, kw in sent if p.endswith("/analysis-input")]
    assert len(analysis) == 1
    blob = json.dumps(analysis[0])
    assert len(blob) < 20_000 and "mdat" not in blob             # texte seulement, aucun octet vidéo
    assert worker.run_once(world.ctx) == 1
    clips = world.http.get("/v1/clips", headers=world.user, params={"video_id": vid}).json()
    assert clips and all(c["simulated"] for c in clips)
    cats = {c["category"] for c in clips}
    assert "reaction" in cats                                    # « Wait, what? … ? »
    assert all(0 <= c["start_s"] < c["end_s"] <= dialogue.duration + 0.1 for c in clips)


def test_network_cut_during_analysis_upload_is_retried(world, dialogue, monkeypatch):
    """Correctif B2 : coupure pendant l'envoi de l'analyse -> nouvel essai, sans retranscrire."""
    st = ScriptedTranscriber(dialogue)
    monkeypatch.setattr(processing, "make_transcriber", lambda opts: st)
    vid = world.iphone_upload("PH-N", dialogue.path.read_bytes())
    agent = world.agent()
    real_post = agent.client.post
    state = {"cut": True}

    def flaky(path, **kw):
        if path.endswith("/analysis-input") and state["cut"]:
            raise httpx.ConnectError("coupure simulée")
        return real_post(path, **kw)

    agent.client.post = flaky
    agent.tick()
    row = agent.queue.get(vid)
    assert row["stage"] == "delivered" and "coupure" in row["last_error"]   # plus bloqué en « processing »
    state["cut"] = False
    agent.queue.conn.execute("UPDATE videos SET next_attempt_at=0")
    agent.tick()
    assert agent.queue.get(vid)["stage"] == "done" and st.calls == 1        # cache réutilisé
    assert world.http.get(f"/v1/videos/{vid}", headers=world.user).json()["state"] == "COMPLETED"


def test_dashboard_retry_reprocessed_without_restart(world, dialogue, monkeypatch):
    """Correctif B1 : une relance depuis le dashboard est traitée au cycle suivant."""
    vid = world.iphone_upload("PH-R", dialogue.path.read_bytes())
    agent = world.agent()
    monkeypatch.setattr(processing, "run_pipeline", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("panne")))
    agent.tick()
    assert world.http.get(f"/v1/videos/{vid}", headers=world.user).json()["state"] == "FAILED"
    monkeypatch.undo()
    monkeypatch.setattr(processing, "make_transcriber", lambda opts: ScriptedTranscriber(dialogue))
    world.http.post(f"/v1/videos/{vid}/retry", headers=world.user)
    agent.tick()                                                  # même processus, sans redémarrage
    assert world.http.get(f"/v1/videos/{vid}", headers=world.user).json()["state"] == "COMPLETED"


def test_model_load_failure_does_not_fail_the_video(dialogue, tmp_path, monkeypatch):
    """Constaté en phase 6.1 : faster-whisper installé mais modèle non téléchargeable
    (hors ligne) faisait échouer toute la vidéo. L'analyse doit continuer sans transcription."""
    def boom(opts):
        raise OSError("ProxyError 403 Forbidden")
    monkeypatch.setattr(processing, "make_transcriber", boom)
    p = processing.run_pipeline(dialogue.path, tmp_path, sha256="offline", options=OPTS)["analysis_input"]
    assert p["transcript"]["status"] == "error" and "403" in p["transcript"]["note"]
    assert p["scenes"] and p["silences"]


def test_faint_voice_not_taken_for_silence(tmp_path):
    """Mesuré en phase 6.1 : à -24 dB, le seuil fixe classait des phrases en silence."""
    m = media.build(tmp_path / "n.mp4")
    faint = tmp_path / "faible.mp4"
    subprocess.run([media.FFMPEG, "-v", "error", "-y", "-i", str(m.path), "-c:v", "copy", "-af", "volume=0.06",
                    "-c:a", "aac", str(faint)], check=True)
    p = processing.run_pipeline(faint, tmp_path, sha256="faible", options=OPTS,
                                transcriber=ScriptedTranscriber(m))["analysis_input"]
    expected = sum(s.duration for s in m.segments if s.kind == "silence") / m.duration
    assert p["summary"]["silence_ratio"] == pytest.approx(expected, abs=0.05)
    assert p["summary"]["silence_threshold_db"] < -35
    assert len(p["silences"]) == 2


def _moving_shot(out, src, seconds, flash=False, extra=""):
    """Plan « tenu à la main » : balayage horizontal rapide (+ éclat de lumière facultatif)."""
    vf = "scale=1600:-2,crop=320:568:x='min(1280,t*400)':y=0" + extra
    if flash:
        vf += ",eq=brightness='if(between(t,1.4,1.8),0.35,0)':eval=frame"
    subprocess.run([media.FFMPEG, "-v", "error", "-y", "-f", "lavfi", "-i", f"{src}:size=1280x720:rate=25",
                    "-t", str(seconds),
                    "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", str(out)], check=True)


def test_handheld_motion_is_not_a_cut_but_hard_cut_is(tmp_path):
    """Phase 6.1 : sur de vraies vidéos d'iPhone tournées à la main, les balayages et éclats
    de lumière étaient pris pour des coupes. Reproduction synthétique du défaut."""
    a, b = tmp_path / "a.mp4", tmp_path / "b.mp4"
    # dégradés qui évoluent lentement : plus proche d'une scène réelle qu'une mire à bandes
    _moving_shot(a, "gradients=speed=0.02:seed=7", 3, flash=True)
    _moving_shot(b, "gradients=speed=0.02:seed=7", 3, extra=",negate,hue=h=120")   # autre plan, autres couleurs
    assert signals.detect_scenes(a) == []                        # plan continu : aucune coupe
    lst = tmp_path / "l.txt"
    lst.write_text(f"file '{a.name}'\nfile '{b.name}'\n")
    both = tmp_path / "both.mp4"
    subprocess.run([media.FFMPEG, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
                    str(both)], check=True)
    cuts = [c["t"] for c in signals.detect_scenes(both)]
    assert len(cuts) == 1 and abs(cuts[0] - 3.0) <= 0.4, cuts   # la vraie coupe, et elle seule



def test_wav_loader_bypasses_pyav(tmp_path, dialogue):
    """faster-whisper 1.2.1 + PyAV 19 : décodage impossible. L'agent fournit les échantillons lui-même."""
    from scf_agent.transcription import load_wav_16k
    wav = processing.extract_audio(dialogue.path, tmp_path / "a.wav")
    x = load_wav_16k(wav)
    assert x.dtype.name == "float32" and abs(len(x) / 16000 - dialogue.duration) < 0.2 and float(abs(x).max()) <= 1.0
    bad = tmp_path / "s.wav"
    subprocess.run([media.FFMPEG, "-v", "error", "-y", "-i", str(dialogue.path), "-ac", "2", "-ar", "44100", str(bad)], check=True)
    with pytest.raises(ValueError, match="attendu 16 kHz"):
        load_wav_16k(bad)


def test_whisper_hallucinations_removed_and_reported():
    """Constaté sur 4 vraies vidéos sur 9 : phrase inventée par Whisper sur la musique ou le bruit."""
    from scf_agent.transcription import clean_transcript, is_hallucination
    real = [" Sous", "-titres", " réalisés", " par", " la", " communauté", " d", "'Amara", ".org"]
    seg = TranscriptSegment(10.3, 13.8, "".join(real), words=[Word(0, 0, t, 0.9) for t in real])
    assert is_hallucination(seg.text) and is_hallucination("Merci d'avoir regardé cette vidéo !")
    assert not is_hallucination("merci merci Duki, c'est lui le prochain")
    keep = TranscriptSegment(0, 3, "c'est lui le prochain", confidence=0.7, words=[Word(0, 1, " c'est", 0.9)])
    doubt = TranscriptSegment(3, 5, "peut-être", confidence=0.3, words=[Word(3, 4, " peut-être", 0.9)])
    borderline = TranscriptSegment(5, 6, "ouais", confidence=0.45, words=[Word(5, 6, " ouais", 0.9)])
    clean_transcript([borderline])
    assert not borderline.words[0].uncertain          # 0,45 : pas assez bas pour tout marquer
    kept, notes = clean_transcript([keep, seg, doubt])
    assert kept == [keep, doubt] and len(notes) == 1 and "Amara" in notes[0]
    assert doubt.words[0].uncertain and not keep.words[0].uncertain        # segment douteux : tout incertain


def test_render_keeps_whisper_spacing():
    toks = [(" T", 0.9), ("'es", 0.9), (" mal,", 0.4), (" c", 0.9), ("'est", 0.9), (" bon", 0.9)]
    seg = TranscriptSegment(0, 2, "", words=mark_uncertain([Word(0, 0, t, p) for t, p in toks], 0.5))
    assert render_text(seg) == "T'es [mal,?] c'est bon"


def test_vocabulary_echo_is_dropped():
    """Constaté : avec le vocabulaire, Whisper « entendait » la liste sur des vidéos sans parole."""
    from scf_agent.transcription import clean_transcript, is_vocabulary_echo
    vocab = ["Lahyster", "B.019", "Dooky"]
    assert is_vocabulary_echo(" B.019, B.019, Dooky", vocab)
    assert not is_vocabulary_echo("merci Dooky, c'est lui le prochain", vocab)
    assert not is_vocabulary_echo("B.019 Dooky", [])
    echo = TranscriptSegment(7.0, 9.0, " B.019, B.019, Dooky")
    real = TranscriptSegment(0.0, 3.0, " Lahyster, il est de retour les gars")
    kept, notes = clean_transcript([real, echo], vocabulary=vocab)
    assert kept == [real] and "vocabulaire" in notes[0]
