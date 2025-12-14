# Random Music Server

A lightweight, web-based music player that serves **MP3 + FLAC** from a local directory with browser-based playback and cover art support (embedded or folder images). Features always-random playback with a clean, modern UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.12-blue.svg)
![Docker](https://img.shields.io/badge/docker-multi--arch-blue.svg)

## Features

- 🎵 **Browser-based playback** using HTML5 audio (no server-side transcoding)
- 🎲 **Always-random queue** with automatic shuffling
- 🎨 **Cover art support**:
  - Embedded art extraction from MP3 (ID3) and FLAC metadata
  - Folder image fallback (`cover.*`, `folder.*`, `front.*`)
  - Smart caching for performance
- 🎛️ **Full playback controls**: Previous, Next, Play, Pause, Stop
- 📊 **Queue sidebar**: Shows previous 5 and next 5 tracks
- ⏱️ **Seek bar** with time display
- 🔄 **Auto-advance** to next track
- 🐳 **Multi-architecture Docker support**: amd64, arm64, armv7
- 🔒 **Security**: Path traversal protection, thread-safe operations
- 📡 **Health checks** for container orchestration

## Configuration

Configuration is loaded from `.env` for both local development and Docker Compose.

### Setup

1. Copy the example configuration:

```bash
cp .env.example .env
```

2. Edit `.env` and set your music directory path:

```bash
# Local development
MUSIC_DIR=/path/to/your/music
DATA_DIR=./data
SCAN_ON_START=true
QUEUE_REFRESH_SECONDS=0

# Docker Compose (host path that gets mounted)
MUSIC_DIR_HOST=/path/to/your/music
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MUSIC_DIR` | `/music` | Directory containing music files (MP3/FLAC) |
| `DATA_DIR` | `/data` | Directory for cached cover art and app data |
| `SCAN_ON_START` | `true` | Scan music directory on startup |
| `QUEUE_REFRESH_SECONDS` | `0` | Auto-reshuffle interval (0=disabled) |
| `MUSIC_DIR_HOST` | - | Host path for Docker volume mount |

## Quick Start

### Option 1: Docker Compose with Pre-built Image (Recommended)

Best for production use. Uses pre-built multi-arch images from GitHub Container Registry.

```bash
# 1. Configure your music directory
cp .env.example .env
# Edit .env and set MUSIC_DIR_HOST to your music folder

# 2. Update docker-compose.yml with your GitHub username
# (Replace GITHUB_USERNAME in the image: line)

# 3. Start the server (automatically pulls image if not present)
docker compose up -d

# 4. Open in browser
open http://localhost:8000
```

**See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.**

### Option 2: Local Development

Best for development and testing.

```bash
# 1. Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure (loads .env automatically)
cp .env.example .env
# Edit .env and set MUSIC_DIR to your music folder

# 4. Start the server
./run.sh
# Or manually: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 5. Open in browser
open http://localhost:8000
```

## Docker Images

Multi-architecture Docker images are automatically built via **GitHub Actions** and published to GitHub Container Registry.

**Supported architectures:**
- `linux/amd64` - x86_64 servers
- `linux/arm64` - ARM 64-bit (Raspberry Pi 4, Apple Silicon)
- `linux/arm/v7` - ARM 32-bit (Raspberry Pi 3)

**Available tags:**
- `latest` - Latest stable release
- `main` - Latest from main branch
- `develop` - Development builds
- `v1.0.0` - Specific version tags

Images are built automatically on:
- Push to `main` or `develop` branches
- Version tag creation (e.g., `v1.0.0`)
- Manual workflow dispatch

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Web UI |
| `GET` | `/health` | Health check (returns track count) |
| `GET` | `/api/state` | Current player state + queue sidebar |
| `POST` | `/api/player/next` | Skip to next track |
| `POST` | `/api/player/prev` | Go to previous track |
| `POST` | `/api/player/stop` | Stop playback |
| `POST` | `/api/rescan` | Rescan music library |
| `GET` | `/api/tracks/{id}` | Get track metadata |
| `GET` | `/api/tracks/{id}/stream` | Stream audio file |
| `GET` | `/api/tracks/{id}/cover` | Get cover art |

## Usage Tips

- **Rescan library**: Click "Rescan library" in the UI after adding/removing music files
- **Auto-reshuffle**: Set `QUEUE_REFRESH_SECONDS` to enable periodic queue regeneration
- **Cover art priority**: Embedded art → `cover.*` → `folder.*` → `front.*` → any single image
- **Supported formats**: MP3, FLAC
- **Supported cover formats**: JPG, PNG, WebP, GIF, BMP

## Architecture

```
┌─────────────────┐
│   Browser UI    │  ← HTML5 Audio + Vanilla JS
└────────┬────────┘
         │ HTTP/REST
┌────────▼────────┐
│  FastAPI Server │  ← Python 3.12 + uvicorn
├─────────────────┤
│ Library Scanner │  ← Recursive directory scan
│ Cover Extractor │  ← mutagen (MP3/FLAC metadata)
│ Player State    │  ← Thread-safe random queue
└────────┬────────┘
         │
┌────────▼────────┐
│  Music Files    │  ← Mounted volume (/music)
│  Cached Covers  │  ← Persistent storage (/data)
└─────────────────┘
```

## Troubleshooting

### Music directory not found
```bash
# Check your .env file
cat .env
# Ensure MUSIC_DIR (local) or MUSIC_DIR_HOST (Docker) points to valid directory
```

### No tracks found
```bash
# Check logs
docker compose logs random-music
# Ensure your music directory contains .mp3 or .flac files
```

### Cover art not showing
- Check browser console for 404 errors
- Embedded art requires valid ID3/FLAC metadata
- Folder images must be named `cover.*`, `folder.*`, or `front.*`

### Port already in use
```bash
# Change port in docker-compose.yml
ports:
  - "8080:8000"  # Use 8080 instead
```

## Development

### Local Development

```bash
# Run with auto-reload
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests (when added)
pytest

# Type checking
mypy app/

# Linting
ruff check app/
```

### Building Docker Images Locally

Images are built automatically via GitHub Actions, but you can build locally:

```bash
# Single architecture (your current platform)
docker build -t random-music-server .

# Multi-architecture (requires buildx)
docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 -t random-music-server .
```

### GitHub Actions Workflow

The `.github/workflows/docker-publish.yml` workflow:
1. Builds multi-arch images on push/tag
2. Publishes to GitHub Container Registry
3. Creates attestations for supply chain security
4. Caches layers for faster builds

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Roadmap

- [ ] Playlist management
- [ ] Search/filter tracks
- [ ] Volume control
- [ ] Keyboard shortcuts
- [ ] Dark/light theme toggle
- [ ] Mobile-responsive improvements
- [ ] WebSocket for real-time updates
- [ ] Multiple user sessions

## License

MIT License - feel free to use and modify as needed.
