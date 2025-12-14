from __future__ import annotations

import random
import threading
import time
from typing import Dict, List, Optional

from .models import Track


class PlayerState:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._queue: List[str] = []
        self._pos: int = 0
        self._tracks: Dict[str, Track] = {}
        self._last_shuffle_seed: Optional[int] = None

    def set_library(self, tracks: Dict[str, Track], track_ids: List[str]) -> None:
        with self._lock:
            self._tracks = tracks
            self._reshuffle_locked(track_ids)

    def _reshuffle_locked(self, track_ids: List[str]) -> None:
        if not track_ids:
            self._queue = []
            self._pos = 0
            return

        self._queue = list(track_ids)
        seed = int(time.time())
        self._last_shuffle_seed = seed
        rnd = random.Random(seed)
        rnd.shuffle(self._queue)
        self._pos = 0

    def maybe_refresh_queue(self, track_ids: List[str], refresh_seconds: int) -> None:
        if refresh_seconds <= 0:
            return
        with self._lock:
            if not self._queue:
                self._reshuffle_locked(track_ids)
                return
            if self._last_shuffle_seed is None:
                self._reshuffle_locked(track_ids)
                return
            if int(time.time()) - self._last_shuffle_seed >= refresh_seconds:
                self._reshuffle_locked(track_ids)

    def current_id(self) -> Optional[str]:
        with self._lock:
            if not self._queue:
                return None
            return self._queue[self._pos]

    def next(self) -> Optional[str]:
        with self._lock:
            if not self._queue:
                return None
            self._pos = (self._pos + 1) % len(self._queue)
            return self._queue[self._pos]

    def prev(self) -> Optional[str]:
        with self._lock:
            if not self._queue:
                return None
            self._pos = (self._pos - 1) % len(self._queue)
            return self._queue[self._pos]

    def stop(self) -> None:
        with self._lock:
            self._pos = 0

    def queue_window(self, window_size: int = 10) -> dict:
        """Get a window of songs around current position.
        
        Logic:
        - Start at top (positions 0-9)
        - Once position reaches 5, keep current at position 5 in the view (4 before, 5 after)
        - Window shifts forward when moving to position 6+
        - Window doesn't shift backward (previous songs stay in same view position)
        """
        with self._lock:
            if not self._queue:
                return {"queue": [], "current_index": -1, "current_id": None}

            total = len(self._queue)
            cur_id = self._queue[self._pos]
            
            # Calculate window start position
            # Start at top until we reach position 5
            # Then keep current song at position 5 in the list (index 4 in window)
            if self._pos < 5:
                # Still at the beginning, show from position 0
                start = 0
            else:
                # Keep current song at position 5 in the visible list
                # This means 4 songs before current (positions 0-3 in window)
                # and current at position 4 in window (5th position)
                start = self._pos - 4
            
            # Get window of songs
            window = []
            for i in range(window_size):
                idx = start + i
                # Don't wrap around - only show what exists
                if idx >= total:
                    break
                    
                tid = self._queue[idx]
                t = self._tracks.get(tid)
                
                item = {
                    "id": tid,
                    "position": idx,
                    "is_current": (idx == self._pos)
                }
                
                if t:
                    item["filename"] = t.filename
                    item["folder"] = t.folder
                    item["ext"] = t.ext
                
                window.append(item)
            
            return {
                "queue": window,
                "current_index": self._pos,
                "current_id": cur_id,
                "total_tracks": total
            }
    
    def jump_to(self, track_id: str) -> Optional[str]:
        """Jump to a specific track by ID."""
        with self._lock:
            if not self._queue:
                return None
            try:
                self._pos = self._queue.index(track_id)
                return track_id
            except ValueError:
                return None
    
    def sidebar(self, n: int = 5) -> dict:
        """Legacy method for backward compatibility."""
        with self._lock:
            if not self._queue:
                return {"current": None, "previous": [], "next": []}

            cur = self._queue[self._pos]

            prev_ids = [self._queue[(self._pos - i) % len(self._queue)] for i in range(n, 0, -1)]
            next_ids = [self._queue[(self._pos + i) % len(self._queue)] for i in range(1, n + 1)]

            def _meta(tid: str) -> dict:
                t = self._tracks.get(tid)
                if t is None:
                    return {"id": tid}
                return {
                    "id": t.id,
                    "filename": t.filename,
                    "folder": t.folder,
                    "ext": t.ext,
                }

            return {
                "current": _meta(cur),
                "previous": [_meta(tid) for tid in prev_ids],
                "next": [_meta(tid) for tid in next_ids],
            }
