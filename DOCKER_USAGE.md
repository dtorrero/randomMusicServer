# Docker Usage Guide

## Quick Start

### 1. Edit Configuration

Open `docker-compose.yml` and update the volumes section with your music directory path:

```yaml
volumes:
  # CHANGE THIS to your music directory
  - /path/to/your/music:/music:ro
  # Example for Linux:
  # - /home/username/Music:/music:ro
  # Example for macOS:
  # - /Users/username/Music:/music:ro
  # Example for Windows:
  # - C:/Users/username/Music:/music:ro
  
  # Data directory (leave as-is or change to absolute path)
  - ./data:/data
```

### 2. Start the Server

```bash
docker compose up -d
```

The first time you run this, Docker will:
1. Pull the pre-built image from GitHub Container Registry
2. Create the container
3. Start the music server

### 3. Access the Player

Open your browser and navigate to:
```
http://localhost:8000
```

Or from another device on your network:
```
http://YOUR_SERVER_IP:8000
```

## Management Commands

### View Logs
```bash
docker compose logs -f
```

### Stop the Server
```bash
docker compose down
```

### Restart the Server
```bash
docker compose restart
```

### Update to Latest Version
```bash
docker compose pull
docker compose up -d
```

### Check Status
```bash
docker compose ps
```

## Configuration Options

All configuration is done in `docker-compose.yml` under the `environment` section:

```yaml
environment:
  # Scan library on startup (recommended: true)
  - SCAN_ON_START=true
  
  # Auto-reshuffle queue after N seconds (0 = disabled)
  - QUEUE_REFRESH_SECONDS=0
```

### SCAN_ON_START
- `true`: Scans music directory every time container starts
- `false`: Only scans on first start (faster restarts, but won't detect new music)

### QUEUE_REFRESH_SECONDS
- `0`: Queue never reshuffles (recommended)
- `3600`: Reshuffle every hour
- `86400`: Reshuffle every day

## Supported Platforms

The image `ghcr.io/dtorrero/random-music-server:latest` is multi-architecture and supports:

- **Linux**: amd64, arm64, armv7
- **macOS**: Intel (amd64) and Apple Silicon (arm64)
- **Raspberry Pi**: All models (armv7, arm64)
- **Windows**: amd64 (via Docker Desktop)

Docker automatically pulls the correct architecture for your system.

## Troubleshooting

### Container Won't Start

Check logs:
```bash
docker compose logs
```

Common issues:
- **Music directory doesn't exist**: Verify the path in `volumes` section
- **Permission denied**: Ensure Docker has access to the music directory
- **Port already in use**: Change `8000:8000` to `8001:8000` (or another port)

### Music Not Showing Up

1. Check if files are MP3 or FLAC format
2. Verify the volume mount is correct:
   ```bash
   docker compose exec random-music ls /music
   ```
3. Trigger a rescan:
   - Click "🔄 Refresh Queue" in the web interface
   - Or restart the container: `docker compose restart`

### Can't Access from Other Devices

1. Check firewall settings on the host machine
2. Verify the server is listening on all interfaces (it should be by default)
3. Use the host machine's IP address, not `localhost`

## Data Persistence

The `./data` directory stores:
- Cached cover art (extracted from audio files)
- Application state

This directory is created automatically and persists between container restarts.

To reset the cache:
```bash
docker compose down
rm -rf ./data
docker compose up -d
```

## Security Notes

- Music directory is mounted **read-only** (`:ro`) for safety
- The server runs on port 8000 by default
- No authentication is built-in - use a reverse proxy (nginx, Caddy) if exposing to the internet
- Consider using a VPN or firewall rules to restrict access

## Advanced: Using a Reverse Proxy

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name music.example.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Example Caddy configuration:

```
music.example.com {
    reverse_proxy localhost:8000
}
```
