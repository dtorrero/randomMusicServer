import os


def _get_env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


MUSIC_DIR = os.getenv("MUSIC_DIR", "/music")
DATA_DIR = os.getenv("DATA_DIR", "/data")
SCAN_ON_START = _get_env_bool("SCAN_ON_START", True)

# In-memory only by default. If enabled, the queue will be re-generated periodically.
QUEUE_REFRESH_SECONDS = int(os.getenv("QUEUE_REFRESH_SECONDS", "0"))
