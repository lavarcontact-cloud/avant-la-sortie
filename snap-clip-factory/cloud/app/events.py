"""Diffusion d'événements temps réel vers le dashboard (WebSocket).

Implémentation en mémoire, mono-processus. Avec plusieurs workers, remplacer
par Redis pub/sub en gardant la même interface `publish(user_id, event)`.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict


class EventBus:
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self, user_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subs[user_id].add(q)
        return q

    def unsubscribe(self, user_id: str, q: asyncio.Queue) -> None:
        self._subs[user_id].discard(q)

    def publish(self, user_id: str, event: dict) -> None:
        """Appelable depuis un thread de handler synchrone."""
        if not self._loop or not self._subs.get(user_id):
            return
        for q in list(self._subs[user_id]):
            self._loop.call_soon_threadsafe(_put_nowait, q, event)


def _put_nowait(q: asyncio.Queue, event: dict) -> None:
    try:
        q.put_nowait(event)
    except asyncio.QueueFull:
        pass  # client trop lent : il resynchronisera via /summary
