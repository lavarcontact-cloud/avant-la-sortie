"""File de travail locale persistante (SQLite). Survit aux redémarrages."""
from __future__ import annotations

import sqlite3
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes INTEGER,
  source_created_at TEXT,
  stage TEXT NOT NULL,            -- pending | downloaded | delivered | processing | done | failed
  local_path TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at REAL NOT NULL DEFAULT 0,
  updated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_videos_sha ON videos(sha256);
CREATE INDEX IF NOT EXISTS idx_videos_stage ON videos(stage, next_attempt_at);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
"""


class LocalQueue:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.executescript(SCHEMA)

    def upsert_pending(self, v: dict) -> None:
        self.conn.execute(
            "INSERT INTO videos(id, sha256, filename, size_bytes, source_created_at, stage, updated_at) "
            "VALUES (?,?,?,?,?, 'pending', ?) ON CONFLICT(id) DO NOTHING",
            (v["id"], v["sha256"], v["filename"], v["size_bytes"], v.get("source_created_at"), time.time()),
        )

    def get(self, video_id: str):
        return self.conn.execute("SELECT * FROM videos WHERE id=?", (video_id,)).fetchone()

    def find_local_copy(self, sha256: str):
        """Doublon local : même empreinte déjà présente sur le disque."""
        for row in self.conn.execute(
            "SELECT * FROM videos WHERE sha256=? AND local_path IS NOT NULL AND stage IN "
            "('downloaded','delivered','processing','done')", (sha256,)
        ):
            if row["local_path"] and Path(row["local_path"]).is_file():
                return row
        return None

    def set_stage(self, video_id: str, stage: str, **fields) -> None:
        cols = ", ".join(f"{k}=?" for k in fields)
        sql = f"UPDATE videos SET stage=?, updated_at=?{', ' + cols if cols else ''} WHERE id=?"
        self.conn.execute(sql, (stage, time.time(), *fields.values(), video_id))

    def fail(self, video_id: str, error: str, *, stage: str = "pending") -> int:
        """Erreur transitoire : backoff exponentiel (30 s, 1 min, 2 min … max 1 h)."""
        row = self.get(video_id)
        attempts = (row["attempts"] if row else 0) + 1
        delay = min(3600, 30 * 2 ** (attempts - 1))
        self.conn.execute(
            "UPDATE videos SET stage=?, attempts=?, last_error=?, next_attempt_at=?, updated_at=? WHERE id=?",
            (stage, attempts, error[:2000], time.time() + delay, time.time(), video_id),
        )
        return attempts

    def due(self, stage: str, limit: int = 50):
        return self.conn.execute(
            "SELECT * FROM videos WHERE stage=? AND next_attempt_at<=? "
            "ORDER BY source_created_at DESC LIMIT ?", (stage, time.time(), limit)
        ).fetchall()

    def counts(self) -> dict[str, int]:
        return {r["stage"]: r["n"] for r in self.conn.execute("SELECT stage, COUNT(*) n FROM videos GROUP BY stage")}

    def kv_get(self, k: str, default: str | None = None) -> str | None:
        row = self.conn.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
        return row["v"] if row else default

    def kv_set(self, k: str, v: str) -> None:
        self.conn.execute("INSERT INTO kv(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, v))
