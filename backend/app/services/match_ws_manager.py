"""
MatchWSManager — manages per-match WebSocket connection sets and broadcasts.
"""

import asyncio
import json
from collections import defaultdict
from fastapi import WebSocket


class MatchWSManager:
    def __init__(self):
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, match_id: int, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections[match_id].add(ws)

    async def disconnect(self, match_id: int, ws: WebSocket) -> None:
        async with self._lock:
            self._connections[match_id].discard(ws)

    async def broadcast(self, match_id: int, message: dict | str) -> None:
        payload = message if isinstance(message, str) else json.dumps(message)
        dead: set[WebSocket] = set()
        for ws in list(self._connections.get(match_id, set())):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        if dead:
            async with self._lock:
                self._connections[match_id] -= dead

    def has_connections(self, match_id: int) -> bool:
        return bool(self._connections.get(match_id))


# Module-level singleton — shared across all requests in one process
ws_manager = MatchWSManager()
