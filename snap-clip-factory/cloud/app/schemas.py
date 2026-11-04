from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

SHA256 = Field(pattern=r"^[0-9a-f]{64}$")


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=10, max_length=256)


class PairRequest(BaseModel):
    code: str = Field(min_length=8, max_length=8)
    name: str = Field(min_length=1, max_length=120)
    kind: Literal["ios", "desktop"]
    platform: str = Field(default="", max_length=64)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    device_id: str


class Heartbeat(BaseModel):
    status: dict = Field(default_factory=dict)


class VideoIn(BaseModel):
    asset_local_id: str = Field(min_length=1, max_length=255)
    origin: Literal["photos", "share", "snapchat_memories"] = "photos"
    filename: str = Field(min_length=1, max_length=255)
    source_created_at: datetime | None = None
    duration_s: float | None = Field(default=None, ge=0)
    width: int | None = Field(default=None, ge=0)
    height: int | None = Field(default=None, ge=0)
    size_bytes: int | None = Field(default=None, ge=0)
    sha256: str | None = None

    @field_validator("sha256")
    @classmethod
    def _sha(cls, v):
        if v is not None:
            v = v.lower()
            if len(v) != 64 or any(ch not in "0123456789abcdef" for ch in v):
                raise ValueError("sha256 hexadécimal attendu")
        return v

    @field_validator("filename")
    @classmethod
    def _filename(cls, v):
        # nom d'affichage uniquement : jamais utilisé comme chemin côté serveur
        return v.replace("/", "_").replace("\\", "_")


class VideoBatch(BaseModel):
    videos: list[VideoIn] = Field(max_length=500)


class Fingerprint(BaseModel):
    sha256: str = SHA256
    size_bytes: int = Field(ge=1)


class UploadCreate(BaseModel):
    chunk_size: int | None = None


class Delivered(BaseModel):
    sha256: str = SHA256


class StateReport(BaseModel):
    state: Literal["PROCESSING", "COMPLETED", "FAILED"]
    error: str | None = Field(default=None, max_length=2000)
    probe: dict | None = None


class VideoOut(BaseModel):
    id: str
    asset_local_id: str
    origin: str
    filename: str
    source_created_at: datetime | None
    duration_s: float | None
    width: int | None
    height: int | None
    size_bytes: int | None
    sha256: str | None
    state: str
    error: str | None
    relay_present: bool
    delivered_at: datetime | None
    updated_at: datetime

    model_config = {"from_attributes": True}
