"""Registre des vidéos : découverte, empreinte, déduplication, états."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..deps import AppContext, Principal, ctx, get_db, log_activity, principal, require_ios, require_user
from ..models import Video
from ..schemas import Fingerprint, VideoBatch, VideoOut
from ..state import InvalidTransition, VideoState, check_transition

router = APIRouter(prefix="/v1", tags=["videos"])


def video_out(v: Video) -> dict:
    return VideoOut.model_validate(v).model_dump(mode="json")


def set_state(db: Session, c: AppContext, v: Video, target: VideoState | str, *, error: str | None = None,
              device_id: str | None = None) -> None:
    try:
        tgt = check_transition(v.state, target)
    except InvalidTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))
    prev = v.state
    v.state = tgt.value
    v.error = error if tgt == VideoState.FAILED else None
    log_activity(db, c, user_id=v.user_id, device_id=device_id, action="video.state",
                 video_id=v.id, filename=v.filename, previous=prev, state=tgt.value, error=error)


def get_owned_video(db: Session, p: Principal, video_id: str) -> Video:
    v = db.get(Video, video_id)
    if v is None or v.user_id != p.user_id:  # contrôle d'accès : jamais de vidéo d'un autre compte
        raise HTTPException(status.HTTP_404_NOT_FOUND, "vidéo inconnue")
    return v


def _apply_fingerprint(db: Session, c: AppContext, p: Principal, v: Video, sha: str, size: int) -> tuple[Video, bool]:
    """Pose l'empreinte. Si une vidéo identique existe déjà pour ce compte, la
    fiche courante est fusionnée dans l'existante (déduplication)."""
    if v.sha256 == sha:
        return v, False
    if v.sha256 is not None and v.state not in (VideoState.DISCOVERED, VideoState.QUEUED, VideoState.FAILED):
        raise HTTPException(status.HTTP_409_CONFLICT, "empreinte déjà figée pour cette vidéo")
    existing = db.scalar(select(Video).where(Video.user_id == p.user_id, Video.sha256 == sha, Video.id != v.id))
    if existing is not None:
        log_activity(db, c, user_id=p.user_id, device_id=p.device.id, action="video.deduplicated",
                     video_id=existing.id, duplicate_asset=v.asset_local_id, filename=v.filename)
        db.delete(v)
        db.flush()
        return existing, True
    v.sha256, v.size_bytes = sha, size
    if v.state == VideoState.DISCOVERED:
        set_state(db, c, v, VideoState.QUEUED, device_id=p.device.id)
    return v, False


@router.post("/videos/batch")
def register_batch(body: VideoBatch, p: Principal = Depends(require_ios), c: AppContext = Depends(ctx),
                   db: Session = Depends(get_db)):
    """Upsert idempotent des vidéos découvertes par l'iPhone (clé : appareil + identifiant PhotoKit)."""
    results = []
    created = 0
    for item in body.videos:
        v = db.scalar(select(Video).where(Video.source_device_id == p.device.id,
                                          Video.asset_local_id == item.asset_local_id))
        if v is None:
            v = Video(user_id=p.user_id, source_device_id=p.device.id, asset_local_id=item.asset_local_id,
                      origin=item.origin, filename=item.filename, state=VideoState.DISCOVERED.value)
            db.add(v)
            created += 1
        for f in ("source_created_at", "duration_s", "width", "height"):
            val = getattr(item, f)
            if val is not None:
                setattr(v, f, val)
        if item.size_bytes is not None and v.sha256 is None:
            v.size_bytes = item.size_bytes
        db.flush()
        dedup = False
        if item.sha256 and item.size_bytes:
            v, dedup = _apply_fingerprint(db, c, p, v, item.sha256, item.size_bytes)
        results.append({"asset_local_id": item.asset_local_id, "deduplicated": dedup, "video": video_out(v)})
    if created:
        log_activity(db, c, user_id=p.user_id, device_id=p.device.id, action="videos.discovered", count=created)
    db.commit()
    return {"results": results}


@router.post("/videos/{video_id}/fingerprint")
def set_fingerprint(video_id: str, body: Fingerprint, p: Principal = Depends(require_ios),
                    c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    v = get_owned_video(db, p, video_id)
    v, dedup = _apply_fingerprint(db, c, p, v, body.sha256, body.size_bytes)
    db.commit()
    return {"deduplicated": dedup, "video": video_out(v)}


@router.get("/videos")
def list_videos(state: str | None = None, limit: int = Query(100, le=500), offset: int = 0,
                p: Principal = Depends(principal), db: Session = Depends(get_db)):
    q = select(Video).where(Video.user_id == p.user_id)
    if state:
        q = q.where(Video.state == state)
    q = q.order_by(Video.source_created_at.desc().nulls_last(), Video.created_at.desc()).limit(limit).offset(offset)
    return [video_out(v) for v in db.scalars(q).all()]


@router.get("/videos/{video_id}")
def get_video(video_id: str, p: Principal = Depends(principal), db: Session = Depends(get_db)):
    return video_out(get_owned_video(db, p, video_id))


@router.post("/videos/{video_id}/retry")
def retry(video_id: str, p: Principal = Depends(require_user), c: AppContext = Depends(ctx),
          db: Session = Depends(get_db)):
    v = get_owned_video(db, p, video_id)
    if v.state != VideoState.FAILED:
        raise HTTPException(status.HTTP_409_CONFLICT, "seules les vidéos en échec peuvent être relancées")
    if v.delivered_at:
        target = VideoState.VERIFIED          # déjà sur l'ordinateur : on relance le traitement
    elif v.relay_present:
        target = VideoState.VERIFIED          # déjà vérifiée côté relais
    else:
        target = VideoState.QUEUED            # renvoi depuis l'iPhone
    set_state(db, c, v, target)
    db.commit()
    return video_out(v)


def state_counts(db: Session, user_id: str) -> dict[str, int]:
    rows = db.execute(select(Video.state, func.count()).where(Video.user_id == user_id).group_by(Video.state)).all()
    counts = {s.value: 0 for s in VideoState}
    counts.update({s: n for s, n in rows})
    return counts
