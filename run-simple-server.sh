#!/bin/bash
# Simple script to run Random Music Server without SSL

set -e

echo "=== Random Music Server Simple Setup ==="
echo "Running without SSL, nginx, or certbot"
echo ""

# Check if podman is available
if ! command -v podman &> /dev/null; then
    echo "Error: podman is not installed or not in PATH"
    exit 1
fi

# Default values
PORT=8000
IMAGE="ghcr.io/dtorrero/randommusicserver:latest"
CONTAINER_NAME="random-music-server"
DATA_DIR="./data"

# Ask for music directory
read -p "Enter path to your music directory: " MUSIC_DIR
if [ ! -d "$MUSIC_DIR" ]; then
    echo "Warning: Music directory '$MUSIC_DIR' does not exist"
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

echo ""
echo "Configuration:"
echo "  Container name: $CONTAINER_NAME"
echo "  Port: $PORT"
echo "  Image: $IMAGE"
echo "  Music directory: $MUSIC_DIR"
echo "  Data directory: $DATA_DIR"
echo "  SCAN_ON_START: false (for faster startup)"
echo ""

# Stop and remove existing container if it exists
if podman ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping existing container..."
    podman stop "$CONTAINER_NAME" 2>/dev/null || true
    echo "Removing existing container..."
    podman rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# Pull latest image
echo "Pulling latest image..."
podman pull "$IMAGE"

# Run new container
echo "Starting new container..."
podman run -d \
  --name "$CONTAINER_NAME" \
  -p "$PORT:8000" \
  -v "$MUSIC_DIR:/music:ro" \
  -v "$DATA_DIR:/data" \
  -e MUSIC_DIR=/music \
  -e DATA_DIR=/data \
  -e SCAN_ON_START=false \
  -e QUEUE_REFRESH_SECONDS=0 \
  --restart unless-stopped \
  "$IMAGE"

echo ""
echo "=== Container started successfully! ==="
echo ""
echo "Server is running at: http://localhost:$PORT"
echo ""
echo "To view logs:"
echo "  podman logs -f $CONTAINER_NAME"
echo ""
echo "To stop the server:"
echo "  podman stop $CONTAINER_NAME"
echo ""
echo "To restart:"
echo "  podman restart $CONTAINER_NAME"
echo ""
echo "To update in the future:"
echo "  podman pull $IMAGE"
echo "  podman stop $CONTAINER_NAME"
echo "  podman rm $CONTAINER_NAME"
echo "  Then run this script again"
