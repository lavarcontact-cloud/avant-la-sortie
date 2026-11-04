"""Machine d'états d'une vidéo. Toute transition passe par `transition()`."""
from __future__ import annotations

from enum import StrEnum


class VideoState(StrEnum):
    DISCOVERED = "DISCOVERED"   # vue dans la photothèque, empreinte pas encore calculée
    QUEUED = "QUEUED"           # empreinte connue, en file d'envoi
    UPLOADING = "UPLOADING"     # session d'upload ouverte
    UPLOADED = "UPLOADED"       # tous les morceaux reçus et assemblés
    VERIFIED = "VERIFIED"       # SHA-256 recalculé côté serveur == SHA-256 annoncé
    PROCESSING = "PROCESSING"   # l'agent desktop traite la vidéo
    COMPLETED = "COMPLETED"     # traitement terminé
    FAILED = "FAILED"


S = VideoState
ALLOWED: dict[VideoState, set[VideoState]] = {
    S.DISCOVERED: {S.QUEUED, S.FAILED},
    S.QUEUED: {S.UPLOADING, S.FAILED},
    S.UPLOADING: {S.UPLOADING, S.UPLOADED, S.FAILED, S.QUEUED},
    S.UPLOADED: {S.VERIFIED, S.FAILED},
    S.VERIFIED: {S.PROCESSING, S.FAILED},
    S.PROCESSING: {S.COMPLETED, S.FAILED, S.VERIFIED},
    S.COMPLETED: {S.PROCESSING},           # retraitement volontaire
    S.FAILED: {S.QUEUED, S.UPLOADING, S.VERIFIED, S.PROCESSING},  # reprise
}


class InvalidTransition(ValueError):
    pass


def check_transition(current: str, target: str) -> VideoState:
    cur, tgt = VideoState(current), VideoState(target)
    if tgt not in ALLOWED[cur]:
        raise InvalidTransition(f"{cur} -> {tgt} interdit")
    return tgt
