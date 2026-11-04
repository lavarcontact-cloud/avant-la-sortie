"""Compte utilisateur, appairage des appareils et rotation des jetons."""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..deps import AppContext, Principal, _aware, ctx, get_db, log_activity, require_user
from ..models import Device, PairingCode, RefreshToken, User, new_id, now
from ..schemas import Credentials, PairRequest, RefreshRequest, TokenPair
from ..security import (
    hash_password,
    issue_access_token,
    new_opaque_token,
    new_pairing_code,
    sha256_hex,
    verify_password,
)

router = APIRouter(prefix="/v1", tags=["auth"])


@router.post("/auth/register", status_code=201)
def register(body: Credentials, c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    has_users = db.scalar(select(User.id).limit(1)) is not None
    # Usage personnel : seul le premier compte peut s'inscrire, sauf ouverture explicite.
    if has_users and not c.settings.allow_signup:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "inscriptions fermées")
    email = body.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "compte existant")
    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    log_activity(db, c, user_id=user.id, action="user.registered")
    db.commit()
    return {"user_id": user.id}


@router.post("/auth/login")
def login(body: Credentials, c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "identifiants invalides")
    token = issue_access_token(c.settings.secret_key, sub=user.id, typ="user", ttl_s=c.settings.user_token_ttl_s)
    log_activity(db, c, user_id=user.id, action="user.login")
    db.commit()
    return {"access_token": token, "expires_in": c.settings.user_token_ttl_s}


@router.post("/pairing-codes", status_code=201)
def create_pairing_code(p: Principal = Depends(require_user), c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    code = new_pairing_code()
    expires = now() + timedelta(seconds=c.settings.pairing_code_ttl_s)
    db.add(PairingCode(user_id=p.user_id, code_hash=sha256_hex(code), expires_at=expires))
    log_activity(db, c, user_id=p.user_id, action="pairing.code_created")
    db.commit()
    return {"code": code, "expires_at": expires}


def _issue_pair(c: AppContext, db: Session, device: Device, family: str | None = None) -> TokenPair:
    refresh = new_opaque_token()
    db.add(
        RefreshToken(
            device_id=device.id,
            token_hash=sha256_hex(refresh),
            family=family or new_id(),
            expires_at=now() + timedelta(seconds=c.settings.refresh_token_ttl_s),
        )
    )
    access = issue_access_token(
        c.settings.secret_key, sub=device.user_id, typ="device",
        ttl_s=c.settings.access_token_ttl_s, device_id=device.id,
    )
    return TokenPair(access_token=access, refresh_token=refresh,
                     expires_in=c.settings.access_token_ttl_s, device_id=device.id)


@router.post("/devices/pair", response_model=TokenPair, status_code=201)
def pair_device(body: PairRequest, c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    pc = db.scalar(select(PairingCode).where(PairingCode.code_hash == sha256_hex(body.code.upper())))
    if pc is None or pc.used_at is not None or _aware(pc.expires_at) < now():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "code d'appairage invalide ou expiré")
    pc.used_at = now()
    device = Device(user_id=pc.user_id, name=body.name, kind=body.kind, platform=body.platform, last_seen_at=now())
    db.add(device)
    db.flush()
    pair = _issue_pair(c, db, device)
    log_activity(db, c, user_id=device.user_id, device_id=device.id, action="device.paired",
                 kind=device.kind, name=device.name)
    db.commit()
    return pair


@router.post("/auth/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    rt = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == sha256_hex(body.refresh_token)))
    if rt is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "jeton de rafraîchissement inconnu")
    device = db.get(Device, rt.device_id)
    if rt.used_at is not None:
        # Réutilisation d'un jeton déjà échangé : vol probable -> on révoque toute la famille.
        db.execute(update(RefreshToken).where(RefreshToken.family == rt.family).values(revoked_at=now()))
        log_activity(db, c, user_id=device.user_id, device_id=device.id, action="security.refresh_reuse")
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "jeton réutilisé : session révoquée")
    if rt.revoked_at is not None or _aware(rt.expires_at) < now() or device is None or device.revoked_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "session expirée ou révoquée")
    rt.used_at = now()
    pair = _issue_pair(c, db, device, family=rt.family)
    db.commit()
    return pair
