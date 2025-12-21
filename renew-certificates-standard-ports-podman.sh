#!/bin/bash

# Manual certificate renewal script for standard ports setup - Podman version

set -e

COMPOSE_FILE="docker-compose.ssl-standard-ports.yml"

echo "### Renewing Let's Encrypt certificates (Podman) ###"

# Renew certificates
podman-compose -f $COMPOSE_FILE run --rm certbot renew

# Reload nginx to use renewed certificates
podman-compose -f $COMPOSE_FILE exec nginx nginx -s reload

echo "### Certificates renewed successfully ###"
