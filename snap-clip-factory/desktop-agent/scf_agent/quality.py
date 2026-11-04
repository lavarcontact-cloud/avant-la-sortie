"""Mesures de qualité de la transcription (phase 6.1), par rapport à une
transcription de RÉFÉRENCE écrite par un humain.

- WER / CER : taux d'erreur de mots / de caractères (Levenshtein) ;
- calibration des incertitudes : parmi les mots FAUX, combien étaient marqués
  incertains ? parmi les mots JUSTES, combien l'étaient à tort ?
- timecodes : écart entre le début de chaque réplique de référence (SRT) et
  le début du mot transcrit qui lui correspond ;
- locuteurs : comptés dans la référence ; le moteur actuel n'en fournit pas.
"""
from __future__ import annotations

import re
import statistics
import unicodedata
from dataclasses import dataclass, field

_PUNCT = re.compile(r"[^\w\s']", re.U)
_SRT_TIME = re.compile(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)")
_SPEAKER = re.compile(r"^\s*(?:\[([^\]]{1,30})\]|([A-Za-zÀ-ÿ0-9 _-]{1,20})\s*:)\s*")


def normalize_words(text: str) -> list[str]:
    """Normalisation française simple : minuscules, apostrophes séparées, ponctuation retirée.
    Les accents sont CONSERVÉS (« a » et « à » sont des mots différents)."""
    t = unicodedata.normalize("NFKC", text).lower().replace("’", "'").replace("`", "'")
    t = re.sub(r"\[([^\]]*?)\?\]", r"\1", t)          # marques d'incertitude retirées pour comparer
    t = _PUNCT.sub(" ", t).replace("'", "' ")
    return [w for w in t.split() if w and w != "'"]


def align(ref: list[str], hyp: list[str]) -> list[tuple[str, int | None, int | None]]:
    """Alignement de Levenshtein : liste d'opérations (op, i_ref, i_hyp), op ∈ ok|sub|del|ins."""
    n, m = len(ref), len(hyp)
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref[i - 1] == hyp[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    ops, i, j = [], n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and d[i][j] == d[i - 1][j - 1] + (ref[i - 1] != hyp[j - 1]):
            ops.append(("ok" if ref[i - 1] == hyp[j - 1] else "sub", i - 1, j - 1))
            i, j = i - 1, j - 1
        elif i > 0 and d[i][j] == d[i - 1][j] + 1:
            ops.append(("del", i - 1, None))
            i -= 1
        else:
            ops.append(("ins", None, j - 1))
            j -= 1
    return ops[::-1]


def wer(ref: list[str], hyp: list[str]) -> float | None:
    if not ref:
        return None
    return round(sum(op != "ok" for op, _, _ in align(ref, hyp)) / len(ref), 4)


def cer(ref_text: str, hyp_text: str) -> float | None:
    r = list(" ".join(normalize_words(ref_text)))
    h = list(" ".join(normalize_words(hyp_text)))
    if not r:
        return None
    return round(sum(op != "ok" for op, _, _ in align(r, h)) / len(r), 4)


@dataclass
class Cue:
    start: float
    end: float
    text: str
    speaker: str | None = None


def parse_srt(text: str) -> list[Cue]:
    cues, cur, lines = [], None, []
    for raw in text.replace("\r", "").split("\n") + [""]:
        line = raw.strip()
        if m := _SRT_TIME.search(line):
            g = [int(x) for x in m.groups()]
            cur = (g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000, g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000)
            lines = []
        elif not line:
            if cur and lines:
                body = " ".join(lines)
                spk = None
                if sm := _SPEAKER.match(body):
                    spk = (sm.group(1) or sm.group(2)).strip()
                    body = body[sm.end():]
                cues.append(Cue(cur[0], cur[1], body, spk))
            cur, lines = None, []
        elif cur is not None:
            lines.append(line)
    return cues


@dataclass
class HypWord:
    text: str
    start: float
    end: float
    uncertain: bool


def hyp_words_from_transcript(t: dict) -> list[HypWord]:
    """Mots horodatés d'une transcription locale (transcript.json). Sans mots
    détaillés, chaque segment est découpé uniformément (timecodes approximatifs)."""
    out = []
    for seg in t.get("segments", []):
        words = seg.get("words") or []
        if words:
            for w in words:
                for piece in normalize_words(w["text"]):
                    out.append(HypWord(piece, w["start"], w["end"], bool(w.get("uncertain"))))
        else:
            pieces = normalize_words(seg["text"])
            step = (seg["end"] - seg["start"]) / max(1, len(pieces))
            out += [HypWord(p, seg["start"] + k * step, seg["start"] + (k + 1) * step, "?]" in seg["text"])
                    for k, p in enumerate(pieces)]
    return out


@dataclass
class TranscriptQuality:
    ref_words: int
    hyp_words: int
    wer: float | None
    cer: float | None
    substitutions: int
    deletions: int
    insertions: int
    wrong_words: int
    wrong_marked_uncertain: float | None     # part des mots faux signalés incertains (plus c'est haut, mieux c'est)
    correct_marked_uncertain: float | None   # fausses alertes
    cue_start_error_s: dict = field(default_factory=dict)
    ref_speaker_changes: int | None = None
    speakers_detected: bool = False
    errors_sample: list = field(default_factory=list)


def evaluate(ref_text: str, transcript: dict, cues: list[Cue] | None = None) -> TranscriptQuality:
    ref = normalize_words(ref_text)
    hyp = hyp_words_from_transcript(transcript)
    ops = align(ref, [h.text for h in hyp])
    subs = sum(op == "sub" for op, _, _ in ops)
    dels = sum(op == "del" for op, _, _ in ops)
    ins = sum(op == "ins" for op, _, _ in ops)
    wrong = [hyp[j] for op, _, j in ops if op in ("sub", "ins")]
    right = [hyp[j] for op, _, j in ops if op == "ok"]
    q = TranscriptQuality(
        ref_words=len(ref), hyp_words=len(hyp), wer=round((subs + dels + ins) / len(ref), 4) if ref else None,
        cer=cer(ref_text, " ".join(h.text for h in hyp)), substitutions=subs, deletions=dels, insertions=ins,
        wrong_words=len(wrong),
        wrong_marked_uncertain=round(sum(w.uncertain for w in wrong) / len(wrong), 3) if wrong else None,
        correct_marked_uncertain=round(sum(w.uncertain for w in right) / len(right), 3) if right else None,
        speakers_detected=any(s.get("speaker") for s in transcript.get("segments", [])),
        errors_sample=[(op, ref[i] if i is not None else None, hyp[j].text if j is not None else None)
                       for op, i, j in ops if op != "ok"][:30],
    )
    if cues:
        # premier mot de chaque réplique -> mot transcrit aligné -> écart de début
        ref_to_hyp = {i: j for op, i, j in ops if op == "ok"}
        errors, k = [], 0
        for cue in cues:
            n = len(normalize_words(cue.text))
            for off in range(n):
                if (k + off) in ref_to_hyp:
                    errors.append(abs(hyp[ref_to_hyp[k + off]].start - cue.start))
                    break
            k += n
        if errors:
            q.cue_start_error_s = {"n": len(errors), "median": round(statistics.median(errors), 3),
                                   "p90": round(sorted(errors)[int(0.9 * (len(errors) - 1))], 3),
                                   "within_0_5s": round(sum(e <= 0.5 for e in errors) / len(errors), 3)}
        spk = [c.speaker for c in cues if c.speaker]
        q.ref_speaker_changes = sum(a != b for a, b in zip(spk, spk[1:])) if spk else None
    return q
