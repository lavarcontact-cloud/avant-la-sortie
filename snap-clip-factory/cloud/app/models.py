from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from .db import Base
from .state import VideoState


class UTCDateTime(TypeDecorator):
    """Toujours en UTC « aware », y compris avec SQLite qui perd le fuseau."""
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc) if value is not None else None

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class PairingCode(Base):
    __tablename__ = "pairing_codes"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(16))  # "ios" | "desktop"
    platform: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    last_seen_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    status: Mapped[dict] = mapped_column(JSON, default=dict)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    family: Mapped[str] = mapped_column(String(32), index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class Video(Base):
    __tablename__ = "videos"
    __table_args__ = (
        UniqueConstraint("source_device_id", "asset_local_id", name="uq_video_source_asset"),
        UniqueConstraint("user_id", "sha256", name="uq_video_user_sha"),
    )
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"), index=True)
    asset_local_id: Mapped[str] = mapped_column(String(255))
    origin: Mapped[str] = mapped_column(String(32), default="photos")  # photos | share | snapchat_memories
    filename: Mapped[str] = mapped_column(String(255))
    source_created_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    state: Mapped[str] = mapped_column(String(16), default=VideoState.DISCOVERED.value, index=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    relay_present: Mapped[bool] = mapped_column(default=False)
    desktop_device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    probe: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now, onupdate=now)


class UploadSession(Base):
    __tablename__ = "upload_sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    video_id: Mapped[str] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"))
    chunk_size: Mapped[int] = mapped_column(Integer)
    total_size: Mapped[int] = mapped_column(BigInteger)
    total_chunks: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="open")  # open | completed | aborted
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())
    chunks: Mapped[list["UploadChunk"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class UploadChunk(Base):
    __tablename__ = "upload_chunks"
    upload_id: Mapped[str] = mapped_column(ForeignKey("upload_sessions.id", ondelete="CASCADE"), primary_key=True)
    index: Mapped[int] = mapped_column(Integer, primary_key=True)
    size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))


class Command(Base):
    __tablename__ = "commands"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32))  # sync_now | pause | resume
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    delivered_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class ActivityLog(Base):
    __tablename__ = "activity_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(32), index=True)
    device_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    action: Mapped[str] = mapped_column(String(64))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now, index=True)
