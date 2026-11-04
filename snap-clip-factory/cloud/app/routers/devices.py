from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..deps import AppContext, Principal, ctx, get_db, log_activity, require_device, require_user
from ..models import Command, Device, RefreshToken, now
from ..schemas import Heartbeat

router = APIRouter(prefix="/v1", tags=["devices"])

STATUS_KEYS = {
    "app_version", "os_version", "disk_free_bytes", "disk_total_bytes", "photo_authorization",
    "videos_available", "videos_synced", "videos_pending", "videos_failed", "bytes_transferred",
    "last_sync_at", "paused", "queue", "current_task", "network",
}


def device_out(d: Device) -> dict:
    return {
        "id": d.id, "name": d.name, "kind": d.kind, "platform": d.platform,
        "created_at": d.created_at, "last_seen_at": d.last_seen_at,
        "revoked": d.revoked_at is not None, "status": d.status or {},
    }


@router.get("/devices")
def list_devices(p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Device).where(Device.user_id == p.user_id).order_by(Device.created_at)).all()
    return [device_out(d) for d in rows]


@router.delete("/devices/{device_id}")
def revoke_device(device_id: str, p: Principal = Depends(require_user), c: AppContext = Depends(ctx),
                  db: Session = Depends(get_db)):
    d = db.get(Device, device_id)
    if d is None or d.user_id != p.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "appareil inconnu")
    d.revoked_at = now()
    db.execute(update(RefreshToken).where(RefreshToken.device_id == d.id).values(revoked_at=now()))
    log_activity(db, c, user_id=p.user_id, device_id=d.id, action="device.revoked", name=d.name)
    db.commit()
    return {"revoked": True}


@router.get("/devices/me")
def me(p: Principal = Depends(require_device)):
    return device_out(p.device)


@router.post("/devices/me/heartbeat")
def heartbeat(body: Heartbeat, p: Principal = Depends(require_device), c: AppContext = Depends(ctx),
              db: Session = Depends(get_db)):
    d = db.get(Device, p.device.id)
    d.status = {k: v for k, v in body.status.items() if k in STATUS_KEYS}
    d.last_seen_at = now()
    db.commit()
    c.bus.publish(p.user_id, {"type": "device", "device": device_out(d)})
    return {"ok": True}


@router.get("/devices/me/commands")
def pull_commands(p: Principal = Depends(require_device), db: Session = Depends(get_db)):
    """Commandes en attente (SYNCHRONISER MAINTENANT, pause, reprise).
    Livrées une seule fois. L'iPhone ne les reçoit que lorsque l'app tourne :
    iOS ne permet pas de réveiller une app sans notification push (APNs)."""
    cmds = db.scalars(
        select(Command).where(Command.device_id == p.device.id, Command.delivered_at.is_(None))
        .order_by(Command.created_at)
    ).all()
    for cmd in cmds:
        cmd.delivered_at = now()
    db.commit()
    return [{"id": cmd.id, "kind": cmd.kind, "created_at": cmd.created_at} for cmd in cmds]


@router.post("/sync/{kind}")
def request_sync(kind: str, p: Principal = Depends(require_user), c: AppContext = Depends(ctx),
                 db: Session = Depends(get_db)):
    if kind not in {"sync_now", "pause", "resume"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "commande inconnue")
    devices = db.scalars(select(Device).where(Device.user_id == p.user_id, Device.revoked_at.is_(None))).all()
    for d in devices:
        db.add(Command(user_id=p.user_id, device_id=d.id, kind=kind))
    log_activity(db, c, user_id=p.user_id, action=f"sync.{kind}", devices=len(devices))
    db.commit()
    return {"queued_for": len(devices)}
