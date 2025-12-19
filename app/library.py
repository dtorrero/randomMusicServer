from __future__ import annotations

import hashlib
import logging
import os
from typing import Dict, List, Optional, Tuple

import mutagen

from .models import Track


logger = logging.getLogger(__name__)


AUDIO_EXTS = {".mp3", ".flac"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
PREFERRED_COVER_BASENAMES = {"cover", "folder", "front"}


def _track_id(rel_path: str) -> str:
    return hashlib.sha1(rel_path.encode("utf-8")).hexdigest()


def _find_folder_cover(abs_folder: str) -> Optional[str]:
    try:
        entries = os.listdir(abs_folder)
    except OSError:
        return None

    lowered = {e.lower(): e for e in entries}

    for base in ("cover", "folder", "front"):
        for ext in IMAGE_EXTS:
            key = f"{base}{ext}"
            if key in lowered:
                return os.path.join(abs_folder, lowered[key])

    images = [e for e in entries if os.path.splitext(e)[1].lower() in IMAGE_EXTS]
    if len(images) == 1:
        return os.path.join(abs_folder, images[0])

    return None


def _extract_metadata(abs_path: str, filename: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[float], Optional[int]]:
    """Extract metadata from audio file using mutagen.
    Returns: (artist, album, title, duration, track_number)
    """
    try:
        audio = mutagen.File(abs_path, easy=True)
        if audio is None:
            return None, None, None, None, None
        
        # Get basic metadata
        artist = audio.get('artist', [None])[0] if 'artist' in audio else None
        album = audio.get('album', [None])[0] if 'album' in audio else None
        title = audio.get('title', [None])[0] if 'title' in audio else None
        
        # Get duration
        duration = audio.info.length if hasattr(audio, 'info') and hasattr(audio.info, 'length') else None
        
        # Get track number
        track_num = None
        if 'tracknumber' in audio:
            track_str = audio['tracknumber'][0]
            if track_str:
                # Handle formats like "1/10" or just "1"
                try:
                    track_num = int(track_str.split('/')[0])
                except (ValueError, AttributeError):
                    pass
        
        return artist, album, title, duration, track_num
    except Exception as e:
        logger.debug(f"Failed to extract metadata from {filename}: {e}")
        return None, None, None, None, None


def scan_library(music_dir: str) -> Tuple[Dict[str, Track], List[str]]:
    tracks: Dict[str, Track] = {}
    order: List[str] = []

    music_dir = os.path.abspath(music_dir)
    logger.info(f"Scanning: {music_dir}")

    folder_count = 0
    for root, _, files in os.walk(music_dir):
        audio_files = [f for f in files if os.path.splitext(f)[1].lower() in AUDIO_EXTS]
        if not audio_files:
            continue

        folder_count += 1
        folder_rel = os.path.relpath(root, music_dir)
        logger.info(f"  Folder {folder_count}: {folder_rel} ({len(audio_files)} audio files)")

        folder_cover = _find_folder_cover(root)
        for fn in sorted(audio_files):
            abs_path = os.path.join(root, fn)
            rel_path = os.path.relpath(abs_path, music_dir)
            tid = _track_id(rel_path)

            ext = os.path.splitext(fn)[1].lower().lstrip(".")
            cover_rel = None
            if folder_cover is not None:
                cover_rel = os.path.relpath(folder_cover, music_dir)
            
            # Extract metadata
            artist, album, title, duration, track_number = _extract_metadata(abs_path, fn)
            
            # If title is not available, use filename without extension
            if not title:
                title = os.path.splitext(fn)[0]

            track = Track(
                id=tid,
                rel_path=rel_path,
                filename=fn,
                folder=folder_rel if folder_rel != "." else "",
                ext=ext,
                cover_rel_path=cover_rel,
                artist=artist,
                album=album,
                title=title,
                duration=duration,
                track_number=track_number,
            )
            tracks[tid] = track
            order.append(tid)
            logger.debug(f"    - {fn} (id: {tid[:8]}...)")

    logger.info(f"Scan complete: {len(tracks)} tracks from {folder_count} folders")
    return tracks, order
