"""Transcription locale horodatée.

Moteur réel : faster-whisper (optionnel : `pip install "scf-agent[transcription]"`),
qui tourne entièrement sur l'ordinateur. Rien n'est envoyé à un service tiers.

Règles :
- langue détectée automatiquement (ou imposée par la configuration) ;
- timecodes conservés au niveau du segment et du mot ;
- mots peu sûrs marqués `uncertain`, jamais « corrigés » ni inventés ;
- locuteur renseigné seulement si le moteur le fournit (faster-whisper ne le
  fait pas : le champ reste `null`) ;
- vidéo sans piste audio ou sans parole : statut explicite, aucune transcription inventée.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Protocol


@dataclass
class Word:
    start: float
    end: float
    text: str
    probability: float | None = None
    uncertain: bool = False


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str
    speaker: str | None = None          # seulement si le moteur sait le déterminer
    confidence: float | None = None     # 0-1, dérivé du modèle
    no_speech_probability: float | None = None
    words: list[Word] = field(default_factory=list)


@dataclass
class Transcript:
    status: str                         # ok | no_speech | no_audio | unavailable | error
    engine: str
    language: str | None = None
    language_probability: float | None = None
    segments: list[TranscriptSegment] = field(default_factory=list)
    note: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


class Transcriber(Protocol):
    name: str

    def transcribe(self, audio: Path, language: str | None) -> Transcript: ...


def mark_uncertain(words: list[Word], threshold: float) -> list[Word]:
    for w in words:
        w.uncertain = bool(w.probability is not None and w.probability < threshold)
    return words


def render_text(seg: TranscriptSegment) -> str:
    """Texte avec les mots incertains entre crochets : « je suis [allé?] ». """
    if not seg.words:
        return seg.text.strip()
    return " ".join(f"[{w.text.strip()}?]" if w.uncertain else w.text.strip() for w in seg.words).strip()


class FasterWhisperTranscriber:
    name = "faster-whisper"
    _models: dict = {}

    def __init__(self, model: str = "small", device: str = "auto", uncertain_below: float = 0.5):
        from faster_whisper import WhisperModel  # import paresseux : dépendance optionnelle

        key = (model, device)
        if key not in self._models:
            self._models[key] = WhisperModel(model, device=device, compute_type="default")
        self.model = self._models[key]
        self.model_name = model
        self.uncertain_below = uncertain_below

    def transcribe(self, audio: Path, language: str | None) -> Transcript:
        import math

        segments, info = self.model.transcribe(
            load_wav_16k(audio), language=language, word_timestamps=True, vad_filter=True,
            condition_on_previous_text=False,   # limite les répétitions « hallucinées »
        )
        out = []
        for s in segments:
            # valeurs numpy -> types Python (sinon l'écriture JSON échoue : constaté en phase 6.1)
            words = mark_uncertain([Word(round(float(w.start), 2), round(float(w.end), 2), str(w.word),
                                         None if w.probability is None else round(float(w.probability), 3))
                                    for w in (s.words or [])],
                                   self.uncertain_below)
            out.append(TranscriptSegment(
                start=round(float(s.start), 2), end=round(float(s.end), 2), text=str(s.text).strip(),
                confidence=round(math.exp(float(s.avg_logprob)), 3) if s.avg_logprob is not None else None,
                no_speech_probability=round(float(s.no_speech_prob), 3), words=words,
            ))
        status = "ok" if any(seg.text for seg in out) else "no_speech"
        return Transcript(status=status, engine=f"faster-whisper:{self.model_name}", language=str(info.language),
                          language_probability=round(float(info.language_probability), 3), segments=out)


def load_wav_16k(path: Path):
    """WAV 16 kHz mono 16 bits (produit par ffmpeg dans processing.extract_audio)
    -> échantillons float32, sans passer par le décodeur PyAV de faster-whisper.

    Constaté en phase 6.1 : faster-whisper 1.2.1 appelle av.open(..., metadata_errors=…),
    argument refusé par PyAV 19 (« unexpected keyword argument »), ce qui faisait
    échouer toutes les transcriptions."""
    import wave

    import numpy as np

    with wave.open(str(path), "rb") as w:
        if w.getframerate() != 16000 or w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise ValueError(f"WAV inattendu : {w.getframerate()} Hz, {w.getnchannels()} canal(aux), "
                             f"{8 * w.getsampwidth()} bits (attendu 16 kHz mono 16 bits)")
        data = w.readframes(w.getnframes())
    return np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0


def make_transcriber(options: dict) -> Transcriber | None:
    """`auto` : faster-whisper s'il est installé, sinon pas de transcription
    (l'analyse continue avec les seuls signaux, et le dit)."""
    choice = options.get("transcriber", "auto")
    if choice == "none":
        return None
    try:
        return FasterWhisperTranscriber(options.get("whisper_model", "small"), options.get("whisper_device", "auto"),
                                        options.get("uncertain_word_probability", 0.5))
    except ImportError:
        if choice == "faster-whisper":
            raise
        return None
