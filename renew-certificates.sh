#!/bin/bash

# Manual certificate renewal script
# Normally certificates auto-renew via the certbot container
# Use this script if you need to manually trigger renewal

set -e

COMPOSE_FILE="docker-compose.ssl.yml"

echo "### Manually renewing Let's Encrypt certificates ###"
echo ""

# Run certbot renew
docker compose -f $COMPOSE_FILE run --rm certbot renew

# Reload nginx to pick up new certificates
echo ""
echo "### Reloading nginx ###"
docker compose -f $COMPOSE_FILE exec nginx nginx -s reload

echo ""
echo "### Certificate renewal complete ###"
echo ""
