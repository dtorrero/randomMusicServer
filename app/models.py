from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Track:
    id: str
    rel_path: str
    filename: str
    folder: str
    ext: str
    cover_rel_path: Optional[str]
    artist: Optional[str] = None
    album: Optional[str] = None
    title: Optional[str] = None
    duration: Optional[float] = None  # in seconds
    track_number: Optional[int] = None
    folder_mtime: Optional[float] = None  # folder modification time in seconds since epoch
    folder_btime: Optional[float] = None  # folder creation/birth time in seconds since epoch
