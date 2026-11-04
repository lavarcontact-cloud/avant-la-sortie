"""Détection des meilleurs moments : préparation des fenêtres, consigne au
modèle, lecture de la réponse et VALIDATION STRICTE des propositions.

Le modèle propose ; le serveur vérifie. En particulier :
- timecodes bornés à la vidéo, recalés sur les segments de transcription ;
- l'extrait de transcription d'un clip est recopié par le serveur depuis la
  transcription réelle, jamais depuis la réponse du modèle ;
- la citation avancée par le modèle doit se retrouver dans cet extrait,
  sinon le clip est signalé et sa confiance divisée par deux ;
- catégories hors liste rejetées.
"""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field

from ..clips import CATEGORIES, LEGACY_CATEGORIES
from .base import LLMRequest, TransientAIError
from .config import AIConfig

SYSTEM_PROMPT = """Tu es éditeur vidéo pour des formats courts verticaux (TikTok, Reels, Shorts).
On te donne la transcription horodatée d'UNE vidéo personnelle et des signaux techniques (silences,
changements de plan, niveau sonore). Tu ne vois pas l'image.

Ta mission : repérer les passages qui feraient un bon extrait autonome.

Règles impératives :
1. Appuie-toi UNIQUEMENT sur la transcription et les signaux fournis. N'invente aucun contexte,
   aucun lieu, aucune personne, aucune intention qui n'apparaît pas dans le texte.
2. Tu ne vois pas l'image : `scene_description` décrit seulement ce que la transcription et les
   signaux permettent d'affirmer (ex. « échange rapide entre deux personnes, rires »). Sinon : "".
3. Le score (0-100) mesure le POTENTIEL ÉDITORIAL du passage : compréhensible sans contexte,
   début et fin nets, force de la phrase ou de la réaction, émotion, rythme. Ce n'est PAS une
   prédiction de popularité ou de vues. Justifie-le concrètement.
4. Les mots entre crochets suivis de « ? » ([mot?]) sont incertains : ne les cite pas comme sûrs.
5. Les timecodes doivent être à l'intérieur de la fenêtre et suivre les débuts/fins de segments.
6. `quote` : recopie mot pour mot la phrase clé telle qu'elle figure dans la transcription.
7. `confidence` (0-1) : ta certitude que le passage existe et se comprend comme tu le décris.
8. Si rien ne mérite d'être extrait, renvoie {"clips": []}. Mieux vaut peu de propositions solides.
9. `explanation` est OBLIGATOIRE : dis concrètement pourquoi ce passage mérite d'être extrait
   (ce qui se passe, ce qui accroche, pourquoi il tient seul). Une proposition sans explication est rejetée.
10. Le français parlé, l'argot et les expressions urbaines sont normaux : ne les « corrige » pas,
    ne les juge pas, cite-les tels quels.

Catégories autorisées (champ `category`) :
- punchline : phrase courte et forte, qui marque
- moment_drole : rire, blague, situation comique
- anecdote : petite histoire racontée avec un début et une chute
- reaction : réaction vive à ce qui vient d'être dit ou fait
- debat : échange d'avis opposés, argumentation
- moment_inattendu : surprise, retournement, imprévu
- coulisses : envers du décor, préparation, studio, ce qu'on ne voit pas d'habitude
- performance : rap, chant, freestyle, musique, danse
- moment_emotionnel : émotion sincère (fierté, tristesse, gratitude…)
- phrase_polemique : propos clivant ou provocateur. Signale-le ; la personne décidera.
Précise des nuances dans `tags` si utile (rire, tension, surprise, musique…).

Réponds UNIQUEMENT par un objet JSON :
{"clips": [{"start_s": 0.0, "end_s": 0.0, "category": "", "tags": [], "title": "", "explanation": "",
 "score": 0, "score_justification": "", "confidence": 0.0, "quote": "", "scene_description": ""}]}"""


@dataclass
class Window:
    index: int
    start: float
    end: float
    segments: list[dict] = field(default_factory=list)


def build_windows(segments: list[dict], duration: float, window_chars: int, overlap_segments: int = 2) -> list[Window]:
    """Découpe les longues transcriptions en fenêtres qui se chevauchent
    légèrement (un moment à cheval sur deux fenêtres n'est pas perdu)."""
    if not segments:
        return [Window(0, 0.0, duration, [])]
    windows, cur, size, i = [], [], 0, 0
    while i < len(segments):
        seg = segments[i]
        cost = len(seg["text"]) + 24
        if cur and size + cost > window_chars:
            windows.append(cur)
            cur = cur[-overlap_segments:] if overlap_segments else []
            size = sum(len(s["text"]) + 24 for s in cur)
        cur.append(seg)
        size += cost
        i += 1
    if cur:
        windows.append(cur)
    out = []
    for k, segs in enumerate(windows):
        start = 0.0 if k == 0 else segs[0]["start"]
        end = duration if k == len(windows) - 1 else segs[-1]["end"]
        out.append(Window(k, start, end, segs))
    return out


def _fmt(t: float) -> str:
    return f"{t:.2f}"


def build_request(win: Window, payload: dict, cfg: AIConfig, total_windows: int) -> LLMRequest:
    params = cfg.level_params
    tr = payload.get("transcript", {})
    lang = cfg.language if cfg.language != "auto" else (tr.get("language") or "langue de la transcription")
    in_win = lambda t: win.start <= t <= win.end  # noqa: E731
    scenes = [s["t"] for s in payload.get("scenes", []) if in_win(s["t"])]
    silences = [s for s in payload.get("silences", []) if in_win(s["start"])]
    rms = payload.get("loudness_per_second", [])
    peaks = [t for t in payload.get("summary", {}).get("loudness_peaks_s", []) if in_win(t)]
    lines = [f"[{_fmt(s['start'])}–{_fmt(s['end'])}]"
             f"{' (' + s['speaker'] + ')' if s.get('speaker') else ''} {s['text']}" for s in win.segments]
    orientation = "verticale" if (payload.get("height") or 0) > (payload.get("width") or 0) else "horizontale"
    user = "\n".join([
        f"Vidéo : {payload.get('duration_s', 0):.1f} s, {orientation}. Langue détectée : {tr.get('language') or 'inconnue'}.",
        f"État de la transcription : {tr.get('status')} {('— ' + tr['note']) if tr.get('note') else ''}",
        f"Fenêtre {win.index + 1}/{total_windows} : de {_fmt(win.start)} s à {_fmt(win.end)} s.",
        f"Propose au plus {params['clips_per_window']} extraits, de {cfg.min_clip_s:g} à {cfg.max_clip_s:g} s chacun.",
        f"Rédige titres et explications en : {lang}.",
        "",
        "TRANSCRIPTION :",
        *(lines or ["(aucune parole transcrite dans cette fenêtre)"]),
        "",
        f"CHANGEMENTS DE PLAN (s) : {scenes or 'aucun'}",
        f"SILENCES : {[(round(s['start'], 1), round(s['end'], 1)) for s in silences] or 'aucun'}",
        f"PICS DE VOLUME (s) : {peaks or 'aucun'}",
        f"VOLUME RMS PAR SECONDE (dBFS, -91 = silence) : {rms[int(win.start):int(win.end) + 1] or 'indisponible'}",
    ])
    return LLMRequest(system=SYSTEM_PROMPT, user=user, max_output_tokens=params["max_output_tokens"],
                      context={"segments": win.segments, "loudness_peaks_s": peaks,
                               "clips_per_window": params["clips_per_window"], "window": [win.start, win.end]})


_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.S)


def parse_response(text: str) -> list[dict]:
    """Extrait {"clips": [...]} de la réponse. Une réponse illisible est
    traitée comme une erreur passagère (nouvel essai), jamais comme « 0 clip »."""
    candidates = [m.group(1) for m in _FENCE.finditer(text)] + [text]
    for cand in candidates:
        cand = cand.strip()
        start, end = cand.find("{"), cand.rfind("}")
        if start < 0 or end <= start:
            continue
        try:
            data = json.loads(cand[start:end + 1])
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and isinstance(data.get("clips"), list):
            return [c for c in data["clips"] if isinstance(c, dict)]
    raise TransientAIError("réponse du modèle illisible (JSON attendu)")


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\[([^\]]*?)\?\]", r"\1", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def excerpt(segments: list[dict], start: float, end: float) -> str:
    return " ".join(s["text"] for s in segments if s["end"] > start and s["start"] < end).strip()


def _snap(t: float, candidates: list[float], tol: float) -> float:
    best = min(candidates, key=lambda c: abs(c - t), default=None)
    return best if best is not None and abs(best - t) <= tol else t


@dataclass
class ValidatedClip:
    start_s: float
    end_s: float
    proposed_start_s: float
    proposed_end_s: float
    category: str
    tags: list[str]
    title: str
    explanation: str
    score: int
    score_justification: str
    confidence: float
    quote: str
    quote_verified: bool
    transcript_excerpt: str
    scene_description: str
    warnings: list[str]


def validate(raw: list[dict], payload: dict, cfg: AIConfig) -> tuple[list[ValidatedClip], list[str]]:
    """Renvoie (clips retenus, motifs de rejet)."""
    duration = float(payload.get("duration_s") or 0)
    segments = payload.get("transcript", {}).get("segments", [])
    starts = [s["start"] for s in segments]
    ends = [s["end"] for s in segments]
    kept, rejected = [], []
    for c in raw:
        try:
            ps, pe = float(c.get("start_s")), float(c.get("end_s"))
        except (TypeError, ValueError):
            rejected.append("timecodes absents ou non numériques")
            continue
        cat = str(c.get("category", "")).strip().lower().replace(" ", "_").replace("é", "e").replace("è", "e")
        cat = LEGACY_CATEGORIES.get(cat, cat)
        if cat not in CATEGORIES:
            rejected.append(f"catégorie inconnue : {cat!r}")
            continue
        if pe <= ps:
            rejected.append(f"fin ({pe}) avant début ({ps})")
            continue
        if ps >= duration or pe <= 0:
            rejected.append(f"hors de la vidéo ({ps}–{pe} s pour {duration} s)")
            continue
        if not str(c.get("explanation") or "").strip():
            rejected.append("pas d'explication fournie")
            continue
        warnings = []
        if cat == "phrase_polemique":
            warnings.append("propos potentiellement polémique : vérifier le contexte et les personnes citées avant toute diffusion")
        s, e = max(0.0, ps), min(duration, pe)
        if (s, e) != (ps, pe):
            warnings.append("timecodes ramenés dans la durée de la vidéo")
        s, e = _snap(s, starts, 1.0), _snap(e, ends, 1.0)
        if e - s > cfg.max_clip_s:
            e = s + cfg.max_clip_s
            warnings.append(f"durée réduite à {cfg.max_clip_s:g} s")
        if e - s < cfg.min_clip_s:
            # élargir autour du passage ; contre un bord de la vidéo, du côté libre
            pad = (cfg.min_clip_s - (e - s)) / 2
            s, e = max(0.0, s - pad), min(duration, e + pad)
            e = min(duration, max(e, s + cfg.min_clip_s))
            s = max(0.0, min(s, e - cfg.min_clip_s))
            if e - s < cfg.min_clip_s - 1e-6:
                rejected.append(f"trop court ({e - s:.1f} s)")
                continue
            warnings.append(f"élargi à {cfg.min_clip_s:g} s minimum")
        ex = excerpt(segments, s, e)
        quote = str(c.get("quote") or "").strip()
        verified = bool(quote) and _norm(quote) in _norm(ex)
        confidence = min(1.0, max(0.0, float(c.get("confidence") or 0)))
        if quote and not verified:
            warnings.append("citation introuvable dans la transcription : à vérifier")
            confidence /= 2
        if not segments:
            warnings.append("aucune transcription : proposition fondée sur le son et le montage seulement")
        kept.append(ValidatedClip(
            start_s=round(s, 2), end_s=round(e, 2), proposed_start_s=round(ps, 2), proposed_end_s=round(pe, 2),
            category=cat, tags=[str(t)[:32] for t in (c.get("tags") or [])][:8],
            title=str(c.get("title") or "")[:160], explanation=str(c.get("explanation") or "")[:1500],
            score=int(min(100, max(0, round(float(c.get("score") or 0))))),
            score_justification=str(c.get("score_justification") or "")[:1500],
            confidence=round(confidence, 3), quote=quote[:600], quote_verified=verified,
            transcript_excerpt=ex[:4000], scene_description=str(c.get("scene_description") or "")[:600],
            warnings=warnings,
        ))
    return dedupe(kept, cfg.max_clips_per_video), rejected


def _iou(a: ValidatedClip, b: ValidatedClip) -> float:
    inter = max(0.0, min(a.end_s, b.end_s) - max(a.start_s, b.start_s))
    union = max(a.end_s, b.end_s) - min(a.start_s, b.start_s)
    return inter / union if union else 0.0


def dedupe(clips: list[ValidatedClip], limit: int) -> list[ValidatedClip]:
    """Fusionne les doublons (fenêtres qui se chevauchent) en gardant le meilleur score."""
    out: list[ValidatedClip] = []
    for c in sorted(clips, key=lambda c: (-c.score, -c.confidence)):
        if all(_iou(c, o) < 0.5 for o in out):
            out.append(c)
    return sorted(out[:limit], key=lambda c: c.start_s)
