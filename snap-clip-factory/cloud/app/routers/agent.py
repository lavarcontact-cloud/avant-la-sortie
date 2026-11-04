"""Côté agent desktop : boîte de réception, téléchargement signé, accusé de
livraison (qui purge la copie relais) et rapports de traitement."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import AppContext, Principal, ctx, get_db, log_activity, require_desktop
from ..models import Device, Video, now
from ..schemas import Delivered, StateReport
from ..security import sign_blob, verify_blob_signature
from ..state import VideoState
from .videos import get_owned_video, set_state, video_out

router = APIRouter(prefix="/v1", tags=["agent"])


@router.get("/agent/inbox")
def inbox(limit: int = Query(20, le=100), p: Principal = Depends(require_desktop), c: AppContext = Depends(ctx),
          db: Session = Depends(get_db)):
    """Vidéos vérifiées prêtes à être rapatriées, les plus récentes d'abord."""
    q = (
        select(Video)
        .where(Video.user_id == p.user_id, Video.state == VideoState.VERIFIED.value,
               Video.relay_present.is_(True), Video.delivered_at.is_(None))
        .order_by(Video.source_created_at.desc().nulls_last(), Video.created_at.desc())
        .limit(limit)
    )
    items = []
    for v in db.scalars(q).all():
        exp, sig = sign_blob(c.settings.secret_key, v.id, p.device.id, c.settings.download_url_ttl_s)
        items.append({
            "video": video_out(v),
            "download_url": f"{c.settings.public_base_url}/v1/blobs/{v.id}?d={p.device.id}&exp={exp}&sig={sig}",
            "expires_at": exp,
        })
    return {"items": items}


_RANGE = re.compile(r"bytes=(\d+)-(\d*)$")


@router.get("/blobs/{video_id}")
def download_blob(video_id: str, d: str, exp: int, sig: str, range_: str | None = Header(None, alias="Range"),
                  c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    """URL temporaire signée (HMAC, ~10 min, liée à un appareil). Gère `Range`
    pour reprendre un téléchargement interrompu."""
    if not verify_blob_signature(c.settings.secret_key, video_id, d, exp, sig):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "lien expiré ou invalide")
    device, v = db.get(Device, d), db.get(Video, video_id)
    if device is None or device.revoked_at or v is None or v.user_id != device.user_id or not c.storage.exists(video_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "introuvable")
    total = c.storage.size(video_id)
    start, end, code = 0, total - 1, 200
    if range_:
        m = _RANGE.match(range_.strip())
        if not m:
            raise HTTPException(status.HTTP_416_RANGE_NOT_SATISFIABLE, "Range invalide")
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else total - 1
        if start >= total or end < start:
            raise HTTPException(status.HTTP_416_RANGE_NOT_SATISFIABLE, "Range hors limites",
                                headers={"Content-Range": f"bytes */{total}"})
        end, code = min(end, total - 1), 206
    headers = {"Accept-Ranges": "bytes", "Content-Length": str(end - start + 1),
               "X-Content-SHA256": v.sha256 or "", "Cache-Control": "no-store"}
    if code == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{total}"
    return StreamingResponse(c.storage.open_range(video_id, start, end), status_code=code,
                             media_type="application/octet-stream", headers=headers)


@router.post("/videos/{video_id}/delivered")
def delivered(video_id: str, body: Delivered, p: Principal = Depends(require_desktop), c: AppContext = Depends(ctx),
              db: Session = Depends(get_db)):
    """L'agent confirme avoir le fichier, SHA-256 vérifié localement.
    Le relais Cloud est alors purgé : l'original vit sur l'iPhone et l'ordinateur."""
    v = get_owned_video(db, p, video_id)
    if body.sha256 != v.sha256:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "empreinte différente de la référence")
    if v.delivered_at is None:
        v.delivered_at = now()
        v.desktop_device_id = p.device.id
        if c.settings.purge_relay_after_delivery:
            c.storage.delete(v.id)
            v.relay_present = False
        log_activity(db, c, user_id=p.user_id, device_id=p.device.id, action="video.delivered",
                     video_id=v.id, filename=v.filename, relay_purged=not v.relay_present)
        db.commit()
    return video_out(v)


@router.post("/videos/{video_id}/state")
def report_state(video_id: str, body: StateReport, p: Principal = Depends(require_desktop),
                 c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    v = get_owned_video(db, p, video_id)
    if v.desktop_device_id != p.device.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "vidéo livrée à un autre ordinateur")
    if body.probe:
        v.probe = {**(v.probe or {}), **body.probe}
    if v.state != body.state:
        set_state(db, c, v, body.state, error=body.error, device_id=p.device.id)
    db.commit()
    return video_out(v)


@router.get("/agent/assigned")
def assigned(p: Principal = Depends(require_desktop), db: Session = Depends(get_db)):
    """Vidéos déjà livrées à cet ordinateur et pas encore terminées (reprise après redémarrage)."""
    q = select(Video).where(Video.desktop_device_id == p.device.id,
                            Video.state.in_([VideoState.VERIFIED.value, VideoState.PROCESSING.value]))
    return [video_out(v) for v in db.scalars(q).all()]
