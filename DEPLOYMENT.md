# Deployment Guide

This guide covers deploying the Random Music Server using pre-built Docker images from GitHub Container Registry.

## Prerequisites

- Docker and Docker Compose installed
- A directory containing MP3/FLAC music files
- (Optional) GitHub account to access container registry

## Quick Start with Pre-built Images

The multi-architecture images are automatically built via GitHub Actions and published to GitHub Container Registry. Docker Compose will automatically pull the image when you run `docker compose up`.

### 1. Configure Your Deployment

#### Option A: Using docker-compose.yml (Development)

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and set your music directory:
```bash
MUSIC_DIR_HOST=/run/media/sprinter/OldW/NewMus/  # Your music folder
DATA_DIR=./data
SCAN_ON_START=true
QUEUE_REFRESH_SECONDS=0
```

3. Update `docker-compose.yml` with your GitHub username:
```yaml
image: ghcr.io/YOUR_GITHUB_USERNAME/randommusicserver:latest
```

4. Start the server (automatically pulls image if not present):
```bash
docker compose up -d
```

#### Option B: Using docker-compose.prod.yml (Production)

1. Copy the production compose file:
```bash
cp docker-compose.prod.yml docker-compose.yml
```

2. Edit `docker-compose.yml` and update:
   - Replace `GITHUB_USERNAME` with your actual GitHub username
   - Replace `/path/to/your/music` with your actual music directory path

3. Start the server (automatically pulls image if not present):
```bash
docker compose up -d
```

### 3. Verify Deployment

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f random-music

# Check health
curl http://localhost:8000/health
```

### 4. Access the Web UI

Open your browser to:
```
http://localhost:8000
```

Or if deploying on a remote server:
```
http://YOUR_SERVER_IP:8000
```

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MUSIC_DIR` | `/music` | Container path for music files |
| `DATA_DIR` | `/data` | Container path for cached covers |
| `SCAN_ON_START` | `true` | Scan music directory on startup |
| `QUEUE_REFRESH_SECONDS` | `0` | Auto-reshuffle interval (0=disabled) |

### Volume Mounts

**Music Directory** (read-only):
```yaml
volumes:
  - /your/music/path:/music:ro
```

**Data Directory** (persistent cache):
```yaml
volumes:
  - ./data:/data
```

## Architecture Support

The pre-built images support:
- **linux/amd64** - Standard x86_64 servers
- **linux/arm64** - ARM 64-bit (Raspberry Pi 4, Apple Silicon)
- **linux/arm/v7** - ARM 32-bit (Raspberry Pi 3)

Docker will automatically pull the correct architecture for your system.

## GitHub Actions CI/CD

Images are automatically built and published when:
- Code is pushed to `main` or `develop` branches
- A version tag is created (e.g., `v1.0.0`)
- Manually triggered via workflow dispatch

### Image Tags

- `latest` - Latest build from main branch
- `main` - Latest build from main branch
- `develop` - Latest build from develop branch
- `v1.0.0` - Specific version tags
- `1.0` - Major.minor version
- `1` - Major version

### Using Specific Versions

```yaml
# Use latest stable
image: ghcr.io/GITHUB_USERNAME/randommusicserver:latest

# Use specific version
image: ghcr.io/GITHUB_USERNAME/randommusicserver:v1.0.0

# Use development version
image: ghcr.io/GITHUB_USERNAME/randommusicserver:develop
```

## Building Locally (Optional)

If you prefer to build the image yourself:

```bash
# Edit docker-compose.yml and uncomment the build line:
# build: .

# Then build and start
docker compose up --build -d
```

## Updating

```bash
# Pull latest image
docker compose pull

# Restart with new image
docker compose up -d

# Clean up old images
docker image prune -f
```

## Troubleshooting

### Image Pull Fails

If the image is in a private repository:

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Then pull
docker compose pull
```

### Permission Issues

Ensure the data directory is writable:
```bash
mkdir -p ./data
chmod 755 ./data
```

### Music Not Found

Check volume mount in logs:
```bash
docker compose logs random-music | grep "Scanning"
```

Verify the path is correct:
```bash
docker compose exec random-music ls -la /music
```

### Port Already in Use

Change the port mapping in `docker-compose.yml`:
```yaml
ports:
  - "8080:8000"  # Use port 8080 instead
```

## Production Recommendations

### 1. Use a Reverse Proxy

Example with Nginx:
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

### 2. Enable HTTPS

Use Let's Encrypt with Certbot or Caddy for automatic HTTPS.

### 3. Resource Limits

Add to `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      memory: 256M
```

### 4. Logging

Configure log rotation:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 5. Backup

Regularly backup the data directory:
```bash
tar -czf music-server-backup-$(date +%Y%m%d).tar.gz ./data
```

## Monitoring

### Health Checks

The container includes a health check endpoint:
```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "tracks": 1234,
  "music_dir": "/music"
}
```

### Docker Health Status

```bash
docker compose ps
# Look for "healthy" status
```

### Logs

```bash
# Follow logs
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100

# Specific service
docker compose logs random-music
```

## Uninstalling

```bash
# Stop and remove containers
docker compose down

# Remove volumes (WARNING: deletes cached covers)
docker compose down -v

# Remove images
docker rmi ghcr.io/GITHUB_USERNAME/randommusicserver:latest
```

## Support

For issues or questions:
1. Check the [main README](README.md)
2. Review logs: `docker compose logs`
3. Open an issue on GitHub
