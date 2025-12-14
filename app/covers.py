from __future__ import annotations

import os
from typing import Optional, Tuple

from mutagen import File as MutagenFile


def _safe_mkdir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _guess_ext_from_mime(mime: Optional[str]) -> str:
    if not mime:
        return ".jpg"
    m = mime.lower().strip()
    if m in {"image/jpeg", "image/jpg"}:
        return ".jpg"
    if m == "image/png":
        return ".png"
    if m == "image/webp":
        return ".webp"
    if m == "image/gif":
        return ".gif"
    if m == "image/bmp":
        return ".bmp"
    return ".jpg"


def extract_embedded_cover(audio_abs_path: str) -> Optional[Tuple[bytes, str]]:
    try:
        mf = MutagenFile(audio_abs_path)
    except Exception:
        return None
    
    if mf is None:
        return None

    # MP3 (ID3 APIC)
    tags = getattr(mf, "tags", None)
    if tags is not None and hasattr(tags, "getall"):
        apics = tags.getall("APIC")
        if apics:
            apic = apics[0]
            mime = getattr(apic, "mime", None)
            data = getattr(apic, "data", None)
            if isinstance(data, (bytes, bytearray)):
                return (bytes(data), _guess_ext_from_mime(mime))

    # FLAC pictures
    pictures = getattr(mf, "pictures", None)
    if pictures:
        pic = pictures[0]
        data = getattr(pic, "data", None)
        mime = getattr(pic, "mime", None)
        if isinstance(data, (bytes, bytearray)):
            return (bytes(data), _guess_ext_from_mime(mime))

    return None


def ensure_cover_cached(
    *,
    data_dir: str,
    track_id: str,
    audio_abs_path: str,
) -> Optional[str]:
    covers_dir = os.path.join(data_dir, "covers")
    _safe_mkdir(covers_dir)

    # Already cached? (any extension)
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"):
        candidate = os.path.join(covers_dir, f"{track_id}{ext}")
        if os.path.exists(candidate):
            return candidate

    embedded = extract_embedded_cover(audio_abs_path)
    if embedded is None:
        return None

    data, ext = embedded
    out_path = os.path.join(covers_dir, f"{track_id}{ext}")
    with open(out_path, "wb") as f:
        f.write(data)

    return out_path
