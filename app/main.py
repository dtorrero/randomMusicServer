from __future__ import annotations

import logging
import mimetypes
import os
import threading
from contextlib import asynccontextmanager
from typing import AsyncIterator, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import DATA_DIR, MUSIC_DIR, QUEUE_REFRESH_SECONDS, SCAN_ON_START
from .covers import ensure_cover_cached
from .library import scan_library
from .models import Track
from .player import PlayerState


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

_tracks: Dict[str, Track] = {}
_track_ids: List[str] = []
_player = PlayerState()
_library_lock = threading.RLock()


class ModeRequest(BaseModel):
    mode: str


class TimeMarginRequest(BaseModel):
    days: int


class DateTypeRequest(BaseModel):
    date_type: str


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting Random Music Server")
    
    if not os.path.exists(MUSIC_DIR):
        logger.error(f"MUSIC_DIR does not exist: {MUSIC_DIR}")
        raise RuntimeError(f"MUSIC_DIR does not exist: {MUSIC_DIR}")
    
    os.makedirs(DATA_DIR, exist_ok=True)
    
    if SCAN_ON_START:
        logger.info(f"Scanning music directory: {MUSIC_DIR}")
        refresh_library()
        logger.info(f"Found {len(_tracks)} tracks")
    
    yield
    
    logger.info("Shutting down Random Music Server")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _abs_music_path(rel_path: str) -> str:
    music_abs = os.path.abspath(MUSIC_DIR)
    full = os.path.abspath(os.path.join(music_abs, rel_path))
    if os.path.commonpath([music_abs, full]) != music_abs:
        raise HTTPException(status_code=400, detail="Invalid path")
    return full


def _guess_audio_mime(ext: str) -> str:
    if ext.lower() == "flac":
        return "audio/flac"
    if ext.lower() == "mp3":
        return "audio/mpeg"
    return mimetypes.guess_type(f"x.{ext}")[0] or "application/octet-stream"


@app.get("/health")
def health() -> dict:
    return {
        "status": "healthy",
        "tracks": len(_tracks),
        "music_dir": MUSIC_DIR,
    }


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    static_index = os.path.join(os.path.dirname(__file__), "..", "static", "index.html")
    static_index = os.path.abspath(static_index)
    with open(static_index, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.post("/api/rescan")
def refresh_library() -> dict:
    global _tracks, _track_ids
    
    logger.info("Starting library rescan")
    tracks, order = scan_library(MUSIC_DIR)
    
    with _library_lock:
        _tracks = tracks
        _track_ids = order
        _player.set_library(_tracks, _track_ids)
    
    logger.info(f"Rescan complete: {len(_tracks)} tracks")
    return {"tracks": len(_tracks)}


@app.get("/api/state")
def state() -> dict:
    _player.maybe_refresh_queue(_track_ids, QUEUE_REFRESH_SECONDS)
    state_data = _player.queue_window(window_size=10)
    # Add mode, time margin, and date type info to state
    state_data["mode"] = _player.get_mode()
    state_data["time_margin_days"] = _player.get_time_margin_days()
    state_data["date_type"] = _player.get_date_type()
    return state_data


@app.get("/api/settings")
def get_settings() -> dict:
    """Get current player settings (mode, time margin, and date type)."""
    return {
        "mode": _player.get_mode(),
        "time_margin_days": _player.get_time_margin_days(),
        "date_type": _player.get_date_type(),
        "available_modes": ["full_random", "recent_albums"],
        "available_time_margins": [7, 14, 30, 90],
        "available_date_types": ["mtime", "btime"]
    }


@app.post("/api/settings/mode")
def set_mode(request: ModeRequest) -> dict:
    """Set the player mode."""
    try:
        _player.set_mode(request.mode, _track_ids)
        return {"ok": True, "mode": request.mode}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/settings/time_margin")
def set_time_margin(request: TimeMarginRequest) -> dict:
    """Set the time margin for recent albums mode."""
    try:
        _player.set_time_margin_days(request.days, _track_ids)
        return {"ok": True, "time_margin_days": request.days}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/settings/date_type")
def set_date_type(request: DateTypeRequest) -> dict:
    """Set the date type for recent albums mode (mtime or btime)."""
    try:
        _player.set_date_type(request.date_type, _track_ids)
        return {"ok": True, "date_type": request.date_type}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/library/info")
def library_info() -> dict:
    """Get information about the scanned library."""
    with _library_lock:
        track_list = []
        for tid in _track_ids:
            t = _tracks.get(tid)
            if t:
                track_list.append({
                    "id": tid,
                    "filename": t.filename,
                    "folder": t.folder,
                    "ext": t.ext
                })
        return {
            "total_tracks": len(_tracks),
            "tracks": track_list
        }


@app.post("/api/player/next")
def player_next() -> dict:
    _player.maybe_refresh_queue(_track_ids, QUEUE_REFRESH_SECONDS)
    tid = _player.next()
    return {"id": tid}


@app.post("/api/player/prev")
def player_prev() -> dict:
    _player.maybe_refresh_queue(_track_ids, QUEUE_REFRESH_SECONDS)
    tid = _player.prev()
    return {"id": tid}


@app.post("/api/player/jump/{track_id}")
def player_jump(track_id: str) -> dict:
    _player.maybe_refresh_queue(_track_ids, QUEUE_REFRESH_SECONDS)
    tid = _player.jump_to(track_id)
    if tid is None:
        return {"error": "Track not found in queue"}
    return {"id": tid}


@app.post("/api/player/stop")
def player_stop() -> dict:
    _player.stop()
    return {"ok": True}


@app.get("/api/tracks/{track_id}")
def get_track(track_id: str) -> dict:
    with _library_lock:
        t = _tracks.get(track_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": t.id,
        "rel_path": t.rel_path,
        "filename": t.filename,
        "folder": t.folder,
        "ext": t.ext,
        "artist": t.artist,
        "album": t.album,
        "title": t.title,
        "duration": t.duration,
        "track_number": t.track_number,
    }


@app.get("/api/tracks/{track_id}/stream")
def stream_track(track_id: str) -> FileResponse:
    with _library_lock:
        t = _tracks.get(track_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Not found")

    abs_path = _abs_music_path(t.rel_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="File missing")

    return FileResponse(
        abs_path,
        media_type=_guess_audio_mime(t.ext),
        filename=t.filename,
    )


@app.get("/api/tracks/{track_id}/cover")
def track_cover(track_id: str):
    with _library_lock:
        t = _tracks.get(track_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Not found")

    # Prefer embedded cover, cache it to DATA_DIR.
    abs_audio = _abs_music_path(t.rel_path)
    cached = ensure_cover_cached(data_dir=DATA_DIR, track_id=t.id, audio_abs_path=abs_audio)
    if cached is not None and os.path.exists(cached):
        return FileResponse(cached)

    # Fallback to folder cover image.
    if t.cover_rel_path is None:
        raise HTTPException(status_code=404, detail="No cover")

    abs_cover = _abs_music_path(t.cover_rel_path)
    if not os.path.exists(abs_cover):
        raise HTTPException(status_code=404, detail="No cover")

    return FileResponse(abs_cover)


static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
app.mount("/static", StaticFiles(directory=static_dir), name="static")
