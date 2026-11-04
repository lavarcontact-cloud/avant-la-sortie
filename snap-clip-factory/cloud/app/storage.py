"""Stockage relais temporaire.

Le Cloud n'est PAS la bibliothèque vidéo : il garde les morceaux et le fichier
assemblé le temps que l'agent desktop le récupère, puis les supprime.
`LocalRelayStorage` écrit sur disque ; une implémentation S3 (multipart upload
+ URL présignées) doit respecter la même interface.
"""
from __future__ import annotations

import hashlib
import os
import shutil
from pathlib import Path
from typing import BinaryIO, Iterator, Protocol


class RelayStorage(Protocol):
    def write_chunk(self, upload_id: str, index: int, data: bytes) -> None: ...
    def assemble(self, upload_id: str, total_chunks: int, video_id: str) -> tuple[str, int]: ...
    def discard_upload(self, upload_id: str) -> None: ...
    def exists(self, video_id: str) -> bool: ...
    def size(self, video_id: str) -> int: ...
    def open_range(self, video_id: str, start: int, end: int) -> Iterator[bytes]: ...
    def delete(self, video_id: str) -> None: ...


class LocalRelayStorage:
    READ_BLOCK = 1024 * 1024

    def __init__(self, root: Path):
        self.root = Path(root)
        (self.root / "uploads").mkdir(parents=True, exist_ok=True)
        (self.root / "videos").mkdir(parents=True, exist_ok=True)

    def _upload_dir(self, upload_id: str) -> Path:
        return self.root / "uploads" / upload_id

    def _video_path(self, video_id: str) -> Path:
        return self.root / "videos" / video_id

    def write_chunk(self, upload_id: str, index: int, data: bytes) -> None:
        d = self._upload_dir(upload_id)
        d.mkdir(parents=True, exist_ok=True)
        tmp = d / f"{index:06d}.part"
        with open(tmp, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, d / f"{index:06d}")  # écriture atomique : idempotent en cas de renvoi

    def assemble(self, upload_id: str, total_chunks: int, video_id: str) -> tuple[str, int]:
        """Concatène les morceaux et renvoie (sha256, taille) du fichier final."""
        d = self._upload_dir(upload_id)
        h = hashlib.sha256()
        size = 0
        out_tmp = self._video_path(video_id).with_suffix(".assembling")
        with open(out_tmp, "wb") as out:
            for i in range(total_chunks):
                with open(d / f"{i:06d}", "rb") as src:
                    while block := src.read(self.READ_BLOCK):
                        h.update(block)
                        size += len(block)
                        out.write(block)
            out.flush()
            os.fsync(out.fileno())
        os.replace(out_tmp, self._video_path(video_id))
        return h.hexdigest(), size

    def discard_upload(self, upload_id: str) -> None:
        shutil.rmtree(self._upload_dir(upload_id), ignore_errors=True)

    def exists(self, video_id: str) -> bool:
        return self._video_path(video_id).is_file()

    def size(self, video_id: str) -> int:
        return self._video_path(video_id).stat().st_size

    def open_range(self, video_id: str, start: int, end: int) -> Iterator[bytes]:
        remaining = end - start + 1
        with open(self._video_path(video_id), "rb") as f:
            f.seek(start)
            while remaining > 0:
                block = f.read(min(self.READ_BLOCK, remaining))
                if not block:
                    break
                remaining -= len(block)
                yield block

    def delete(self, video_id: str) -> None:
        self._video_path(video_id).unlink(missing_ok=True)
