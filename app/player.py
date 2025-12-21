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
        self._mode: str = "full_random"  # "full_random" or "recent_albums"
        self._time_margin_days: int = 7  # 7, 14, 30, 90 days
        self._date_type: str = "mtime"  # "mtime" (modification) or "btime" (creation/birth)

    def set_library(self, tracks: Dict[str, Track], track_ids: List[str]) -> None:
        with self._lock:
            self._tracks = tracks
            self._reshuffle_locked(track_ids)

    def get_mode(self) -> str:
        with self._lock:
            return self._mode

    def set_mode(self, mode: str, track_ids: List[str]) -> None:
        with self._lock:
            if mode not in ("full_random", "recent_albums"):
                raise ValueError(f"Invalid mode: {mode}")
            self._mode = mode
            self._reshuffle_locked(track_ids)

    def get_time_margin_days(self) -> int:
        with self._lock:
            return self._time_margin_days

    def set_time_margin_days(self, days: int, track_ids: List[str]) -> None:
        with self._lock:
            if days not in (7, 14, 30, 90):
                raise ValueError(f"Invalid time margin: {days}")
            self._time_margin_days = days
            self._reshuffle_locked(track_ids)

    def get_date_type(self) -> str:
        with self._lock:
            return self._date_type

    def set_date_type(self, date_type: str, track_ids: List[str]) -> None:
        with self._lock:
            if date_type not in ("mtime", "btime"):
                raise ValueError(f"Invalid date type: {date_type}")
            self._date_type = date_type
            self._reshuffle_locked(track_ids)

    def _reshuffle_locked(self, track_ids: List[str]) -> None:
        if not track_ids:
            self._queue = []
            self._pos = 0
            return

        # Filter tracks based on mode
        if self._mode == "recent_albums":
            current_time = time.time()
            margin_seconds = self._time_margin_days * 24 * 60 * 60
            threshold = current_time - margin_seconds
            
            # Get unique folders with their date (mtime or btime based on setting)
            folder_tracks: Dict[str, List[str]] = {}
            folder_dates: Dict[str, float] = {}
            
            for tid in track_ids:
                track = self._tracks.get(tid)
                # Use the appropriate date based on date_type setting
                if track:
                    folder_date = None
                    if self._date_type == "mtime" and track.folder_mtime:
                        folder_date = track.folder_mtime
                    elif self._date_type == "btime" and track.folder_btime:
                        folder_date = track.folder_btime
                    
                    if folder_date is not None:
                        if track.folder not in folder_tracks:
                            folder_tracks[track.folder] = []
                            folder_dates[track.folder] = folder_date
                        folder_tracks[track.folder].append(tid)
            
            # Filter folders by date
            recent_folders = [
                folder for folder, date in folder_dates.items()
                if date >= threshold
            ]
            
            # Get all tracks from recent folders
            filtered_track_ids = []
            for folder in recent_folders:
                filtered_track_ids.extend(folder_tracks[folder])
            
            # Don't fall back to all tracks - keep empty if no recent albums
            # This will result in an empty queue
        else:
            # Full random mode - use all tracks
            filtered_track_ids = track_ids

        self._queue = list(filtered_track_ids)
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
                    item["artist"] = t.artist
                    item["album"] = t.album
                    item["title"] = t.title
                    item["duration"] = t.duration
                    item["track_number"] = t.track_number
                    item["folder_mtime"] = t.folder_mtime
                
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
