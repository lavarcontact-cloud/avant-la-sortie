from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import Settings
from .db import Database
from .events import EventBus
from .models import ActivityLog, Device, now
from .security import decode_access_token
from .storage import RelayStorage


@dataclass
class AppContext:
    settings: Settings
    db: Database
    storage: RelayStorage
    bus: EventBus


@dataclass
class Principal:
    user_id: str
    typ: str  # "user" | "device"
    device: Device | None = None


def ctx(request: Request) -> AppContext:
    return request.app.state.ctx


def get_db(request: Request):
    yield from request.app.state.ctx.db.session()


_bearer = HTTPBearer(auto_error=False)


def principal(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    c: AppContext = Depends(ctx),
    db: Session = Depends(get_db),
) -> Principal:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "jeton manquant")
    return resolve_token(creds.credentials, c, db)


def resolve_token(token: str, c: AppContext, db: Session) -> Principal:
    try:
        claims = decode_access_token(c.settings.secret_key, token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "jeton expiré")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "jeton invalide")
    if claims.get("typ") == "device":
        device = db.get(Device, claims.get("did"))
        if device is None or device.revoked_at is not None or device.user_id != claims["sub"]:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "appareil révoqué")
        # last_seen au plus une écriture par minute
        if device.last_seen_at is None or _aware(device.last_seen_at) < now() - timedelta(seconds=60):
            device.last_seen_at = now()
            db.commit()
        return Principal(user_id=claims["sub"], typ="device", device=device)
    if claims.get("typ") == "user":
        return Principal(user_id=claims["sub"], typ="user")
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "type de jeton inconnu")


def require_user(p: Principal = Depends(principal)) -> Principal:
    if p.typ != "user":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "réservé au compte utilisateur")
    return p


def require_device(p: Principal = Depends(principal)) -> Principal:
    if p.typ != "device":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "réservé aux appareils appairés")
    return p


def require_ios(p: Principal = Depends(require_device)) -> Principal:
    if p.device.kind != "ios":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "réservé à l'application iPhone")
    return p


def require_desktop(p: Principal = Depends(require_device)) -> Principal:
    if p.device.kind != "desktop":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "réservé à l'agent desktop")
    return p


def _aware(dt):
    from datetime import timezone

    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def log_activity(
    db: Session, c: AppContext, *, user_id: str, action: str, device_id: str | None = None, **detail
) -> None:
    """Journal d'activité persistant + notification temps réel du dashboard."""
    db.add(ActivityLog(user_id=user_id, device_id=device_id, action=action, detail=detail))
    c.bus.publish(user_id, {"type": "activity", "action": action, "device_id": device_id, **detail})
