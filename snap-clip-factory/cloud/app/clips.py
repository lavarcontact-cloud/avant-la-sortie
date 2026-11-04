"""Cycle de vie d'un clip et garde de publication.

    DETECTED ─▶ ANALYZED ─▶ READY_FOR_REVIEW ─▶ APPROVED ─▶ RENDERED
                                  ▲   │   ▲         │            │
                                  │   ▼   └─────────┴────────────┘  (modification = nouvelle revue)
                                  └ REJECTED

La validation humaine est OBLIGATOIRE : seul un compte utilisateur (jamais un
appareil, jamais le moteur IA) peut faire passer un clip à APPROVED, et toute
modification après validation la révoque.
"""
from __future__ import annotations

import hashlib
from enum import StrEnum

from .models import Clip, now


class ClipState(StrEnum):
    DETECTED = "DETECTED"
    ANALYZED = "ANALYZED"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RENDERED = "RENDERED"


C = ClipState
ALLOWED: dict[ClipState, set[ClipState]] = {
    C.DETECTED: {C.ANALYZED, C.REJECTED},
    C.ANALYZED: {C.READY_FOR_REVIEW, C.REJECTED},
    C.READY_FOR_REVIEW: {C.APPROVED, C.REJECTED},
    C.APPROVED: {C.RENDERED, C.READY_FOR_REVIEW, C.REJECTED},
    C.REJECTED: {C.READY_FOR_REVIEW},
    C.RENDERED: {C.READY_FOR_REVIEW, C.REJECTED},
}

CATEGORIES = ("punchline", "anecdote", "humour", "reaction", "performance", "moment_fort")


class ClipTransitionError(ValueError):
    pass


class PublicationRefused(PermissionError):
    pass


def fingerprint(clip: Clip) -> str:
    """Ce qui a été validé : vidéo + timecodes + titre. Toute modification change l'empreinte."""
    raw = f"{clip.video_id}|{clip.start_s:.3f}|{clip.end_s:.3f}|{clip.title}"
    return hashlib.sha256(raw.encode()).hexdigest()


def transition(clip: Clip, target: ClipState | str, *, by: str, note: str = "") -> None:
    cur, tgt = ClipState(clip.state), ClipState(target)
    if tgt not in ALLOWED[cur]:
        raise ClipTransitionError(f"{cur} -> {tgt} interdit")
    clip.state = tgt.value
    clip.history = [*(clip.history or []), {"from": cur.value, "to": tgt.value, "by": by,
                                            "at": now().isoformat(), "note": note[:300]}]
    if tgt == C.APPROVED:
        clip.approved_at = now()
        clip.approved_by = by
        clip.approval_fingerprint = fingerprint(clip)
    elif tgt in (C.READY_FOR_REVIEW, C.REJECTED):
        clip.approved_at = clip.approved_by = clip.approval_fingerprint = None
        if tgt == C.READY_FOR_REVIEW:
            clip.render_path = None   # un rendu antérieur ne correspond plus


def approve(clip: Clip, *, user_id: str, note: str = "") -> None:
    if clip.simulated:
        raise ClipTransitionError("clip de démonstration (résultat simulé) : il ne peut pas être validé")
    transition(clip, C.APPROVED, by=f"user:{user_id}", note=note)


def assert_publishable(clip: Clip) -> None:
    """À appeler par TOUTE future fonction de publication (phase 9), juste avant l'envoi.
    Refuse tout ce qui n'a pas été explicitement validé tel quel par l'utilisateur."""
    if clip.simulated:
        raise PublicationRefused("résultat simulé (mode démo)")
    if clip.state not in (C.APPROVED, C.RENDERED):
        raise PublicationRefused(f"clip non validé (état {clip.state})")
    if not clip.approved_at or not (clip.approved_by or "").startswith("user:"):
        raise PublicationRefused("aucune validation humaine enregistrée")
    if clip.approval_fingerprint != fingerprint(clip):
        raise PublicationRefused("le clip a changé depuis sa validation")
