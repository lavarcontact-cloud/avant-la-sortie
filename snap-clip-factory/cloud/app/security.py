"""Mots de passe, jetons d'accès (JWT courts), jetons de rafraîchissement
(opaques, hachés, rotatifs) et URL de téléchargement signées."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta, timezone

import jwt

ALG = "HS256"


# --- Mots de passe (scrypt, stdlib) -------------------------------------------------
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_b64, dk_b64 = stored.split("$")
    except ValueError:
        return False
    salt, expected = base64.b64decode(salt_b64), base64.b64decode(dk_b64)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return hmac.compare_digest(dk, expected)


# --- Jetons -------------------------------------------------------------------------
def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def new_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def new_pairing_code() -> str:
    # 8 caractères sans ambiguïté visuelle (pas de 0/O/1/I)
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def issue_access_token(secret: str, *, sub: str, typ: str, ttl_s: int, device_id: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    claims = {"sub": sub, "typ": typ, "iat": now, "exp": now + timedelta(seconds=ttl_s)}
    if device_id:
        claims["did"] = device_id
    return jwt.encode(claims, secret, algorithm=ALG)


def decode_access_token(secret: str, token: str) -> dict:
    return jwt.decode(token, secret, algorithms=[ALG])


# --- URL signées (équivalent local d'une URL présignée S3) --------------------------
def sign_blob(secret: str, video_id: str, device_id: str, ttl_s: int) -> tuple[int, str]:
    exp = int(time.time()) + ttl_s
    msg = f"{video_id}:{device_id}:{exp}".encode()
    sig = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()
    return exp, sig


def verify_blob_signature(secret: str, video_id: str, device_id: str, exp: int, sig: str) -> bool:
    if exp < int(time.time()):
        return False
    msg = f"{video_id}:{device_id}:{exp}".encode()
    expected = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)
