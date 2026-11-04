from __future__ import annotations

import asyncio
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..deps import AppContext, Principal, ctx, get_db, require_user, resolve_token
from ..models import ActivityLog, Device, Video
from .devices import device_out
from .videos import state_counts

router = APIRouter(tags=["dashboard"])
STATIC = Path(__file__).resolve().parent.parent / "static"


@router.get("/", include_in_schema=False)
def dashboard_page():
    return FileResponse(STATIC / "dashboard.html", headers={"Cache-Control": "no-store"})


@router.get("/studio", include_in_schema=False)
def studio_page():
    return FileResponse(STATIC / "studio.html", headers={"Cache-Control": "no-store"})


@router.get("/v1/dashboard/summary")
def summary(p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    devices = db.scalars(select(Device).where(Device.user_id == p.user_id, Device.revoked_at.is_(None))).all()
    counts = state_counts(db, p.user_id)
    total = sum(counts.values())
    transferred_bytes = db.scalar(
        select(func.coalesce(func.sum(Video.size_bytes), 0)).where(
            Video.user_id == p.user_id, Video.state.in_(["VERIFIED", "PROCESSING", "COMPLETED"]))
    )
    delivered = db.scalar(select(func.count()).where(Video.user_id == p.user_id, Video.delivered_at.is_not(None)))
    awaiting_processing = db.scalar(select(func.count()).where(
        Video.user_id == p.user_id, Video.delivered_at.is_not(None), Video.state == "VERIFIED"))
    return {
        "devices": [device_out(d) for d in devices],
        "sync": {
            "detected": total,
            "transferred": counts["VERIFIED"] + counts["PROCESSING"] + counts["COMPLETED"],
            "delivered_to_desktop": delivered,
            "pending": counts["DISCOVERED"] + counts["QUEUED"] + counts["UPLOADING"] + counts["UPLOADED"],
            "errors": counts["FAILED"],
            "bytes_transferred": transferred_bytes,
            "by_state": counts,
        },
        # PHASES 6 à 9 : pas encore construites. Les compteurs restent à zéro
        # tant que l'analyse IA et le montage n'existent pas réellement.
        "production": {
            "to_analyze": awaiting_processing + counts["PROCESSING"],
            "clips_detected": 0, "clips_edited": 0, "clips_to_review": 0, "scheduled_posts": 0,
            "available": False,
        },
    }


@router.get("/v1/activity")
def activity(limit: int = Query(50, le=200), p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(ActivityLog).where(ActivityLog.user_id == p.user_id)
                      .order_by(ActivityLog.id.desc()).limit(limit)).all()
    return [{"id": r.id, "action": r.action, "device_id": r.device_id, "detail": r.detail, "at": r.created_at}
            for r in rows]


@router.websocket("/v1/ws")
async def ws(websocket: WebSocket):
    """Le jeton est envoyé dans le premier message (jamais dans l'URL, qui
    finirait dans les journaux d'accès)."""
    c: AppContext = websocket.app.state.ctx
    await websocket.accept()
    try:
        hello = await asyncio.wait_for(websocket.receive_json(), timeout=5)
    except Exception:
        await websocket.close(code=4401)
        return
    db = c.db.SessionLocal()
    try:
        p = resolve_token(str(hello.get("token", "")), c, db)
    except HTTPException:
        await websocket.close(code=4401)
        return
    finally:
        db.close()
    if p.typ != "user":
        await websocket.close(code=4403)
        return
    await websocket.send_json({"type": "ready"})
    q = c.bus.subscribe(p.user_id)
    try:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=25)
            except asyncio.TimeoutError:
                event = {"type": "ping"}
            await websocket.send_text(json.dumps(event, default=str))
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        c.bus.unsubscribe(p.user_id, q)
