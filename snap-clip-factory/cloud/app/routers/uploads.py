"""Upload par morceaux, reprenable et vérifié.

1. POST /videos/{id}/uploads        -> ouvre (ou reprend) une session
2. PUT  /uploads/{uid}/chunks/{n}   -> envoie le morceau n (en-tête X-Chunk-SHA256)
3. GET  /uploads/{uid}              -> liste des morceaux reçus (reprise)
4. POST /uploads/{uid}/complete     -> assemblage + SHA-256 global -> VERIFIED
"""
from __future__ import annotations

import hashlib
import math
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from ..deps import AppContext, Principal, _aware, ctx, get_db, log_activity, require_ios
from ..models import UploadChunk, UploadSession, Video, now
from ..schemas import UploadCreate
from ..state import VideoState
from .videos import get_owned_video, set_state, video_out

router = APIRouter(prefix="/v1", tags=["uploads"])

UPLOADABLE = {VideoState.QUEUED, VideoState.UPLOADING, VideoState.FAILED}


def session_out(s: UploadSession) -> dict:
    return {
        "upload_id": s.id, "video_id": s.video_id, "chunk_size": s.chunk_size,
        "total_size": s.total_size, "total_chunks": s.total_chunks, "status": s.status,
        "received": sorted(ch.index for ch in s.chunks), "expires_at": s.expires_at,
    }


def _get_session(db: Session, p: Principal, upload_id: str) -> tuple[UploadSession, Video]:
    s = db.get(UploadSession, upload_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session inconnue")
    v = get_owned_video(db, p, s.video_id)
    return s, v


@router.post("/videos/{video_id}/uploads", status_code=201)
def open_upload(video_id: str, body: UploadCreate, p: Principal = Depends(require_ios),
                c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    v = get_owned_video(db, p, video_id)
    if v.state in (VideoState.UPLOADED, VideoState.VERIFIED, VideoState.PROCESSING, VideoState.COMPLETED) or (
        v.state == VideoState.FAILED and (v.relay_present or v.delivered_at)
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "already_uploaded", "video": video_out(v)})
    if v.state not in UPLOADABLE or not v.sha256 or not v.size_bytes:
        raise HTTPException(status.HTTP_409_CONFLICT, "empreinte SHA-256 requise avant l'upload")

    existing = db.scalar(select(UploadSession).where(UploadSession.video_id == v.id, UploadSession.status == "open"))
    if existing and _aware(existing.expires_at) > now():
        return session_out(existing)  # reprise : le client renvoie seulement les morceaux manquants
    if existing:
        existing.status = "aborted"
        c.storage.discard_upload(existing.id)

    st = c.settings
    chunk = max(st.min_chunk_size, min(body.chunk_size or st.default_chunk_size, st.max_chunk_size))
    s = UploadSession(video_id=v.id, device_id=p.device.id, chunk_size=chunk, total_size=v.size_bytes,
                      total_chunks=max(1, math.ceil(v.size_bytes / chunk)),
                      expires_at=now() + timedelta(seconds=st.upload_session_ttl_s))
    db.add(s)
    set_state(db, c, v, VideoState.UPLOADING, device_id=p.device.id)
    db.commit()
    db.refresh(s)
    return session_out(s)


@router.get("/uploads/{upload_id}")
def get_upload(upload_id: str, p: Principal = Depends(require_ios), db: Session = Depends(get_db)):
    s, _ = _get_session(db, p, upload_id)
    return session_out(s)


@router.put("/uploads/{upload_id}/chunks/{index}")
async def put_chunk(upload_id: str, index: int, request: Request,
                    x_chunk_sha256: str = Header(..., alias="X-Chunk-SHA256"),
                    p: Principal = Depends(require_ios), c: AppContext = Depends(ctx),
                    db: Session = Depends(get_db)):
    declared = int(request.headers.get("content-length") or 0)
    if declared > c.settings.max_chunk_size:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "morceau trop gros")
    data = await request.body()
    if len(data) > c.settings.max_chunk_size:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "morceau trop gros")

    def work():
        s, v = _get_session(db, p, upload_id)
        if s.status != "open" or _aware(s.expires_at) < now():
            raise HTTPException(status.HTTP_410_GONE, "session close ou expirée")
        if not 0 <= index < s.total_chunks:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "index hors limites")
        expected = s.chunk_size if index < s.total_chunks - 1 else s.total_size - s.chunk_size * (s.total_chunks - 1)
        if len(data) != expected:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"taille {len(data)} != {expected}")
        digest = hashlib.sha256(data).hexdigest()
        if digest != x_chunk_sha256.lower():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "morceau corrompu (SHA-256)")
        c.storage.write_chunk(s.id, index, data)
        ch = db.get(UploadChunk, (s.id, index))
        if ch is None:
            db.add(UploadChunk(upload_id=s.id, index=index, size=len(data), sha256=digest))
        else:
            ch.size, ch.sha256 = len(data), digest
        db.commit()
        db.refresh(s)
        received = len(s.chunks)
        c.bus.publish(p.user_id, {"type": "upload.progress", "video_id": v.id,
                                  "received": received, "total": s.total_chunks})
        return {"index": index, "received": received, "total_chunks": s.total_chunks}

    return await run_in_threadpool(work)


@router.post("/uploads/{upload_id}/complete")
async def complete_upload(upload_id: str, p: Principal = Depends(require_ios), c: AppContext = Depends(ctx),
                          db: Session = Depends(get_db)):
    def work():
        s, v = _get_session(db, p, upload_id)
        if s.status == "completed":
            return video_out(v)
        if s.status != "open":
            raise HTTPException(status.HTTP_410_GONE, "session close")
        got = {ch.index for ch in s.chunks}
        missing = [i for i in range(s.total_chunks) if i not in got]
        if missing:
            raise HTTPException(status.HTTP_409_CONFLICT, {"code": "missing_chunks", "missing": missing[:1000]})
        sha, size = c.storage.assemble(s.id, s.total_chunks, v.id)
        c.storage.discard_upload(s.id)
        set_state(db, c, v, VideoState.UPLOADED, device_id=p.device.id)
        if sha != v.sha256 or size != v.size_bytes:
            c.storage.delete(v.id)
            s.status = "aborted"
            set_state(db, c, v, VideoState.FAILED, device_id=p.device.id,
                      error=f"intégrité : sha256 {sha[:12]}… / taille {size} ne correspondent pas")
            db.commit()
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, {"code": "integrity_failed", "video": video_out(v)})
        s.status = "completed"
        v.relay_present = True
        set_state(db, c, v, VideoState.VERIFIED, device_id=p.device.id)
        db.commit()
        return video_out(v)

    return await run_in_threadpool(work)


@router.delete("/uploads/{upload_id}")
def abort_upload(upload_id: str, p: Principal = Depends(require_ios), c: AppContext = Depends(ctx),
                 db: Session = Depends(get_db)):
    s, v = _get_session(db, p, upload_id)
    if s.status == "open":
        s.status = "aborted"
        c.storage.discard_upload(s.id)
        if v.state == VideoState.UPLOADING:
            set_state(db, c, v, VideoState.QUEUED, device_id=p.device.id)
        log_activity(db, c, user_id=p.user_id, device_id=p.device.id, action="upload.aborted", video_id=v.id)
        db.commit()
    return {"aborted": True}
